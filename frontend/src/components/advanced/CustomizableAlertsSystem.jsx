/**
 * 🚨 Customizable Alerts System
 * CMT v2.5 - Sistema de alertas personalizables con constructor de reglas
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Slider,
  FormGroup,
  Checkbox,
  Stack,
  Autocomplete,
  ButtonGroup
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  NotificationImportant,
  Warning,
  Error,
  Info,
  CheckCircle,
  Settings,
  Schedule,
  Email,
  Sms,
  Webhook,
  ExpandMore,
  PlayArrow,
  Pause,
  Stop,
  History,
  Analytics,
  FilterList,
  Save,
  Cancel,
  Preview,
  Send,
  Group,
  Person,
  AccessTime,
  TrendingUp,
  Security,
  Speed,
  Timeline
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';

/**
 * 📏 Configuración de condiciones de alertas
 */
const CONDITION_TYPES = {
  threshold: {
    label: 'Umbral',
    description: 'Activar cuando un valor supere/baje de un límite',
    operators: [
      { value: 'gt', label: 'Mayor que (>)' },
      { value: 'gte', label: 'Mayor o igual que (≥)' },
      { value: 'lt', label: 'Menor que (<)' },
      { value: 'lte', label: 'Menor o igual que (≤)' },
      { value: 'eq', label: 'Igual a (=)' },
      { value: 'neq', label: 'Diferente de (≠)' }
    ]
  },
  change: {
    label: 'Cambio',
    description: 'Activar cuando haya un cambio porcentual',
    operators: [
      { value: 'increase', label: 'Incremento mayor a (%)' },
      { value: 'decrease', label: 'Decremento mayor a (%)' },
      { value: 'change', label: 'Cambio absoluto mayor a (%)' }
    ]
  },
  pattern: {
    label: 'Patrón',
    description: 'Activar basado en patrones temporales',
    operators: [
      { value: 'consecutive_above', label: 'Consecutivo por encima' },
      { value: 'consecutive_below', label: 'Consecutivo por debajo' },
      { value: 'pattern_match', label: 'Coincidencia de patrón' }
    ]
  },
  anomaly: {
    label: 'Anomalía',
    description: 'Activar cuando se detecte comportamiento anómalo',
    operators: [
      { value: 'statistical_outlier', label: 'Outlier estadístico' },
      { value: 'trend_break', label: 'Ruptura de tendencia' },
      { value: 'volatility_spike', label: 'Pico de volatilidad' }
    ]
  }
};

/**
 * 📊 Métricas disponibles para alertas
 */
const ALERT_METRICS = {
  certificates: [
    { key: 'total_certificates', label: 'Total Certificados', type: 'number' },
    { key: 'expiring_soon', label: 'Próximos a Expirar', type: 'number' },
    { key: 'expired', label: 'Expirados', type: 'number' },
    { key: 'expiry_days_avg', label: 'Días Promedio para Expirar', type: 'number' }
  ],
  devices: [
    { key: 'total_devices', label: 'Total Dispositivos', type: 'number' },
    { key: 'offline_devices', label: 'Dispositivos Offline', type: 'number' },
    { key: 'devices_with_errors', label: 'Dispositivos con Errores', type: 'number' }
  ],
  security: [
    { key: 'security_score', label: 'Puntuación Seguridad', type: 'percentage' },
    { key: 'vulnerabilities', label: 'Vulnerabilidades', type: 'number' },
    { key: 'compliance_score', label: 'Cumplimiento', type: 'percentage' }
  ]
};

/**
 * 📢 Canales de notificación
 */
const NOTIFICATION_CHANNELS = {
  email: {
    label: 'Email',
    icon: Email,
    description: 'Enviar notificación por correo electrónico',
    config: ['recipients', 'subject_template']
  },
  sms: {
    label: 'SMS',
    icon: Sms,
    description: 'Enviar notificación por SMS',
    config: ['phone_numbers']
  },
  webhook: {
    label: 'Webhook',
    icon: Webhook,
    description: 'Llamar a un endpoint HTTP',
    config: ['url', 'method', 'headers']
  },
  slack: {
    label: 'Slack',
    icon: Group,
    description: 'Enviar a canal de Slack',
    config: ['webhook_url', 'channel']
  }
};

/**
 * ⚡ Severidades de alertas
 */
const ALERT_SEVERITIES = {
  info: { label: 'Información', color: '#2196f3', icon: Info },
  warning: { label: 'Advertencia', color: '#ff9800', icon: Warning },
  error: { label: 'Error', color: '#f44336', icon: Error },
  critical: { label: 'Crítico', color: '#d32f2f', icon: NotificationImportant }
};

/**
 * 🚨 Customizable Alerts System Component
 */
const CustomizableAlertsSystem = ({ 
  onAlertCreated, 
  onAlertTriggered,
  initialAlerts = [] 
}) => {
  // Estados principales
  const [alerts, setAlerts] = useState(initialAlerts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [alertHistory, setAlertHistory] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);

  // Estado del formulario de nueva alerta
  const [alertForm, setAlertForm] = useState({
    name: '',
    description: '',
    enabled: true,
    severity: 'warning',
    category: 'certificates',
    conditions: [{
      metric: '',
      type: 'threshold',
      operator: 'gt',
      value: '',
      timeWindow: 5 // minutos
    }],
    notifications: {
      channels: ['email'],
      templates: {
        email: {
          subject: 'Alerta CMT: {{alert_name}}',
          body: 'Se ha activado la alerta {{alert_name}}: {{condition_description}}'
        }
      },
      escalation: {
        enabled: false,
        delay: 30, // minutos
        levels: []
      }
    },
    schedule: {
      enabled: true,
      timezone: 'Europe/Madrid',
      active_hours: { start: '09:00', end: '18:00' },
      active_days: [1, 2, 3, 4, 5], // Lunes a viernes
      snooze_duration: 60 // minutos
    }
  });

  /**
   * 🔄 Cargar alertas guardadas
   */
  useEffect(() => {
    loadSavedAlerts();
    loadAlertHistory();
  }, []);

  const loadSavedAlerts = () => {
    try {
      const saved = localStorage.getItem('cmt_custom_alerts');
      if (saved) {
        setAlerts(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadAlertHistory = () => {
    try {
      const saved = localStorage.getItem('cmt_alert_history');
      if (saved) {
        setAlertHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading alert history:', error);
    }
  };

  /**
   * 💾 Guardar alertas
   */
  const saveAlerts = useCallback((newAlerts) => {
    try {
      localStorage.setItem('cmt_custom_alerts', JSON.stringify(newAlerts));
      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  }, []);

  /**
   * ➕ Crear nueva alerta
   */
  const handleCreateAlert = () => {
    setEditingAlert(null);
    setAlertForm({
      name: '',
      description: '',
      enabled: true,
      severity: 'warning',
      category: 'certificates',
      conditions: [{
        metric: '',
        type: 'threshold',
        operator: 'gt',
        value: '',
        timeWindow: 5
      }],
      notifications: {
        channels: ['email'],
        templates: {
          email: {
            subject: 'Alerta CMT: {{alert_name}}',
            body: 'Se ha activado la alerta {{alert_name}}: {{condition_description}}'
          }
        },
        escalation: {
          enabled: false,
          delay: 30,
          levels: []
        }
      },
      schedule: {
        enabled: true,
        timezone: 'Europe/Madrid',
        active_hours: { start: '09:00', end: '18:00' },
        active_days: [1, 2, 3, 4, 5],
        snooze_duration: 60
      }
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  /**
   * ✏️ Editar alerta existente
   */
  const handleEditAlert = (alert) => {
    setEditingAlert(alert);
    setAlertForm(alert);
    setActiveStep(0);
    setDialogOpen(true);
  };

  /**
   * 💾 Guardar alerta
   */
  const handleSaveAlert = () => {
    const newAlert = {
      ...alertForm,
      id: editingAlert?.id || Date.now(),
      created_at: editingAlert?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      triggered_count: editingAlert?.triggered_count || 0,
      last_triggered: editingAlert?.last_triggered || null
    };

    const updatedAlerts = editingAlert
      ? alerts.map(a => a.id === editingAlert.id ? newAlert : a)
      : [...alerts, newAlert];

    saveAlerts(updatedAlerts);
    setDialogOpen(false);

    if (onAlertCreated) {
      onAlertCreated(newAlert);
    }
  };

  /**
   * 🗑️ Eliminar alerta
   */
  const handleDeleteAlert = (alertId) => {
    const updatedAlerts = alerts.filter(a => a.id !== alertId);
    saveAlerts(updatedAlerts);
  };

  /**
   * ⚡ Toggle estado de alerta
   */
  const handleToggleAlert = (alertId) => {
    const updatedAlerts = alerts.map(alert =>
      alert.id === alertId ? { ...alert, enabled: !alert.enabled } : alert
    );
    saveAlerts(updatedAlerts);
  };

  /**
   * 🧪 Probar alerta
   */
  const handleTestAlert = async (alert) => {
    try {
      // Simular activación de alerta
      const testEvent = {
        id: Date.now(),
        alert_id: alert.id,
        alert_name: alert.name,
        severity: alert.severity,
        triggered_at: new Date().toISOString(),
        condition_met: 'Test condition',
        value: 'Test value',
        is_test: true
      };

      // Agregar al historial
      const newHistory = [testEvent, ...alertHistory].slice(0, 100);
      setAlertHistory(newHistory);
      localStorage.setItem('cmt_alert_history', JSON.stringify(newHistory));

      if (onAlertTriggered) {
        onAlertTriggered(testEvent);
      }

      // Mostrar notificación de éxito
      alert('✅ Alerta de prueba enviada correctamente');
    } catch (error) {
      console.error('Error testing alert:', error);
      alert('❌ Error al enviar alerta de prueba');
    }
  };

  /**
   * 🎨 Renderizar constructor de condiciones
   */
  const renderConditionBuilder = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🔧 Condiciones de Activación
      </Typography>
      
      {alertForm.conditions.map((condition, index) => (
        <Card key={index} variant="outlined" sx={{ mb: 2, p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Métrica</InputLabel>
                <Select
                  value={condition.metric}
                  label="Métrica"
                  onChange={(e) => {
                    const newConditions = [...alertForm.conditions];
                    newConditions[index].metric = e.target.value;
                    setAlertForm(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  {ALERT_METRICS[alertForm.category]?.map(metric => (
                    <MenuItem key={metric.key} value={metric.key}>
                      {metric.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={condition.type}
                  label="Tipo"
                  onChange={(e) => {
                    const newConditions = [...alertForm.conditions];
                    newConditions[index].type = e.target.value;
                    newConditions[index].operator = CONDITION_TYPES[e.target.value].operators[0].value;
                    setAlertForm(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  {Object.entries(CONDITION_TYPES).map(([key, type]) => (
                    <MenuItem key={key} value={key}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Operador</InputLabel>
                <Select
                  value={condition.operator}
                  label="Operador"
                  onChange={(e) => {
                    const newConditions = [...alertForm.conditions];
                    newConditions[index].operator = e.target.value;
                    setAlertForm(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  {CONDITION_TYPES[condition.type]?.operators.map(op => (
                    <MenuItem key={op.value} value={op.value}>
                      {op.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                label="Valor"
                type="number"
                value={condition.value}
                onChange={(e) => {
                  const newConditions = [...alertForm.conditions];
                  newConditions[index].value = e.target.value;
                  setAlertForm(prev => ({ ...prev, conditions: newConditions }));
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={2}>
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={() => {
                    const newConditions = [...alertForm.conditions];
                    newConditions.splice(index + 1, 0, {
                      metric: '',
                      type: 'threshold',
                      operator: 'gt',
                      value: '',
                      timeWindow: 5
                    });
                    setAlertForm(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  <Add />
                </Button>
                {alertForm.conditions.length > 1 && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      const newConditions = alertForm.conditions.filter((_, i) => i !== index);
                      setAlertForm(prev => ({ ...prev, conditions: newConditions }));
                    }}
                  >
                    <Delete />
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
          
          <Box mt={2}>
            <Typography variant="caption" color="textSecondary">
              {CONDITION_TYPES[condition.type]?.description}
            </Typography>
          </Box>
        </Card>
      ))}
    </Box>
  );

  /**
   * 📢 Renderizar configuración de notificaciones
   */
  const renderNotificationConfig = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        📢 Configuración de Notificaciones
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Canales de Notificación
          </Typography>
          <FormGroup>
            {Object.entries(NOTIFICATION_CHANNELS).map(([key, channel]) => {
              const IconComponent = channel.icon;
              return (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={alertForm.notifications.channels.includes(key)}
                      onChange={(e) => {
                        const channels = e.target.checked
                          ? [...alertForm.notifications.channels, key]
                          : alertForm.notifications.channels.filter(c => c !== key);
                        setAlertForm(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, channels }
                        }));
                      }}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <IconComponent sx={{ fontSize: '1.2rem' }} />
                      {channel.label}
                    </Box>
                  }
                />
              );
            })}
          </FormGroup>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Plantilla de Email
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Asunto"
            value={alertForm.notifications.templates.email.subject}
            onChange={(e) => {
              setAlertForm(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  templates: {
                    ...prev.notifications.templates,
                    email: {
                      ...prev.notifications.templates.email,
                      subject: e.target.value
                    }
                  }
                }
              }));
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            size="small"
            label="Cuerpo del mensaje"
            value={alertForm.notifications.templates.email.body}
            onChange={(e) => {
              setAlertForm(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  templates: {
                    ...prev.notifications.templates,
                    email: {
                      ...prev.notifications.templates.email,
                      body: e.target.value
                    }
                  }
                }
              }));
            }}
          />
          <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
            Variables disponibles: {'{'}{'{'} alert_name {'}'}{'}'},  {'{'}{'{'} condition_description {'}'}{'}'},  {'{'}{'{'} value {'}'}{'}'},  {'{'}{'{'} timestamp {'}'}{'}'} 
          </Typography>
        </Grid>
      </Grid>
      
      <Divider sx={{ my: 3 }} />
      
      <FormControlLabel
        control={
          <Switch
            checked={alertForm.notifications.escalation.enabled}
            onChange={(e) => {
              setAlertForm(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  escalation: {
                    ...prev.notifications.escalation,
                    enabled: e.target.checked
                  }
                }
              }));
            }}
          />
        }
        label="Habilitar Escalamiento"
      />
      
      {alertForm.notifications.escalation.enabled && (
        <Box mt={2}>
          <TextField
            type="number"
            size="small"
            label="Retraso de escalamiento (minutos)"
            value={alertForm.notifications.escalation.delay}
            onChange={(e) => {
              setAlertForm(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  escalation: {
                    ...prev.notifications.escalation,
                    delay: parseInt(e.target.value)
                  }
                }
              }));
            }}
            sx={{ width: 200 }}
          />
        </Box>
      )}
    </Box>
  );

  /**
   * 📅 Renderizar configuración de horarios
   */
  const renderScheduleConfig = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        📅 Configuración de Horarios
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={alertForm.schedule.enabled}
                onChange={(e) => {
                  setAlertForm(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, enabled: e.target.checked }
                  }));
                }}
              />
            }
            label="Habilitar horarios activos"
          />
          
          {alertForm.schedule.enabled && (
            <Box mt={2}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="time"
                    label="Hora inicio"
                    value={alertForm.schedule.active_hours.start}
                    onChange={(e) => {
                      setAlertForm(prev => ({
                        ...prev,
                        schedule: {
                          ...prev.schedule,
                          active_hours: {
                            ...prev.schedule.active_hours,
                            start: e.target.value
                          }
                        }
                      }));
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="time"
                    label="Hora fin"
                    value={alertForm.schedule.active_hours.end}
                    onChange={(e) => {
                      setAlertForm(prev => ({
                        ...prev,
                        schedule: {
                          ...prev.schedule,
                          active_hours: {
                            ...prev.schedule.active_hours,
                            end: e.target.value
                          }
                        }
                      }));
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Días activos
          </Typography>
          <ButtonGroup size="small" variant="outlined">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => (
              <Button
                key={index}
                variant={alertForm.schedule.active_days.includes(index + 1) ? 'contained' : 'outlined'}
                onClick={() => {
                  const days = alertForm.schedule.active_days.includes(index + 1)
                    ? alertForm.schedule.active_days.filter(d => d !== index + 1)
                    : [...alertForm.schedule.active_days, index + 1];
                  setAlertForm(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, active_days: days }
                  }));
                }}
              >
                {day}
              </Button>
            ))}
          </ButtonGroup>
        </Grid>
      </Grid>
    </Box>
  );

  /**
   * 📋 Renderizar lista de alertas
   */
  const renderAlertsList = () => (
    <Grid container spacing={2}>
      {alerts.map((alert) => (
        <Grid item xs={12} md={6} lg={4} key={alert.id}>
          <Card 
            variant="outlined"
            sx={{ 
              borderColor: alert.enabled ? ALERT_SEVERITIES[alert.severity].color : '#ccc',
              opacity: alert.enabled ? 1 : 0.6
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" noWrap>
                  {alert.name}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    label={ALERT_SEVERITIES[alert.severity].label}
                    sx={{ 
                      backgroundColor: ALERT_SEVERITIES[alert.severity].color,
                      color: 'white'
                    }}
                  />
                  <Switch
                    checked={alert.enabled}
                    onChange={() => handleToggleAlert(alert.id)}
                    size="small"
                  />
                </Box>
              </Box>
              
              <Typography variant="body2" color="textSecondary" paragraph>
                {alert.description}
              </Typography>
              
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="caption">
                  {alert.conditions.length} condicion(es)
                </Typography>
                <Typography variant="caption">
                  Activada {alert.triggered_count || 0} veces
                </Typography>
              </Box>
              
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => handleEditAlert(alert)}
                >
                  Editar
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={() => handleTestAlert(alert)}
                >
                  Probar
                </Button>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteAlert(alert.id)}
                >
                  <Delete />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  /**
   * 📊 Renderizar historial de alertas
   */
  const renderAlertHistory = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Alerta</TableCell>
            <TableCell>Severidad</TableCell>
            <TableCell>Condición</TableCell>
            <TableCell>Valor</TableCell>
            <TableCell>Fecha</TableCell>
            <TableCell>Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {alertHistory.slice(0, 50).map((event, index) => (
            <TableRow key={index}>
              <TableCell>{event.alert_name}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={ALERT_SEVERITIES[event.severity]?.label}
                  sx={{ 
                    backgroundColor: ALERT_SEVERITIES[event.severity]?.color,
                    color: 'white'
                  }}
                />
              </TableCell>
              <TableCell>{event.condition_met}</TableCell>
              <TableCell>{event.value}</TableCell>
              <TableCell>
                {new Date(event.triggered_at).toLocaleString()}
              </TableCell>
              <TableCell>
                {event.is_test && (
                  <Chip size="small" label="Test" color="info" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const steps = [
    { label: 'Información Básica', description: 'Nombre y configuración general' },
    { label: 'Condiciones', description: 'Definir cuándo activar la alerta' },
    { label: 'Notificaciones', description: 'Configurar canales y mensajes' },
    { label: 'Horarios', description: 'Definir cuándo están activas' }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box>
        {/* 🎛️ Panel principal */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h5">
                🚨 Sistema de Alertas Personalizables
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateAlert}
              >
                Nueva Alerta
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Box textAlign="center">
                  <NotificationImportant sx={{ fontSize: '2.5rem', color: '#1976d2', mb: 1 }} />
                  <Typography variant="h4">{alerts.length}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Alertas
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box textAlign="center">
                  <CheckCircle sx={{ fontSize: '2.5rem', color: '#4caf50', mb: 1 }} />
                  <Typography variant="h4">{alerts.filter(a => a.enabled).length}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Activas
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box textAlign="center">
                  <History sx={{ fontSize: '2.5rem', color: '#ff9800', mb: 1 }} />
                  <Typography variant="h4">{alertHistory.length}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Activaciones
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box textAlign="center">
                  <Timeline sx={{ fontSize: '2.5rem', color: '#9c27b0', mb: 1 }} />
                  <Typography variant="h4">
                    {alertHistory.filter(h => h.triggered_at > new Date(Date.now() - 24*60*60*1000).toISOString()).length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Últimas 24h
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 📋 Lista de alertas */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📋 Alertas Configuradas
            </Typography>
            {alerts.length > 0 ? renderAlertsList() : (
              <Alert severity="info">
                No hay alertas configuradas. Crea tu primera alerta para comenzar.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 📊 Historial de alertas */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Historial de Activaciones
            </Typography>
            {alertHistory.length > 0 ? renderAlertHistory() : (
              <Alert severity="info">
                No hay historial de alertas disponible.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 🛠️ Dialog de creación/edición */}
        <Dialog 
          open={dialogOpen} 
          onClose={() => setDialogOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            {editingAlert ? '✏️ Editar Alerta' : '➕ Nueva Alerta'}
          </DialogTitle>
          <DialogContent>
            <Stepper activeStep={activeStep} orientation="vertical">
              {/* Paso 1: Información básica */}
              <Step>
                <StepLabel>Información Básica</StepLabel>
                <StepContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Nombre de la alerta"
                        value={alertForm.name}
                        onChange={(e) => setAlertForm(prev => ({ ...prev, name: e.target.value }))}
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth margin="normal">
                        <InputLabel>Severidad</InputLabel>
                        <Select
                          value={alertForm.severity}
                          label="Severidad"
                          onChange={(e) => setAlertForm(prev => ({ ...prev, severity: e.target.value }))}
                        >
                          {Object.entries(ALERT_SEVERITIES).map(([key, severity]) => (
                            <MenuItem key={key} value={key}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <severity.icon sx={{ color: severity.color }} />
                                {severity.label}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Descripción"
                        value={alertForm.description}
                        onChange={(e) => setAlertForm(prev => ({ ...prev, description: e.target.value }))}
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth margin="normal">
                        <InputLabel>Categoría</InputLabel>
                        <Select
                          value={alertForm.category}
                          label="Categoría"
                          onChange={(e) => setAlertForm(prev => ({ 
                            ...prev, 
                            category: e.target.value,
                            conditions: [{ ...prev.conditions[0], metric: '' }]
                          }))}
                        >
                          {Object.entries(ALERT_METRICS).map(([key, metrics]) => (
                            <MenuItem key={key} value={key}>
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(1)}
                      disabled={!alertForm.name || !alertForm.category}
                    >
                      Siguiente
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Paso 2: Condiciones */}
              <Step>
                <StepLabel>Condiciones</StepLabel>
                <StepContent>
                  {renderConditionBuilder()}
                  <Box mt={2} display="flex" gap={1}>
                    <Button onClick={() => setActiveStep(0)}>
                      Anterior
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(2)}
                      disabled={!alertForm.conditions[0].metric}
                    >
                      Siguiente
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Paso 3: Notificaciones */}
              <Step>
                <StepLabel>Notificaciones</StepLabel>
                <StepContent>
                  {renderNotificationConfig()}
                  <Box mt={2} display="flex" gap={1}>
                    <Button onClick={() => setActiveStep(1)}>
                      Anterior
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(3)}
                    >
                      Siguiente
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Paso 4: Horarios */}
              <Step>
                <StepLabel>Horarios</StepLabel>
                <StepContent>
                  {renderScheduleConfig()}
                  <Box mt={2} display="flex" gap={1}>
                    <Button onClick={() => setActiveStep(2)}>
                      Anterior
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleSaveAlert}
                    >
                      {editingAlert ? 'Actualizar' : 'Crear'} Alerta
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default CustomizableAlertsSystem;