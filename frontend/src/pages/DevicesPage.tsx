// frontend/src/pages/DevicesPage.tsx
// Enterprise-grade Device Inventory Dashboard - Phase 3
// Features: Table/Card views, Favorites, Column selector
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  TextField,
  InputAdornment,
  Paper,
  Theme,
  SxProps,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Badge,
  Drawer,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  alpha,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  CardActions,
  Grid,
  Skeleton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import DevicesIcon from '@mui/icons-material/Devices';
import KeyOffIcon from '@mui/icons-material/KeyOff';
import CloseIcon from '@mui/icons-material/Close';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SyncIcon from '@mui/icons-material/Sync';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { authProvider } from './LoginPage';
import {
  createDevice,
  deleteDevice,
  updateDeviceCredentials,
  refreshFacts,
  refreshCache,
  scanAllDevices,
} from '../api/devices';
import DeviceTable from '../components/DeviceTable';
import DeviceDetailDrawer from '../components/DeviceDetailDrawer';
import EditDeviceDialog from '../components/EditDeviceDialog';
import CredentialDialog from '../components/CredentialDialog';
import AddDeviceDialog from '../components/AddDeviceDialog';
import BulkActionsBar from '../components/BulkActionsBar';
import BulkCredentialsDialog from '../components/BulkCredentialsDialog';
import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket';
import type { Device, DeviceCredentials, DeviceCreate } from '../types/device';

// Types
type AlertSeverity = 'success' | 'error' | 'warning' | 'info';
type UserRole = 'admin' | 'operator' | 'viewer';
type ViewMode = 'table' | 'grid';

interface Notification {
  open: boolean;
  message: string;
  severity: AlertSeverity;
}

interface DeviceFilters {
  ha_state?: string;
  sync_status?: string;
  site?: string;
  is_primary_preferred?: boolean;
  no_credentials?: boolean;
  health_status?: string;
  favorites_only?: boolean;
}

// LocalStorage keys
const FAVORITES_KEY = 'cmt_device_favorites';
const VIEW_MODE_KEY = 'cmt_device_view_mode';
const VISIBLE_COLUMNS_KEY = 'cmt_device_columns';
const FILTERS_KEY = 'cmt_device_filters';

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { id: 'hostname', label: 'Device', defaultVisible: true },
  { id: 'site', label: 'Site', defaultVisible: true },
  { id: 'cluster_key', label: 'Cluster', defaultVisible: true },
  { id: 'version', label: 'Version', defaultVisible: true },
  { id: 'ha_sync', label: 'HA / Sync', defaultVisible: true },
  { id: 'last_facts_refresh', label: 'Last Scan', defaultVisible: true },
  { id: 'last_scan_status', label: 'Health', defaultVisible: true },
];

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
  active?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, onClick, active }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1,
      borderRadius: 2,
      cursor: onClick ? 'pointer' : 'default',
      backgroundColor: active ? alpha(color, 0.15) : 'transparent',
      border: '1px solid',
      borderColor: active ? color : 'divider',
      transition: 'all 0.2s ease',
      '&:hover': onClick
        ? {
            backgroundColor: alpha(color, 0.1),
            borderColor: color,
          }
        : {},
    }}
  >
    <Box sx={{ color, display: 'flex' }}>{icon}</Box>
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1, color }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </Box>
);

// Device Card Component for Grid View
interface DeviceCardProps {
  device: Device;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onSetCredentials: (device: Device) => void;
  onDelete: (id: number) => void;
  onClick: (device: Device) => void;
  userRole: UserRole;
}

const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  isFavorite,
  onToggleFavorite,
  onSetCredentials,
  onDelete,
  onClick,
  userRole,
}) => {
  const getHealthIcon = () => {
    const status = device.last_scan_status?.toLowerCase();
    if (status === 'success') return <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />;
    if (status === 'error' || status === 'failed') return <ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} />;
    if (status === 'warning') return <WarningIcon sx={{ color: '#f59e0b', fontSize: 20 }} />;
    return <HelpOutlineIcon sx={{ color: '#6b7280', fontSize: 20 }} />;
  };

  const getHAColor = () => {
    if (device.ha_state === 'ACTIVE') return '#10b981';
    if (device.ha_state === 'STANDBY') return '#6b7280';
    return '#6366f1';
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
      onClick={() => onClick(device)}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {device.is_primary_preferred && (
              <Tooltip title="Primary device">
                <StarIcon sx={{ color: 'warning.main', fontSize: 18 }} />
              </Tooltip>
            )}
            {getHealthIcon()}
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(device.id);
            }}
            sx={{ color: isFavorite ? 'warning.main' : 'action.disabled' }}
          >
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Box>

        {/* Device Info */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, lineHeight: 1.3 }} noWrap>
          {device.hostname}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontFamily: 'monospace' }}>
          {device.ip_address}
        </Typography>

        {/* Details Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Site
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {device.site || '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {device.version || '—'}
            </Typography>
          </Box>
        </Box>

        {/* HA/Sync Status */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {device.ha_state && (
            <Chip
              icon={device.ha_state === 'ACTIVE' ? <PlayArrowIcon /> : <PauseIcon />}
              label={device.ha_state}
              size="small"
              sx={{
                backgroundColor: alpha(getHAColor(), 0.1),
                color: getHAColor(),
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
          )}
          {device.sync_status && (
            <Chip
              icon={<SyncIcon />}
              label={device.sync_status.length > 12 ? device.sync_status.substring(0, 12) + '…' : device.sync_status}
              size="small"
              sx={{
                backgroundColor: alpha(
                  device.last_sync_color === 'green' ? '#10b981' : device.last_sync_color === 'red' ? '#ef4444' : '#f59e0b',
                  0.1
                ),
                color: device.last_sync_color === 'green' ? '#10b981' : device.last_sync_color === 'red' ? '#ef4444' : '#f59e0b',
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          )}
        </Box>

        {/* Cluster */}
        {device.cluster_key && (
          <Box sx={{ mt: 1.5 }}>
            <Chip
              label={device.cluster_key}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', borderColor: 'primary.light', color: 'primary.main' }}
            />
          </Box>
        )}

        {/* No credentials warning */}
        {!device.username && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <VpnKeyIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            <Typography variant="caption" color="warning.main">
              No credentials
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      {userRole !== 'viewer' && (
        <CardActions sx={{ pt: 0, px: 2, pb: 1.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Set Credentials">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onSetCredentials(device);
              }}
            >
              <VpnKeyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {userRole === 'admin' && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(device.id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </CardActions>
      )}
    </Card>
  );
};

// Main Component
const DevicesPage: React.FC = () => {
  const userRole = authProvider.getRole() as UserRole;

  const glassmorphicStyle: SxProps<Theme> = {
    p: { xs: 2, sm: 3 },
    backgroundColor: (theme: Theme) =>
      theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid',
    borderColor: (theme: Theme) =>
      theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    borderRadius: '20px',
  };

  // State
  const [notification, setNotification] = useState<Notification>({ open: false, message: '', severity: 'info' });
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState<boolean>(false);
  const [drawerDevice, setDrawerDevice] = useState<Device | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [limitCertsInput, setLimitCertsInput] = useState<string>('');
  const [clearSelectionKey, setClearSelectionKey] = useState<number>(0);
  const [filters, setFilters] = useState<DeviceFilters>(() => {
    const saved = localStorage.getItem(FILTERS_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [bulkCredentialsOpen, setBulkCredentialsOpen] = useState<boolean>(false);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState<null | HTMLElement>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState<null | HTMLElement>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Phase 3: New state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return (saved as ViewMode) || 'table';
  });
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(VISIBLE_COLUMNS_KEY);
    return saved ? JSON.parse(saved) : AVAILABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
  });

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  const forceTableRefresh = useCallback((): void => setRefreshKey((k) => k + 1), []);

  // WebSocket
  const { isConnected: wsConnected } = useDeviceWebSocket({
    onDeviceAdded: useCallback(
      (deviceId: number, data: Record<string, unknown>) => {
        setNotification({
          open: true,
          message: `New device added: ${data.hostname || deviceId}`,
          severity: 'info',
        });
        forceTableRefresh();
      },
      [forceTableRefresh]
    ),
    onDeviceUpdated: useCallback(
      (_deviceId: number, _data: Record<string, unknown>) => {
        forceTableRefresh();
      },
      [forceTableRefresh]
    ),
    onDeviceDeleted: useCallback(
      (deviceId: number) => {
        setSelectedIds((prev) => prev.filter((x) => x !== deviceId));
        setFavorites((prev) => prev.filter((x) => x !== deviceId));
        forceTableRefresh();
      },
      [forceTableRefresh]
    ),
    onScanCompleted: useCallback(
      (_deviceId: number, _data: Record<string, unknown>) => {
        forceTableRefresh();
      },
      [forceTableRefresh]
    ),
    onBulkUpdate: useCallback(
      (_deviceIds: number[], _eventType: string) => {
        forceTableRefresh();
      },
      [forceTableRefresh]
    ),
  });

  // Update lastRefresh and loading when devices are loaded
  const handleDevicesLoaded = useCallback((devices: Device[]) => {
    setAllDevices(devices);
    setLastRefresh(new Date());
    setIsLoading(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && e.target === document.body) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to close drawer
      if (e.key === 'Escape') {
        if (detailDrawerOpen) setDetailDrawerOpen(false);
        if (filterDrawerOpen) setFilterDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [detailDrawerOpen, filterDrawerOpen]);

  // Format relative time
  const getRelativeTime = useCallback((date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }, []);

  // Re-render relative time every 10 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = allDevices.length;
    const healthy = allDevices.filter((d) => d.last_scan_status === 'success').length;
    const issues = allDevices.filter((d) => ['failed', 'error'].includes(d.last_scan_status || '')).length;
    const noCredentials = allDevices.filter((d) => !d.username).length;
    const favoritesCount = favorites.length;
    return { total, healthy, issues, noCredentials, favoritesCount };
  }, [allDevices, favorites]);

  // Filter options
  const filterOptions = useMemo(() => {
    const haStates = new Set<string>();
    const syncStatuses = new Set<string>();
    const sites = new Set<string>();

    allDevices.forEach((device) => {
      if (device.ha_state) haStates.add(device.ha_state);
      if (device.sync_status) syncStatuses.add(device.sync_status);
      if (device.site) sites.add(device.site);
    });

    return {
      haStates: Array.from(haStates).sort(),
      syncStatuses: Array.from(syncStatuses).sort(),
      sites: Array.from(sites).sort(),
    };
  }, [allDevices]);

  // Filtered devices for grid view
  const filteredDevicesForGrid = useMemo(() => {
    let result = allDevices;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.hostname?.toLowerCase().includes(term) ||
          d.ip_address?.toLowerCase().includes(term) ||
          d.site?.toLowerCase().includes(term)
      );
    }

    // Filters
    if (filters.ha_state) {
      result = result.filter((d) => d.ha_state === filters.ha_state);
    }
    if (filters.sync_status) {
      result = result.filter((d) => d.sync_status === filters.sync_status);
    }
    if (filters.site) {
      result = result.filter((d) => d.site === filters.site);
    }
    if (filters.is_primary_preferred) {
      result = result.filter((d) => d.is_primary_preferred === true);
    }
    if (filters.no_credentials) {
      result = result.filter((d) => !d.username);
    }
    if (filters.health_status) {
      if (filters.health_status === 'success') {
        result = result.filter((d) => d.last_scan_status === 'success');
      } else if (filters.health_status === 'failed') {
        result = result.filter((d) => ['failed', 'error'].includes(d.last_scan_status || ''));
      }
    }
    if (filters.favorites_only) {
      result = result.filter((d) => favorites.includes(d.id));
    }

    // Sort: favorites first
    result = [...result].sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (a.hostname || '').localeCompare(b.hostname || '');
    });

    return result;
  }, [allDevices, searchTerm, filters, favorites]);

  const activeFilterCount = Object.keys(filters).filter(
    (k) => filters[k as keyof DeviceFilters] !== undefined && filters[k as keyof DeviceFilters] !== false
  ).length;

  // Handlers
  const toggleFavorite = (deviceId: number) => {
    setFavorites((prev) => (prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]));
  };

  const handleExportCSV = (): void => {
    if (!allDevices || allDevices.length === 0) {
      setNotification({ open: true, message: 'No devices to export.', severity: 'warning' });
      return;
    }

    const columns: (keyof Device)[] = [
      'id', 'hostname', 'ip_address', 'site', 'cluster_key', 'is_primary_preferred',
      'version', 'ha_state', 'sync_status', 'last_sync_color',
      'last_scan_status', 'last_scan_message', 'last_facts_refresh',
      'active', 'username', 'created_at', 'updated_at',
    ];

    const header = columns.join(',');
    const rows = allDevices.map((device: Device) => {
      return columns
        .map((col) => {
          let value: unknown = device[col];
          if (value === null || value === undefined) value = '';
          if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
          let strValue = String(value).replace(/"/g, '""');
          if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
            strValue = `"${strValue}"`;
          }
          return strValue;
        })
        .join(',');
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `device_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionsMenuAnchor(null);
    setNotification({ open: true, message: `Exported ${allDevices.length} devices to CSV.`, severity: 'success' });
  };

  const handleScanAll = (): void => {
    setActionsMenuAnchor(null);
    scanAllDevices()
      .then((res) => setNotification({ open: true, message: res?.message || 'Scan queued.', severity: 'success' }))
      .catch((err: Error) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleSaveCredentials = (credentials: DeviceCredentials): void => {
    if (!selectedDevice) return;
    updateDeviceCredentials(selectedDevice.id, credentials)
      .then(() => {
        setNotification({ open: true, message: `Credentials updated.`, severity: 'success' });
        setCredentialModalOpen(false);
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleAddDevice = (deviceData: DeviceCreate): void => {
    createDevice(deviceData)
      .then(() => {
        setNotification({ open: true, message: 'Device added.', severity: 'success' });
        setAddModalOpen(false);
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleDeleteDevice = (id: number): void => {
    deleteDevice(id)
      .then(() => {
        setNotification({ open: true, message: 'Device deleted.', severity: 'success' });
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        setFavorites((prev) => prev.filter((x) => x !== id));
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const bulkRefreshFacts = async (): Promise<void> => {
    await Promise.all(selectedIds.map((id) => refreshFacts(id)));
    setNotification({ open: true, message: `Queued facts refresh for ${selectedIds.length}.`, severity: 'success' });
  };

  const bulkRefreshCache = async (): Promise<void> => {
    const limitCerts = limitCertsInput.trim() ? parseInt(limitCertsInput.trim(), 10) : undefined;
    await Promise.all(selectedIds.map((id) => refreshCache(id, limitCerts)));
    setNotification({ open: true, message: `Queued cache refresh for ${selectedIds.length}.`, severity: 'success' });
  };

  const clearSelection = (): void => {
    setSelectedIds([]);
    setClearSelectionKey((k) => k + 1);
  };

  const handleRowClick = (device: Device): void => {
    setDrawerDevice(device);
    setDetailDrawerOpen(true);
  };

  const handleDrawerClose = (): void => {
    setDetailDrawerOpen(false);
  };

  const handleScanDevice = (device: Device): void => {
    scanAllDevices([device.id])
      .then(() => {
        setNotification({ open: true, message: `Scan queued for ${device.hostname}`, severity: 'success' });
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleRefreshFacts = (device: Device): void => {
    refreshFacts(device.id)
      .then(() => {
        setNotification({ open: true, message: `Facts refresh queued for ${device.hostname}`, severity: 'success' });
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleBulkCredentialSave = async (deviceId: number, credentials: DeviceCredentials): Promise<void> => {
    await updateDeviceCredentials(deviceId, credentials);
  };

  const handleEditDevice = (device: Device): void => {
    setEditDevice(device);
    setEditModalOpen(true);
    setDetailDrawerOpen(false);
  };

  const handleSaveDevice = (updatedDevice: Device): void => {
    setNotification({ open: true, message: `Device ${updatedDevice.hostname} updated.`, severity: 'success' });
    forceTableRefresh();
    if (drawerDevice && drawerDevice.id === updatedDevice.id) {
      setDrawerDevice(updatedDevice);
    }
  };

  const handleFilterChange = (filterKey: keyof DeviceFilters, value: string | boolean | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value === undefined || value === '' || value === false) {
        delete newFilters[filterKey];
      } else {
        (newFilters as any)[filterKey] = value;
      }
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const handleStatClick = (filterType: string) => {
    if (filterType === 'healthy') {
      setFilters(filters.health_status === 'success' ? {} : { health_status: 'success' });
    } else if (filterType === 'issues') {
      setFilters(filters.health_status === 'failed' ? {} : { health_status: 'failed' });
    } else if (filterType === 'noCredentials') {
      setFilters(filters.no_credentials ? {} : { no_credentials: true });
    } else if (filterType === 'favorites') {
      setFilters(filters.favorites_only ? {} : { favorites_only: true });
    } else {
      clearAllFilters();
    }
  };

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    );
  };

  return (
    <Box>
      <Paper elevation={0} sx={glassmorphicStyle}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Device Inventory
                </Typography>
                <Chip
                  icon={wsConnected ? <WifiIcon /> : <WifiOffIcon />}
                  label={wsConnected ? 'Live' : 'Offline'}
                  color={wsConnected ? 'success' : 'default'}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 500 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Manage and monitor your F5 BIG-IP devices
              </Typography>
            </Box>
          </Box>

          {/* Stats */}
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
            <StatCard
              icon={<DevicesIcon />}
              label="Total Devices"
              value={stats.total}
              color="#6366f1"
              onClick={() => handleStatClick('all')}
              active={activeFilterCount === 0}
            />
            <StatCard
              icon={<CheckCircleOutlineIcon />}
              label="Healthy"
              value={stats.healthy}
              color="#10b981"
              onClick={() => handleStatClick('healthy')}
              active={filters.health_status === 'success'}
            />
            <StatCard
              icon={<ErrorOutlineIcon />}
              label="Issues"
              value={stats.issues}
              color="#ef4444"
              onClick={() => handleStatClick('issues')}
              active={filters.health_status === 'failed'}
            />
            <StatCard
              icon={<KeyOffIcon />}
              label="No Credentials"
              value={stats.noCredentials}
              color="#f59e0b"
              onClick={() => handleStatClick('noCredentials')}
              active={filters.no_credentials === true}
            />
            <StatCard
              icon={<StarIcon />}
              label="Favorites"
              value={stats.favoritesCount}
              color="#ec4899"
              onClick={() => handleStatClick('favorites')}
              active={filters.favorites_only === true}
            />
          </Stack>
        </Box>

        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          }}
        >
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search devices... (press /)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputRef={searchInputRef}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          {/* Filters */}
          <Badge badgeContent={activeFilterCount} color="primary">
            <Button
              variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => setFilterDrawerOpen(true)}
              color={activeFilterCount > 0 ? 'primary' : 'inherit'}
            >
              Filters
            </Button>
          </Badge>

          {activeFilterCount > 0 && (
            <Tooltip title="Clear all filters">
              <IconButton size="small" onClick={clearAllFilters}>
                <ClearAllIcon />
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="grid">
              <Tooltip title="Card View">
                <GridViewIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Column Selector (Table only) */}
          {viewMode === 'table' && (
            <>
              <Tooltip title="Configure columns">
                <IconButton onClick={(e) => setColumnsMenuAnchor(e.currentTarget)}>
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={columnsMenuAnchor}
                open={Boolean(columnsMenuAnchor)}
                onClose={() => setColumnsMenuAnchor(null)}
              >
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary">
                    Visible Columns
                  </Typography>
                </MenuItem>
                <Divider />
                {AVAILABLE_COLUMNS.map((col) => (
                  <MenuItem key={col.id} onClick={() => toggleColumn(col.id)} dense>
                    <Checkbox checked={visibleColumns.includes(col.id)} size="small" />
                    <ListItemText>{col.label}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          {/* Last Refresh Indicator */}
          <Tooltip title={`Last updated: ${lastRefresh.toLocaleTimeString()}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption">{getRelativeTime(lastRefresh)}</Typography>
            </Box>
          </Tooltip>

          {/* Refresh */}
          <Tooltip title="Refresh data">
            <IconButton onClick={forceTableRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Actions Menu */}
          {userRole !== 'viewer' && (
            <>
              <Button
                variant="outlined"
                size="small"
                endIcon={<MoreVertIcon />}
                onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
              >
                Actions
              </Button>
              <Menu
                anchorEl={actionsMenuAnchor}
                open={Boolean(actionsMenuAnchor)}
                onClose={() => setActionsMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {userRole === 'admin' && (
                  <MenuItem onClick={() => { setActionsMenuAnchor(null); setAddModalOpen(true); }}>
                    <ListItemIcon><DevicesIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Add Device</ListItemText>
                  </MenuItem>
                )}
                <MenuItem onClick={handleScanAll}>
                  <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Scan All Devices</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleExportCSV} disabled={allDevices.length === 0}>
                  <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Export to CSV</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Notification */}
        <Collapse in={notification.open}>
          <Alert
            severity={notification.severity}
            onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
            sx={{ mb: 2 }}
          >
            {notification.message}
          </Alert>
        </Collapse>

        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Active filters:
            </Typography>
            {filters.ha_state && (
              <Chip label={`HA: ${filters.ha_state}`} size="small" onDelete={() => handleFilterChange('ha_state', undefined)} color="primary" variant="outlined" />
            )}
            {filters.sync_status && (
              <Chip label={`Sync: ${filters.sync_status}`} size="small" onDelete={() => handleFilterChange('sync_status', undefined)} color="primary" variant="outlined" />
            )}
            {filters.site && (
              <Chip label={`Site: ${filters.site}`} size="small" onDelete={() => handleFilterChange('site', undefined)} color="primary" variant="outlined" />
            )}
            {filters.health_status && (
              <Chip label={`Health: ${filters.health_status}`} size="small" onDelete={() => handleFilterChange('health_status', undefined)} color={filters.health_status === 'success' ? 'success' : 'error'} variant="outlined" />
            )}
            {filters.no_credentials && (
              <Chip label="No Credentials" size="small" onDelete={() => handleFilterChange('no_credentials', undefined)} color="warning" variant="outlined" />
            )}
            {filters.is_primary_preferred && (
              <Chip label="Primary Only" size="small" onDelete={() => handleFilterChange('is_primary_preferred', undefined)} color="primary" variant="outlined" />
            )}
            {filters.favorites_only && (
              <Chip label="Favorites Only" size="small" onDelete={() => handleFilterChange('favorites_only', undefined)} color="secondary" variant="outlined" icon={<StarIcon />} />
            )}
          </Box>
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && viewMode === 'table' && (
          <BulkActionsBar
            selectionCount={selectedIds.length}
            onRefreshFacts={bulkRefreshFacts}
            onRefreshCache={bulkRefreshCache}
            onScanAll={handleScanAll}
            onClearSelection={clearSelection}
            onBulkSetCredentials={() => setBulkCredentialsOpen(true)}
            limitCertsInput={limitCertsInput}
            setLimitCertsInput={setLimitCertsInput}
            userRole={userRole}
          />
        )}

        {/* Content: Table or Grid */}
        {viewMode === 'table' ? (
          <DeviceTable
            onSetCredentials={(d: Device) => {
              setSelectedDevice(d);
              setCredentialModalOpen(true);
            }}
            onDeleteDevice={handleDeleteDevice}
            onRowClick={handleRowClick}
            refreshTrigger={refreshKey}
            searchTerm={searchTerm}
            userRole={userRole}
            onSelectionChange={setSelectedIds}
            clearSelectionKey={clearSelectionKey}
            filters={filters}
            onDevicesLoaded={handleDevicesLoaded}
            visibleColumns={visibleColumns}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        ) : (
          <Box sx={{ height: 'calc(100vh - 400px)', overflow: 'auto', py: 1 }}>
            {filteredDevicesForGrid.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <DevicesIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No devices found
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Try adjusting your search or filters
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {filteredDevicesForGrid.map((device) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={device.id}>
                    <DeviceCard
                      device={device}
                      isFavorite={favorites.includes(device.id)}
                      onToggleFavorite={toggleFavorite}
                      onSetCredentials={(d) => {
                        setSelectedDevice(d);
                        setCredentialModalOpen(true);
                      }}
                      onDelete={handleDeleteDevice}
                      onClick={handleRowClick}
                      userRole={userRole}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}
      </Paper>

      {/* Filter Drawer */}
      <Drawer
        anchor="right"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        PaperProps={{ sx: { width: 320, p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Filters</Typography>
          <IconButton onClick={() => setFilterDrawerOpen(false)} size="small"><CloseIcon /></IconButton>
        </Box>

        <Stack spacing={3}>
          <FormControl fullWidth size="small">
            <InputLabel>HA State</InputLabel>
            <Select value={filters.ha_state || ''} label="HA State" onChange={(e: SelectChangeEvent) => handleFilterChange('ha_state', e.target.value || undefined)}>
              <MenuItem value=""><em>All</em></MenuItem>
              {filterOptions.haStates.map((state) => (<MenuItem key={state} value={state}>{state}</MenuItem>))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Sync Status</InputLabel>
            <Select value={filters.sync_status || ''} label="Sync Status" onChange={(e: SelectChangeEvent) => handleFilterChange('sync_status', e.target.value || undefined)}>
              <MenuItem value=""><em>All</em></MenuItem>
              {filterOptions.syncStatuses.map((status) => (<MenuItem key={status} value={status}>{status}</MenuItem>))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Site</InputLabel>
            <Select value={filters.site || ''} label="Site" onChange={(e: SelectChangeEvent) => handleFilterChange('site', e.target.value || undefined)}>
              <MenuItem value=""><em>All Sites</em></MenuItem>
              {filterOptions.sites.map((site) => (<MenuItem key={site} value={site}>{site}</MenuItem>))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Health</InputLabel>
            <Select value={filters.health_status || ''} label="Health" onChange={(e: SelectChangeEvent) => handleFilterChange('health_status', e.target.value || undefined)}>
              <MenuItem value=""><em>All</em></MenuItem>
              <MenuItem value="success">Healthy</MenuItem>
              <MenuItem value="failed">Issues</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          <FormGroup>
            <FormControlLabel control={<Checkbox checked={filters.is_primary_preferred || false} onChange={(e) => handleFilterChange('is_primary_preferred', e.target.checked || undefined)} />} label="Primary devices only" />
            <FormControlLabel control={<Checkbox checked={filters.no_credentials || false} onChange={(e) => handleFilterChange('no_credentials', e.target.checked || undefined)} />} label="Missing credentials" />
            <FormControlLabel control={<Checkbox checked={filters.favorites_only || false} onChange={(e) => handleFilterChange('favorites_only', e.target.checked || undefined)} />} label="Favorites only" />
          </FormGroup>

          <Divider />

          <Button variant="outlined" fullWidth startIcon={<ClearAllIcon />} onClick={() => { clearAllFilters(); setFilterDrawerOpen(false); }} disabled={activeFilterCount === 0}>
            Clear All Filters
          </Button>
        </Stack>
      </Drawer>

      {/* Device Detail Drawer */}
      <DeviceDetailDrawer
        open={detailDrawerOpen}
        onClose={handleDrawerClose}
        device={drawerDevice}
        onSetCredentials={(d: Device) => { setSelectedDevice(d); setCredentialModalOpen(true); setDetailDrawerOpen(false); }}
        onEdit={handleEditDevice}
        onRefreshFacts={handleRefreshFacts}
        onScan={handleScanDevice}
      />

      {/* Dialogs */}
      <CredentialDialog open={credentialModalOpen} onClose={() => setCredentialModalOpen(false)} onSave={handleSaveCredentials} device={selectedDevice} />
      <EditDeviceDialog open={editModalOpen} onClose={() => setEditModalOpen(false)} device={editDevice} onSave={handleSaveDevice} />
      <BulkCredentialsDialog open={bulkCredentialsOpen} onClose={() => { setBulkCredentialsOpen(false); forceTableRefresh(); }} devices={allDevices.filter((d) => selectedIds.includes(d.id))} onSave={handleBulkCredentialSave} />
      {userRole === 'admin' && <AddDeviceDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdd={handleAddDevice} />}
    </Box>
  );
};

export default DevicesPage;
