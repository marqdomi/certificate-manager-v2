/**
 * 📊 Advanced Report Export System
 * CMT v2.5 - Sistema Comprehensivo de Exportación de Reportes
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  Switch,
  Grid,
  Avatar,
  ListItemText,
  List,
  ListItem,
  ListItemIcon
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Description as CsvIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Visibility as PreviewIcon,
  Email as EmailIcon,
  Cloud as CloudIcon,
  History as HistoryIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

/**
 * 📋 Export Types & Formats
 */
export const EXPORT_FORMATS = {
  PDF: {
    value: 'pdf',
    label: 'PDF',
    icon: PdfIcon,
    description: 'Documento PDF con gráficos y tablas',
    supportsCharts: true,
    supportsImages: true,
    maxRecords: 10000
  },
  EXCEL: {
    value: 'excel',
    label: 'Excel (XLSX)',
    icon: ExcelIcon,
    description: 'Hoja de cálculo con múltiples pestañas',
    supportsCharts: true,
    supportsFormatting: true,
    maxRecords: 1000000
  },
  CSV: {
    value: 'csv',
    label: 'CSV',
    icon: CsvIcon,
    description: 'Valores separados por comas',
    supportsCharts: false,
    lightweight: true,
    maxRecords: 10000000
  }
};

export const REPORT_TEMPLATES = {
  CERTIFICATE_SUMMARY: {
    id: 'cert_summary',
    name: 'Resumen de Certificados',
    description: 'Reporte ejecutivo de estado de certificados',
    sections: ['overview', 'expiring', 'critical', 'statistics'],
    charts: ['status_pie', 'expiration_timeline', 'issuer_breakdown'],
    tables: ['critical_certificates', 'expiring_soon']
  },
  DEVICE_INVENTORY: {
    id: 'device_inventory',
    name: 'Inventario de Dispositivos',
    description: 'Inventario completo de dispositivos F5',
    sections: ['devices', 'versions', 'connectivity'],
    charts: ['device_types', 'version_distribution', 'status_overview'],
    tables: ['all_devices', 'offline_devices']
  },
  SECURITY_AUDIT: {
    id: 'security_audit',
    name: 'Auditoría de Seguridad',
    description: 'Reporte de seguridad y cumplimiento',
    sections: ['security_overview', 'vulnerabilities', 'compliance'],
    charts: ['security_score', 'vulnerability_trends'],
    tables: ['security_issues', 'compliance_status']
  },
  CUSTOM: {
    id: 'custom',
    name: 'Reporte Personalizado',
    description: 'Configuración personalizada de secciones',
    sections: [],
    customizable: true
  }
};

/**
 * 📊 Export Configuration Component
 */
const ExportConfigDialog = ({ 
  open, 
  onClose, 
  onExport, 
  data = [], 
  availableFields = [] 
}) => {
  const theme = useTheme();
  const [config, setConfig] = useState({
    format: 'pdf',
    template: 'cert_summary',
    title: 'Reporte CMT v2.5',
    includeCharts: true,
    includeImages: true,
    includeFilters: true,
    includeSummary: true,
    fields: availableFields.slice(0, 10),
    pageOrientation: 'portrait',
    fontSize: 'medium',
    branding: true,
    watermark: false
  });
  const [activeTab, setActiveTab] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const selectedFormat = EXPORT_FORMATS[config.format.toUpperCase()];
  const selectedTemplate = REPORT_TEMPLATES[config.template.toUpperCase()];

  // Generar preview del reporte
  const generatePreview = useCallback(() => {
    const preview = {
      title: config.title,
      format: selectedFormat,
      template: selectedTemplate,
      estimatedSize: Math.round((data.length * config.fields.length * 50) / 1024) + 'KB',
      estimatedTime: Math.max(1, Math.round(data.length / 1000)) + 's',
      sections: selectedTemplate?.sections || [],
      recordCount: data.length,
      fieldCount: config.fields.length
    };
    setPreviewData(preview);
  }, [config, data, selectedFormat, selectedTemplate]);

  // Ejecutar exportación
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(config);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Generar preview cuando cambie la configuración
  React.useEffect(() => {
    if (open) {
      generatePreview();
    }
  }, [open, generatePreview]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          background: `linear-gradient(135deg, 
            ${theme.palette.background.paper}95, 
            ${theme.palette.background.default}80)`,
          backdropFilter: 'blur(10px)'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DownloadIcon color="primary" />
          <Typography variant="h6">Exportar Reporte</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="Formato" />
            <Tab label="Contenido" />
            <Tab label="Diseño" />
            <Tab label="Preview" />
          </Tabs>
        </Box>

        {/* Tab 1: Formato */}
        {activeTab === 0 && (
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Formato de Exportación</InputLabel>
              <Select
                value={config.format}
                label="Formato de Exportación"
                onChange={(e) => setConfig({ ...config, format: e.target.value })}
              >
                {Object.values(EXPORT_FORMATS).map((format) => {
                  const Icon = format.icon;
                  return (
                    <MenuItem key={format.value} value={format.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Icon />
                        <Box>
                          <Typography variant="body1">{format.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Plantilla</InputLabel>
              <Select
                value={config.template}
                label="Plantilla"
                onChange={(e) => setConfig({ ...config, template: e.target.value })}
              >
                {Object.values(REPORT_TEMPLATES).map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    <Box>
                      <Typography variant="body1">{template.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {template.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Título del Reporte"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
            />

            {/* Limitaciones del formato */}
            {selectedFormat && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>{selectedFormat.label}:</strong> {selectedFormat.description}
                </Typography>
                <Typography variant="caption">
                  Máximo de registros: {selectedFormat.maxRecords.toLocaleString()}
                </Typography>
              </Alert>
            )}
          </Stack>
        )}

        {/* Tab 2: Contenido */}
        {activeTab === 1 && (
          <Stack spacing={3}>
            <Typography variant="h6">Secciones a Incluir</Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeSummary}
                  onChange={(e) => setConfig({ ...config, includeSummary: e.target.checked })}
                />
              }
              label="Resumen ejecutivo"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeCharts}
                  onChange={(e) => setConfig({ ...config, includeCharts: e.target.checked })}
                  disabled={!selectedFormat?.supportsCharts}
                />
              }
              label="Gráficos y visualizaciones"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeImages}
                  onChange={(e) => setConfig({ ...config, includeImages: e.target.checked })}
                  disabled={!selectedFormat?.supportsImages}
                />
              }
              label="Imágenes y capturas"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeFilters}
                  onChange={(e) => setConfig({ ...config, includeFilters: e.target.checked })}
                />
              }
              label="Información de filtros aplicados"
            />

            <Box>
              <Typography variant="h6" gutterBottom>Campos a Exportar</Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {availableFields.map((field) => (
                  <FormControlLabel
                    key={field.key}
                    control={
                      <Checkbox
                        checked={config.fields.some(f => f.key === field.key)}
                        onChange={(e) => {
                          const newFields = e.target.checked
                            ? [...config.fields, field]
                            : config.fields.filter(f => f.key !== field.key);
                          setConfig({ ...config, fields: newFields });
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{field.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {field.description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        )}

        {/* Tab 3: Diseño */}
        {activeTab === 2 && (
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Orientación</InputLabel>
              <Select
                value={config.pageOrientation}
                label="Orientación"
                onChange={(e) => setConfig({ ...config, pageOrientation: e.target.value })}
              >
                <MenuItem value="portrait">Vertical</MenuItem>
                <MenuItem value="landscape">Horizontal</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Tamaño de Fuente</InputLabel>
              <Select
                value={config.fontSize}
                label="Tamaño de Fuente"
                onChange={(e) => setConfig({ ...config, fontSize: e.target.value })}
              >
                <MenuItem value="small">Pequeña</MenuItem>
                <MenuItem value="medium">Mediana</MenuItem>
                <MenuItem value="large">Grande</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={config.branding}
                  onChange={(e) => setConfig({ ...config, branding: e.target.checked })}
                />
              }
              label="Incluir marca y logo de CMT"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={config.watermark}
                  onChange={(e) => setConfig({ ...config, watermark: e.target.checked })}
                />
              }
              label="Marca de agua de seguridad"
            />
          </Stack>
        )}

        {/* Tab 4: Preview */}
        {activeTab === 3 && previewData && (
          <Stack spacing={3}>
            <Typography variant="h6">Vista Previa del Reporte</Typography>
            
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {React.createElement(selectedFormat.icon)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{previewData.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedFormat.label} - {selectedTemplate.name}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Registros a exportar:
                      </Typography>
                      <Typography variant="h6">
                        {previewData.recordCount.toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Campos seleccionados:
                      </Typography>
                      <Typography variant="h6">
                        {previewData.fieldCount}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Tamaño estimado:
                      </Typography>
                      <Typography variant="h6">
                        {previewData.estimatedSize}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Tiempo estimado:
                      </Typography>
                      <Typography variant="h6">
                        {previewData.estimatedTime}
                      </Typography>
                    </Grid>
                  </Grid>

                  {previewData.sections.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Secciones incluidas:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {previewData.sections.map((section) => (
                          <Chip
                            key={section}
                            label={section.replace('_', ' ').toUpperCase()}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {data.length > selectedFormat.maxRecords && (
              <Alert severity="warning">
                El número de registros ({data.length.toLocaleString()}) excede el límite 
                para formato {selectedFormat.label} ({selectedFormat.maxRecords.toLocaleString()}). 
                Se exportarán solo los primeros {selectedFormat.maxRecords.toLocaleString()} registros.
              </Alert>
            )}
          </Stack>
        )}

        {/* Progress bar para exportación */}
        {isExporting && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Generando reporte...
            </Typography>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={isExporting || data.length === 0}
          startIcon={<DownloadIcon />}
        >
          {isExporting ? 'Exportando...' : 'Exportar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * 📅 Scheduled Export Component
 */
const ScheduledExportDialog = ({ open, onClose, onSchedule }) => {
  const [schedule, setSchedule] = useState({
    frequency: 'weekly',
    dayOfWeek: 1,
    time: '09:00',
    format: 'pdf',
    template: 'cert_summary',
    email: '',
    enabled: true
  });

  const handleSchedule = () => {
    onSchedule(schedule);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ScheduleIcon color="primary" />
          <Typography variant="h6">Programar Exportación</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Frecuencia</InputLabel>
            <Select
              value={schedule.frequency}
              label="Frecuencia"
              onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
            >
              <MenuItem value="daily">Diaria</MenuItem>
              <MenuItem value="weekly">Semanal</MenuItem>
              <MenuItem value="monthly">Mensual</MenuItem>
            </Select>
          </FormControl>

          {schedule.frequency === 'weekly' && (
            <FormControl fullWidth>
              <InputLabel>Día de la Semana</InputLabel>
              <Select
                value={schedule.dayOfWeek}
                label="Día de la Semana"
                onChange={(e) => setSchedule({ ...schedule, dayOfWeek: e.target.value })}
              >
                <MenuItem value={1}>Lunes</MenuItem>
                <MenuItem value={2}>Martes</MenuItem>
                <MenuItem value={3}>Miércoles</MenuItem>
                <MenuItem value={4}>Jueves</MenuItem>
                <MenuItem value={5}>Viernes</MenuItem>
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Hora"
            type="time"
            value={schedule.time}
            onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            fullWidth
            label="Email de Notificación"
            type="email"
            value={schedule.email}
            onChange={(e) => setSchedule({ ...schedule, email: e.target.value })}
            placeholder="admin@empresa.com"
          />

          <FormControlLabel
            control={
              <Switch
                checked={schedule.enabled}
                onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
              />
            }
            label="Activar programación"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSchedule}>
          Programar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * 📋 Export History Component
 */
const ExportHistory = ({ history = [] }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Historial de Exportaciones
        </Typography>
        
        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            No hay exportaciones recientes
          </Typography>
        ) : (
          <List>
            {history.slice(0, 10).map((export_, index) => (
              <ListItem key={index} divider={index < history.length - 1}>
                <ListItemIcon>
                  {getStatusIcon(export_.status)}
                </ListItemIcon>
                <ListItemText
                  primary={`${export_.template} - ${export_.format.toUpperCase()}`}
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(export_.timestamp).toLocaleString()}
                      </Typography>
                      <br />
                      <Typography variant="caption">
                        {export_.recordCount.toLocaleString()} registros - {export_.fileSize}
                      </Typography>
                    </Box>
                  }
                />
                {export_.status === 'completed' && (
                  <IconButton size="small" onClick={() => window.open(export_.downloadUrl)}>
                    <DownloadIcon />
                  </IconButton>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 🎯 Main Report Export Component
 */
export const ReportExportSystem = ({ 
  data = [], 
  availableFields = [], 
  title = "Reporte CMT v2.5" 
}) => {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);

  // Simular historial de exportaciones
  React.useEffect(() => {
    const mockHistory = [
      {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        template: 'Resumen de Certificados',
        format: 'pdf',
        status: 'completed',
        recordCount: 156,
        fileSize: '2.3 MB',
        downloadUrl: '#'
      },
      {
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        template: 'Inventario de Dispositivos',
        format: 'excel',
        status: 'completed',
        recordCount: 24,
        fileSize: '1.1 MB',
        downloadUrl: '#'
      },
      {
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        template: 'Auditoría de Seguridad',
        format: 'pdf',
        status: 'failed',
        recordCount: 0,
        fileSize: '0 MB'
      }
    ];
    setExportHistory(mockHistory);
  }, []);

  const handleExport = async (config) => {
    console.log('Exporting with config:', config);
    
    // Simular exportación
    const newExport = {
      timestamp: new Date().toISOString(),
      template: REPORT_TEMPLATES[config.template.toUpperCase()]?.name || 'Custom',
      format: config.format,
      status: 'processing',
      recordCount: data.length,
      fileSize: 'Calculando...'
    };

    setExportHistory(prev => [newExport, ...prev]);

    // Simular proceso de exportación
    setTimeout(() => {
      setExportHistory(prev => prev.map((exp, index) => 
        index === 0 ? { 
          ...exp, 
          status: 'completed', 
          fileSize: '2.5 MB',
          downloadUrl: '#'
        } : exp
      ));
    }, 3000);

    setExportDialogOpen(false);
  };

  const handleSchedule = (scheduleConfig) => {
    console.log('Scheduling export:', scheduleConfig);
    // Implementar lógica de programación
  };

  return (
    <Box>
      {/* Botones de acción */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => setExportDialogOpen(true)}
          disabled={data.length === 0}
        >
          Exportar Reporte
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<ScheduleIcon />}
          onClick={() => setScheduleDialogOpen(true)}
        >
          Programar Exportación
        </Button>
      </Stack>

      {/* Historial de exportaciones */}
      <ExportHistory history={exportHistory} />

      {/* Diálogos */}
      <ExportConfigDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        data={data}
        availableFields={availableFields}
      />

      <ScheduledExportDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onSchedule={handleSchedule}
      />
    </Box>
  );
};

export default ReportExportSystem;