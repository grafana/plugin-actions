# Package plugin action

This GitHub Action automates the process of packaging Grafana plugins. It takes the source code of a Grafana plugin and transforms it into an archive file, preparing it for distribution.

## Features

- Builds Grafana plugin source code into an archive for distribution.
- Supports signing the plugin if a Grafana access token policy is provided.

## Usage

- Add this workflow to your GitHub repository as in the example.
- Set up the necessary environment variables and secrets, including the Grafana access token policy (if signing is desired).
- The action will build the plugin and create an archive that can be used by further steps of your workflow.

## Examples

### Package and upload the plugin

This workflow will trigger on pushes to the `main` branch. Use this workflow if you want to build plugins from your `main` branch as artifacts without creating a release.

To build, package and release in a single action use [build-plugin](https://github.com/grafana/plugin-actions/tree/main/build-plugin)
<!-- x-release-please-start-version -->
```yaml
name: Package plugin and upload artifact

on:
  workflow_dispatch:
  push:
    branches:
      - main # Run workflow on pushes to `main`

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/package-plugin@package-plugin/v1.0.2
        id: 'package-plugin'
        with:
          # see https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token to generate it
          # save the value in your repository secrets
          policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}

      - id: 'auth'
        uses: 'google-github-actions/auth@v2'
        with:
          credentials_json: ${{ env.GCP_UPLOAD_ARTIFACTS_KEY }}

      - name: 'rename versioned archive to main-archive'
        run: mv ${{ steps.package-plugin.outputs.archive }} ${{ steps.package-plugin.outputs.plugin-id }}-main.zip

      - id: 'upload-to-gcs'
        name: 'Upload assets to main'
        uses: 'google-github-actions/upload-cloud-storage@v1'
        with:
          path: ./
          destination: 'your-bucket-name/'
          glob: '*.zip'
          parent: false
```
<!-- x-release-please-end-version -->
## Options

- `policy_token`: Grafana access policy token. https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token
