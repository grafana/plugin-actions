#!/bin/bash

# Exit on any error
set -e

# Ensure we are in the right directory
cd all-reports || { echo "Failed to enter directory all-reports"; exit 1; }

# Initialize the table variable
table="### Playwright test results"

# Check if any summary.txt has a PLUGIN_NAME value
if grep -q 'PLUGIN_NAME=.*[^ ]' */summary.txt 2>/dev/null; then
  table="${table}\n| Plugin Name | Image Name | Version | Result | Report |\n|:----------- |:---------- |:------- |:------: |:------: |"
  use_plugin_name=true
else
  table="${table}\n| Image Name | Version | Result | Report |\n|:---------- |:------- |:------: |:------: |"
  use_plugin_name=false
fi

# Iterate through subdirectories
for dir in */; do
  if [[ -d "$dir" ]]; then
    dir_name=$(basename "$dir")
    summary_file="$dir/summary.txt"

    if [[ -f "$summary_file" ]]; then
      # Read data from summary.txt
      grafana_image=$(grep 'GRAFANA_IMAGE=' "$summary_file" | cut -d'=' -f2)
      grafana_version=$(grep 'GRAFANA_VERSION=' "$summary_file" | cut -d'=' -f2)
      test_output=$(grep 'OUTPUT=' "$summary_file" | cut -d'=' -f2)
      plugin_name=$(grep 'PLUGIN_NAME=' "$summary_file" | cut -d'=' -f2)

      if [[ -n $plugin_name ]]; then
        report_link="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY}/${TIMESTAMP}/${GITHUB_EVENT_NUMBER}/$plugin_name-$grafana_image-$grafana_version/"
      else
        report_link="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY}/${TIMESTAMP}/${GITHUB_EVENT_NUMBER}/$grafana_image-$grafana_version/"
      fi
      
      # Map result to emoji
      if [[ "$test_output" == "success" ]]; then
        result_emoji="✅"
      else
        result_emoji="❌"
      fi

      # Check for index.html
      if [[ -f "$dir/index.html" ]]; then
        link_cell="[🔗](${report_link})"
      else
        link_cell=""
      fi

      # Append a row to the table
      if [[ "$use_plugin_name" == true ]]; then
        table="${table}
| ${plugin_name} | ${grafana_image} | ${grafana_version} | ${result_emoji} | ${link_cell} |"
      else
        table="${table}
| ${grafana_image} | ${grafana_version} | ${result_emoji} | ${link_cell} |"
      fi
    else
      # Handle missing summary.txt
      if [[ "$use_plugin_name" == true ]]; then
        table="${table}
| UNKNOWN | ${dir_name} | UNKNOWN | ❓ | No report available |"
      else
        table="${table}
| ${dir_name} | UNKNOWN | ❓ | No report available |"
      fi
    fi
  fi
done

# Debug: Print the final table
echo "Generated Markdown Table:"
echo -e "$table"

# Export the table as an environment variable
echo "MARKDOWN_TABLE<<EOF" >> "$GITHUB_ENV"
echo -e "$table" >> "$GITHUB_ENV"
echo "EOF" >> "$G
