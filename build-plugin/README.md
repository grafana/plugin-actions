# Build plugin action

This GitHub Action automates the process of building Grafana plugins. It takes the source code of a Grafana plugin and transforms it into an archive file, preparing it for distribution. It creates a github draft release for the plugin, allowing for easy management.

## Features

- Builds Grafana plugin source code into an archive for distribution.
- Generates a draft Github release for the plugin.
- Supports signing the plugin if a Grafana access token policy is provided.
- Supports creating a [signed build provenance attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds). This guarantees that the plugin was built from the source code provided in the release.
- Optionally generates a changelog for the plugin using [github-changelog-generator](https://github.com/github-changelog-generator/github-changelog-generator)

## Usage

- Add this workflow to your Github repository as in the example.
- Set up the necessary environment variables and secrets, including the Grafana access token policy (if signing is desired).
- Create a git tag with the same version as the package.json version that you want to build and create a release.
- Push the git tag to trigger the action.
- The action will build the plugin, create an archive, generate a draft release based on the package.json version and if you prefer, the action will generate and commit an updated changelog to your repository.

NOTE: the package.json version and the git tag must match. You can use `yarn version` or `npm version` to set the correct version and create the git tag.

## Workflow example
<!-- x-release-please-start-version -->

```yaml
name: Release

on:
  push:
    tags:
      - "v*" # Run workflow on version tags, e.g. v1.0.2.

jobs:
  release:
    permissions:
      id-token: write
      contents: write
      attestations: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/build-plugin@build-plugin/v1.0.2
        with:
          # see https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token to generate it
          # save the value in your repository secrets
          policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}
          # creates a signed build provenance attestation to verify the authenticity of the plugin build
          attestation: true
```
<!-- x-release-please-end-version -->

## Attestation of plugin package

If you pass `attestation: true` to the action, it will create a signed build provenance attestation for the plugin package using github [attest-build-provenance action](https://github.com/actions/attest-build-provenance).

This attestation will be used to verify the authenticity of the plugin package build and ensure that the plugin was built from the source code provided in the release.

### Add attestation to your existing workflow

To add the attestation to your existing workflow, you can use the following steps:

1. Add the `id-token: write` and `attestations: write` permissions to your workflow job.
1. Add the `attestation: true` option to the `build-plugin` action.

e.g.
<!-- x-release-please-start-version -->

```yaml
name: Release

on:
  push:
    tags:
      - "v*" # Run workflow on version tags, e.g. v1.0.2.

jobs:
  release:
    runs-on: ubuntu-latest
    permissions: # new line
      id-token: write # new line
      contents: write # new line
      attestations: write # new line

    steps:
      - uses: actions/checkout@v4

      - uses: grafana/plugin-actions/build-plugin@build-plugin/v1.0.2
        with:
          policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}
          attestation: true # new line
```
<!-- x-release-please-end-version -->

## Changelog Generation

If you pass `use_changelog_generator: true` to the action, it will:

1. Generate a changelog using the [github-changelog-generator](https://github.com/github-changelog-generator/github-changelog-generator) tool
1. Commit the updated changelog back to your repository's default branch

This feature helps maintain a well-documented history of changes for your plugin. The changelog will include information about merged pull requests, closed issues, and any labeled enhancements or features.

### Add changelog generation to your workflow

To enable changelog generation in your workflow:
<!-- x-release-please-start-version -->

```yaml
- uses: grafana/plugin-actions/build-plugin@build-plugin/v1.0.2
  with:
    policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}
    use_changelog_generator: true
```
<!-- x-release-please-end-version -->

Note: This will commit changes to your repository's default branch, so your workflow must have the `contents: write` permission.

### For Protected Branches

If your target branch is protected, the default github.token cannot push changes directly, even with write permissions. In this case, you need to:

1. Create a Personal Access Token (PAT) with appropriate permissions
1. Store it as a repository secret (e.g., CHANGELOG_PAT)
1. Configure the action to use this token:
<!-- x-release-please-start-version -->

```yaml
- name: Build plugin
  uses: grafana/plugin-actions/build-plugin@build-plugin/v1.0.2
  with:
    use_changelog_generator: true
    token: ${{ secrets.CHANGELOG_PAT }}  # Replace default github.token
```
<!-- x-release-please-end-version -->

## Options

- `policy_token`: Grafana access policy token. https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#generate-an-access-policy-token
- `grafana_token`: [deprecated] Grafana API Key to sign a plugin. Prefer `policy_token`. See https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin
- attestation: If `true`, create a verifiable attestation for the plugin using sigstore. See [attestation of plugin package](#attestation-of-plugin-package)
- use_changelog_generator: If `true`, generate a changelog for the plugin and commit it to the repository. See [changelog generation](#changelog-generation)

## Troubleshooting

### Error: Failed to persist attestation: Resource not accessible by integration

You are missing the `attestations: write` permission in your workflow.

See [Add attestation to your existing workflow](#add-attestation-to-your-existing-workflow) for more information.

### Error: Failed to get ID token: Error message: Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable

You are missing the `id-token: write` permission in your workflow.

See [Add attestation to your existing workflow](#add-attestation-to-your-existing-workflow) for more information.

### Error: Resource not accessible by integration - https://docs.github.com/rest/releases/releases#create-a-release

You are missing the `contents: write` permission in your workflow.

### Error: Failed to commit changelog: Resource not accessible by integration
You are using `use_changelog_generator: true` but your workflow doesn't have the required permissions. Make sure you have `contents: write` permission in your workflow. Or check if your default branch is protected - in this case please follow the [instructions for protected branches](#for-protected-branches)
