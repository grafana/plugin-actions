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

# Detect the command to run build
if [ -f yarn.lock ]; then
  pmb=("yarn" "build" "--profile" "--json" "pr-stats.json")
elif [ -f package-lock.json ]; then
  pmb=("npm" "run" "build" "--" "--profile" "--json" "pr-stats.json")
else
  echo "Defaulting to pnpm for build command..."
  install_pnpm_if_not_present
  pmb=("pnpm" "build" "--profile" "--json" "pr-stats.json")
fi

# Run the provided command with the detected package manager
echo "Running '$1' with $pm..."
if [ "$1" = "install" ]; then
	"$pm" install
elif [ "$1" = "build" ]; then
	"${pmb[@]}"
fi
