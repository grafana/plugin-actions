# Build plugin action

This GitHub Action automates the process of building Grafana plugins. It takes the source code of a Grafana plugin and transforms it into an archive file, preparing it for distribution. It creates a github draft release for the plugin, allowing for easy management.

## Features

- Builds Grafana plugin source code into an archive for distribution.
- Generates a draft Github release for the plugin.
- Supports signing the plugin if a Grafana access token policy is provided.

## Usage

- Add this workflow to your Github repository as in the example.
- Set up the necessary environment variables and secrets, including the Grafana access token policy (if signing is desired).
- Create a git tag with the same version as the package.json version that you want to build and create a release.
- Push the git tag to trigger the action.
- The action will build the plugin, create an archive, and generate a draft release based on the package.json version.

NOTE: the package.json version and the git tag must match. You can use `yarn version` or `npm version` to set the correct version and create the git tag.

## Workflow example

```yaml
name: Release

on:
  push:
    tags:
      - "v*" # Run workflow on version tags, e.g. v1.0.0.

# necessary to create releases
permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/build-plugin@main
        with:
          # see https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token to generate it
          # save the value in your repository secrets
          policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}
```

## Options

- `policy_token`: Grafana access policy token. https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token
- `grafana_token`: [deprecated] Grafana API Key to sign a plugin. Prefer `policy_token`. See https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin
