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
current_dir=$(pwd)
cd $(git rev-parse --show-toplevel) # Navigate to the root of the git repository
if [ -f yarn.lock ]; then
    pm="yarn"
elif [ -f package-lock.json ]; then
    pm="npm"
elif [ -f pnpm-lock.yaml ]; then
    install_pnpm_if_not_present
    pm="pnpm"
else
    echo "No recognized package manager found in this project."
    exit 1
fi
cd $current_dir # Navigate back to the original directory

# Detect the command to run build
if [ "$pm" = "yarn" ]; then
    pmb=("yarn" "build" "--profile" "--json" "pr-stats.json")
elif [ "$pm" = "npm" ]; then
    pmb=("npm" "run" "build" "--" "--profile" "--json" "pr-stats.json")
elif [ "$pm" = "pnpm" ]; then
    install_pnpm_if_not_present
    pmb=("pnpm" "build" "--profile" "--json" "pr-stats.json")
else
    echo "No recognized package manager found in this project."
    exit 1
fi

# Run the provided command with the detected package manager
echo "Running '$1' with $pm..."
if [ "$1" = "install" ]; then
    "$pm" install
elif [ "$1" = "build" ]; then
    "${pmb[@]}"
fi