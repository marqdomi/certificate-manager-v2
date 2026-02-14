// frontend/src/pages/ProfilePage.jsx
// User profile page with personal info management and password change

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  InputAdornment,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Lock as LockIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/api';
import { PageHeader, PageTransition, SkeletonStatCard } from '../components/shared';
import { glassmorphicCard } from '../constants/styleMixins';
import { changeMyPassword } from '../services/adminApi';

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const theme = useTheme();
  
  // Profile state
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    username: '',
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const { data } = await apiClient.get('/users/me');
        setProfileData({
          full_name: data.full_name || user?.full_name || '',
          email: data.email || user?.email || '',
          username: data.username || user?.username || '',
        });
      } catch (err) {
        console.error('Error loading profile:', err);
        // Fallback to user data from context if API fails
        if (user) {
          setProfileData({
            full_name: user.full_name || '',
            email: user.email || '',
            username: user.username || '',
          });
        }
        setSnackbar({
          open: true,
          message: 'Error loading profile',
          severity: 'error',
        });
      } finally {
        setProfileLoading(false);
      }
    };
    
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Handle profile update
  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      await apiClient.patch('/users/me', {
        full_name: profileData.full_name,
        email: profileData.email,
      });
      setSnackbar({
        open: true,
        message: 'Profile updated successfully',
        severity: 'success',
      });
      setEditing(false);
      refreshUser();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Error updating profile',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle password change
  const handleChangePassword = async () => {
    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setSnackbar({
        open: true,
        message: 'Passwords do not match',
        severity: 'error',
      });
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      setSnackbar({
        open: true,
        message: 'Password must be at least 8 characters long',
        severity: 'error',
      });
      return;
    }

    try {
      setChangingPassword(true);
      await changeMyPassword(passwordData.currentPassword, passwordData.newPassword);
      setSnackbar({
        open: true,
        message: 'Password updated successfully',
        severity: 'success',
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Error changing password',
        severity: 'error',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: 'grey' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: 33, label: 'Weak', color: 'error' };
    if (strength <= 4) return { strength: 66, label: 'Medium', color: 'warning' };
    return { strength: 100, label: 'Strong', color: 'success' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  // Role chip
  const getRoleChip = (role) => {
    const config = {
      admin: { color: 'error', label: 'Administrator' },
      operator: { color: 'primary', label: 'Operator' },
      viewer: { color: 'default', label: 'Viewer' },
    };
    const { color, label } = config[role] || config.viewer;
    return <Chip size="small" color={color} label={label} />;
  };

  if (profileLoading) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)}
        </Box>
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal information and security settings."
      />

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ ...glassmorphicCard(theme) }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Personal Information</Typography>
              {!editing ? (
                  <IconButton onClick={() => setEditing(true)} aria-label="Edit profile">
                    <EditIcon />
                  </IconButton>
                ) : (
                  <Stack direction="row" spacing={1}>
                    <IconButton 
                      color="primary" 
                      onClick={handleSaveProfile}
                      disabled={loading}
                      aria-label="Save profile"
                    >
                      {loading ? <CircularProgress size={24} /> : <SaveIcon />}
                    </IconButton>
                    <IconButton 
                      onClick={() => setEditing(false)}
                      disabled={loading}
                      aria-label="Cancel editing"
                    >
                      <CancelIcon />
                    </IconButton>
                  </Stack>
                )
              }
            </Box>
            <Divider sx={{ mt: 1 }} />
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    disabled={!editing}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={profileData.username}
                    disabled
                    helperText="Username cannot be modified"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Role"
                    value={user?.role || ''}
                    disabled
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {getRoleChip(user?.role)}
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Avatar and Info Card */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ ...glassmorphicCard(theme), textAlign: 'center', py: 3 }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 2,
                fontSize: 48,
                bgcolor: 'primary.main',
              }}
            >
              {profileData.full_name?.charAt(0)?.toUpperCase() || 
               profileData.username?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <Typography variant="h6" fontWeight="bold">
              {profileData.full_name || profileData.username || 'User'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              @{profileData.username || 'unknown'}
            </Typography>
            <Box sx={{ mt: 2 }}>
              {getRoleChip(user?.role)}
            </Box>
            {user?.last_login && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <HistoryIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Last login: {new Date(user.last_login).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Password Change Card */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ ...glassmorphicCard(theme) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2 }}>
              <LockIcon color="action" />
              <Typography variant="subtitle1" fontWeight={600}>Change Password</Typography>
            </Box>
            <Divider sx={{ mt: 1 }} />
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Current Password"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            edge="end"
                            aria-label="Toggle current password visibility"
                          >
                            {showPasswords.current ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="New Password"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    helperText={
                      passwordData.newPassword && (
                        <Box component="span" sx={{ color: `${passwordStrength.color}.main` }}>
                          Strength: {passwordStrength.label}
                        </Box>
                      )
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            edge="end"
                            aria-label="Toggle new password visibility"
                          >
                            {showPasswords.new ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Confirm Password"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    error={
                      passwordData.confirmPassword && 
                      passwordData.newPassword !== passwordData.confirmPassword
                    }
                    helperText={
                      passwordData.confirmPassword && 
                      passwordData.newPassword !== passwordData.confirmPassword
                        ? 'Passwords do not match'
                        : ''
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {passwordData.confirmPassword && 
                           passwordData.newPassword === passwordData.confirmPassword && (
                            <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                          )}
                          <IconButton
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            edge="end"
                            aria-label="Toggle confirm password visibility"
                          >
                            {showPasswords.confirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleChangePassword}
                    disabled={
                      changingPassword || 
                      !passwordData.currentPassword || 
                      !passwordData.newPassword || 
                      passwordData.newPassword !== passwordData.confirmPassword
                    }
                    startIcon={changingPassword ? <CircularProgress size={20} /> : <LockIcon />}
                  >
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Security Info Card */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ ...glassmorphicCard(theme) }}>
            <Box sx={{ px: 2, pt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Security</Typography>
            </Box>
            <Divider sx={{ mt: 1 }} />
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Password Requirements:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5 } }}>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Minimum 8 characters
                  </Typography>
                </li>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Include uppercase and lowercase letters
                  </Typography>
                </li>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Include numbers
                  </Typography>
                </li>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Include special characters (recommended)
                  </Typography>
                </li>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </PageTransition>
  );
};

export default ProfilePage;
