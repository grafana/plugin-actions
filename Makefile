# Makefile for regenerating / verifying the bundled `dist/` of a GitHub Action.
#
# Bundled JS actions ship a checked-in `dist/` that the runtime executes
# instead of the source. `dist/` is produced by `ncc`, which inlines every
# dependency and minifies the result, so the output only stays reproducible
# when the Node version, the bundler, and every inlined dependency are pinned
# identically everywhere (see .github/workflows/verify-dist.yml).
#
# The action directory is passed as a positional argument:
#   make check  e2e-version   # validate the action is set up for reproducible bundling
#   make bundle e2e-version   # validate, then rebuild <action>/dist
#   make verify e2e-version   # rebuild and fail if <action>/dist is out of date (used in CI)
#   make help
#
# `bundle` uses `nvm` to select the Node version from .nvmrc when available
# (local dev). In CI, where nvm is absent and Node is provisioned by
# actions/setup-node from the same .nvmrc, it verifies the active Node matches
# instead. Either way it then runs `npm ci` and `npm run bundle`.

# nvm requires bash; the default /bin/sh (dash on some Linux) cannot source it.
SHELL := bash

NVM_DIR ?= $(HOME)/.nvm

# Resolve the action directory from the positional goal, e.g. the `e2e-version`
# in `make check e2e-version`: strip the known verbs, whatever remains is it.
KNOWN_TARGETS := help check bundle verify
ACTION := $(firstword $(filter-out $(KNOWN_TARGETS),$(MAKECMDGOALS)))

# Turn the positional action argument into a silent, do-nothing target so
# `make check e2e-version` doesn't fail on an unknown goal. An explicit phony
# target (rather than a `%` catch-all) runs the no-op without make printing
# "up to date" / "Nothing to be done".
ifneq ($(ACTION),)
.PHONY: $(ACTION)
$(ACTION): ; @:
endif

.DEFAULT_GOAL := help

.PHONY: help check bundle verify

help:
	@echo "Regenerate / verify the bundled dist/ of a GitHub Action."
	@echo ""
	@echo "Usage:"
	@echo "  make check  <action>   Validate the action is set up for reproducible bundling"
	@echo "  make bundle <action>   Validate, then rebuild <action>/dist"
	@echo "  make verify <action>   Rebuild and fail if <action>/dist is out of date (used in CI)"
	@echo ""
	@echo "Example:"
	@echo "  make bundle e2e-version"

# Validate that the action is set up for reproducible bundling BEFORE building.
# Each check is its own line, so make stops at the first one that fails.
check:
	@test -n "$(ACTION)" || { echo "Error: action name is required, e.g. 'make check e2e-version'" >&2; exit 1; }
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

# Rebuild dist/. Depends on `check`, so config is validated first.
bundle: check
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
verify: bundle
	@if [ -n "$$(git status --porcelain -- "$(ACTION)")" ]; then \
		git --no-pager diff -- "$(ACTION)" >&2; \
		{ \
		echo ""; \
		echo "================================================================"; \
		echo "'$(ACTION)/dist' is out of date with its source."; \
		echo ""; \
		echo "To regenerate it locally:"; \
		echo "    make bundle $(ACTION)"; \
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
		echo "'make check $(ACTION)' validates all of the above."; \
		echo "================================================================"; \
		} >&2; \
		if [ -n "$$CI" ]; then echo "::error::'$(ACTION)/dist' is out of date. Run 'make bundle $(ACTION)' and commit dist/. See the log above."; fi; \
		exit 1; \
	fi
	@echo "OK: '$(ACTION)/dist' is up to date."
