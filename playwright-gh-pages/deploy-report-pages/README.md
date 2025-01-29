# Publish to GitHub Pages Action

This GitHub Action automates the process of publishing test artifacts to GitHub Pages and commenting on the pull request with the results and links. It is designed to work together with the `upload-report-artifacts` action.

## Usage

See full blown examples [here](../README.txt).

## Inputs

| Input Name           | Description                                                                    | Required | Default                  |
| -------------------- | ------------------------------------------------------------------------------ | -------- | ------------------------ |
| `github-token`       | Token for the repository. Can be passed in using `{{ secrets.GITHUB_TOKEN }}`. | Yes      | N/A                      |
| `retention-days`     | Number of days to retain the reports.                                          | Yes      | 30                       |
| `pr-comment-summary` | Whether to comment the PR with the test results.                               | Yes      | true                     |
| `artifact-pattern`   | Pattern to match the artifacts.                                                | Yes      | `gf-playwright-report-*` |
