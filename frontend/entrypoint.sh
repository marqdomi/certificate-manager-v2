#!/bin/sh
# Inject runtime configuration into index.html

# If VITE_API_URL is empty or not set, use empty string (frontend will use relative paths)
API_URL="${VITE_API_URL:-}"

echo "🔧 Injecting API_URL: '${API_URL:-<empty, using relative paths>}'"

# Create the config script
CONFIG_SCRIPT="<script>window.APP_CONFIG={API_URL:'$API_URL'};</script>"

# Replace placeholder in HTML files
find /usr/share/nginx/html -name "*.html" -type f -exec sed -i "s|<!--RUNTIME_CONFIG_PLACEHOLDER-->|$CONFIG_SCRIPT|g" {} \;

echo "✅ Configuration injected successfully"

# Start nginx
exec nginx -g 'daemon off;'
