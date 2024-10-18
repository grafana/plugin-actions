# Bundle plugin action

This GitHub Action automates the process of bundling Grafana plugins typescript types for sharing with other plugins. It takes the source code of a Grafana plugin and outputs a typescript declaration file.

## Features

- Builds a Grafana plugin source typescript file into a single typescript declaration file.
- Supports bundling and treeshaking imported types.

## Usage

- Add this workflow to your Github repository as in the example.
- Set up the necessary environment variables and secrets, including the Grafana access token policy (if signing is desired).
- Create a git tag with the same version as the package.json version that you want to build and create a release.
- Push the git tag to trigger the action.
- The action will build the plugin, create an archive, and generate a draft release based on the package.json version.

NOTE: the package.json version and the git tag must match. You can use `yarn version` or `npm version` to set the correct version and create the git tag.

## Workflow example

```yaml
name: Bundle Types

on:
  push:
    branches:
      - main

jobs:
  bundle-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/bundle-types@main
```

## Options

- `entryPoint`: Location of types file to bundle. Defaults to `"./src/types/index.ts"`
- `tsConfig`: A path to the tsconfig file to use when bundling types.
