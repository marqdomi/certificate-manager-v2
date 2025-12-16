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
  Card,
  CardContent,
  CardHeader,
  IconButton,
  InputAdornment,
  Chip,
  Stack,
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/api';
import { changeMyPassword } from '../services/adminApi';

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  
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
        const { data } = await apiClient.get('/users/me');
        setProfileData({
          full_name: data.full_name || '',
          email: data.email || '',
          username: data.username || '',
        });
      } catch (err) {
        setSnackbar({
          open: true,
          message: 'Error al cargar el perfil',
          severity: 'error',
        });
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

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
        message: 'Perfil actualizado correctamente',
        severity: 'success',
      });
      setEditing(false);
      refreshUser();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Error al actualizar el perfil',
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
        message: 'Las contraseñas no coinciden',
        severity: 'error',
      });
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      setSnackbar({
        open: true,
        message: 'La contraseña debe tener al menos 8 caracteres',
        severity: 'error',
      });
      return;
    }

    try {
      setChangingPassword(true);
      await changeMyPassword(passwordData.currentPassword, passwordData.newPassword);
      setSnackbar({
        open: true,
        message: 'Contraseña actualizada correctamente',
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
        message: err.response?.data?.detail || 'Error al cambiar la contraseña',
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

    if (strength <= 2) return { strength: 33, label: 'Débil', color: 'error' };
    if (strength <= 4) return { strength: 66, label: 'Media', color: 'warning' };
    return { strength: 100, label: 'Fuerte', color: 'success' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  // Role chip
  const getRoleChip = (role) => {
    const config = {
      admin: { color: 'error', label: 'Administrador' },
      operator: { color: 'primary', label: 'Operador' },
      viewer: { color: 'default', label: 'Visor' },
    };
    const { color, label } = config[role] || config.viewer;
    return <Chip size="small" color={color} label={label} />;
  };

  if (profileLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">
          Mi Perfil
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Información Personal"
              action={
                !editing ? (
                  <IconButton onClick={() => setEditing(true)}>
                    <EditIcon />
                  </IconButton>
                ) : (
                  <Stack direction="row" spacing={1}>
                    <IconButton 
                      color="primary" 
                      onClick={handleSaveProfile}
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={24} /> : <SaveIcon />}
                    </IconButton>
                    <IconButton 
                      onClick={() => setEditing(false)}
                      disabled={loading}
                    >
                      <CancelIcon />
                    </IconButton>
                  </Stack>
                )
              }
            />
            <Divider />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nombre Completo"
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
                    label="Nombre de Usuario"
                    value={profileData.username}
                    disabled
                    helperText="El nombre de usuario no se puede modificar"
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
                    label="Rol"
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
            </CardContent>
          </Card>
        </Grid>

        {/* Avatar and Info Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ textAlign: 'center', py: 3 }}>
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
              {profileData.full_name || profileData.username}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              @{profileData.username}
            </Typography>
            <Box sx={{ mt: 2 }}>
              {getRoleChip(user?.role)}
            </Box>
            {user?.last_login && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <HistoryIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Último acceso: {format(new Date(user.last_login), 'PPp', { locale: es })}
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Password Change Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Cambiar Contraseña"
              avatar={<LockIcon color="action" />}
            />
            <Divider />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Contraseña Actual"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            edge="end"
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
                    label="Nueva Contraseña"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    helperText={
                      passwordData.newPassword && (
                        <Box component="span" sx={{ color: `${passwordStrength.color}.main` }}>
                          Fortaleza: {passwordStrength.label}
                        </Box>
                      )
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            edge="end"
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
                    label="Confirmar Contraseña"
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
                        ? 'Las contraseñas no coinciden'
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
                    {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Info Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Seguridad" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Requisitos de contraseña:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5 } }}>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Mínimo 8 caracteres
                  </Typography>
                </li>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Incluir mayúsculas y minúsculas
                  </Typography>
                </li>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Incluir números
                  </Typography>
                </li>
                <li>
                  <Typography variant="caption" color="text.secondary">
                    Incluir caracteres especiales (recomendado)
                  </Typography>
                </li>
              </Box>
            </CardContent>
          </Card>
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
  );
};

export default ProfilePage;
