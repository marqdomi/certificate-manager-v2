// frontend/src/components/Breadcrumbs.jsx

import React from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Typography, Link, Box } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { 
  Home as HomeIcon, 
  VpnKey as CertificatesIcon,
  Dns as DevicesIcon,
  Build as PfxIcon,
  Publish as DeployIcon,
  Lan as VipsIcon,
  AdminPanelSettings as AdminIcon,
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  People as UsersIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const routeConfig = {
  '/dashboard': { 
    label: 'Dashboard', 
    icon: <DashboardIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/certificates': { 
    label: 'Certificates', 
    icon: <CertificatesIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/devices': { 
    label: 'Devices', 
    icon: <DevicesIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/pfx-generator': { 
    label: 'PFX Generator', 
    icon: <PfxIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/deploy': { 
    label: 'Deploy Center', 
    icon: <DeployIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/vips': { 
    label: 'VIPs', 
    icon: <VipsIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/vips/overview': { 
    label: 'Overview', 
    icon: <DashboardIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: '/vips' 
  },
  '/vips/search': { 
    label: 'Search', 
    icon: <SearchIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: '/vips' 
  },
  '/admin': { 
    label: 'Administration', 
    icon: <AdminIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: null 
  },
  '/admin/dashboard': { 
    label: 'Dashboard', 
    icon: <DashboardIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: '/admin' 
  },
  '/admin/users': { 
    label: 'User Management', 
    icon: <UsersIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: '/admin' 
  },
  '/admin/config': { 
    label: 'System Config', 
    icon: <SettingsIcon sx={{ fontSize: 16, mr: 0.5 }} />,
    parent: '/admin' 
  }
};

const Breadcrumbs = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Build breadcrumb path
  const buildBreadcrumbs = () => {
    const breadcrumbs = [];
    
    // Always start with home
    breadcrumbs.push({
      path: '/dashboard',
      label: 'Home',
      icon: <HomeIcon sx={{ fontSize: 16, mr: 0.5 }} />,
      isLast: false
    });

    // Find current route config
    const currentRoute = routeConfig[currentPath];
    if (currentRoute) {
      // Add parent breadcrumbs if they exist
      if (currentRoute.parent && routeConfig[currentRoute.parent]) {
        const parent = routeConfig[currentRoute.parent];
        breadcrumbs.push({
          path: currentRoute.parent,
          label: parent.label,
          icon: parent.icon,
          isLast: false
        });
      }

      // Add current page (unless it's already home)
      if (currentPath !== '/dashboard') {
        breadcrumbs.push({
          path: currentPath,
          label: currentRoute.label,
          icon: currentRoute.icon,
          isLast: true
        });
      } else {
        breadcrumbs[0].isLast = true;
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs for single-level navigation
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center',
      ml: { xs: 1, sm: 2 },
      maxWidth: { md: '300px', lg: '400px' },
      overflow: 'hidden',
      '& .MuiBreadcrumbs-separator': {
        color: 'text.secondary',
        mx: { xs: 0.5, sm: 1 }
      }
    }}>
      <MuiBreadcrumbs 
        separator="/"
        maxItems={3}
        sx={{
          '& .MuiBreadcrumbs-ol': {
            alignItems: 'center'
          }
        }}
      >
        {breadcrumbs.map((crumb, index) => (
          crumb.isLast ? (
            <Typography 
              key={crumb.path}
              color="text.primary" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                fontWeight: 500,
                fontSize: { xs: '0.8rem', sm: '0.875rem' }
              }}
            >
              {crumb.icon}
              {crumb.label}
            </Typography>
          ) : (
            <Link 
              key={crumb.path}
              component={RouterLink} 
              to={crumb.path}
              underline="hover"
              color="text.secondary"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              {crumb.icon}
              {crumb.label}
            </Link>
          )
        ))}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs;