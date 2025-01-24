#!/bin/bash

# exit on any error
set -e

# ensure we are in the right directory
cd all-reports || { echo "failed to enter directory all-reports"; exit 1; }

# initialize the table variable
table="### Playwright test results"

# check if any summary.txt has a PLUGIN_NAME value
if grep -q 'PLUGIN_NAME=.*[^ ]' */summary.txt 2>/dev/null; then
  table="${table}  \n| plugin name | image name | version | result | report |  \n|:----------- |:---------- |:------- |:------: |:------: |"
  use_plugin_name=true
else
  table="${table}  \n| image name | version | result | report |  \n|:---------- |:------- |:------: |:------: |"
  use_plugin_name=false
fi

# iterate through subdirectories
for dir in */; do
  if [[ -d "$dir" ]]; then
    dir_name=$(basename "$dir")
    summary_file="$dir/summary.txt"

    if [[ -f "$summary_file" ]]; then
      # read data from summary.txt
      grafana_image=$(grep 'GRAFANA_IMAGE=' "$summary_file" | cut -d'=' -f2)
      grafana_version=$(grep 'GRAFANA_VERSION=' "$summary_file" | cut -d'=' -f2)
      test_output=$(grep 'OUTPUT=' "$summary_file" | cut -d'=' -f2)
      plugin_name=$(grep 'PLUGIN_NAME=' "$summary_file" | cut -d'=' -f2)

      if [[ -n $plugin_name ]]; then
        report_link="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY}/${TIMESTAMP}/${GITHUB_EVENT_NUMBER}/$plugin_name-$grafana_image-$grafana_version/"
      else
        report_link="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY}/${TIMESTAMP}/${GITHUB_EVENT_NUMBER}/$grafana_image-$grafana_version/"
      fi
      
      # map result to emoji
      if [[ "$test_output" == "success" ]]; then
        result_emoji="✅"
      else
        result_emoji="❌"
      fi

      # check for index.html
      if [[ -f "$dir/index.html" ]]; then
        if [[ "$use_plugin_name" == true ]]; then
          table="${table}  \n| $plugin_name | $grafana_image | $grafana_version | $result_emoji | [report]($report_link) |"
        else
          table="${table}  \n| $grafana_image | $grafana_version | $result_emoji | [report]($report_link) |"
        fi
      else
        echo "warning: index.html not found in $dir"
      fi
    else
      echo "warning: summary.txt not found in $dir"
    fi
  fi
done

echo "MARKDOWN_TABLE<<EOF" >> "$GITHUB_ENV"
echo -e "$table" >> "$GITHUB_ENV"
echo "EOF" >> "$GITHUB_ENV"
