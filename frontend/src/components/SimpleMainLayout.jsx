// frontend/src/components/SimpleMainLayout.jsx

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
    Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton, 
    ListItemIcon, ListItemText, Typography, IconButton, Tooltip
} from '@mui/material';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DnsIcon from '@mui/icons-material/Dns';
import BuildIcon from '@mui/icons-material/Build';
import LogoutIcon from '@mui/icons-material/Logout';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PublishIcon from '@mui/icons-material/Publish';

import { useThemeContext } from '../context/ThemeContext';
import { authProvider } from '../pages/LoginPage';
import soleraLogo from '../assets/solera_logo.svg';
import SimpleErrorBoundary from './SimpleErrorBoundary';

const drawerWidth = 240;

const navItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/app/dashboard' },
  { text: 'Certificates', icon: <VpnKeyIcon />, path: '/app/certificates' },
  { text: 'Devices', icon: <DnsIcon />, path: '/app/devices' },
  { text: 'PFX Generator', icon: <BuildIcon />, path: '/app/pfx-generator' },
  { text: 'Deploy Center', icon: <PublishIcon />, path: '/app/deploy' },
  { text: 'Admin Panel', icon: <AdminPanelSettingsIcon />, path: '/app/admin' },
];

const SimpleMainLayout = ({ children }) => {
  const { mode, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    authProvider.logout();
    navigate('/login', { replace: true });
  };

  return (
    <SimpleErrorBoundary>
      <Box sx={{ display: 'flex' }}>
        {/* AppBar */}
        <AppBar 
          position="fixed" 
          sx={{ 
            zIndex: (theme) => theme.zIndex.drawer + 1,
            background: theme => theme.palette.mode === 'dark' 
              ? 'rgba(18, 18, 18, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            {/* Logo */}
            <Box 
              component="img" 
              sx={{ 
                height: 28, 
                mr: 2,
              }} 
              alt="Solera Logo" 
              src={soleraLogo} 
            />
            
            {/* Title */}
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Certificate Management Tool v2.5
            </Typography>

            {/* Theme Toggle */}
            <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton sx={{ mr: 1 }} onClick={toggleTheme} color="inherit">
                {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>
            </Tooltip>

            {/* Logout */}
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} color="inherit">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Side Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              mt: '64px', // AppBar height
              background: theme => theme.palette.mode === 'dark' 
                ? 'rgba(32, 32, 32, 0.9)'
                : 'rgba(250, 250, 250, 0.9)',
              backdropFilter: 'blur(10px)',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <List>
            {navItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  sx={{
                    '&.active': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            mt: '64px', // AppBar height
          }}
        >
          <SimpleErrorBoundary>
            {children}
          </SimpleErrorBoundary>
        </Box>
      </Box>
    </SimpleErrorBoundary>
  );
};

export default SimpleMainLayout;