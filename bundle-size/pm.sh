#!/bin/bash

set -euo pipefail

# Supported commands: install, buildPR, buildMain

if [ "$#" -ne 1 ]; then
	echo "Error: Please provide exactly one command to run."
	echo "Supported commands: install, buildPR, buildMain"
	exit 1
fi


case "$1" in
	"install"|"buildPR"|"buildMain")
		command="$1"
		;;
	*)
		echo "Error: Unsupported command '$1'"
		echo "Supported commands: install, buildPR, buildMain"
		exit 1
		;;
esac

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
elif [ -f package-lock.json ]; then
	pm="npm"
else
	echo "Defaulting to pnpm for install command."
	install_pnpm_if_not_present
	pm="pnpm"
fi

# Define build commands
if [ -f yarn.lock ]; then
	build_pr_cmd=("yarn" "build" "--profile" "--json" "pr-stats.json")
	build_main_cmd=("yarn" "build" "--profile" "--json" "stats.json")
elif [ -f package-lock.json ]; then
	build_pr_cmd=("npm" "run" "build" "--" "--profile" "--json" "pr-stats.json")
	build_main_cmd=("npm" "run" "build" "--" "--profile" "--json" "stats.json")
else
	echo "Defaulting to pnpm for build command."
	install_pnpm_if_not_present
	build_pr_cmd=("pnpm" "build" "--profile" "--json" "pr-stats.json")
	build_main_cmd=("pnpm" "build" "--profile" "--json" "stats.json")
fi

# Run the provided command with the detected package manager
echo "Running '$command' with $pm..."
case "$command" in
	"install")
		"$pm" install
		;;
	"buildPR")
		"${build_pr_cmd[@]}"
		;;
	"buildMain")
		"${build_main_cmd[@]}"
		;;
esac
