// frontend/src/components/UserProfile.jsx

import React, { useState } from 'react';
import {
  Box,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip,
  Badge
} from '@mui/material';
import {
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  AccountCircle as AccountIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Help as HelpIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useThemeContext } from '../context/ThemeContext';
import { authProvider } from '../pages/LoginPage';
import { useNavigate } from 'react-router-dom';

const UserProfile = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const { mode, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  
  const open = Boolean(anchorEl);
  
  // Get user info from localStorage (you can replace this with actual user context)
  const username = localStorage.getItem('username') || 'User';
  const userRole = localStorage.getItem('user_role') || 'user';
  const userEmail = localStorage.getItem('user_email') || 'user@company.com';

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    authProvider.logout();
    navigate('/login', { replace: true });
    handleClose();
  };

  const handleProfile = () => {
    // Navigate to user profile page when it exists
    // navigate('/profile');
    handleClose();
  };

  const handleSettings = () => {
    // Navigate to user settings page when it exists
    // navigate('/settings');
    handleClose();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'admin':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Administrator';
      default:
        return 'User';
    }
  };

  // Generate initials from username
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{ 
          ml: 1,
          p: 0.5,
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }}
      >
        <Badge
          variant="dot"
          color="success"
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          sx={{
            '& .MuiBadge-badge': {
              width: 8,
              height: 8,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: 'background.paper'
            }
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.875rem',
              fontWeight: 600,
              bgcolor: 'primary.main',
              color: 'primary.contrastText'
            }}
          >
            {getInitials(username)}
          </Avatar>
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 8,
          sx: {
            minWidth: 280,
            mt: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            background: theme => theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(32, 32, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
            '& .MuiMenuItem-root': {
              borderRadius: 1,
              mx: 1,
              my: 0.5,
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 600
              }}
            >
              {getInitials(username)}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {username}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.75rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {userEmail}
              </Typography>
              <Chip
                label={getRoleLabel(userRole)}
                size="small"
                color={getRoleColor(userRole)}
                sx={{ 
                  mt: 0.5,
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 500
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Menu Items */}
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <AccountIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Profile" 
            secondary="View and edit profile"
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </MenuItem>

        <MenuItem onClick={handleSettings}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Settings" 
            secondary="Preferences and configuration"
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </MenuItem>

        {/* Theme Toggle */}
        <MenuItem onClick={toggleTheme}>
          <ListItemIcon>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText 
            primary={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
            secondary={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </MenuItem>

        {/* Admin Section */}
        {(userRole === 'super_admin' || userRole === 'admin') && (
          <>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={() => navigate('/admin/dashboard')}>
              <ListItemIcon>
                <AdminIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Administration" 
                secondary="System management"
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </MenuItem>
          </>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Help */}
        <MenuItem>
          <ListItemIcon>
            <HelpIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Help & Support" 
            secondary="Documentation and support"
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </MenuItem>

        {/* Security */}
        <MenuItem>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Security" 
            secondary="Security settings"
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Logout */}
        <MenuItem 
          onClick={handleLogout}
          sx={{ 
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.contrastText'
            }
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: 'inherit' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Sign Out" 
            secondary="Log out of your account"
            secondaryTypographyProps={{ fontSize: '0.75rem', color: 'inherit', opacity: 0.7 }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserProfile;