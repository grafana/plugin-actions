# Deploy Report Artifacts Action

This GitHub Action automates the process of uploading test reports and summaries as GitHub artifacts. It is designed to work together with the `deploy-report-pages` action to publish the reports to GitHub Pages.

## Usage

See full blown examples [here](../README.txt).

## Inputs

| Input Name                | Description                                                                 | Required | Default                  |
|---------------------------|-----------------------------------------------------------------------------|----------|--------------------------|
| `github-token`            | Token for the repository. Can be passed in using `{{ secrets.GITHUB_TOKEN }}`.| Yes      | `${{ github.token }}`    |
| `test-outcome`            | Outcome of the test step. For example `{{ steps.run-tests.outcome }}`.       | Yes      | N/A                      |
| `grafana-image`           | Grafana image used in the test. Default is `{{ matrix.GRAFANA_IMAGE.NAME }}`.| Yes      | `${{ matrix.GRAFANA_IMAGE.NAME }}` |
| `grafana-version`         | Grafana version used in the test. Default is `{{ matrix.GRAFANA_IMAGE.VERSION }}`.| Yes      | `${{ matrix.GRAFANA_IMAGE.VERSION }}` |
| `artifact-prefix`         | Pattern to prefix the artifact with. Default is "playwright-report-".        | No       | `playwright-report-`     |
| `upload-successful-reports`| Whether to upload the report if all tests were successful.                  | No       | `false`                  |
| `report-dir`              | Directory in which the report is stored. Default is "playwright-report".     | Yes      | `playwright-report`      |
| `plugin-name`             | Name of the plugin being tested. Useful in for example mono-repos when multiple plugins are tested generating multiple reports. | No | N/A |
