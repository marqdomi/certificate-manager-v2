/**
 * ✨ Advanced Inline Filters System
 * CMT v2.5 - Sistema de Filtros Avanzados con Múltiples Criterios
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Button,
  IconButton,
  Popover,
  Checkbox,
  FormControlLabel,
  DatePicker,
  Autocomplete,
  Collapse,
  Badge,
  Tooltip,
  Divider,
  Switch
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  RestoreFromTrash as RestoreIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
  BookmarkBorder as BookmarkIcon,
  Bookmark as BookmarkFilledIcon,
  Download as DownloadIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';

/**
 * 🎛️ Filter Types & Constants
 */
export const FILTER_TYPES = {
  TEXT: 'text',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  DATE_RANGE: 'date_range',
  NUMBER_RANGE: 'number_range',
  BOOLEAN: 'boolean',
  AUTOCOMPLETE: 'autocomplete'
};

export const FILTER_OPERATORS = {
  EQUALS: 'equals',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  BETWEEN: 'between',
  IN: 'in',
  NOT_IN: 'not_in',
  IS_NULL: 'is_null',
  IS_NOT_NULL: 'is_not_null'
};

export const CERTIFICATE_FILTERS = {
  search: {
    type: FILTER_TYPES.TEXT,
    label: 'Buscar certificados',
    placeholder: 'Nombre, dominio, CN...',
    operators: [FILTER_OPERATORS.CONTAINS, FILTER_OPERATORS.STARTS_WITH, FILTER_OPERATORS.EQUALS]
  },
  status: {
    type: FILTER_TYPES.MULTISELECT,
    label: 'Estado',
    options: [
      { value: 'active', label: 'Activo', color: 'success' },
      { value: 'expiring', label: 'Próximo a expirar', color: 'warning' },
      { value: 'expired', label: 'Expirado', color: 'error' },
      { value: 'revoked', label: 'Revocado', color: 'default' }
    ]
  },
  issuer: {
    type: FILTER_TYPES.AUTOCOMPLETE,
    label: 'Emisor (CA)',
    options: ['DigiCert', 'Let\'s Encrypt', 'GlobalSign', 'Sectigo', 'GoDaddy']
  },
  keySize: {
    type: FILTER_TYPES.SELECT,
    label: 'Tamaño de Clave',
    options: [
      { value: '1024', label: '1024 bits' },
      { value: '2048', label: '2048 bits' },
      { value: '4096', label: '4096 bits' },
      { value: 'ec256', label: 'EC 256' },
      { value: 'ec384', label: 'EC 384' }
    ]
  },
  expirationDate: {
    type: FILTER_TYPES.DATE_RANGE,
    label: 'Fecha de Expiración',
    presets: [
      { label: 'Próximos 30 días', value: { start: new Date(), end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      { label: 'Próximos 90 días', value: { start: new Date(), end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
      { label: 'Este año', value: { start: new Date(new Date().getFullYear(), 0, 1), end: new Date(new Date().getFullYear(), 11, 31) } }
    ]
  },
  domains: {
    type: FILTER_TYPES.NUMBER_RANGE,
    label: 'Número de Dominios',
    min: 1,
    max: 100
  },
  isWildcard: {
    type: FILTER_TYPES.BOOLEAN,
    label: 'Certificado Wildcard'
  }
};

export const DEVICE_FILTERS = {
  search: {
    type: FILTER_TYPES.TEXT,
    label: 'Buscar dispositivos',
    placeholder: 'Nombre, IP, modelo...'
  },
  status: {
    type: FILTER_TYPES.MULTISELECT,
    label: 'Estado de Conexión',
    options: [
      { value: 'online', label: 'Online', color: 'success' },
      { value: 'offline', label: 'Offline', color: 'error' },
      { value: 'maintenance', label: 'Mantenimiento', color: 'warning' },
      { value: 'unknown', label: 'Desconocido', color: 'default' }
    ]
  },
  deviceType: {
    type: FILTER_TYPES.SELECT,
    label: 'Tipo de Dispositivo',
    options: [
      { value: 'f5_bigip', label: 'F5 BIG-IP' },
      { value: 'f5_ltm', label: 'F5 LTM' },
      { value: 'f5_asm', label: 'F5 ASM' },
      { value: 'nginx', label: 'NGINX' },
      { value: 'apache', label: 'Apache' }
    ]
  },
  version: {
    type: FILTER_TYPES.AUTOCOMPLETE,
    label: 'Versión',
    options: ['16.1.0', '15.1.4', '14.1.4', '13.1.3', '12.1.6']
  },
  lastSeen: {
    type: FILTER_TYPES.DATE_RANGE,
    label: 'Última Conexión'
  }
};

/**
 * 🎯 Advanced Filter Component
 */
export const AdvancedFilters = ({
  filterConfig = CERTIFICATE_FILTERS,
  onFiltersChange,
  initialFilters = {},
  showPresets = true,
  showSaveLoad = true,
  compact = false,
  maxHeight = 600
}) => {
  const theme = useTheme();
  const [filters, setFilters] = useState(initialFilters);
  const [expandedFilters, setExpandedFilters] = useState(!compact);
  const [anchorEl, setAnchorEl] = useState(null);
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterPresets] = useState([
    {
      name: 'Certificados Críticos',
      description: 'Expirados y próximos a expirar',
      filters: {
        status: ['expired', 'expiring'],
        expirationDate: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      name: 'Certificados Wildcard',
      description: 'Solo certificados wildcard activos',
      filters: {
        isWildcard: true,
        status: ['active']
      }
    },
    {
      name: 'Let\'s Encrypt',
      description: 'Certificados de Let\'s Encrypt',
      filters: {
        issuer: ['Let\'s Encrypt'],
        status: ['active', 'expiring']
      }
    }
  ]);

  // Calcular filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
      }
      return value !== null && value !== undefined && value !== '';
    }).length;
  }, [filters]);

  // Aplicar filtros
  const applyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  }, [onFiltersChange]);

  // Limpiar todos los filtros
  const clearAllFilters = useCallback(() => {
    applyFilters({});
  }, [applyFilters]);

  // Guardar filtro actual
  const saveCurrentFilter = useCallback(() => {
    const name = prompt('Nombre para este filtro:');
    if (name && Object.keys(filters).length > 0) {
      const newSaved = [...savedFilters, {
        id: Date.now(),
        name,
        filters: { ...filters },
        createdAt: new Date()
      }];
      setSavedFilters(newSaved);
      localStorage.setItem('cmt_saved_filters', JSON.stringify(newSaved));
    }
  }, [filters, savedFilters]);

  // Cargar filtros guardados
  useEffect(() => {
    const saved = localStorage.getItem('cmt_saved_filters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, []);

  // Renderizar campo de filtro individual
  const renderFilterField = (key, config) => {
    const value = filters[key];

    switch (config.type) {
      case FILTER_TYPES.TEXT:
        return (
          <TextField
            fullWidth
            size="small"
            label={config.label}
            placeholder={config.placeholder}
            value={value || ''}
            onChange={(e) => applyFilters({ ...filters, [key]: e.target.value })}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
            }}
          />
        );

      case FILTER_TYPES.SELECT:
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{config.label}</InputLabel>
            <Select
              value={value || ''}
              label={config.label}
              onChange={(e) => applyFilters({ ...filters, [key]: e.target.value })}
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              {config.options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case FILTER_TYPES.MULTISELECT:
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{config.label}</InputLabel>
            <Select
              multiple
              value={value || []}
              label={config.label}
              onChange={(e) => applyFilters({ ...filters, [key]: e.target.value })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((val) => {
                    const option = config.options.find(opt => opt.value === val);
                    return (
                      <Chip
                        key={val}
                        label={option?.label || val}
                        size="small"
                        color={option?.color || 'default'}
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {config.options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={(value || []).includes(option.value)} />
                  <Chip
                    label={option.label}
                    size="small"
                    color={option.color || 'default'}
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case FILTER_TYPES.AUTOCOMPLETE:
        return (
          <Autocomplete
            fullWidth
            size="small"
            multiple
            options={config.options}
            value={value || []}
            onChange={(e, newValue) => applyFilters({ ...filters, [key]: newValue })}
            renderInput={(params) => (
              <TextField {...params} label={config.label} />
            )}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => (
                <Chip
                  key={index}
                  label={option}
                  size="small"
                  variant="outlined"
                  {...getTagProps({ index })}
                />
              ))
            }
          />
        );

      case FILTER_TYPES.DATE_RANGE:
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {config.label}
              </Typography>
              <Stack direction="row" spacing={1}>
                <MuiDatePicker
                  label="Desde"
                  value={value?.start || null}
                  onChange={(newValue) => applyFilters({
                    ...filters,
                    [key]: { ...value, start: newValue }
                  })}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
                <MuiDatePicker
                  label="Hasta"
                  value={value?.end || null}
                  onChange={(newValue) => applyFilters({
                    ...filters,
                    [key]: { ...value, end: newValue }
                  })}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Stack>
              {config.presets && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {config.presets.map((preset, index) => (
                    <Chip
                      key={index}
                      label={preset.label}
                      size="small"
                      variant="outlined"
                      onClick={() => applyFilters({ ...filters, [key]: preset.value })}
                      color={JSON.stringify(value) === JSON.stringify(preset.value) ? 'primary' : 'default'}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </LocalizationProvider>
        );

      case FILTER_TYPES.NUMBER_RANGE:
        return (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {config.label}
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Mínimo"
                type="number"
                value={value?.min || ''}
                onChange={(e) => applyFilters({
                  ...filters,
                  [key]: { ...value, min: parseInt(e.target.value) || null }
                })}
                inputProps={{ min: config.min, max: config.max }}
              />
              <TextField
                size="small"
                label="Máximo"
                type="number"
                value={value?.max || ''}
                onChange={(e) => applyFilters({
                  ...filters,
                  [key]: { ...value, max: parseInt(e.target.value) || null }
                })}
                inputProps={{ min: config.min, max: config.max }}
              />
            </Stack>
          </Stack>
        );

      case FILTER_TYPES.BOOLEAN:
        return (
          <FormControlLabel
            control={
              <Switch
                checked={value || false}
                onChange={(e) => applyFilters({ ...filters, [key]: e.target.checked })}
                color="primary"
              />
            }
            label={config.label}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card sx={{
      mb: 2,
      background: `linear-gradient(135deg, 
        ${theme.palette.background.paper}95, 
        ${theme.palette.background.default}80)`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}40`
    }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge badgeContent={activeFiltersCount} color="primary">
              <FilterIcon color={activeFiltersCount > 0 ? 'primary' : 'action'} />
            </Badge>
            <Typography variant="h6">
              Filtros Avanzados
            </Typography>
            {!compact && (
              <IconButton
                size="small"
                onClick={() => setExpandedFilters(!expandedFilters)}
              >
                {expandedFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            {activeFiltersCount > 0 && (
              <Tooltip title="Limpiar todos los filtros">
                <IconButton size="small" onClick={clearAllFilters}>
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            )}

            {showSaveLoad && (
              <>
                <Tooltip title="Guardar filtro actual">
                  <IconButton
                    size="small"
                    onClick={saveCurrentFilter}
                    disabled={activeFiltersCount === 0}
                  >
                    <SaveIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Filtros guardados y presets">
                  <IconButton
                    size="small"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                  >
                    <BookmarkIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Box>

        {/* Filtros activos como chips */}
        {activeFiltersCount > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Filtros activos:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {Object.entries(filters).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;

                const config = filterConfig[key];
                if (!config) return null;

                const getValueLabel = () => {
                  if (Array.isArray(value)) {
                    return value.length > 2 
                      ? `${value.length} seleccionados`
                      : value.map(v => {
                          const option = config.options?.find(opt => opt.value === v);
                          return option?.label || v;
                        }).join(', ');
                  }
                  if (typeof value === 'object' && value !== null) {
                    if (value.start && value.end) {
                      return `${value.start?.toLocaleDateString()} - ${value.end?.toLocaleDateString()}`;
                    }
                    if (value.min !== null || value.max !== null) {
                      return `${value.min || '∞'} - ${value.max || '∞'}`;
                    }
                  }
                  if (typeof value === 'boolean') {
                    return value ? 'Sí' : 'No';
                  }
                  return String(value);
                };

                return (
                  <Chip
                    key={key}
                    label={`${config.label}: ${getValueLabel()}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    onDelete={() => {
                      const newFilters = { ...filters };
                      delete newFilters[key];
                      applyFilters(newFilters);
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Campos de filtro */}
        <Collapse in={expandedFilters || compact}>
          <Box sx={{ maxHeight, overflow: 'auto' }}>
            <Stack spacing={3}>
              {Object.entries(filterConfig).map(([key, config]) => (
                <Box key={key}>
                  {renderFilterField(key, config)}
                </Box>
              ))}
            </Stack>
          </Box>
        </Collapse>

        {/* Popover para filtros guardados y presets */}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ p: 2, minWidth: 300, maxWidth: 400 }}>
            <Typography variant="h6" gutterBottom>
              Filtros Guardados y Presets
            </Typography>

            {/* Presets */}
            {showPresets && filterPresets.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Presets:
                </Typography>
                <Stack spacing={1}>
                  {filterPresets.map((preset, index) => (
                    <Card
                      key={index}
                      variant="outlined"
                      sx={{
                        p: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => {
                        applyFilters(preset.filters);
                        setAnchorEl(null);
                      }}
                    >
                      <Typography variant="body2" fontWeight="medium">
                        {preset.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {preset.description}
                      </Typography>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Filtros guardados */}
            {savedFilters.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Guardados:
                </Typography>
                <Stack spacing={1}>
                  {savedFilters.map((saved) => (
                    <Card
                      key={saved.id}
                      variant="outlined"
                      sx={{ p: 1 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box
                          sx={{ cursor: 'pointer', flex: 1 }}
                          onClick={() => {
                            applyFilters(saved.filters);
                            setAnchorEl(null);
                          }}
                        >
                          <Typography variant="body2" fontWeight="medium">
                            {saved.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {saved.createdAt.toLocaleDateString()}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newSaved = savedFilters.filter(f => f.id !== saved.id);
                            setSavedFilters(newSaved);
                            localStorage.setItem('cmt_saved_filters', JSON.stringify(newSaved));
                          }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}

            {savedFilters.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                No hay filtros guardados
              </Typography>
            )}
          </Box>
        </Popover>
      </CardContent>
    </Card>
  );
};

export default AdvancedFilters;