// frontend/src/pages/SettingsPage.jsx
// User settings page with theme, notifications, and display preferences

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  FormGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Button,
  Slider,
  Stack,
  Chip,
  RadioGroup,
  Radio,
  FormLabel,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  FormatSize as FormatSizeIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { useThemeContext } from '../context/ThemeContext';
import { getNotificationPreferences, updateNotificationPreferences } from '../services/adminApi';

const SettingsPage = () => {
  const { mode, toggleTheme } = useThemeContext();
  
  // Notification preferences state
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications_enabled: true,
    email_digest_frequency: 'daily',
    notification_settings: {
      certificate_expiry: true,
      certificate_renewal: true,
      deployment_status: true,
      system_alerts: true,
      user_activity: false,
      batch_operations: true,
    },
  });
  
  // Display preferences state (localStorage)
  const [displaySettings, setDisplaySettings] = useState({
    tableRowsPerPage: 25,
    autoRefreshInterval: 30,
    compactMode: false,
    showTooltips: true,
    animationsEnabled: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load preferences on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load notification preferences from API
        const prefs = await getNotificationPreferences();
        setNotificationSettings({
          email_notifications_enabled: prefs.email_notifications_enabled,
          email_digest_frequency: prefs.email_digest_frequency,
          notification_settings: prefs.notification_settings || {},
        });
        
        // Load display preferences from localStorage
        const savedDisplay = localStorage.getItem('displaySettings');
        if (savedDisplay) {
          setDisplaySettings(JSON.parse(savedDisplay));
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        setSnackbar({
          open: true,
          message: 'Error al cargar las preferencias',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Save notification settings
  const handleSaveNotificationSettings = async () => {
    try {
      setSaving(true);
      await updateNotificationPreferences({
        email_notifications_enabled: notificationSettings.email_notifications_enabled,
        email_digest_frequency: notificationSettings.email_digest_frequency,
        notification_settings: notificationSettings.notification_settings,
      });
      setSnackbar({
        open: true,
        message: 'Preferencias de notificaciones guardadas',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error al guardar preferencias de notificaciones',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Save display settings to localStorage
  const handleSaveDisplaySettings = () => {
    localStorage.setItem('displaySettings', JSON.stringify(displaySettings));
    setSnackbar({
      open: true,
      message: 'Preferencias de visualización guardadas',
      severity: 'success',
    });
  };

  // Reset display settings
  const handleResetDisplaySettings = () => {
    const defaultSettings = {
      tableRowsPerPage: 25,
      autoRefreshInterval: 30,
      compactMode: false,
      showTooltips: true,
      animationsEnabled: true,
    };
    setDisplaySettings(defaultSettings);
    localStorage.setItem('displaySettings', JSON.stringify(defaultSettings));
    setSnackbar({
      open: true,
      message: 'Preferencias restablecidas',
      severity: 'info',
    });
  };

  // Handle notification toggle
  const handleNotificationToggle = (key) => {
    setNotificationSettings(prev => ({
      ...prev,
      notification_settings: {
        ...prev.notification_settings,
        [key]: !prev.notification_settings[key],
      },
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <SettingsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">
          Configuración
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Appearance Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Apariencia"
              subheader="Personaliza el aspecto de la aplicación"
              avatar={mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
            />
            <Divider />
            <CardContent>
              <FormGroup>
                <Box sx={{ mb: 3 }}>
                  <FormLabel component="legend" sx={{ mb: 1 }}>Tema</FormLabel>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <LightModeIcon color={mode === 'light' ? 'primary' : 'disabled'} />
                    <Switch
                      checked={mode === 'dark'}
                      onChange={toggleTheme}
                      color="primary"
                    />
                    <DarkModeIcon color={mode === 'dark' ? 'primary' : 'disabled'} />
                    <Chip 
                      size="small" 
                      label={mode === 'dark' ? 'Oscuro' : 'Claro'} 
                      color="primary" 
                      variant="outlined"
                    />
                  </Stack>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={displaySettings.compactMode}
                      onChange={(e) => setDisplaySettings({ ...displaySettings, compactMode: e.target.checked })}
                    />
                  }
                  label="Modo compacto"
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1, mb: 2 }}>
                  Reduce el espaciado para mostrar más contenido
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={displaySettings.animationsEnabled}
                      onChange={(e) => setDisplaySettings({ ...displaySettings, animationsEnabled: e.target.checked })}
                    />
                  }
                  label="Animaciones"
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1, mb: 2 }}>
                  Habilita transiciones y animaciones suaves
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={displaySettings.showTooltips}
                      onChange={(e) => setDisplaySettings({ ...displaySettings, showTooltips: e.target.checked })}
                    />
                  }
                  label="Mostrar tooltips"
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Display Settings Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Visualización"
              subheader="Configura tablas y actualización automática"
              avatar={<FormatSizeIcon />}
            />
            <Divider />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Filas por página en tablas
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={displaySettings.tableRowsPerPage}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, tableRowsPerPage: e.target.value })}
                  >
                    <MenuItem value={10}>10 filas</MenuItem>
                    <MenuItem value={25}>25 filas</MenuItem>
                    <MenuItem value={50}>50 filas</MenuItem>
                    <MenuItem value={100}>100 filas</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Intervalo de actualización automática: {displaySettings.autoRefreshInterval}s
                </Typography>
                <Slider
                  value={displaySettings.autoRefreshInterval}
                  onChange={(e, value) => setDisplaySettings({ ...displaySettings, autoRefreshInterval: value })}
                  min={10}
                  max={120}
                  step={10}
                  marks={[
                    { value: 10, label: '10s' },
                    { value: 60, label: '60s' },
                    { value: 120, label: '120s' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}s`}
                />
              </Box>

              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveDisplaySettings}
                >
                  Guardar
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ResetIcon />}
                  onClick={handleResetDisplaySettings}
                >
                  Restablecer
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings Card */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Notificaciones"
              subheader="Configura qué notificaciones deseas recibir"
              avatar={<NotificationsIcon />}
              action={
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSaveNotificationSettings}
                  disabled={saving}
                >
                  Guardar
                </Button>
              }
            />
            <Divider />
            <CardContent>
              <Grid container spacing={4}>
                {/* Email Settings */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Notificaciones por Email
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.email_notifications_enabled}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            email_notifications_enabled: e.target.checked,
                          })}
                        />
                      }
                      label="Habilitar emails"
                    />
                  </FormGroup>
                  
                  {notificationSettings.email_notifications_enabled && (
                    <Box sx={{ mt: 2 }}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">Frecuencia de resumen</FormLabel>
                        <RadioGroup
                          value={notificationSettings.email_digest_frequency}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            email_digest_frequency: e.target.value,
                          })}
                        >
                          <FormControlLabel value="realtime" control={<Radio />} label="Tiempo real" />
                          <FormControlLabel value="daily" control={<Radio />} label="Diario" />
                          <FormControlLabel value="weekly" control={<Radio />} label="Semanal" />
                          <FormControlLabel value="never" control={<Radio />} label="Nunca" />
                        </RadioGroup>
                      </FormControl>
                    </Box>
                  )}
                </Grid>

                {/* In-App Notification Types */}
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Tipos de Notificación
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.notification_settings.certificate_expiry ?? true}
                              onChange={() => handleNotificationToggle('certificate_expiry')}
                            />
                          }
                          label="Vencimiento de certificados"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.notification_settings.certificate_renewal ?? true}
                              onChange={() => handleNotificationToggle('certificate_renewal')}
                            />
                          }
                          label="Renovación de certificados"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.notification_settings.deployment_status ?? true}
                              onChange={() => handleNotificationToggle('deployment_status')}
                            />
                          }
                          label="Estado de despliegues"
                        />
                      </FormGroup>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.notification_settings.system_alerts ?? true}
                              onChange={() => handleNotificationToggle('system_alerts')}
                            />
                          }
                          label="Alertas del sistema"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.notification_settings.batch_operations ?? true}
                              onChange={() => handleNotificationToggle('batch_operations')}
                            />
                          }
                          label="Operaciones por lotes"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.notification_settings.user_activity ?? false}
                              onChange={() => handleNotificationToggle('user_activity')}
                            />
                          }
                          label="Actividad de usuarios"
                        />
                      </FormGroup>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* System Info Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Información del Sistema"
              avatar={<LanguageIcon />}
            />
            <Divider />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Versión de la aplicación
                  </Typography>
                  <Typography variant="body1">v2.5.0</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Última actualización
                  </Typography>
                  <Typography variant="body1">Junio 2025</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Idioma
                  </Typography>
                  <Typography variant="body1">Español</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Zona horaria
                  </Typography>
                  <Typography variant="body1">{Intl.DateTimeFormat().resolvedOptions().timeZone}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Keyboard Shortcuts Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Atajos de Teclado" />
            <Divider />
            <CardContent>
              <Grid container spacing={1}>
                {[
                  { keys: 'Ctrl + K', action: 'Búsqueda rápida' },
                  { keys: 'Ctrl + N', action: 'Nueva notificación' },
                  { keys: 'Ctrl + R', action: 'Actualizar datos' },
                  { keys: 'Ctrl + D', action: 'Ir al dashboard' },
                  { keys: 'Escape', action: 'Cerrar diálogo' },
                ].map(({ keys, action }) => (
                  <Grid item xs={12} key={keys}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">{action}</Typography>
                      <Chip label={keys} size="small" variant="outlined" />
                    </Box>
                  </Grid>
                ))}
              </Grid>
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

export default SettingsPage;
