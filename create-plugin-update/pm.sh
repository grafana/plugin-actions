#!/bin/bash

# Check if command argument is provided
if [ "$1" = "" ]; then
	echo "Please provide a command to run."
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
if [ -f yarn.lock ]; then
	pm="yarn"
elif [ -f pnpm-lock.yaml ]; then
	install_pnpm_if_not_present
	pm="pnpm"
elif [ -f package-lock.json ]; then
	pm="npm"
else
	echo "No recognized package manager found in this project."
	exit 1
fi

# Detect the exec command to run create-plugin update
if [ -f yarn.lock ]; then
	pmx="yarn create @grafana/plugin"
elif [ -f pnpm-lock.yaml ]; then
	install_pnpm_if_not_present
	pmx="pnpm dlx @grafana/create-plugin@latest"
elif [ -f package-lock.json ]; then
	pmx="npx -y @grafana/create-plugin@latest"
else
	echo "No recognized package manager found in this project."
	exit 1
fi

# Run the provided command with the detected package manager
echo "Running '$1' with $pm..."
if [ "$1" = "install" ]; then
	"$pm" install
elif [ "$1" = "update" ]; then
	"$pmx" update
fi
