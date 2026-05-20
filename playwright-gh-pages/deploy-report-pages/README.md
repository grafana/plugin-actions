# Publish to GitHub Pages Action

This GitHub Action automates the process of publishing test artifacts to GitHub Pages and commenting on the pull request with the results and links. It is designed to work together with the `upload-report-artifacts` action.

## Usage

See full blown examples [here](../README.md).

## Inputs

| Input Name           | Description                                                                    | Required | Default                  |
| -------------------- | ------------------------------------------------------------------------------ | -------- | ------------------------ |
| `github-token`       | Token for the repository. Pass `${{ secrets.GITHUB_TOKEN }}` from the publish job. | Yes      | N/A                      |
| `retention-days`     | Number of days to retain the reports.                                          | Yes      | 30                       |
| `pr-comment-summary` | Whether to manage a PR comment with the test results. Set this to `false` if you do not want the action to create or delete PR comments. | Yes      | true                     |
| `artifact-pattern`   | Pattern to match the artifacts.                                                | Yes      | `gf-playwright-report-*` |
| `pages-branch`       | Branch to deploy the reports to.                                               | Yes      | `gh-pages`               |
