#!/bin/bash

# Check if command argument is provided
if [ "$1" = "" ]; then
	echo "Please provide a command to run. Available commands: install, update"
	exit 1
fi

install_pnpm_if_not_present() {
    if ! command -v pnpm &> /dev/null
    then
        echo "pnpm could not be found, installing..."
        npm install -g pnpm
    fi
}

# Detect the package manager
# to determine the correct installation command
# and the exec command to run create-plugin update
if [ -f yarn.lock ]; then
	install_deps=("yarn" "install" "--no-immutable")
	create_plugin_update=("yarn" "create" "@grafana/plugin" "update" "--commit")
elif [ -f pnpm-lock.yaml ]; then
	install_pnpm_if_not_present
	install_deps=("pnpm" "install" "--no-frozen-lockfile")
	create_plugin_update=("pnpm" "dlx" "@grafana/create-plugin@latest" "update" "--commit")
elif [ -f package-lock.json ]; then
	install_deps=("npm" "install")
	create_plugin_update=("npx" "-y" "@grafana/create-plugin@latest" "update" "--commit")
else
	echo "No recognized package manager found in this project."
	exit 1
fi

# Run the provided command with the detected package manager
if [ "$1" = "install" ]; then
	echo "Running '$1' with ${install_deps[0]}..."
	"${install_deps[@]}"
elif [ "$1" = "update" ]; then
	echo "Running '$1' with ${create_plugin_update[0]}..."
	"${create_plugin_update[@]}"
fi
