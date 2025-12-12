#!/bin/sh
# Generate runtime configuration

cat > /usr/share/nginx/html/config.js << EOF
// Runtime configuration
window.APP_CONFIG = {
  API_URL: '${VITE_API_URL}' || 'https://ca-certmgr-backend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io'
};
EOF

# Start nginx
exec nginx -g 'daemon off;'
