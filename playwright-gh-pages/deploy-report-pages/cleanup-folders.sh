#!/bin/bash

log_skipped() {
  echo "SKIPPED --- $1" >&2
}

delete_folder() {
  local folder_path="$1"
  if rm -rf "$folder_path"; then
    echo "DELETED --- Folder '$folder_path' and its contents have been deleted."
  else
    echo "ERROR --- Failed to delete folder '$folder_path'."
  fi
}

# parses and validates a folder name as a date
parse_folder_date() {
  local folder_name="$1"
  if [[ "$folder_name" =~ ^[0-9]{8}$ ]]; then
    echo "${folder_name:0:4}-${folder_name:4:2}-${folder_name:6:2}"  # Convert to "YYYY-MM-DD"
  else
    echo ""
  fi
}

# calculates the age of a folder in days
calculate_folder_age() {
  local folder_date="$1"
  local current_date
  current_date=$(date -u +%s)
  local folder_date_epoch
  folder_date_epoch=$(date -u -d "$folder_date" +%s 2>/dev/null || echo "")
  if [[ -n "$folder_date_epoch" ]]; then
    echo $(( (current_date - folder_date_epoch) / 86400 ))  # Age in days
  else
    echo ""
  fi
}

find_old_folders() {
  local retention_days="$1"
  local directory="$2"

  echo "Checking folder..." >&2
  for folder in "$directory"/*/; do
    folder_name=$(basename "$folder")
    folder_date=$(parse_folder_date "$folder_name")

    if [[ -n "$folder_date" ]]; then
      age_days=$(calculate_folder_age "$folder_date")
      if [[ -n "$age_days" && $age_days -gt $retention_days ]]; then
        echo "$folder_name"  # eligible for deletion
      else
        log_skipped "Folder '$folder_name' is not older than $retention_days days. It will not be deleted."
      fi
    else
      log_skipped "Found folder/file with name '$folder_name' that does not match the expected date format. It will not be deleted."
    fi
  done
}

# validates and processes arguments
parse_arguments() {
  local retention_days=""
  local folder_name=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --retention-days)
        retention_days="$2"
        shift 2
        ;;
      --folder-name)
        folder_name="$2"
        shift 2
        ;;
      *)
        echo "Usage: $0 --retention-days <days> --folder-name <directory>"
        exit 1
        ;;
    esac
  done

  if [[ -z "$retention_days" || -z "$folder_name" ]]; then
    echo "Usage: $0 --retention-days <days> --folder-name <directory>"
    exit 1
  fi

  if [[ ! -d "$folder_name" ]]; then
    echo "Error: Directory '$folder_name' does not exist."
    exit 1
  fi

  echo "$retention_days" "$folder_name"
}

main() {
  read -r retention_days folder_name <<< "$(parse_arguments "$@")"

  # find old folders and delete them
  old_folders=$(find_old_folders "$retention_days" "$folder_name")
  echo "Old folders found: $old_folders" >&2
  for folder in $old_folders; do
    delete_folder "$folder_name/$folder"
  done
}

# run the script
main "$@"
