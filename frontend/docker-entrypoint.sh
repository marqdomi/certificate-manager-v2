#!/bin/sh
set -e

# Replace environment variables in nginx config
# This allows us to use ${BACKEND_URL} in nginx.conf
envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
