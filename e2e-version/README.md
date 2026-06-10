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

#### Feature-toggle variants

Beyond the plain version matrix, the action can add **feature-toggle variants** — extra matrix entries that run a Grafana release with one or more feature toggles enabled. For example, React 19 is exercised by running a real Grafana release with the `react19` feature toggle enabled (rather than a dedicated `dev-preview-react19` image). A variant entry looks like:

```json
{ "name": "grafana-enterprise", "version": "13.1.5", "enabledToggles": "react19" }
```

A variant does **not** replace the baseline entry for the same version — the matrix keeps both the plain entry and the toggle-enabled one, so the release is tested with and without the toggle.

#### Defining the variants

The variants are **not** baked into the action. They are fetched at runtime from [`feature-toggle-variants.json`](./feature-toggle-variants.json) on the `main` branch:

```
https://raw.githubusercontent.com/grafana/plugin-actions/main/e2e-version/feature-toggle-variants.json
```

The file is a JSON **array** of variant objects:

```json
[
  {
    "name": "grafana-enterprise",
    "enabledToggles": "react19",
    "grafanaDependency": ">=13.1.0 <13.2.0",
    "runInRepositories": ["^grafana/"]
  }
]
```

Each variant has the following fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | The Grafana image name to use for the variant entry (e.g. `grafana-enterprise`). |
| `enabledToggles` | yes | Comma-separated feature toggles to enable, surfaced as the entry's `enabledToggles` field (pass to Grafana via `GF_FEATURE_TOGGLES_ENABLE`). |
| `grafanaDependency` | yes | A **semver range**. The toggles are applied to **every** available stable Grafana version (latest patch per minor) that satisfies this range — see below. |
| `runInRepositories` | no | Array of regexes restricting which repositories the variant applies to — see below. |

To add or remove a variant, merge a PR that edits this file on `main`. The change takes effect for **all** consumers immediately — regardless of which action version they have pinned — without cutting a new action release or asking consumers to bump their pinned ref. Because the file is served via the GitHub raw CDN, changes can take a few minutes (~5) to propagate.

If the file cannot be fetched (network error, non-2xx, or not an array), the action logs a warning and simply skips the feature-toggle variants; the rest of the matrix is unaffected.

#### `grafanaDependency` (semver matching)

`grafanaDependency` is a [semver range](https://github.com/npm/node-semver#ranges). The action resolves the available stable Grafana versions (the latest patch of each minor) and emits a variant entry for **every** version that satisfies the range. This mirrors how `grafana-dependency` works for the base matrix.

- `">=13.1.0 <13.2.0"` (or `"~13.1.0"`, `"13.1.x"`) → only the latest `13.1.x` patch.
- `">=13.1.0"` → the latest patch of `13.1`, `13.2`, `14.0`, … — i.e. a separate toggle-enabled entry per satisfying minor.
- `"13.1.5"` → only that exact version, if it is among the available releases.
- An invalid range, or a range that no available version satisfies, is logged and the variant is skipped (never fatal).

#### `runInRepositories`

`runInRepositories` controls which repositories a variant applies to. It is an array of **regular expressions** matched against the consuming repository's `GITHUB_REPOSITORY` (format `owner/repo`). The variant is included when **any** pattern matches.

- Omitted or empty → the variant runs in **every** repository.
- Examples:
  - `["^grafana/"]` — every repository in the `grafana` org.
  - `["^grafana/(clock-panel|simple-json-datasource)$"]` — specific repositories.
  - `[".*"]` — everywhere (equivalent to omitting the field).
- Matching is case-sensitive; write patterns against the literal `owner/repo`.
- An invalid pattern is logged as a warning and ignored (treated as non-matching); it never fails the action.

### `skip-grafana-react-19-preview-image`

> **Deprecated:** variant targeting is now controlled centrally via `runInRepositories` in `feature-toggle-variants.json`. When explicitly set to `true`, this input still acts as a kill-switch that skips **all** feature-toggle variants. It will be removed in a future release.

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
