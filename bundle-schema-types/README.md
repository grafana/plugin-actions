# Bundle Schema Types action

This GitHub Action automates the process of downloading the Grafana plugin schema and generating TypeScript types for sharing with other plugins. It downloads the latest plugin schema from Grafana's repository and generates TypeScript declaration files using json-schema-to-typescript.

> [!IMPORTANT]
> This action is only available to plugins that live within the grafana github organization. Attempting to use this action in a plugin whos source code lives outside the grafana github org will fail.

## Features

- Downloads the latest Grafana plugin schema from the official repository
- Generates TypeScript types from the JSON schema using json-schema-to-typescript
- Updates the types in the `@grafana/plugin-extension-types` repository
- On successful generation opens a PR in the `@grafana/plugin-extension-types` repo set to auto merge

## Usage

- Add this workflow to your Github repository (see example below).
- The action will download the plugin schema, generate TypeScript types, clone the `@grafana/plugin-extension-types` repo, create a branch, open a PR in the repo set to auto merge.

## Workflow example

>[!NOTE]
> The example below uses workflow_dispatch to manually update schema types. Consider how releases work within your plugin and set the event accordingly.

```yaml
name: Bundle Schema Types

on:
  workflow_dispatch:

# These permissions are needed to assume roles from Github's OIDC.
permissions:
  contents: read
  id-token: write

jobs:
  bundle-schema-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/bundle-schema-types@main
```

## Options

- `node-version`: The version of node to use with the action. Defaults to `24`.
