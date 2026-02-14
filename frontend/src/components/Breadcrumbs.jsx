// frontend/src/components/Breadcrumbs.jsx
// Breadcrumbs navigation component
// Supports two contexts: inline in AppBar (inherits white text) and standalone (page colors)

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Typography,
  Box,
  useTheme,
  alpha,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

// Route configuration with labels and parent references
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
  '/certificate-cleanup': { label: 'Certificate Cleanup', parent: '/dashboard' },
  '/host-search': { label: 'Host Search', parent: '/dashboard' },
  '/audit-log': { label: 'Audit Log', parent: '/dashboard' },
  '/notifications': { label: 'Notifications', parent: '/dashboard' },
  '/profile': { label: 'My Profile', parent: '/dashboard' },
  '/settings': { label: 'Settings', parent: '/dashboard' },
  '/admin': { label: 'Admin Dashboard', parent: '/dashboard' },
  '/admin/users': { label: 'User Management', parent: '/admin' },
  '/admin/credentials': { label: 'Credential Templates', parent: '/admin' },
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

  // Colors that inherit from parent (works on AppBar gradient or page bg)
  const inactiveColor = 'inherit';
  const activeColor = 'inherit';

  return (
    <MuiBreadcrumbs
      separator={
        <NavigateNextIcon
          fontSize="small"
          sx={{ fontSize: 16, opacity: 0.6 }}
        />
      }
      aria-label="breadcrumb"
      sx={{
        '& .MuiBreadcrumbs-separator': { mx: 0.3 },
        '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
      }}
    >
      <Link
        to="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'inherit',
          textDecoration: 'none',
          opacity: 0.7,
        }}
      >
        <HomeIcon sx={{ fontSize: 16 }} />
      </Link>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        if (isLast) {
          return (
            <Typography
              key={crumb.path}
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: '0.82rem',
                color: activeColor,
                opacity: 1,
                whiteSpace: 'nowrap',
              }}
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
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.82rem',
                opacity: 0.7,
                whiteSpace: 'nowrap',
                '&:hover': {
                  opacity: 1,
                  textDecoration: 'underline',
                },
              }}
            >
              {crumb.label}
            </Typography>
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
};

export default Breadcrumbs;
