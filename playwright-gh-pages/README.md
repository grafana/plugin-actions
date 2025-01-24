# Publishing Playwright reports to Github Pages

When testing a Grafana plugin using the [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) package, it is highly recommended to run tests against a matrix of Grafana versions (as demonstrated in this [example](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/ci) in the documentation). Each test run in this matrix generates an HTML report. By uploading these reports to a static site hosting service, they become immediately accessible for direct browsing, eliminating the need to download and serve them locally. This enhances productivity and fosters collaborative troubleshooting by making the results easily shareable and reviewable.

This set of GitHub Actions streamlines the process of managing Playwright test reports. It automates uploading reports as artifacts, publishing them to GitHub Pages, and providing links in pull request comments. These actions work seamlessly together, enhancing collaboration, traceability, and test result management.

## Overview

The workflow consists of two main actions:

1. **Upload Report Artifacts Action**: This action uploads test reports and summaries as GitHub artifacts. It can be used together with the `publish-report-pages` action to publish the reports to GitHub Pages.
2. **Publish to GitHub Pages Action**: This action publishes the test artifacts to GitHub Pages and comments on the pull request with the results and corresponding links. It also cleans up and deletes old reports based on the specified retention policy.

## Features

- **Upload Report Artifacts Action**:

  - Uploads test reports and summaries as GitHub artifacts.
  - Supports conditional uploading based on test outcomes.
  - Structures reports in a well-organized directory format, ensuring uniqueness for each test setup.

- **Publish to GitHub Pages Action**:
  - Downloads test artifacts and publishes them to GitHub Pages.
  - Comments on the pull request with the test results and links to the reports.
  - Supports retention of reports for a specified number of days.

## Permissions Needed

To use these actions, you need to set up the necessary permissions:

- **contents: write**: This permission is needed to push changes to the repository, such as updating the GitHub Pages branch with the latest test reports.
- **id-token: write**: This permission is required for authentication purposes when interacting with GitHub APIs.
- **pull-requests: write**: This permission allows the action to create and update pull requests with comments containing the test results and links to the reports.

## Workflow Example

This is a simplified workflow example. You may refer to the plugin-e2e [docs](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/ci) for a full example of how to properly build the plugin.

```yaml
name: e2e tests

on:
  pull_request:
    branches:
      - master
      - main

permissions:
  contents: write
  id-token: write
  pull-requests: write

jobs:
  resolve-versions:
    name: Resolve Grafana images
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.resolve-versions.outputs.matrix }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Resolve Grafana E2E versions
        id: resolve-versions
        uses: grafana/plugin-actions/e2e-version@main

  playwright-tests:
    needs: [resolve-versions, build]
    strategy:
      fail-fast: false
      matrix:
        GRAFANA_IMAGE: ${{fromJson(needs.resolve-versions.outputs.matrix)}}
    name: e2e test ${{ matrix.GRAFANA_IMAGE.name }}@${{ matrix.GRAFANA_IMAGE.VERSION }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download plugin
        uses: actions/download-artifact@v4
        with:
          path: dist
          name: ${{ needs.build.outputs.plugin-id }}-${{ needs.build.outputs.plugin-version }}

      - name: Execute permissions on binary
        if: needs.build.outputs.has-backend == 'true'
        run: |
          chmod +x ./dist/gpx_*

      - name: Setup Node.js environment
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dev dependencies
        run: npm ci

      - name: Start Grafana
        run: |
          docker compose pull
          DEVELOPMENT=false GRAFANA_VERSION=${{ matrix.GRAFANA_IMAGE.VERSION }} GRAFANA_IMAGE=${{ matrix.GRAFANA_IMAGE.NAME }} docker compose up -d

      - name: Wait for grafana server
        uses: grafana/plugin-actions/wait-for-grafana@main

      - name: Install Playwright Browsers
        run: npm exec playwright install chromium --with-deps

      - name: Run Playwright tests
        id: run-tests
        run: npm run e2e

      - name: Upload e2e test summary
        uses: grafana/plugin-actions/playwright-gh-pages/upload-report-pages@main
        if: ${{ always() }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          test-outcome: ${{ steps.run-tests.outcome }}

  deploy-pages:
    if: ${{ always() }}
    needs: [playwright-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish report
        uses: grafana/plugin-actions/playwright-gh-pages/deploy-report-artifacts@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

For details on how to
