# Create plugin update action

This GitHub Action automates the process of running `create-plugin update` within your plugins repository.

## Features

- Checks if

## Usage

- Add this workflow to your Github repository as in the example.
- Set up the necessary environment variables and secrets. You must supply a custom GH token for this action as it will open a PR in your plugins repository.

## Workflow example

```yaml
name: Create Plugin Update

on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * *"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: grafana/plugin-actions/create-plugin-update@main
        with:
          token: ${{ secrets.GH_PAT_TOKEN }}
```

## Options

- `token`: A github . https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token
