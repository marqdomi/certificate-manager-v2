// frontend/src/components/UserAvatarMenu.jsx
// User avatar with dropdown menu for profile, settings, and logout

import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';

const ROLE_COLORS = {
  admin: 'error',
  operator: 'warning',
  viewer: 'info',
};

const UserAvatarMenu = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggleTheme } = useThemeContext();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    handleClose();
    navigate('/profile');
  };

  const handleSettings = () => {
    handleClose();
    navigate('/settings');
  };

  const handleAdmin = () => {
    handleClose();
    navigate('/admin');
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login', { replace: true });
  };

  const getInitials = () => {
    if (user?.full_name) {
      const parts = user.full_name.split(' ');
      return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="small"
        sx={{
          ml: 1,
          border: open ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
          transition: 'border-color 0.2s',
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: theme.palette.primary.main,
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {getInitials()}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 280,
            mt: 1,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info Header */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: theme.palette.primary.main,
                fontSize: '1.25rem',
                fontWeight: 600,
              }}
            >
              {getInitials()}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {user?.full_name ? user.full_name : (user?.username || 'User')}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user?.email ? user.email : `@${user?.username || 'unknown'}`}
              </Typography>
              {user?.role && (
                <Chip
                  size="small"
                  label={user.role}
                  color={ROLE_COLORS[user.role] || 'default'}
                  sx={{
                    mt: 0.5,
                    height: 20,
                    textTransform: 'capitalize',
                    '& .MuiChip-label': { px: 1, fontSize: '0.7rem' },
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
        <Divider />

        {/* Menu Items */}
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="My Profile" />
        </MenuItem>

        <MenuItem onClick={handleSettings}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </MenuItem>

        <MenuItem onClick={toggleTheme}>
          <ListItemIcon>
            {mode === 'dark' ? (
              <Brightness7Icon fontSize="small" />
            ) : (
              <Brightness4Icon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText primary={mode === 'dark' ? 'Light Mode' : 'Dark Mode'} />
        </MenuItem>

        {isAdmin && (
          <>
            <Divider />
            <MenuItem onClick={handleAdmin}>
              <ListItemIcon>
                <AdminPanelSettingsIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Admin Panel"
                primaryTypographyProps={{ color: 'error.main', fontWeight: 500 }}
              />
            </MenuItem>
          </>
        )}

        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{ color: 'error.main' }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserAvatarMenu;
