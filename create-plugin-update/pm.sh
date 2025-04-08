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
# and the exec command to run create-plugin update
if [ -f yarn.lock ]; then
	pm="yarn"
	pmx=("yarn" "create" "@grafana/plugin")
elif [ -f pnpm-lock.yaml ]; then
	install_pnpm_if_not_present
	pm="pnpm"
	pmx=("pnpm" "dlx" "@grafana/create-plugin@latest")
elif [ -f package-lock.json ]; then
	pm="npm"
	pmx=("npx" "-y" "@grafana/create-plugin@latest")
else
	echo "No recognized package manager found in this project."
	exit 1
fi

# Run the provided command with the detected package manager
if [ "$1" = "install" ]; then
  echo "Running '$1' with $pm..."
	"$pm" install
elif [ "$1" = "update" ]; then
  echo "Running '$1' with ${pmx[0]}..."
	"${pmx[@]}" update
fi
