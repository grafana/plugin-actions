# E2E Grafana version resolver

This Action resolves what Grafana image names and versions to use when E2E testing a Grafana plugin in a Github Action.

## Inputs

### `skip-grafana-nightly-image`

By default, this action includes the `grafana-enterprise:nightly` image in the test matrix. To exclude it, set `skip-grafana-nightly-image` to `true`.

> **Deprecated:** The old `skip-grafana-dev-image` input is still accepted as an alias but will be removed in a future release.

### `limit`

The maximum number of versions to resolve. Default is 6, 0 means no limit.

### `plugin-directory`

Only applies when using `plugin-grafana-dependency` mode without a `grafana-dependency` override. Path to the plugin root directory — the directory that contains the `src/plugin.json` file. Defaults to the repository root. Use this when the plugin is in a subdirectory rather than at the root of the repository.

```yaml
- name: Resolve Grafana E2E versions
  id: resolve-versions
  uses: grafana/plugin-actions/e2e-version@e2e-version/v1.2.1
  with:
    version-resolver-type: plugin-grafana-dependency
    plugin-directory: plugin
```

### `version-resolver-type`

The action supports two modes.

**plugin-grafana-dependency (default)**
This will return the `grafana-enterprise:nightly` image and all the latest patch releases of every minor version of Grafana Enterprise that satisfies the range specified in the [dependencies.grafanaDependency](https://grafana.com/developers/plugin-tools/reference/plugin-json#properties-1) property in plugin.json. This requires the plugin.json file to be placed in the `<root>/src` directory. To avoid starting too many jobs, the output will be capped at 6 versions.

### Example

At the time of writing, the most recent release of Grafana is 10.3.1. If the plugin has specified >=8.0.0 as `grafanaDependency` in the plugin.json file, the output would be:

```json
[
  {
    "name": "grafana-enterprise",
    "version": "nightly"
  },
  {
    "name": "grafana-enterprise",
    "version": "10.3.1"
  },
  {
    "name": "grafana-enterprise",
    "version": "10.0.10"
  },
  {
    "name": "grafana-enterprise",
    "version": "9.2.20"
  },
  {
    "name": "grafana-enterprise",
    "version": "8.4.11"
  },
  {
    "name": "grafana-enterprise",
    "version": "8.1.8"
  }
]
```

Please note that the output changes as new versions of Grafana are being released.

**version-support-policy**
Except for including the `grafana-enterprise:nightly` image, this will resolve versions according to Grafana's plugin compatibility support policy. Specifically, it retrieves the latest patch release for each minor version within the current major version of Grafana. Additionally, it includes the most recent release for the latest minor version of the previous major Grafana version.

### Example

At the time of writing, the most recent release of Grafana is 10.2.2. The output for `version-support-policy` would be:

```json
[
  {
    "name": "grafana-enterprise",
    "version": "nightly"
  },
  {
    "name": "grafana-enterprise",
    "version": "10.3.1"
  },
  {
    "name": "grafana-enterprise",
    "version": "10.2.3"
  },
  {
    "name": "grafana-enterprise",
    "version": "10.1.6"
  },
  {
    "name": "grafana-enterprise",
    "version": "10.0.10"
  },
  {
    "name": "grafana-enterprise",
    "version": "9.5.15"
  }
]
```

### Output

The result of this action is a JSON array that lists the latest patch version for each Grafana minor version. These values can be employed to define a version matrix in a subsequent workflow job.

## Workflow example

### plugin-grafana-dependency
<!-- x-release-please-start-version -->

```yaml
name: E2E tests - Playwright
on:
  pull_request:

jobs:
  resolve-versions:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.resolve-versions.outputs.matrix }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Resolve Grafana E2E versions
        id: resolve-versions
        uses: grafana/plugin-actions/e2e-version@e2e-version/v2.0.0
        with:
          # target all minor versions of Grafana that have been released since the version that was specified as grafanaDependency in the plugin
          version-resolver-type: plugin-grafana-dependency

  playwright-tests:
    needs: resolve-versions
    strategy:
      matrix:
        # use matrix from output in previous job
        GRAFANA_IMAGE: ${{fromJson(needs.resolve-versions.outputs.matrix)}}
    runs-on: ubuntu-latest
    steps:
      ...
      - name: Start Grafana
        run: |
          docker-compose pull
          GRAFANA_VERSION=${{ matrix.GRAFANA_IMAGE.VERSION }} GRAFANA_IMAGE=${{ matrix.GRAFANA_IMAGE.NAME }} docker-compose up -d
      ...
```
<!-- x-release-please-end-version -->

### version-support-policy
<!-- x-release-please-start-version -->
```yaml
name: E2E tests - Playwright
on:
  pull_request:

jobs:
  resolve-versions:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.resolve-versions.outputs.matrix }}
    steps:
      - name: Resolve Grafana E2E versions
        id: resolve-versions
        uses: grafana/plugin-actions/e2e-version@e2e-version/v2.0.0
        with:
          #target all minors for the current major version of Grafana and the last minor of the previous major version of Grafana
          version-resolver-type: version-support-policy

  playwright-tests:
    needs: resolve-versions
    strategy:
      matrix:
        # use matrix from output in previous job
        GRAFANA_IMAGE: ${{fromJson(needs.resolve-versions.outputs.matrix)}}
    runs-on: ubuntu-latest
    steps:
      ...
      - name: Start Grafana
        run: |
          docker-compose pull
          GRAFANA_VERSION=${{ matrix.GRAFANA_IMAGE.VERSION }} GRAFANA_IMAGE=${{ matrix.GRAFANA_IMAGE.NAME }} docker-compose up -d
      ...
```
<!-- x-release-please-end-version -->
### `grafana-dependency`

When using the `plugin-grafana-dependency` resolver type, you can optionally use the `grafana-dependency` input to pass a semver range of supported Grafana versions to test against. If this input is provided, the [dependencies.grafanaDependency](https://grafana.com/developers/plugin-tools/reference/plugin-json#properties-1) property in plugin.json will be ignored.

## Development

```bash
cd e2e-versions
npm i

#before pushing to main
npm run bundle
```
