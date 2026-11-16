#!/usr/bin/env bash
# Run Instagram Profile Scraper No Login - Bio + Emails + 25 Fields on Apify and print the dataset rows as JSON.
# Needs an Apify API token: https://console.apify.com/settings/integrations
#   APIFY_TOKEN=... ./run.sh [input.json]
set -euo pipefail
curl -sS -X POST "https://api.apify.com/v2/acts/anshumanatrey~instagram-profile-intel-no-login/run-sync-get-dataset-items" \
  -H "Authorization: Bearer $APIFY_TOKEN" -H "Content-Type: application/json" \
  --data @"${1:-$(dirname "$0")/input.json}"
