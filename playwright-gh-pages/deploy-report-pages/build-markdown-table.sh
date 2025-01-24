# exit on any error
set -e

# ensure we are in the right directory
cd all-reports || { echo "failed to enter directory all-reports"; exit 1; }

# initialize the table variable
table="### Playwright test results"

# check if any summary.txt has a plugin_name value
if grep -q 'PLUGIN_NAME=.*[^ ]' */summary.txt 2>/dev/null; then
  table="${table}  \n| plugin name | image name | version | result | report |  \n|:----------- |:---------- |:------- |:------: |:------: |"
  use_plugin_name=true
else
  table="${table}  \n| image name | version | result | report |  \n|:---------- |:------- |:------: |:------: |"
  use_plugin_name=false
fi

# collect rows in an array for sorting
rows=()

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
        report_link="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY_NAME}/${TIMESTAMP}/${GITHUB_EVENT_NUMBER}/$plugin_name-$grafana_image-$grafana_version/"
      else
        report_link="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY_NAME}/${TIMESTAMP}/${GITHUB_EVENT_NUMBER}/$grafana_image-$grafana_version/"
      fi

      # map result to emoji
      if [[ "$test_output" == "success" ]]; then
        result_emoji="✅"
      else
        result_emoji="❌"
      fi

      # build row and add it to the array
      if [[ -f "$dir/index.html" ]]; then
        if [[ "$use_plugin_name" == true ]]; then
          rows+=("$plugin_name | $grafana_image | $grafana_version | $result_emoji | [🔗]($report_link)")
        else
          rows+=("$grafana_image | $grafana_version | $result_emoji | [🔗]($report_link)")
        fi
      else
        # add row without a report link
        if [[ "$use_plugin_name" == true ]]; then
          rows+=("$plugin_name | $grafana_image | $grafana_version | $result_emoji | ")
        else
          rows+=("$grafana_image | $grafana_version | $result_emoji | ")
        fi
        echo "warning: index.html not found in $dir"
      fi
    else
      echo "warning: summary.txt not found in $dir"
    fi
  fi
done

# sort rows by version
sorted_rows=$(printf "%s\n" "${rows[@]}" | sort -t'|' -k3,3 -V)

# add sorted rows to the table
while IFS= read -r row; do
  table="${table}  \n| $row |"
done <<< "$sorted_rows"

# export the table
echo "MARKDOWN_TABLE<<EOF" >> "$GITHUB_ENV"
echo -e "$table" >> "$GITHUB_ENV"
echo "EOF" >> "$GITHUB_ENV"
