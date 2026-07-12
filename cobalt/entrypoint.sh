#!/bin/sh
set -e

# Write cookies.json from env var so Railway can inject it without a volume mount
if [ -n "$COBALT_COOKIES_JSON" ]; then
    echo "$COBALT_COOKIES_JSON" > /cookies.json
    echo "[cobalt] cookies written to /cookies.json"
fi

exec "$@"
