# Create plugin update action

This GitHub Action automates the process of running `create-plugin update` within your plugins repository.

## Features

- Checks the latest version of create-plugin against the current create-plugin configs in the repository
- If changes are required opens a PR which contains the updates from create-plugin along with lock file changes.
- Will update and rebase any open PR whenever a newer version of create-plugin is released.

## Usage

- Add a workflow to your Github repository as in the example below.
- Set up the necessary secrets. As this action will push to and open a PR in the plugins repository make sure the token you supply has the correct privileges.

## Workflow example

```yaml
name: Create Plugin Update

on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * 0"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: grafana/plugin-actions/create-plugin-update@main
        with:
          token: ${{ secrets.GH_PAT_TOKEN }}
```

## Options

- `token`: A github token with write access to pull requests and content (defaults to `github.token`).
- `base`: The base branch to open the pull request against (defaults to `main`).
- `node-version`: The version of node to use (defaults to `20`).

## Issues

**Error: GitHub Actions is not permitted to create or approve pull requests.**

If you're seeing this error it means the GH token passes to the action doesn't have the necessary privileges to create the pull request. To resolve this you can either:

- Create a Personal Access Token which has the permission to write to both pull-requests and contents for your repository.
- Go to https://github.com/USER_NAME/REPO_NAME/settings/actions and check **Allow GitHub Actions to create and approve pull requests** then add the following to your workflow to elevate the token permissions:

  ```yaml
  permissions:
    contents: write
    pull-requests: write
  ```
