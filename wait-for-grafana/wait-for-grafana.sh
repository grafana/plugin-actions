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

# Phase 1: wait for TCP port to bind.
# curl exit code 7 = ECONNREFUSED: the process isn't listening yet, safe to keep waiting.
# Any other non-zero exit code (e.g. 6 = DNS failure) indicates misconfiguration — fail fast.
startup_end=$((SECONDS + startup_timeout))
port_bound=false

while [ $SECONDS -lt $startup_end ]; do
  response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url")
  curl_exit=$?

  if [ $curl_exit -ne 0 ] && [ $curl_exit -ne 7 ]; then
    echo "curl failed with exit code $curl_exit (not a connection-refused error) — failing fast"
    exit 1
  fi

  if [ "$response" != "000" ]; then
    port_bound=true
    break
  fi

  echo "Waiting for TCP bind (curl exit: $curl_exit). Current status: $response"
  sleep 5
done

if [ "$port_bound" = false ]; then
  echo "Startup timeout reached. Server TCP port did not bind within $startup_timeout seconds"
  exit 1
fi

echo "TCP port bound. Waiting for server to respond with status code $expected_response_code..."

# Phase 2: port is open, wait for a healthy response.
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

echo "Timeout reached. Server did not respond with status code $expected_response_code within $timeout seconds after TCP bind"
exit 1
