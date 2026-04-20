#!/bin/sh
set -e

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL environment variable is not set."
  echo "Set it in Railway to your backend service URL, e.g. https://your-api.up.railway.app"
  exit 1
fi

# Strip trailing slash
BACKEND_URL="${BACKEND_URL%/}"

echo "Starting frontend proxy → $BACKEND_URL"

# Replace the placeholder with the actual backend URL
sed "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" \
  /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
