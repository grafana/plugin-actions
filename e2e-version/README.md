# E2E Grafana version resolver

This Action resolves what Grafana image names and versions to use when E2E testing a Grafana plugin in a Github Action.

## Inputs

### `skip-grafana-nightly-image`

By default, this action includes the `grafana-enterprise:nightly` image in the test matrix. To exclude it, set `skip-grafana-nightly-image` to `true`.

> **Deprecated:** The old `skip-grafana-dev-image` input is still accepted as an alias but will be removed in a future release.

### `limit`

The maximum number of versions to resolve. Default is 6, 0 means no limit.

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
    "version": "nightly",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "10.3.1",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "10.0.10",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "9.2.20",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "8.4.11",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "8.1.8",
    "enabledToggles": ""
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
    "version": "nightly",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "10.3.1",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "10.2.3",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "10.1.6",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "10.0.10",
    "enabledToggles": ""
  },
  {
    "name": "grafana-enterprise",
    "version": "9.5.15",
    "enabledToggles": ""
  }
]
```

### Output

The result of this action is a JSON array that lists the latest patch version for each Grafana minor version. These values can be employed to define a version matrix in a subsequent workflow job.

Each entry has three fields:

- `name` – the Grafana image name (e.g. `grafana-enterprise`).
- `version` – the Grafana version/tag to run.
- `enabledToggles` – a comma-separated list of Grafana feature toggles to enable for this entry, or an empty string when none. Pass it to Grafana via the `GF_FEATURE_TOGGLES_ENABLE` environment variable.

#### React 19

React 19 is exercised by running the latest Grafana `13.1` release with the `react19` feature toggle enabled, rather than a dedicated `dev-preview-react19` image. When not skipped (see [`skip-grafana-react-19-preview-image`](#skip-grafana-react-19-preview-image) below), the matrix gains an entry like:

```json
{ "name": "grafana-enterprise", "version": "13.1.5", "enabledToggles": "react19" }
```

If no stable `13.1` release exists yet, the entry is omitted (the action does not fail).

#### Updating the feature-toggle variants

The variants (which Grafana minor + which feature toggles) are **not** baked into the action. They are fetched at runtime from [`feature-toggle-variants.json`](./feature-toggle-variants.json) on the `main` branch:

```
https://raw.githubusercontent.com/grafana/plugin-actions/main/e2e-version/feature-toggle-variants.json
```

The file is a JSON object keyed by Grafana minor version (`major.minor`):

```json
{
  "13.1": { "name": "grafana-enterprise", "enabledToggles": "react19" }
}
```

To add or remove a variant, merge a PR that edits this file on `main`. The change takes effect for **all** consumers immediately — regardless of which action version they have pinned — without cutting a new action release or asking consumers to bump their pinned ref. Because the file is served via the GitHub raw CDN, changes can take a few minutes (~5) to propagate.

If the file cannot be fetched (network error, non-2xx, or malformed JSON), the action logs a warning and simply skips the feature-toggle variants; the rest of the matrix is unaffected.

### `skip-grafana-react-19-preview-image`

Controls whether the React 19 variant described above is added to the matrix. Defaults to included for Grafana org repositories and skipped for others; set it explicitly to override.

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
          GRAFANA_VERSION=${{ matrix.GRAFANA_IMAGE.VERSION }} GRAFANA_IMAGE=${{ matrix.GRAFANA_IMAGE.NAME }} GF_FEATURE_TOGGLES_ENABLE=${{ matrix.GRAFANA_IMAGE.enabledToggles }} docker-compose up -d
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
          GRAFANA_VERSION=${{ matrix.GRAFANA_IMAGE.VERSION }} GRAFANA_IMAGE=${{ matrix.GRAFANA_IMAGE.NAME }} GF_FEATURE_TOGGLES_ENABLE=${{ matrix.GRAFANA_IMAGE.enabledToggles }} docker-compose up -d
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
