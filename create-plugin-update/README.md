# Create plugin update action

This GitHub Action automates the process of running `create-plugin update` within your plugins repository. It checks the current create-plugin version against latest and if there is a newer version available it will create a branch, run create-plugin update, update the node lock file, and open a PR with the changes.

## Features

- Checks the latest version of create-plugin against the current create-plugin configs in the repository
- If changes are required opens a PR which contains the updates from create-plugin along with lock file changes.
- Will update and rebase any open PR whenever a newer version of create-plugin is released.

## Usage

Detailed setup instructions can be found in the [Grafana developer portal](https://grafana.com/developers/plugin-tools/set-up/set-up-github#the-create-plugin-update-workflow).

- Add a workflow to your Github repository as in the example below.
- Set up the necessary secrets. As this action will push to and open a PR in the plugins repostory create a fine-grained personal access token for your repository with `contents: read and write`, `pull requests: read and write` and `workflows: read and write` and pass it to the action.

## Workflow example

<!-- x-release-please-start-version -->

```yaml
name: Create Plugin Update

on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 1 * *" # run once a month on the 1st day

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: grafana/plugin-actions/create-plugin-update@create-plugin-update/v2.0.1
        with:
          token: ${{ secrets.GH_PAT_TOKEN }}
```

<!-- x-release-please-end-version -->

## Options

The following options can be passed to this action:

- `token`: A github token with write access to `pull requests`, `content` and `workflows` (**required**).
- `base`: The base branch to open the pull request against (defaults to `main`).
- `node-version`: The version of node to use (defaults to `20`).
