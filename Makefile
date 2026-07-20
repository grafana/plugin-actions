# Helper for building and checking the bundled dist/ of a GitHub Action
# Run `make help` for usage instructions.

# nvm requires bash; the default /bin/sh (dash on some Linux) cannot source it.
SHELL := bash

NVM_DIR ?= $(HOME)/.nvm

# The action directory is passed as a variable, e.g. `make check-setup ACTION=e2e-version`.
ACTION ?=

.DEFAULT_GOAL := help

.PHONY: help check-setup bundle check-drift

help:
	@echo "Usage:"
	@echo "  make check-setup ACTION=<action>   Validate the action is set up for reproducible bundling"
	@echo "  make bundle      ACTION=<action>   Validate, then rebuild <action>/dist"
	@echo "  make check-drift ACTION=<action>   Rebuild and fail if <action>/dist is out of date (used in CI)"
	@echo ""
	@echo "Example:"
	@echo "  make bundle ACTION=e2e-version"

# Validate that the action is set up for reproducible bundling BEFORE building.
# Each check is its own line, so make stops at the first one that fails.
check-setup:
	@test -n "$(ACTION)" || { echo "Error: ACTION is required, e.g. 'make check-setup ACTION=e2e-version'" >&2; exit 1; }
	@test -d "$(ACTION)" || { echo "Error: directory '$(ACTION)' not found" >&2; exit 1; }
	@test -f "$(ACTION)/package.json" || { echo "Error: '$(ACTION)/package.json' not found - '$(ACTION)' is not a bundled JS action" >&2; exit 1; }
	@command -v jq >/dev/null || { echo "Error: 'jq' is required for config checks (brew install jq)" >&2; exit 1; }
	@test -f "$(ACTION)/.nvmrc" || { echo "Error: '$(ACTION)/.nvmrc' is missing. Pin an exact Node version, e.g.: echo 24.11.0 > $(ACTION)/.nvmrc" >&2; exit 1; }
	@test -f "$(ACTION)/package-lock.json" || { echo "Error: '$(ACTION)/package-lock.json' is missing. Run 'npm install' once in '$(ACTION)' and commit it." >&2; exit 1; }
	@jq -e '.scripts.bundle' "$(ACTION)/package.json" >/dev/null || { echo "Error: '$(ACTION)/package.json' has no 'bundle' script (expected something like: ncc build ... -o dist)" >&2; exit 1; }
	@unpinned=$$(jq -r '((.dependencies // {}) + ((.devDependencies // {}) | with_entries(select(.key == "@vercel/ncc")))) | to_entries[] | select(.value | test("^[0-9]+[.][0-9]+[.][0-9]+([-+].+)?$$") | not) | "\(.key)@\(.value)"' "$(ACTION)/package.json"); \
	if [ -n "$$unpinned" ]; then \
		echo "Error: the following dependencies must be pinned to EXACT versions (no '^' or '~')," >&2; \
		echo "       because ncc inlines them into dist/ and a range lets the output drift:" >&2; \
		echo "$$unpinned" | sed 's/^/  - /' >&2; \
		echo "Fix: set exact versions in '$(ACTION)/package.json', then run 'npm install' in '$(ACTION)' to refresh the lockfile." >&2; \
		exit 1; \
	fi
	@echo "OK: '$(ACTION)' is configured for reproducible bundling (.nvmrc, lockfile, bundle script, pinned deps)."

# Rebuild dist/. Depends on `check-setup`, so config is validated first.
bundle: check-setup
	@echo ">> $(ACTION): rebuilding dist/ ..."
	@if [ -s "$(NVM_DIR)/nvm.sh" ]; then \
		. "$(NVM_DIR)/nvm.sh" >/dev/null && cd "$(ACTION)" && nvm install >/dev/null && npm ci && npm run bundle; \
	else \
		want=$$(sed 's/^v//; s/[[:space:]]//g' "$(ACTION)/.nvmrc"); \
		have=$$(node -v 2>/dev/null | sed 's/^v//'); \
		if [ -z "$$have" ]; then echo "Error: Node.js not found on PATH and nvm not available at '$(NVM_DIR)/nvm.sh'." >&2; exit 1; fi; \
		case "$$have" in "$$want"*) : ;; *) echo "Error: active Node '$$have' does not match '$(ACTION)/.nvmrc' ('$$want'). Switch to the matching version (nvm / asdf / setup-node)." >&2; exit 1 ;; esac; \
		cd "$(ACTION)" && npm ci && npm run bundle; \
	fi
	@echo ">> $(ACTION): dist/ regenerated. Review 'git diff -- $(ACTION)/dist' and commit it."

# Rebuild and fail if the committed dist/ drifted from source. Used by CI.
check-drift: bundle
	@if [ -n "$$(git status --porcelain -- "$(ACTION)")" ]; then \
		{ \
		echo ""; \
		echo "================================================================"; \
		echo "'$(ACTION)/dist' is out of date with its source."; \
		echo ""; \
		echo "To regenerate it locally:"; \
		echo "    make bundle ACTION=$(ACTION)"; \
		echo "then commit the updated dist/ together with your change."; \
		echo ""; \
		echo "dist/ is produced by 'ncc', which inlines every dependency and minifies"; \
		echo "the result, so it drifts unless Node, the bundler and every inlined"; \
		echo "dependency are pinned identically everywhere."; \
		echo ""; \
		echo "Setting up a NEW bundled action? It must have:"; \
		echo "  - a .nvmrc pinning an exact Node version (e.g. 24.11.0)"; \
		echo "  - exact, caret-free versions for the inlined runtime deps and @vercel/ncc"; \
		echo "    in package.json (e.g. \"@actions/core\": \"3.0.1\", not \"^3.0.1\")"; \
		echo "  - a committed package-lock.json, always installed with 'npm ci'"; \
		echo "  - a 'bundle' script in package.json that writes to dist/"; \
		echo "'make check-setup ACTION=$(ACTION)' validates all of the above."; \
		echo "================================================================"; \
		} >&2; \
		if [ -n "$$CI" ]; then echo "::error::'$(ACTION)/dist' is out of date. Run 'make bundle ACTION=$(ACTION)' and commit dist/. See the log above."; fi; \
		exit 1; \
	fi
	@echo "OK: '$(ACTION)/dist' is up to date."
