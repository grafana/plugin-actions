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
	pmi=("yarn" "install")
	pmu=("yarn" "create" "@grafana/plugin" "update")
elif [ -f pnpm-lock.yaml ]; then
	install_pnpm_if_not_present
	pmi=("pnpm" "install" "--no-frozen-lockfile")
	pmu=("pnpm" "dlx" "@grafana/create-plugin@latest" "update")
elif [ -f package-lock.json ]; then
	pmi=("npm" "install")
	pmu=("npx" "-y" "@grafana/create-plugin@latest" "update")
else
	echo "No recognized package manager found in this project."
	exit 1
fi

# Run the provided command with the detected package manager
if [ "$1" = "install" ]; then
	echo "Running '$1' with ${pmi[0]}..."
	"${pmi[@]}"
elif [ "$1" = "update" ]; then
	echo "Running '$1' with ${pmu[0]}..."
	"${pmu[@]}"
fi
