// frontend/src/components/MainLayout.jsx

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
    Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton, 
    ListItemIcon, ListItemText, Typography, IconButton, Tooltip, Collapse 
} from '@mui/material';

// --- (No se cambian los imports) ---
import DashboardIcon from '@mui/icons-material/Dashboard';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DnsIcon from '@mui/icons-material/Dns';
import BuildIcon from '@mui/icons-material/Build';
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
import RadarIcon from '@mui/icons-material/Radar';

const drawerWidth = 240;

const navItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Certificates', icon: <VpnKeyIcon />, path: '/certificates' },
  { text: 'Devices', icon: <DnsIcon />, path: '/devices' },
  { text: 'Discovery', icon: <RadarIcon />, path: '/discovery' },
  { text: 'PFX Generator', icon: <BuildIcon />, path: '/pfx-generator' },
  { text: 'Deploy Center', icon: <PublishIcon />, path: '/deploy' },
];

const MainLayout = ({ children }) => {
  const { mode, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [openVips, setOpenVips] = React.useState(location.pathname.startsWith('/vips'));

  const handleLogout = () => {
    authProvider.logout();
    navigate('/login', { replace: true });
  };

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
            sx={{ height: 24, mr: 2 }} // Se quita el filtro invertido, ya que el logo es SVG y se puede controlar mejor.
            alt="Solera Logo" 
            src={soleraLogo} 
          />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Certificate Management Tool
          </Typography>
          
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Logout">
            <IconButton sx={{ ml: 1 }} onClick={handleLogout} color="inherit">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      {/* El Drawer (barra lateral) no necesita cambios, está perfecto. */}
      <Drawer
        variant="permanent"
        sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' } }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
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
                    to="/vips/overview"
                    sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                  >
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary="Overview" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    component={NavLink}
                    to="/vips/search"
                    sx={{ pl: 4, '&.active': { backgroundColor: 'action.selected', fontWeight: 'fontWeightBold' } }}
                  >
                    <ListItemIcon><SearchOutlinedIcon /></ListItemIcon>
                    <ListItemText primary="Search" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Collapse>
          </List>
        </Box>
      </Drawer>
      
      {/* ✅ CAMBIO 2: El área de contenido principal ahora aplica el fondo del tema. */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          minHeight: '100vh', // Asegura que el fondo cubra toda la altura
          // Esta es la línea clave que aplica el color de fondo de tu tema
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        <Toolbar /> {/* Espaciador para que el contenido no quede debajo de la AppBar */}
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;