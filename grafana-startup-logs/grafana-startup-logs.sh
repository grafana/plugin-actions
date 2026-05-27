#!/bin/bash
# Dump Grafana container logs on failure with level-aware filtering, regex
# redaction, and artifact upload. Designed to run as a follow-up step after
# wait-for-grafana fails — never invoked on success.
#
# Inputs come from environment variables (see action.yml). The script
# discovers the container via a heuristic chain (explicit container,
# compose service, compose-service-name regex, docker-ps port lookup),
# writes the full redacted logs to $RUNNER_TEMP/grafana-startup-logs/, and
# prints three log groups: filtered errors+warns, container state, and a
# bounded tail of the full log.

set -uo pipefail

mkdir -p "$RUNNER_TEMP/grafana-startup-logs"
log_dir="$RUNNER_TEMP/grafana-startup-logs"
full_log="$log_dir/grafana-full.log"
redacted_log="$log_dir/grafana.log"
ps_log="$log_dir/docker-compose-ps.txt"

# Surface paths for the composite step's outputs.
echo "log-dir=$log_dir" >> "$GITHUB_OUTPUT"

# ---------- compose helpers ----------

compose_args=()
if [ -n "${GSL_COMPOSE_FILE:-}" ]; then
  compose_args+=(-f "$GSL_COMPOSE_FILE")
fi

run_compose() {
  docker compose "${compose_args[@]}" "$@"
}

# ---------- container discovery ----------

container=""
compose_service=""

if [ -n "${GSL_CONTAINER:-}" ]; then
  container="$GSL_CONTAINER"
elif [ "${GSL_SERVICE:-}" = "none" ]; then
  # Skip compose entirely; fall through to port-based docker ps lookup.
  :
elif [ -n "${GSL_SERVICE:-}" ]; then
  compose_service="$GSL_SERVICE"
else
  # Heuristic 1: first compose service whose name contains "grafana".
  if compose_services=$(run_compose ps --services 2>/dev/null); then
    compose_service=$(printf '%s\n' "$compose_services" | grep -i grafana | head -n 1 || true)
  fi
fi

# Heuristic 2 (fallback): port-based docker ps lookup.
if [ -z "$container" ] && [ -z "$compose_service" ]; then
  port=$(printf '%s' "$GSL_URL" | sed -E 's|^[a-z]+://[^:/]+:([0-9]+).*|\1|; t; s|.*|3000|')
  if [ -n "$port" ]; then
    container=$(docker ps --filter "publish=$port" --format '{{.Names}}' | head -n 1 || true)
  fi
fi

# Heuristic 3 (last resort): literal container named "grafana".
if [ -z "$container" ] && [ -z "$compose_service" ]; then
  if docker inspect grafana >/dev/null 2>&1; then
    container="grafana"
  fi
fi

if [ -z "$container" ] && [ -z "$compose_service" ]; then
  echo "::warning::grafana-startup-logs: could not locate a Grafana container. Set the 'container' or 'service' input explicitly."
  exit 0
fi

# ---------- collect ----------

if [ -n "$compose_service" ]; then
  echo "Collecting logs from compose service: $compose_service"
  run_compose ps -a > "$ps_log" 2>&1 || true
  run_compose logs --no-color --no-log-prefix "$compose_service" > "$full_log" 2>&1 || true
else
  echo "Collecting logs from container: $container"
  docker ps -a --filter "name=$container" > "$ps_log" 2>&1 || true
  docker logs "$container" > "$full_log" 2>&1 || true
fi

if [ ! -s "$full_log" ]; then
  echo "::warning::grafana-startup-logs: log file is empty. Container may not have produced any output."
fi

# ---------- redaction ----------

# Build sed args from the multi-line redact-patterns input. Empty lines and
# comments (lines starting with #) are ignored. Each pattern is wrapped in
# an extended-regex substitution that replaces the entire match with
# [REDACTED]. Pattern delimiter is ~ because | clashes with regex alternation
# inside patterns (e.g. "(password|secret)=..."), / is common in URLs, and
# : / = appear in many log lines and patterns.
sed_args=()
while IFS= read -r pat; do
  # Trim whitespace.
  pat="${pat#"${pat%%[![:space:]]*}"}"
  pat="${pat%"${pat##*[![:space:]]}"}"
  [ -z "$pat" ] && continue
  case "$pat" in \#*) continue ;; esac
  sed_args+=(-E -e "s~$pat~[REDACTED]~g")
done <<< "${GSL_REDACT_PATTERNS:-}"

if [ "${#sed_args[@]}" -gt 0 ]; then
  if ! sed "${sed_args[@]}" "$full_log" > "$redacted_log"; then
    echo "::warning::grafana-startup-logs: redaction sed pipeline failed; falling back to copying full log verbatim."
    cp "$full_log" "$redacted_log"
  fi
else
  cp "$full_log" "$redacted_log"
fi

# Drop the unredacted intermediate so the artifact never contains it.
rm -f "$full_log"
echo "log-file=$redacted_log" >> "$GITHUB_OUTPUT"

# ---------- filtered summary ----------

# Build alternation regex from comma-separated levels.
levels_alt=$(printf '%s' "${GSL_LEVEL:-error,warn,crit}" | tr ',' '|' | tr -d '[:space:]')

# awk-based multi-line filter:
#   - lines that match lvl=<level> or "level":"<level>"   → emit and mark in-match
#   - lines that look like a new log line (t=, JSON {, or ISO timestamp) and
#     do NOT match the level filter → stop emitting
#   - other lines while in-match (stack frames, continuation) → emit
#
# Regex notes: \b is a GNU extension, not POSIX ERE — awk would warn and treat
# it as literal. The level keyword in Grafana text logs is always followed by
# a space, so dropping the boundary is safe in practice. Likewise [{] avoids
# awk's interval-expression interpretation of a bare {.
filter_re="(lvl=(${levels_alt})|\"level\":\"(${levels_alt})\")"
new_line_re="^(t=|[{]|[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9])"

echo "::group::Grafana errors and warnings (filtered to: ${GSL_LEVEL})"
awk -v fr="$filter_re" -v nr="$new_line_re" '
  $0 ~ fr        { in_match=1; print; next }
  $0 ~ nr        { in_match=0; next }
  in_match == 1  { print }
' "$redacted_log" || true
echo "::endgroup::"

# ---------- container state ----------

echo "::group::Container state"
cat "$ps_log" || true
echo "::endgroup::"

# ---------- bounded tail ----------

if [ "${GSL_TAIL:-500}" -gt 0 ] 2>/dev/null; then
  echo "::group::Recent Grafana logs (last ${GSL_TAIL} lines, all levels, redacted)"
  tail -n "$GSL_TAIL" "$redacted_log" || true
  echo "::endgroup::"
fi
