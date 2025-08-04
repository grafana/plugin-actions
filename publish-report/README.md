# Publish Playwright report

> **_IMPORTANT:_** This action is only for repositories under the `grafana` organisation.

This Action publishes Playwright reports to the `releng-pipeline-artifacts-dev` bucket in GCS. It authenticates to GCP using the `artifacts-uploader-service-account` service account secret which is defined in Vault. Only repositories within the Grafana organization has permissions to pull this secret, so this Action is not usable for respositories outside the organization.

The report will be published to the following path inside the bucket: `<repository-name>/<pr-number>/<grafana-version>/index.html`. If the report was successfully published, a link to the report is added to the Github workflow summary.

## Inputs

### `grafana-version` (required)

The Grafana version that was used in the test session that generated the report.

### `path` (optional)

The path to the folder that contains the files that you would like to upload. If `path` argument is not provided, it's assumed that the report is in the `playwright-report` folder which is the default report output path for Playwright.

## How to use?

A Playwright report is only generated in case Playwright tests were executed, so you may want to add a condition to the `publish-report` step that ensures the workflow wasn't cancelled before the execution of the tests took place. Since this Action only works for repositories in the Grafana organization, you can include a check for that in the step condition too.

### Using the default report path.
<!-- x-release-please-start-version -->
```yml
- name: Publish report to GCS
if: ${{ (always() && steps.run-tests.outcome == 'success') || (failure() && steps.run-tests.outcome == 'failure') && github.event.organization.login == 'grafana' }}
uses: grafana/plugin-actions/publish-report@publish-report/v1.0.2
with:
    grafana-version: ${{ matrix.GRAFANA_IMAGE.VERSION }}
```
<!-- x-release-please-end-version -->
### Using a custom report path.
<!-- x-release-please-start-version -->
```yml
- name: Publish report to GCS
if: ${{ (always() && steps.run-tests.outcome == 'success') || (failure() && steps.run-tests.outcome == 'failure') && github.event.organization.login == 'grafana' }}
uses: grafana/plugin-actions/publish-report@publish-report/v1.0.2
with:
    grafana-version: ${{ matrix.GRAFANA_IMAGE.VERSION }}
    directory: packages/grafana-datasource/playwright-report/
```
<!-- x-release-please-end-version -->
