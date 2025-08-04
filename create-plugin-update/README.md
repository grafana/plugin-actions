# Create plugin update action

This GitHub Action automates the process of running `create-plugin update` within your plugins repository. It checks the current create-plugin version against latest and if there is a newer version available it will create a branch, run create-plugin update, update the node lock file, and open a PR with the changes.

## Features

- Checks the latest version of create-plugin against the current create-plugin configs in the repository
- If changes are required opens a PR which contains the updates from create-plugin along with lock file changes.
- Will update and rebase any open PR whenever a newer version of create-plugin is released.

## Usage

- Add a workflow to your Github repository as in the example below.
- Set up the necessary secrets. As this action will push to and open a PR in the plugins repository make sure the token you supply has the correct privileges.

## Workflow example
<!-- x-release-please-start-version -->

```yaml
name: Create Plugin Update

on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 1 * *' # run once a month on the 1st day

# To use the default github token with the following elevated permissions make sure to check:
# **Allow GitHub Actions to create and approve pull requests** in https://github.com/USER_NAME/REPO_NAME/settings/actions.
# Alternatively create a fine-grained personal access token for your repository with `contents: read and write` and `pull requests: read and write` and pass it to the action.

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: grafana/plugin-actions/create-plugin-update@create-plugin-update/v1.0.2
```
<!-- x-release-please-end-version -->

## Options

The following options can be passed to this action:

- `token`: A github token with write access to pull requests and content (defaults to `github.token`).
- `base`: The base branch to open the pull request against (defaults to `main`).
- `node-version`: The version of node to use (defaults to `20`).
