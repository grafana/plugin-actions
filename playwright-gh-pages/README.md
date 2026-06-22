# Publishing Playwright reports to Google Cloud Storage

When testing a Grafana plugin using the [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) package, it is highly recommended to run tests against a matrix of Grafana versions (as demonstrated in this [example](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/ci) in the documentation). Each test run in this matrix generates an HTML report. By uploading these reports to Google Cloud Storage, they become immediately accessible for direct browsing by Grafana staff, eliminating the need to download and serve them locally.

This set of GitHub Actions streamlines the process of managing Playwright test reports. It automates uploading reports as artifacts, publishing them to GCS, and providing links in pull request comments.

## Overview

The workflow consists of two main actions:

1. **Upload Report Artifacts Action**: Uploads test reports and summaries as GitHub artifacts. Used together with the `deploy-report-pages` action to publish the reports to GCS.
2. **Deploy Playwright Reports to GCS Action**: Uploads the test artifacts to Google Cloud Storage and comments on the pull request with the results and corresponding links.

## Features

- **Upload Report Artifacts Action**:

  - Uploads test reports and summaries as GitHub artifacts.
  - Supports conditional uploading based on test outcomes.
  - Structures reports in a well-organized directory format, ensuring uniqueness for each test setup.

- **Deploy Playwright Reports to GCS Action**:
  - Downloads test artifacts and uploads them to Google Cloud Storage.
  - Comments on the pull request with the test results and links to the reports.
  - Reports are retained for **90 days** via the bucket's object lifecycle policy.

## GCS Bucket Configuration

Reports are uploaded to a Grafana-managed GCS bucket. Each report is stored at the path:

```
gs://{bucket}/{owner}/{repo}/{YYYYMMDD}/{pr-number-or-run-id}/{matrix-dir}/
```

The bucket must be provisioned by Grafana infra with:

- **Object lifecycle rule** — auto-delete objects after 90 days.
- **IAM** — `roles/storage.objectViewer` granted to the Grafana Google Workspace group; uniform bucket-level access enabled.
- **WIF write access** — the GitHub Actions service account used by Grafana's org-wide Workload Identity provider must have object create/write on the bucket.

## Viewing Reports

Report links in PR comments point to `https://storage.cloud.google.com/{bucket}/...`. Viewing them requires being signed into a Google account that is a member of the Grafana Google Workspace group. Users not in the group will see a 403 error.

## Permissions Needed

Use job-scoped permissions instead of granting write access to the entire workflow:

- Set `contents: read` at the workflow level so test jobs can check out the repository.
- Add `id-token: write` only to the job that publishes reports to GCS (required for Workload Identity Federation authentication).
- Add `pull-requests: write` only if you want `deploy-report-pages` to manage a pull request comment. This permission is not needed when `pr-comment-summary: false`.

Note: `contents: write` is **not** required. This action does not push to any branch.

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
  contents: read

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
          test-outcome: ${{ steps.run-tests.outcome }}

  deploy-reports:
    if: ${{ always() && !cancelled() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) }}
    needs: [playwright-tests]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      pull-requests: write
    steps:
      # use deploy-report-pages Action to upload the artifacts to GCS
      - name: Publish report
        uses: grafana/plugin-actions/playwright-gh-pages/deploy-report-pages@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          bucket: your-gcs-bucket-name
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
  contents: read

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

  deploy-reports:
    if: ${{ always() && !cancelled() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) }}
    needs: [e2e]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      pull-requests: write
    steps:
      # use deploy-report-pages Action to upload the artifacts to GCS
      - name: Publish report
        uses: grafana/plugin-actions/playwright-gh-pages/deploy-report-pages@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          bucket: your-gcs-bucket-name
```

## Inputs

For details on available inputs for the Actions, refer to the [README](./deploy-report-pages/README.md) of `deploy-report-pages` and the [README](./upload-report-artifacts/README.md) of `upload-report-artifacts`.

If you want to skip publishing for forked pull requests while still allowing scheduled runs, pushes, and same-repository pull requests, use this condition on the publish job:

```yaml
if: ${{ always() && !cancelled() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) }}
```
