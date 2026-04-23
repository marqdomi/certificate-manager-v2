// frontend/src/components/MainLayout.jsx (Enhanced with Error Handling)

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
    Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton, 
    ListItemIcon, ListItemText, Typography, IconButton, Tooltip, Collapse 
} from '@mui/material';

// --- Enhanced imports for professional AppBar ---
import DashboardIcon from '@mui/icons-material/Dashboard';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DnsIcon from '@mui/icons-material/Dns';
import BuildIcon from '@mui/icons-material/Build';
import BrushIcon from '@mui/icons-material/Brush';
import LogoutIcon from '@mui/icons-material/Logout';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeContext } from '../context/ThemeContext';
import { authProvider } from '../pages/LoginPage';
import soleraLogo from '../assets/solera_logo.svg';
import PublishIcon from '@mui/icons-material/Publish';
import LanIcon from '@mui/icons-material/Lan';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ExtensionIcon from '@mui/icons-material/Extension';

// Import new professional components
import Breadcrumbs from './Breadcrumbs';
import UserProfile from './UserProfile';
import SystemStatus from './SystemStatus';
import GlobalSearch from './GlobalSearch';
import NotificationCenter from './NotificationCenter';

// Import Error Handling components
import ErrorBoundary, { ErrorProvider, GlobalErrorBoundary, SectionErrorBoundary } from './ErrorBoundary';
import { LoadingProvider, OverallProgress, GlobalProgressBar } from '../context/LoadingContext';

// Import GUI Enhancement Systems
import { TooltipProvider } from './EnhancedTooltips';
import { ContextualHelpProvider } from './ContextualHelpSystem';
import { KeyboardShortcutsProvider } from './KeyboardShortcutsSystem';
import { DragDropProvider } from './DragDropSystem';
import { ProgressiveDisclosureProvider } from './ProgressiveDisclosureSystem';

const drawerWidth = 240;

const navItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/app/dashboard' },
  { text: 'Certificates', icon: <VpnKeyIcon />, path: '/app/certificates' },
  { text: 'Devices', icon: <DnsIcon />, path: '/app/devices' },
  { text: 'PFX Generator', icon: <BuildIcon />, path: '/app/pfx-generator' },
  { text: 'Deploy Center', icon: <PublishIcon />, path: '/app/deploy' },
  { text: 'DigiCert Renewals', icon: <AutoFixHighIcon />, path: '/app/digicert/renewals' },
  { text: '🎨 GUI Demo', icon: <BrushIcon />, path: '/app/demo' },
];

const MainLayout = ({ children }) => {
  const { mode, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [openVips, setOpenVips] = React.useState(location.pathname.startsWith('/app/vips'));
  const [openAdmin, setOpenAdmin] = React.useState(location.pathname.startsWith('/app/admin'));

  const handleLogout = () => {
    authProvider.logout();
    navigate('/login', { replace: true });
  };

  const handleNavigateHome = () => {
    navigate('/app/dashboard', { replace: true });
  };

  const handleGlobalError = (error, errorInfo) => {
    // Log to external service if available
    console.error('Global Application Error:', error, errorInfo);
    
    // Could send to error reporting service
    // errorReporting.captureError(error, { context: errorInfo });
  };

  return (
    <ErrorProvider>
      <GlobalErrorBoundary 
        onError={handleGlobalError}
        onNavigateHome={handleNavigateHome}
      >
        <LoadingProvider>
          <TooltipProvider>
            <ContextualHelpProvider>
              <KeyboardShortcutsProvider>
                <DragDropProvider>
                  <ProgressiveDisclosureProvider>
                    <GlobalProgressBar />
                    <Box sx={{ display: 'flex' }}>
      {/* 🚀 PROFESSIONAL APPBAR - Enterprise-grade top navigation */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          // Enhanced glassmorphic effect with better backdrop
          background: theme => theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(32, 32, 32, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: theme => theme.palette.mode === 'dark'
            ? '0 4px 20px rgba(0, 0, 0, 0.3)'
            : '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Toolbar 
          sx={{ 
            minHeight: '64px !important',
            px: { xs: 1, sm: 2, md: 3 },
            gap: { xs: 1, sm: 1.5, md: 2 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%'
          }}
        >
          {/* Left section: Logo, Title, and Breadcrumbs */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            minWidth: 0,
            flex: { xs: '0 0 auto', md: '0 0 auto' },
            maxWidth: 'none'
          }}>
            {/* Enhanced Logo with brand styling */}
            <Box 
              component="img" 
              sx={{ 
                height: { xs: 24, sm: 28 }, 
                mr: { xs: 1, sm: 2 },
                filter: theme => theme.palette.mode === 'dark' ? 'brightness(1.1)' : 'none',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }} 
              alt="Solera Logo" 
              src={soleraLogo} 
            />
            
            {/* App Title with professional styling - responsive */}
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 600,
                fontSize: { xs: '0.975rem', sm: '1.125rem' },
                color: 'primary.main',
                mr: { xs: 1, sm: 2 },
                display: { xs: 'none', sm: 'block' },
                textShadow: theme => theme.palette.mode === 'dark' 
                  ? '0 0 8px rgba(33, 150, 243, 0.3)'
                  : '0 1px 2px rgba(0, 0, 0, 0.1)',
                whiteSpace: 'nowrap',
                overflow: 'visible',
                minWidth: 'fit-content'
              }}
            >
              Certificate Management Tool
            </Typography>

            {/* Mobile short title */}
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 600,
                fontSize: '0.975rem',
                color: 'primary.main',
                mr: 1,
                display: { xs: 'block', sm: 'none' },
                textShadow: theme => theme.palette.mode === 'dark' 
                  ? '0 0 8px rgba(33, 150, 243, 0.3)'
                  : '0 1px 2px rgba(0, 0, 0, 0.1)',
                whiteSpace: 'nowrap',
                overflow: 'visible'
              }}
            >
              Certificate Management Tool
            </Typography>

            {/* Professional Breadcrumbs - hide on small screens */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Breadcrumbs />
            </Box>
          </Box>
          
          {/* Center section: Global Search - responsive width */}
          <Box sx={{ 
            display: 'flex', 
            flex: { xs: '1 1 auto', md: '1 1 400px' },
            justifyContent: 'center',
            px: { xs: 1, sm: 2 },
            maxWidth: { xs: 'none', lg: '600px' },
            minWidth: { xs: '200px', sm: '300px' }
          }}>
            <GlobalSearch />
          </Box>

          {/* Right section: System Status, Notifications, Theme Toggle, User Profile */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1 },
            flex: '0 0 auto',
            minWidth: 'fit-content'
          }}>
            {/* System Health Status - hide on very small screens */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <SystemStatus />
            </Box>
            
            {/* Notification Center */}
            <NotificationCenter />
            
            {/* Theme Toggle with enhanced styling */}
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton 
                onClick={toggleTheme} 
                size="small"
                sx={{ 
                  ml: { xs: 0.5, sm: 1 },
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-1px)',
                    boxShadow: 2
                  }
                }}
              >
                {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>
            </Tooltip>

            {/* Professional User Profile */}
            <UserProfile />
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Enhanced Drawer with better styling */}
      <Drawer
        variant="permanent"
        sx={{ 
          width: drawerWidth, 
          flexShrink: 0, 
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            background: theme => theme.palette.mode === 'dark' 
              ? 'linear-gradient(180deg, rgba(18, 18, 18, 0.95) 0%, rgba(32, 32, 32, 0.95) 100%)'
              : 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%)',
            backdropFilter: 'blur(8px)'
          } 
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <SectionErrorBoundary section="navigation">
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

            {/* VIPs parent item */}
            <ListItem disablePadding>
              <ListItemButton onClick={() => setOpenVips((v) => !v)}
                sx={{
                  '&.active': {
                    backgroundColor: 'action.selected',
                    fontWeight: 'fontWeightBold',
                  },
                }}
              >
                <ListItemIcon><LanIcon /></ListItemIcon>
                <ListItemText primary="VIPs" />
                {openVips ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>

            <Collapse in={openVips} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                <ListItem disablePadding>
                  <ListItemButton
                    component={NavLink}
                    to="/app/vips/overview"
                    sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                  >
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary="Overview" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    component={NavLink}
                    to="/app/vips/search"
                    sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                  >
                    <ListItemIcon><SearchOutlinedIcon /></ListItemIcon>
                    <ListItemText primary="Search" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Collapse>

            {/* Admin Section - Only show if user has admin role */}
            {(localStorage.getItem('user_role') === 'super_admin' || localStorage.getItem('user_role') === 'admin') && (
              <>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => setOpenAdmin((v) => !v)}
                    sx={{
                      '&.active': {
                        backgroundColor: 'action.selected',
                        fontWeight: 'fontWeightBold',
                      },
                    }}
                  >
                    <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
                    <ListItemText primary="Administration" />
                    {openAdmin ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>

                <Collapse in={openAdmin} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem disablePadding>
                      <ListItemButton
                        component={NavLink}
                        to="/app/admin/dashboard"
                        sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                      >
                        <ListItemIcon><DashboardIcon /></ListItemIcon>
                        <ListItemText primary="Dashboard" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        component={NavLink}
                        to="/app/admin/users"
                        sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                      >
                        <ListItemIcon><PeopleIcon /></ListItemIcon>
                        <ListItemText primary="User Management" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        component={NavLink}
                        to="/app/admin/config"
                        sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                      >
                        <ListItemIcon><SettingsIcon /></ListItemIcon>
                        <ListItemText primary="System Config" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        component={NavLink}
                        to="/app/admin/providers/digicert"
                        sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                      >
                        <ListItemIcon><ExtensionIcon /></ListItemIcon>
                        <ListItemText primary="DigiCert Provider" />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}
          </List>
          </SectionErrorBoundary>
        </Box>
      </Drawer>
      
      {/* ✅ Enhanced main content area with professional spacing */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          minHeight: '100vh',
          backgroundColor: (theme) => theme.palette.background.default,
          // Enhanced spacing for new AppBar height
          pt: 4, // Additional padding top for better spacing
        }}
      >
        <Toolbar /> {/* Spacer for the enhanced AppBar */}
        <SectionErrorBoundary section="main-content">
          {children}
        </SectionErrorBoundary>
      </Box>
          </Box>
                  </ProgressiveDisclosureProvider>
                </DragDropProvider>
              </KeyboardShortcutsProvider>
            </ContextualHelpProvider>
          </TooltipProvider>
        </LoadingProvider>
      </GlobalErrorBoundary>
    </ErrorProvider>
  );
};

export default MainLayout;