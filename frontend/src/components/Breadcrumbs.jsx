// frontend/src/components/Breadcrumbs.jsx
// Breadcrumbs navigation component

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Typography,
  Box,
  useTheme,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

// Route configuration with labels and icons
const ROUTE_CONFIG = {
  '/dashboard': { label: 'Dashboard', parent: null },
  '/certificates': { label: 'Certificates', parent: '/dashboard' },
  '/devices': { label: 'Devices', parent: '/dashboard' },
  '/discovery': { label: 'Discovery', parent: '/dashboard' },
  '/generate-csr': { label: 'CSR Generator', parent: '/dashboard' },
  '/pfx-generator': { label: 'PFX Generator', parent: '/dashboard' },
  '/deploy': { label: 'Deploy Center', parent: '/dashboard' },
  '/batch-renewal': { label: 'Batch Renewal', parent: '/dashboard' },
  '/cert-cleanup': { label: 'Certificate Cleanup', parent: '/dashboard' },
  '/audit-log': { label: 'Audit Log', parent: '/dashboard' },
  '/notifications': { label: 'Notifications', parent: '/dashboard' },
  '/profile': { label: 'My Profile', parent: '/dashboard' },
  '/settings': { label: 'Settings', parent: '/dashboard' },
  '/admin': { label: 'Admin Dashboard', parent: '/dashboard' },
  '/admin/users': { label: 'User Management', parent: '/admin' },
  '/admin/health': { label: 'System Health', parent: '/admin' },
  '/admin/notifications': { label: 'Notification Settings', parent: '/admin' },
};

const Breadcrumbs = () => {
  const theme = useTheme();
  const location = useLocation();
  const currentPath = location.pathname;

  // Build breadcrumb trail
  const buildBreadcrumbs = () => {
    const breadcrumbs = [];
    let path = currentPath;

    while (path && ROUTE_CONFIG[path]) {
      breadcrumbs.unshift({
        path,
        label: ROUTE_CONFIG[path].label,
      });
      path = ROUTE_CONFIG[path].parent;
    }

    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  // Don't show on dashboard (root)
  if (currentPath === '/dashboard' || breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-separator': {
            mx: 0.5,
          },
        }}
      >
        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            color: theme.palette.text.secondary,
            textDecoration: 'none',
          }}
        >
          <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />
          <Typography variant="body2" color="text.secondary">
            Home
          </Typography>
        </Link>

        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          if (isLast) {
            return (
              <Typography
                key={crumb.path}
                variant="body2"
                color="text.primary"
                fontWeight={500}
              >
                {crumb.label}
              </Typography>
            );
          }

          return (
            <Link
              key={crumb.path}
              to={crumb.path}
              style={{
                color: theme.palette.text.secondary,
                textDecoration: 'none',
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  '&:hover': {
                    textDecoration: 'underline',
                    color: theme.palette.primary.main,
                  },
                }}
              >
                {crumb.label}
              </Typography>
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs;
