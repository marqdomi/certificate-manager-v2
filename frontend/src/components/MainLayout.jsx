// frontend/src/components/MainLayout.jsx

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
    Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton, 
    ListItemIcon, ListItemText, Typography, Divider, Collapse
} from '@mui/material';

// --- Icons ---
import DashboardIcon from '@mui/icons-material/Dashboard';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DnsIcon from '@mui/icons-material/Dns';
import BuildIcon from '@mui/icons-material/Build';
import { authProvider } from '../pages/LoginPage';
import soleraLogo from '../assets/solera_logo.svg';
import PublishIcon from '@mui/icons-material/Publish';
import RadarIcon from '@mui/icons-material/Radar';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

// --- Components ---
import NotificationBell from './NotificationBell';
import UserAvatarMenu from './UserAvatarMenu';
import Breadcrumbs from './Breadcrumbs';

const drawerWidth = 240;

const navItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Certificates', icon: <VpnKeyIcon />, path: '/certificates' },
  { text: 'Devices', icon: <DnsIcon />, path: '/devices' },
  { text: 'Discovery', icon: <RadarIcon />, path: '/discovery' },
  { text: 'CSR Generator', icon: <AssignmentIcon />, path: '/generate-csr' },
  { text: 'PFX Generator', icon: <BuildIcon />, path: '/pfx-generator' },
  { text: 'Deploy Center', icon: <PublishIcon />, path: '/deploy' },
  { text: 'Batch Renewal', icon: <AutorenewIcon />, path: '/batch-renewal' },
  { text: 'Cert Cleanup', icon: <CleaningServicesIcon />, path: '/certificate-cleanup' },
  { text: 'Host Search', icon: <TravelExploreIcon />, path: '/host-search' },
  { text: 'Audit Log', icon: <HistoryIcon />, path: '/audit-log' },
];

const adminItems = [
  { text: 'Admin Dashboard', icon: <AdminPanelSettingsIcon />, path: '/admin' },
  { text: 'User Management', icon: <PeopleIcon />, path: '/admin/users' },
  { text: 'System Health', icon: <MonitorHeartIcon />, path: '/admin/health' },
];

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = React.useState(false);

  // Check if user is admin from token
  const isAdmin = React.useMemo(() => {
    try {
      const token = authProvider.getToken?.();
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.role === 'admin';
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      {/* ✅ CAMBIO 1: La AppBar ahora usará el estilo definido en el theme.js */}
      {/* Al quitar el 'elevation' y el 'sx' con el gradiente, permitimos que */}
      {/* el tema aplique automáticamente el efecto de vidrio esmerilado. */}
      <AppBar 
        position="fixed" 
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Box 
            component="img" 
            sx={{ height: 24, mr: 2 }}
            alt="Solera Logo" 
            src={soleraLogo} 
          />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Certificate Management Tool
          </Typography>
          
          {/* Notification Bell */}
          <NotificationBell />
          
          {/* User Avatar Menu (includes theme toggle and logout) */}
          <UserAvatarMenu />
        </Toolbar>
      </AppBar>
      
      {/* El Drawer (barra lateral) no necesita cambios, está perfecto. */}
      <Drawer
        variant="permanent"
        sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' } }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <List>
            {navItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton 
                  component={NavLink} 
                  to={item.path}
                  sx={{
                    '&.active': {
                      backgroundColor: 'action.selected',
                      fontWeight: 'fontWeightBold',
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          {/* Admin Section - Only visible to admins */}
          {isAdmin && (
            <>
              <Divider sx={{ my: 1 }} />
              <List>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => setAdminOpen(!adminOpen)}>
                    <ListItemIcon>
                      <AdminPanelSettingsIcon color="error" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Administration" 
                      primaryTypographyProps={{ fontWeight: 600, color: 'error.main' }}
                    />
                    {adminOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {adminItems.map((item) => (
                      <ListItem key={item.text} disablePadding>
                        <ListItemButton
                          component={NavLink}
                          to={item.path}
                          sx={{
                            pl: 4,
                            '&.active': {
                              backgroundColor: 'action.selected',
                              fontWeight: 'fontWeightBold',
                            },
                          }}
                        >
                          <ListItemIcon>{item.icon}</ListItemIcon>
                          <ListItemText primary={item.text} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </List>
            </>
          )}
          
          <Box sx={{ flexGrow: 1 }} />
        </Box>
      </Drawer>
      
      {/* Main content area */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          minHeight: '100vh',
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Breadcrumbs />
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;