# Grafana startup logs

Diagnostic companion to [`wait-for-grafana`](../wait-for-grafana). When wait-for-grafana fails, this action discovers the Grafana container, prints a level-filtered summary plus a bounded tail to the workflow log, and uploads the full redacted logs as a short-retention artifact.

## When to use it

`wait-for-grafana` can only observe `Current status: 000` — connection refused. It cannot distinguish "Grafana is still booting" from "Grafana crashed before binding `:3000`." Pair this action with it on the failure path to recover the missing signal.

## Example

<!-- x-release-please-start-version -->
```yaml
- name: Wait for Grafana to start
  id: wait
  uses: grafana/plugin-actions/wait-for-grafana@wait-for-grafana/v1.0.5

- name: Dump Grafana startup logs on failure
  if: ${{ failure() && steps.wait.outcome == 'failure' }}
  uses: grafana/plugin-actions/grafana-startup-logs@grafana-startup-logs/v1.0.0
  with:
    additional-secrets: |
      ${{ env.HL_TOKEN }}
      ${{ env.GRAFANACLOUD_USAGE_TOKEN }}
```
<!-- x-release-please-end-version -->

The two-step pattern keeps the polling action narrow and lets the diagnostic action live on the failure branch only.

## Inputs

All inputs are optional. Most have heuristic discovery that handles the default `docker-compose.yaml` + `:3000` setup with no configuration.

### `url`

URL passed to wait-for-grafana. The port is parsed and used as a container-discovery fallback. Default `http://localhost:3000/`.

### `service`

Compose service name for Grafana. Empty triggers heuristic discovery (first compose service whose name contains `grafana`, then port-based `docker ps` lookup). Set to `none` to skip docker compose and use plain `docker logs`. Default empty.

### `container`

Explicit container name. Wins over `service` when set. Used with plain `docker logs`. Default empty.

### `compose-file`

Path to docker-compose file. Default uses discovery (`docker-compose.yaml` in `working-directory`).

### `working-directory`

Working directory for docker commands. Default `.`.

### `level`

Comma-separated log levels included in the filtered summary group. Multi-line continuations after a matching line (stack traces) are carried until the next timestamp-led line. Default `error,warn,crit,eror` — `eror` is Grafana's truncated rendering of `error`.

### `tail`

Tail line count for the unfiltered group printed inline. Set to `0` to skip this group (the artifact still contains the full logs). Default `500`.

### `upload-artifact`

Whether to upload the full redacted logs as an artifact. Default `true`.

### `artifact-name`

Artifact name. Default `grafana-startup-logs`. For matrix workflows, prefix with `${{ matrix.GRAFANA_IMAGE.NAME }}-${{ matrix.GRAFANA_IMAGE.VERSION }}-` to keep matrix cells from colliding.

### `artifact-retention-days`

Artifact retention. Default `7` — shorter than GitHub's 90-day default to limit the window during which container logs are downloadable from CI.

### `redact-patterns`

Newline-separated regex patterns redacted from all output and from the artifact. Each non-empty, non-comment line is an extended-regex pattern; the entire match is replaced with `[REDACTED]`. Default catches `Bearer …`, `glsa_…`, `glc_…`, `eyJ…` (JWT prefix), `?token=…` / `?api_key=…` URL parameters, and inline `password=…` / `token: …` style assignments.

This applies on top of GitHub Actions' built-in secret masker, which only covers values registered via the `secrets` context or `::add-mask::`. Use `additional-secrets` to register plugin-specific values that the workflow has in scope but did not pass through `secrets:`.

### `additional-secrets`

Newline-separated literal values registered with `::add-mask::` before any docker commands run. The masker affects log streams only — artifact contents are protected by `redact-patterns`.

## Outputs

### `artifact-url`

URL of the uploaded artifact, when `upload-artifact` is true and the upload succeeded. Also written to the job summary as a markdown link.

## PII and trust model

Container logs are not designed to be a public surface. Default behavior treats them as semi-sensitive:

- Artifact retention defaults to **7 days** (vs. GitHub's 90)
- `redact-patterns` strips common token / JWT / URL-parameter shapes before content leaves the runner
- `additional-secrets` re-masks plugin-specific values for the log streams that GHA would otherwise miss
- The artifact is **opt-out**: set `upload-artifact: false` for repos that consider container logs too sensitive even after redaction

The redactor is regex-based and best-effort. Treat the artifact as semi-sensitive in proportion to what your plugins log.

## How it discovers the container

In order:

1. `container` input (explicit, wins over everything)
2. `service` input (explicit compose service)
3. First compose service whose name contains `grafana` (case-insensitive)
4. `docker ps --filter publish=<port>` where `<port>` is parsed from `url`
5. A container literally named `grafana`

If none match, the action prints a warning and exits 0 — it never blocks the workflow on its own discovery miss.
