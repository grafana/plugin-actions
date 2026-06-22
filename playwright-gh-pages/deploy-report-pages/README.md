# Deploy Playwright Reports to GCS Action

This GitHub Action uploads Playwright test reports to Google Cloud Storage and comments on the pull request with the results and links. It is designed to work together with the `upload-report-artifacts` action.

## Usage

See full examples [here](../README.md).

## Inputs

| Input Name           | Description                                                                                                                                                           | Required | Default                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| `github-token`       | Token for the repository. Pass `${{ secrets.GITHUB_TOKEN }}` from the publish job.                                                                                   | Yes      | N/A                      |
| `pr-comment-summary` | Whether to manage a PR comment with the test results. Set this to `false` if you do not want the action to create or delete PR comments.                              | Yes      | `true`                   |
| `artifact-pattern`   | Pattern to match the artifacts.                                                                                                                                       | Yes      | `gf-playwright-report-*` |
| `bucket`             | GCS bucket name to upload reports to.                                                                                                                                 | Yes      | N/A                      |
