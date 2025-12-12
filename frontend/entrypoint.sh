#!/bin/sh
# Inject runtime configuration into index.html

API_URL="${VITE_API_URL:-https://ca-certmgr-backend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io}"

echo "🔧 Injecting API_URL: $API_URL"

# Create the config script
CONFIG_SCRIPT="<script>window.APP_CONFIG={API_URL:'$API_URL'};</script>"

# Replace placeholder in HTML files
find /usr/share/nginx/html -name "*.html" -type f -exec sed -i "s|<!--RUNTIME_CONFIG_PLACEHOLDER-->|$CONFIG_SCRIPT|g" {} \;

echo "✅ Configuration injected successfully"

# Start nginx
exec nginx -g 'daemon off;'
