# Package manager detect action

This GitHub Action attempts to resolve the Node.js package manager a repo uses and returns a normalised map of commands for subsequent workflow steps to use.

## Features

- Detects package manager based on packageManager field then lock file
- If no package.json is found in the current directory it will traverse up directories to the nearest package.json file
- If no lock file is found in the current directory it will traverse up directories to find the nearest lock file

## Outputs

This workflow outputs the following information / commands for the node package manager the project uses:

- `name`: The name of the package manager (e.g. npm, pnpm, yarn) used to install dependencies and run scripts.
- `agent`: Like name but can be used to know if yarn berry is used by a project.
- `lockFilePath`: The path to the closest lock file (e.g. package-lock.json, pnpm-lock.yaml, yarn.lock).
- `installCmd`: The install command (e.g. npm install, pnpm install, yarn install).
- `frozenInstallCmd`: The install command recommended for CI environments (e.g. npm ci, pnpm install --frozen-lockfile, yarn install --immutable).
- `globalInstallCmd`: The global install command (e.g. npm install -g, pnpm install -g, yarn global add).
- `uninstallCmd`: The uninstall command (e.g. npm uninstall, pnpm remove, yarn remove).
- `globalUninstallCmd`: The global uninstall command (e.g. npm uninstall -g, pnpm remove -g, yarn global remove).
- `updateCmd`: The update command (e.g. npm update, pnpm update, yarn upgrade).
- `runCmd`: The run command (e.g. npm run, pnpm run, yarn run).
- `execCmd`: The exec command (e.g. npx, pnpm dlx, yarn dlx).
- `execLocalCmd`: The exec command (e.g. npx, pnpm dlx, yarn exec).

## Usage

Add the following to your workflow after checkout and before nodejs setup. Make sure to supply an id so you can reference the output later.

```yaml
- uses: grafana/plugin-actions/package-manager-detect@package-manager-detect/v1.0.0
- id: packageManager
```

After this you can reference the various package manager commands like so:

```yaml
- name: Install dependencies
  run: ${{ steps.packageManager.outputs.frozenInstallCmd }}
```

## Workflow example

<!-- x-release-please-start-version -->

```yaml
name: Run CI

on:
  pull_request:
    branches:
      - main

jobs:
  compare:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - uses: grafana/plugin-actions/package-manager-detect@package-manager-detect/v1.0.0
      - id: packageManager

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: ${{ steps.packageManager.outputs.name }}
          cache-dependency-path: ${{ steps.packageManager.outputs.lockFilePath }}

      - name: Install dependencies
        run: ${{ steps.packageManager.outputs.frozenInstallCmd }}

      - name: Install playwright browsers
        run: ${{ steps.packageManager.outputs.execCmd }} playwright install

      - name: Run tests
        run: ${{ steps.packageManager.outputs.runCmd }} test

      - name: Build project
        run: ${{ steps.packageManager.outputs.runCmd }} build
```

<!-- x-release-please-end-version -->

## Options

The following options can be passed to this action:

- `working-directory` (optional): The working directory to run the action in. Defaults to `.`.
