/**
 * ⌨️ Keyboard Shortcuts System - CMT v2.5
 * Sistema completo de atajos de teclado con hotkeys personalizables y gestión avanzada
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Snackbar,
  Badge,
  Grid,
  Tabs,
  Tab,
  InputAdornment,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';

import {
  Keyboard as KeyboardIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Help as HelpIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Navigation as NavigationIcon,
  Assessment as ReportsIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';

/**
 * 🎯 Componente principal del sistema de atajos
 */
export const KeyboardShortcutsSystem = ({ 
  onShortcutTriggered,
  context = 'global',
  disabled = false
}) => {
  const theme = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(getDefaultShortcuts());
  const [customShortcuts, setCustomShortcuts] = useState([]);
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingFor, setRecordingFor] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [recentlyUsed, setRecentlyUsed] = useState([]);

  // Cargar configuración guardada
  useEffect(() => {
    loadSavedConfiguration();
  }, []);

  // Detectar conflictos
  useEffect(() => {
    const conflicts = detectConflicts([...shortcuts, ...customShortcuts]);
    setConflictWarnings(conflicts);
  }, [shortcuts, customShortcuts]);

  return (
    <>
      {/* Indicador de atajos activos */}
      <ShortcutIndicator
        shortcuts={shortcuts}
        context={context}
        disabled={disabled}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onShowHelp={() => setShowHelp(true)}
        recentlyUsed={recentlyUsed}
      />

      {/* Panel de configuración */}
      <ShortcutSettingsDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        shortcuts={shortcuts}
        customShortcuts={customShortcuts}
        conflictWarnings={conflictWarnings}
        onUpdateShortcuts={setShortcuts}
        onUpdateCustomShortcuts={setCustomShortcuts}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        recordingFor={recordingFor}
        setRecordingFor={setRecordingFor}
      />

      {/* Panel de ayuda */}
      <ShortcutHelpDialog
        open={showHelp}
        onClose={() => setShowHelp(false)}
        shortcuts={shortcuts}
        context={context}
      />

      {/* Hook para capturar teclas */}
      <KeyboardListener
        shortcuts={[...shortcuts, ...customShortcuts]}
        onShortcutTriggered={(shortcut) => {
          if (!disabled) {
            addToRecentlyUsed(shortcut);
            if (onShortcutTriggered) onShortcutTriggered(shortcut);
          }
        }}
        context={context}
        disabled={disabled}
      />
    </>
  );

  function loadSavedConfiguration() {
    try {
      const saved = localStorage.getItem('cmt_keyboard_shortcuts');
      if (saved) {
        const config = JSON.parse(saved);
        if (config.shortcuts) setShortcuts(config.shortcuts);
        if (config.customShortcuts) setCustomShortcuts(config.customShortcuts);
        if (config.recentlyUsed) setRecentlyUsed(config.recentlyUsed);
      }
    } catch (error) {
      console.warn('Error loading keyboard shortcuts configuration:', error);
    }
  }

  function addToRecentlyUsed(shortcut) {
    setRecentlyUsed(prev => {
      const filtered = prev.filter(s => s.id !== shortcut.id);
      return [{ ...shortcut, lastUsed: Date.now() }, ...filtered].slice(0, 10);
    });
  }
};

/**
 * 📊 Indicador visual de atajos activos
 */
const ShortcutIndicator = ({ 
  shortcuts, 
  context, 
  disabled, 
  onOpenSettings, 
  onShowHelp,
  recentlyUsed 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const contextualShortcuts = shortcuts.filter(s => 
    s.context === 'global' || s.context === context
  ).slice(0, 5);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: theme.zIndex.fab - 1
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 1,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[8]
          }
        }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Badge badgeContent={recentlyUsed.length} color="primary">
            <KeyboardIcon 
              fontSize="small" 
              color={disabled ? 'disabled' : 'primary'} 
            />
          </Badge>
          
          <Box display="flex" gap={0.5}>
            {contextualShortcuts.slice(0, 3).map((shortcut, index) => (
              <Chip
                key={index}
                label={formatShortcutDisplay(shortcut.keys)}
                size="small"
                variant="outlined"
                sx={{ 
                  fontSize: '0.65rem',
                  height: 20,
                  opacity: disabled ? 0.5 : 1
                }}
              />
            ))}
          </Box>

          {contextualShortcuts.length > 3 && (
            <Typography variant="caption" color="text.secondary">
              +{contextualShortcuts.length - 3}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Menu desplegable */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { minWidth: 280 }
        }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" fontWeight={600}>
            Atajos Disponibles
          </Typography>
        </MenuItem>
        <Divider />
        
        {contextualShortcuts.map((shortcut, index) => (
          <MenuItem key={index} dense>
            <Box display="flex" alignItems="center" gap={2} width="100%">
              <shortcut.icon fontSize="small" color="primary" />
              <Box flex={1}>
                <Typography variant="body2">{shortcut.label}</Typography>
              </Box>
              <Chip
                label={formatShortcutDisplay(shortcut.keys)}
                size="small"
                variant="outlined"
              />
            </Box>
          </MenuItem>
        ))}
        
        <Divider />
        <MenuItem onClick={onShowHelp}>
          <HelpIcon fontSize="small" sx={{ mr: 1 }} />
          Ver Todos los Atajos
        </MenuItem>
        <MenuItem onClick={onOpenSettings}>
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
          Configurar Atajos
        </MenuItem>
      </Menu>
    </Box>
  );
};

/**
 * ⚙️ Dialog de configuración de atajos
 */
const ShortcutSettingsDialog = ({
  open,
  onClose,
  shortcuts,
  customShortcuts,
  conflictWarnings,
  onUpdateShortcuts,
  onUpdateCustomShortcuts,
  isRecording,
  setIsRecording,
  recordingFor,
  setRecordingFor
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingShortcut, setEditingShortcut] = useState(null);

  const filteredShortcuts = shortcuts.filter(shortcut =>
    shortcut.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveConfiguration = () => {
    try {
      const config = {
        shortcuts,
        customShortcuts,
        timestamp: Date.now()
      };
      localStorage.setItem('cmt_keyboard_shortcuts', JSON.stringify(config));
      
      // Mostrar confirmación
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving shortcuts configuration:', error);
      alert('Error al guardar la configuración');
    }
  };

  const handleRestoreDefaults = () => {
    if (confirm('¿Estás seguro de que quieres restaurar los atajos por defecto?')) {
      onUpdateShortcuts(getDefaultShortcuts());
      onUpdateCustomShortcuts([]);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <KeyboardIcon color="primary" />
            <Typography variant="h6">Configuración de Atajos de Teclado</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Alertas de conflictos */}
        {conflictWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Conflictos Detectados:
            </Typography>
            {conflictWarnings.map((conflict, index) => (
              <Typography key={index} variant="body2">
                • {conflict.message}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="Atajos del Sistema" />
          <Tab label="Atajos Personalizados" />
          <Tab label="Configuración Global" />
        </Tabs>

        {/* Barra de búsqueda */}
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar atajos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {/* Contenido de las tabs */}
        {activeTab === 0 && (
          <SystemShortcutsTab
            shortcuts={filteredShortcuts}
            onUpdateShortcuts={onUpdateShortcuts}
            editingShortcut={editingShortcut}
            setEditingShortcut={setEditingShortcut}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            recordingFor={recordingFor}
            setRecordingFor={setRecordingFor}
          />
        )}

        {activeTab === 1 && (
          <CustomShortcutsTab
            customShortcuts={customShortcuts}
            onUpdateCustomShortcuts={onUpdateCustomShortcuts}
          />
        )}

        {activeTab === 2 && (
          <GlobalSettingsTab />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleRestoreDefaults} color="warning">
          Restaurar por Defecto
        </Button>
        <Button onClick={handleSaveConfiguration} variant="contained">
          Guardar Configuración
        </Button>
        <Button onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * 📋 Tab de atajos del sistema
 */
const SystemShortcutsTab = ({
  shortcuts,
  onUpdateShortcuts,
  editingShortcut,
  setEditingShortcut,
  isRecording,
  setIsRecording,
  recordingFor,
  setRecordingFor
}) => {
  const groupedShortcuts = groupShortcutsByCategory(shortcuts);

  const handleUpdateShortcut = (shortcutId, newKeys) => {
    const updated = shortcuts.map(s => 
      s.id === shortcutId ? { ...s, keys: newKeys } : s
    );
    onUpdateShortcuts(updated);
    setEditingShortcut(null);
  };

  const handleToggleShortcut = (shortcutId) => {
    const updated = shortcuts.map(s => 
      s.id === shortcutId ? { ...s, enabled: !s.enabled } : s
    );
    onUpdateShortcuts(updated);
  };

  return (
    <Box>
      {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
        <Accordion key={category} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              {getCategoryIcon(category)}
              <Typography variant="subtitle1" fontWeight={600}>
                {getCategoryName(category)}
              </Typography>
              <Chip 
                label={categoryShortcuts.length} 
                size="small" 
                color="primary" 
                variant="outlined" 
              />
            </Box>
          </AccordionSummary>
          
          <AccordionDetails>
            <List dense>
              {categoryShortcuts.map((shortcut) => (
                <ListItem key={shortcut.id}>
                  <ListItemIcon>
                    <shortcut.icon fontSize="small" color="primary" />
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={shortcut.label}
                    secondary={shortcut.description}
                  />

                  <Box display="flex" alignItems="center" gap={1}>
                    {editingShortcut === shortcut.id && isRecording ? (
                      <ShortcutRecorder
                        onRecorded={(keys) => handleUpdateShortcut(shortcut.id, keys)}
                        onCancel={() => {
                          setEditingShortcut(null);
                          setIsRecording(false);
                        }}
                      />
                    ) : (
                      <Chip
                        label={formatShortcutDisplay(shortcut.keys)}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setEditingShortcut(shortcut.id);
                          setRecordingFor(shortcut.id);
                          setIsRecording(true);
                        }}
                        sx={{ cursor: 'pointer' }}
                      />
                    )}

                    <Switch
                      checked={shortcut.enabled !== false}
                      onChange={() => handleToggleShortcut(shortcut.id)}
                      size="small"
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

/**
 * 🎨 Tab de atajos personalizados
 */
const CustomShortcutsTab = ({ customShortcuts, onUpdateCustomShortcuts }) => {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCustomShortcut = (newShortcut) => {
    onUpdateCustomShortcuts([...customShortcuts, { ...newShortcut, id: Date.now().toString() }]);
    setIsAdding(false);
  };

  const handleDeleteCustomShortcut = (shortcutId) => {
    onUpdateCustomShortcuts(customShortcuts.filter(s => s.id !== shortcutId));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
        <Typography variant="h6">Atajos Personalizados</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsAdding(true)}
        >
          Agregar Atajo
        </Button>
      </Box>

      {isAdding && (
        <CustomShortcutEditor
          onSave={handleAddCustomShortcut}
          onCancel={() => setIsAdding(false)}
        />
      )}

      <List>
        {customShortcuts.map((shortcut) => (
          <ListItem key={shortcut.id}>
            <ListItemIcon>
              <shortcut.icon fontSize="small" color="primary" />
            </ListItemIcon>
            
            <ListItemText
              primary={shortcut.label}
              secondary={shortcut.description}
            />

            <ListItemSecondaryAction>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={formatShortcutDisplay(shortcut.keys)}
                  size="small"
                  variant="outlined"
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteCustomShortcut(shortcut.id)}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {customShortcuts.length === 0 && !isAdding && (
        <Alert severity="info">
          No tienes atajos personalizados configurados. 
          Haz clic en "Agregar Atajo" para crear uno nuevo.
        </Alert>
      )}
    </Box>
  );
};

/**
 * ⚙️ Tab de configuración global
 */
const GlobalSettingsTab = () => {
  const [settings, setSettings] = useState({
    enabledGlobally: true,
    showIndicator: true,
    enableSounds: false,
    enableTooltips: true,
    enableConflictDetection: true
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configuración Global
      </Typography>

      <List>
        <ListItem>
          <ListItemText
            primary="Habilitar Atajos Globalmente"
            secondary="Activa o desactiva todos los atajos de teclado"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabledGlobally}
                onChange={(e) => setSettings(prev => ({ ...prev, enabledGlobally: e.target.checked }))}
              />
            }
            label=""
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary="Mostrar Indicador Visual"
            secondary="Muestra el indicador de atajos en la esquina de la pantalla"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.showIndicator}
                onChange={(e) => setSettings(prev => ({ ...prev, showIndicator: e.target.checked }))}
              />
            }
            label=""
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary="Sonidos de Confirmación"
            secondary="Reproduce sonidos cuando se ejecutan atajos"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enableSounds}
                onChange={(e) => setSettings(prev => ({ ...prev, enableSounds: e.target.checked }))}
              />
            }
            label=""
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary="Tooltips de Ayuda"
            secondary="Muestra tooltips con información de atajos"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enableTooltips}
                onChange={(e) => setSettings(prev => ({ ...prev, enableTooltips: e.target.checked }))}
              />
            }
            label=""
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary="Detección de Conflictos"
            secondary="Detecta automáticamente conflictos entre atajos"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enableConflictDetection}
                onChange={(e) => setSettings(prev => ({ ...prev, enableConflictDetection: e.target.checked }))}
              />
            }
            label=""
          />
        </ListItem>
      </List>
    </Box>
  );
};

/**
 * 🎙️ Componente para grabar nuevos atajos
 */
const ShortcutRecorder = ({ onRecorded, onCancel }) => {
  const [recordedKeys, setRecordedKeys] = useState([]);
  const [isListening, setIsListening] = useState(true);

  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        keys.push(e.key.toUpperCase());
      }

      if (keys.length > 0) {
        setRecordedKeys(keys);
        setTimeout(() => {
          onRecorded(keys);
          setIsListening(false);
        }, 500);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isListening, onRecorded]);

  return (
    <Box
      sx={{
        p: 1,
        border: `2px dashed`,
        borderColor: 'primary.main',
        borderRadius: 1,
        bgcolor: alpha('#1976d2', 0.1),
        minWidth: 120,
        textAlign: 'center'
      }}
    >
      <Typography variant="caption" color="primary" fontWeight={600}>
        {recordedKeys.length > 0 
          ? formatShortcutDisplay(recordedKeys)
          : 'Presiona las teclas...'
        }
      </Typography>
      <Box mt={0.5}>
        <Button size="small" onClick={onCancel} color="secondary">
          Cancelar
        </Button>
      </Box>
    </Box>
  );
};

/**
 * 📝 Editor de atajos personalizados
 */
const CustomShortcutEditor = ({ onSave, onCancel }) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('');
  const [keys, setKeys] = useState([]);
  const [icon, setIcon] = useState('SpeedIcon');

  const handleSave = () => {
    if (!label || !action || keys.length === 0) return;

    onSave({
      label,
      description,
      action,
      keys,
      icon: getIconComponent(icon),
      enabled: true,
      context: 'global'
    });
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader title="Crear Atajo Personalizado" />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Etiqueta"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Acción"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="navigateTo, openDialog, etc."
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
            />
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" gap={1} alignItems="center">
              <Typography variant="body2">Combinación de teclas:</Typography>
              <ShortcutRecorder
                onRecorded={setKeys}
                onCancel={() => {}}
              />
            </Box>
          </Grid>
        </Grid>

        <Box mt={2} display="flex" gap={1}>
          <Button variant="contained" onClick={handleSave}>
            Guardar
          </Button>
          <Button onClick={onCancel}>
            Cancelar
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * 🎧 Listener global de teclado
 */
const KeyboardListener = ({ shortcuts, onShortcutTriggered, context, disabled }) => {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e) => {
      const pressedKeys = [];
      if (e.ctrlKey || e.metaKey) pressedKeys.push('Ctrl');
      if (e.altKey) pressedKeys.push('Alt');
      if (e.shiftKey) pressedKeys.push('Shift');
      
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        pressedKeys.push(e.key.toUpperCase());
      }

      // Buscar coincidencias
      const matchingShortcut = shortcuts.find(shortcut => {
        if (shortcut.enabled === false) return false;
        if (shortcut.context !== 'global' && shortcut.context !== context) return false;
        
        return arraysEqual(shortcut.keys, pressedKeys);
      });

      if (matchingShortcut) {
        e.preventDefault();
        e.stopPropagation();
        onShortcutTriggered(matchingShortcut);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, onShortcutTriggered, context, disabled]);

  return null;
};

/**
 * ❓ Dialog de ayuda
 */
const ShortcutHelpDialog = ({ open, onClose, shortcuts, context }) => {
  const contextualShortcuts = shortcuts.filter(s => 
    s.context === 'global' || s.context === context
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <HelpIcon color="primary" />
          <Typography variant="h6">Atajos de Teclado Disponibles</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <List>
          {contextualShortcuts.map((shortcut, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <shortcut.icon fontSize="small" color="primary" />
              </ListItemIcon>
              
              <ListItemText
                primary={shortcut.label}
                secondary={shortcut.description}
              />

              <Chip
                label={formatShortcutDisplay(shortcut.keys)}
                size="small"
                variant="outlined"
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * 🔧 Funciones auxiliares
 */
const getDefaultShortcuts = () => [
  // Navegación
  {
    id: 'nav-dashboard',
    label: 'Ir al Dashboard',
    description: 'Navegar al panel principal',
    keys: ['Ctrl', 'H'],
    action: 'navigateTo',
    actionParams: { route: '/dashboard' },
    category: 'navigation',
    icon: NavigationIcon,
    context: 'global',
    enabled: true
  },
  {
    id: 'nav-certificates',
    label: 'Ir a Certificados',
    description: 'Navegar a la gestión de certificados',
    keys: ['Ctrl', 'C'],
    action: 'navigateTo',
    actionParams: { route: '/certificates' },
    category: 'navigation',
    icon: SecurityIcon,
    context: 'global',
    enabled: true
  },
  {
    id: 'nav-devices',
    label: 'Ir a Dispositivos',
    description: 'Navegar a la gestión de dispositivos',
    keys: ['Ctrl', 'D'],
    action: 'navigateTo',
    actionParams: { route: '/devices' },
    category: 'navigation',
    icon: SpeedIcon,
    context: 'global',
    enabled: true
  },

  // Acciones
  {
    id: 'action-search',
    label: 'Búsqueda Global',
    description: 'Abrir la búsqueda global',
    keys: ['Ctrl', 'K'],
    action: 'openSearch',
    category: 'actions',
    icon: SearchIcon,
    context: 'global',
    enabled: true
  },
  {
    id: 'action-help',
    label: 'Ayuda Contextual',
    description: 'Mostrar ayuda para la sección actual',
    keys: ['F1'],
    action: 'showHelp',
    category: 'actions',
    icon: HelpIcon,
    context: 'global',
    enabled: true
  },
  {
    id: 'action-settings',
    label: 'Configuración',
    description: 'Abrir panel de configuración',
    keys: ['Ctrl', ','],
    action: 'openSettings',
    category: 'actions',
    icon: SettingsIcon,
    context: 'global',
    enabled: true
  },

  // Filtros y búsqueda
  {
    id: 'filter-toggle',
    label: 'Alternar Filtros',
    description: 'Mostrar/ocultar panel de filtros',
    keys: ['Ctrl', 'F'],
    action: 'toggleFilters',
    category: 'filters',
    icon: FilterIcon,
    context: 'certificates',
    enabled: true
  },
  {
    id: 'filter-clear',
    label: 'Limpiar Filtros',
    description: 'Eliminar todos los filtros activos',
    keys: ['Ctrl', 'Shift', 'F'],
    action: 'clearFilters',
    category: 'filters',
    icon: FilterIcon,
    context: 'certificates',
    enabled: true
  },

  // Exportación
  {
    id: 'export-data',
    label: 'Exportar Datos',
    description: 'Abrir diálogo de exportación',
    keys: ['Ctrl', 'E'],
    action: 'openExport',
    category: 'export',
    icon: ReportsIcon,
    context: 'global',
    enabled: true
  }
];

const formatShortcutDisplay = (keys) => {
  if (!Array.isArray(keys)) return '';
  return keys.join(' + ');
};

const groupShortcutsByCategory = (shortcuts) => {
  return shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category || 'other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(shortcut);
    return groups;
  }, {});
};

const getCategoryIcon = (category) => {
  const icons = {
    navigation: <NavigationIcon fontSize="small" color="primary" />,
    actions: <SpeedIcon fontSize="small" color="primary" />,
    filters: <FilterIcon fontSize="small" color="primary" />,
    export: <ReportsIcon fontSize="small" color="primary" />,
    other: <InfoIcon fontSize="small" color="primary" />
  };
  return icons[category] || icons.other;
};

const getCategoryName = (category) => {
  const names = {
    navigation: 'Navegación',
    actions: 'Acciones',
    filters: 'Filtros',
    export: 'Exportación',
    other: 'Otros'
  };
  return names[category] || 'Otros';
};

const getIconComponent = (iconName) => {
  const iconMap = {
    SpeedIcon,
    SecurityIcon,
    NavigationIcon,
    SearchIcon,
    HelpIcon,
    SettingsIcon,
    FilterIcon,
    ReportsIcon
  };
  return iconMap[iconName] || SpeedIcon;
};

const detectConflicts = (shortcuts) => {
  const conflicts = [];
  const keyMap = new Map();

  shortcuts.forEach(shortcut => {
    const keyString = shortcut.keys.join('+');
    if (keyMap.has(keyString)) {
      conflicts.push({
        message: `Conflicto: "${formatShortcutDisplay(shortcut.keys)}" está asignado a "${shortcut.label}" y "${keyMap.get(keyString).label}"`,
        shortcuts: [shortcut, keyMap.get(keyString)]
      });
    } else {
      keyMap.set(keyString, shortcut);
    }
  });

  return conflicts;
};

const arraysEqual = (a, b) => {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
};

// Provider para el sistema de atajos de teclado
export const KeyboardShortcutsProvider = ({ children }) => {
  return (
    <Box>
      {children}
    </Box>
  );
};

export default KeyboardShortcutsSystem;