#!/bin/bash

url="$1"
expected_response_code="$2"
timeout="$3"
interval="$4"
startup_timeout="${5:-300}"

echo "Checking URL: $url"
echo "Expected response code: $expected_response_code"
echo "Startup timeout (TCP bind): $startup_timeout seconds"
echo "Health timeout (after bind): $timeout seconds"
echo "Interval: $interval seconds"

# Phase 1: wait for the server to return any HTTP status.
# Any curl error is treated as a transient startup condition — keep waiting.
# This covers ECONNREFUSED, recv errors, connection resets, and any other
# transient state that can occur while the process is starting up.
startup_end=$((SECONDS + startup_timeout))
port_bound=false

while [ $SECONDS -lt $startup_end ]; do
  response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url")

  if [ "$response" != "000" ]; then
    port_bound=true
    break
  fi

  echo "Waiting for server to start. Current status: $response"
  sleep 5
done

if [ "$port_bound" = false ]; then
  echo "Startup timeout reached. Server did not respond within $startup_timeout seconds"
  exit 1
fi

echo "Server is responding. Waiting for status code $expected_response_code..."

# Phase 2: server is up, wait for a healthy response.
# --connect-timeout and --max-time bound each curl call so a stalled connection
# cannot outlast the health window.
# Fail fast on 4xx — indicates a URL misconfiguration, not a timing issue.
health_end=$((SECONDS + timeout))

while [ $SECONDS -lt $health_end ]; do
  response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 10 "$url")

  if [ "$response" -eq "$expected_response_code" ]; then
    echo "Server is up and responding with status code $expected_response_code"
    exit 0
  fi

  if [ "$response" -ge 400 ] && [ "$response" -lt 500 ]; then
    echo "Server returned $response — likely a URL misconfiguration, failing fast"
    exit 1
  fi

  echo "Waiting for server to respond with status code $expected_response_code. Current status: $response"
  sleep "$interval"
done

echo "Timeout reached. Server did not respond with status code $expected_response_code within $timeout seconds"
exit 1
