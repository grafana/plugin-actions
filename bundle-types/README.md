# Bundle plugin types action

This GitHub Action automates the process of bundling Grafana plugins typescript types for sharing with other plugins. It takes the source code of a Grafana plugin and outputs a typescript declaration file.

> [!IMPORTANT]
> This action is only available to plugins that live within the grafana github organization. Attempting to use this action in a plugin whos source code lives outside the grafana github org will fail.

## Features

- Builds a Grafana plugin source typescript file into a single typescript declaration file.
- Supports bundling and treeshaking imported types.
- On successful build opens a PR in the `@grafana/plugin-types` repo set to auto merge.

## Usage

- Add this workflow to your Github repository (see example below).
- The action will build the plugin types file, clone the `@grafana/plugin-types` repo, create a branch, open a PR in the repo set to auto merge. The branch name and PR will be associated to your plugins id and version at time of checkout.

## Workflow example

>[!NOTE]
> The example below uses workflow_dispatch to manually release new types. Consider how releases work within your plugin and set the event accordingly.
<!-- x-release-please-start-version -->

```yaml
name: Bundle Types

on:
  workflow_dispatch:

# These permissions are needed to assume roles from Github's OIDC.
permissions:
  contents: read
  id-token: write

jobs:
  bundle-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/bundle-types@bundle-types/v1.0.2
```
<!-- x-release-please-end-version -->

## Options

- `entry-point`: The location of types file to bundle. Defaults to `"./src/types/index.ts"`.
- `ts-config`: A path to the tsconfig file to use when bundling types.
- `node-version`: The version of node to use with the action. Defaults to `20`.
- `plugin-json-path`: The path to your plugins `plugin.json` file. Used to extract the plugin id. Defaults to `"src/plugin.json"`.
- `package-json-path`: The path to your plugins `package.json` file. Used to extract the plugin version. Defaults to `"package.json"`.
