#!/bin/sh
set -e

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL environment variable is not set."
  echo "Set it in Railway to your backend service URL, e.g. https://your-api.up.railway.app"
  exit 1
fi

# Strip trailing slash
BACKEND_URL="${BACKEND_URL%/}"

# The hostname part of BACKEND_URL. Railway's edge routes by Host header, so the
# proxied request must carry the backend's own host — forwarding the browser's
# Host (www.vyrle.co) sends the request straight back to this frontend and every
# /api call dies in a loop after 60 s.
BACKEND_HOST="${BACKEND_URL#http://}"
BACKEND_HOST="${BACKEND_HOST#https://}"
BACKEND_HOST="${BACKEND_HOST%%/*}"

echo "Starting frontend proxy → $BACKEND_URL (Host: $BACKEND_HOST)"

# Replace the placeholders with the actual backend URL and host
sed -e "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" \
    -e "s|BACKEND_HOST_PLACEHOLDER|${BACKEND_HOST}|g" \
  /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
