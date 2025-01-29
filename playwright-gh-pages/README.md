# Publishing Playwright reports to Github Pages

When testing a Grafana plugin using the [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) package, it is highly recommended to run tests against a matrix of Grafana versions (as demonstrated in this [example](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/ci) in the documentation). Each test run in this matrix generates an HTML report. By uploading these reports to a static site hosting service, they become immediately accessible for direct browsing, eliminating the need to download and serve them locally. This enhances productivity and fosters collaborative troubleshooting by making the results easily shareable and reviewable.

This set of GitHub Actions streamlines the process of managing Playwright test reports. It automates uploading reports as artifacts, publishing them to GitHub Pages, and providing links in pull request comments. These actions work seamlessly together, enhancing collaboration, traceability, and test result management.

## Overview

The workflow consists of two main actions:

1. **Upload Report Artifacts Action**: This action uploads test reports and summaries as GitHub artifacts. It can be used together with the `deploy-report-pages` action to publish the reports to GitHub Pages.
2. **Deploy to GitHub Pages Action**: This action publishes the test artifacts to GitHub Pages and comments on the pull request with the results and corresponding links. It also cleans up and deletes old reports based on the specified retention policy.

## Features

- **Upload Report Artifacts Action**:

  - Uploads test reports and summaries as GitHub artifacts.
  - Supports conditional uploading based on test outcomes.
  - Structures reports in a well-organized directory format, ensuring uniqueness for each test setup.

- **Deploy to GitHub Pages Action**:
  - Downloads test artifacts and publishes them to GitHub Pages.
  - Comments on the pull request with the test results and links to the reports.
  - Supports retention of reports for a specified number of days.

## GitHub Pages Branch

By default, the `deploy-report-pages` Action deploys reports to the `gh-pages` branch. However, **you need to take an extra step** to ensure that GitHub Pages can build and serve the site from this branch. To do so:

1. Go to the **Settings** tab of your repository.
2. In the left-hand sidebar, click on **Pages**.
3. Under **Source**, select **Deploy from a branch**, then choose the `gh-pages` branch.

This action needs to be completed **manually** in order for your GitHub Pages site to be built and accessible from the `gh-pages` branch. Once configured, GitHub will automatically build and serve the site whenever new reports are deployed.

## GitHub Pages Visibility

By default, all GitHub Pages sites are publicly accessible on the Internet. However, GitHub Enterprise customers can restrict access by configuring access control for private and internal repositories. This allows greater flexibility in managing who can view your Pages site. For more details, refer to the official GitHub [documentation](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site#about-access-control-for-github-pages-sites).

## Permissions Needed

To use these actions, you need to set up the necessary permissions:

- `contents: write`: This permission is needed to push changes to the repository, such as updating the GitHub Pages branch with the latest test reports.
- `id-token: write`: This permission is required for authentication purposes when interacting with GitHub APIs.
- `pull-requests: write`: This permission allows the action to create and update pull requests with comments containing the test results and links to the reports.

## Workflow usage

### Example using the [resolve-versions](../e2e-version/README.md) Action

This is a simplified workflow example using the [resolve-versions](../e2e-version/README.md) Action which is recommended in the plugin-e2e [docs](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/ci).

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

      # use upload-report-artifacts Action to upload the report and the test summary to GH Artifacts
      - name: Upload e2e test summary
        uses: grafana/plugin-actions/playwright-gh-pages/upload-report-artifacts@main
        if: ${{ (always() && !cancelled()) }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          test-outcome: ${{ steps.run-tests.outcome }}

  deploy-pages:
    if: ${{ (always() && !cancelled()) }}
    needs: [playwright-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # use deploy-report-pages Action to deploy the artifacts to GitHub Pages
      - name: Publish report
        uses: grafana/plugin-actions/playwright-gh-pages/deploy-report-pages@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Example using a per-plugin matrix

The following simplified example demonstrates how Playwright report publishing can be integrated in a mono repo where the matrix is derived for each plugin in the repo.

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
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        plugin-id: ['grafana-panel-sample1', 'grafana-panel-sample2', 'grafana-panel-sample3']
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # necessary steps to install dependencies and build the plugin

      - name: Start Grafana latest
        run: |
          docker compose pull
          DEVELOPMENT=false GRAFANA_VERSION=latest GRAFANA_IMAGE=grafana-enterprise docker compose up -d

      - name: Wait for grafana server
        uses: grafana/plugin-actions/wait-for-grafana@main

      - name: Install Playwright Browsers
        run: npm exec playwright install --with-deps

      - name: Run Playwright tests
        id: run-tests-latest
        run: npm run e2e

      # use upload-report-artifacts Action to upload the report and the test summary to GH Artifacts
      - name: Upload e2e test summary
        uses: grafana/plugin-actions/playwright-gh-pages/upload-report-artifacts@main
        if: ${{ (always() && !cancelled()) }}
        with:
          report-dir: playwright-report
          grafana-version: latest
          grafana-image: grafana-enterprise
          plugin-name: ${{ matrix.plugin-id }}
          test-outcome: ${{ steps.run-tests-latest.outcome }}
      # repeat steps but for another Grafana version if necessary

  deploy-pages:
    if: ${{ (always() && !cancelled()) }}
    needs: [playwright-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # use deploy-report-pages Action to deploy the artifacts to GitHub Pages
      - name: Publish report
        uses: grafana/plugin-actions/playwright-gh-pages/deploy-report-pages@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

For details on what the available inputs for the Actions, refer to the [README](./deploy-report-pages/README.md) of `deploy-report-pages` and the [README](./upload-report-artifacts/README.md) of `upload-report-artifacts`
