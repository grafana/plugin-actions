# Wait for Grafana

This Action polls a specified URL (typically a Grafana server) until it responds with an expected status code or a timeout is reached. It's useful for ensuring that your Grafana instance is up and running before executing tests or other operations that depend on it.

## Inputs

### `url` (optional)

The URL to check. Default is `'http://localhost:3000/'`.

### `responseCode` (optional)

The expected HTTP response code that indicates the server is ready. Default is `200`.

### `timeout` (optional)

The maximum time to wait for the server to respond, in seconds. Default is `60`.

### `interval` (optional)

The time to wait between each check, in seconds. Default is `0.5`.

## How to use?

You can use this action in your workflow to wait for a Grafana server to become available before running tests or other operations. Here's an example of how to use it:

### Using default values

If you're happy with the default values, you can use the action without specifying any inputs:
<!-- x-release-please-start-version -->
```yml
- name: Wait for Grafana server
  uses: grafana/plugin-actions/wait-for-grafana@wait-for-grafana/v1.0.2
```
<!-- x-release-please-end-version -->
### Using custom values

You can customize any or all of the inputs:

```yml
- name: Wait for Grafana server
  uses: ./.github/actions/wait-for-grafana
  with:
    url: "http://grafana.mycompany.com/"
    responseCode: 301
    timeout: 120
    interval: 1
```

## Error Handling

If the server doesn't respond with the expected status code within the specified timeout, the action will fail, and your workflow will stop or move to any subsequent error handling steps you've defined.

## Limitations

This action is designed to check for a simple HTTP response. It doesn't verify the content of the response or perform any authentication. If you need more complex health checks, you might need to create a custom script or use a different action.
