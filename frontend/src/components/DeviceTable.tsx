// frontend/src/components/DeviceTable.tsx
// Enterprise-grade Device Table with compact design
import React, { useState, useEffect, useMemo, FC } from 'react';
import apiClient from '../services/api';
import { DataGrid, GridColDef, GridSortModel, GridRowParams, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SyncIcon from '@mui/icons-material/Sync';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DevicesIcon from '@mui/icons-material/Devices';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { Device } from '../types/device';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

// Types
interface DeviceFilters {
  ha_state?: string | null;
  sync_status?: string | null;
  site?: string | null;
  is_primary_preferred?: boolean | null;
  no_credentials?: boolean | null;
  health_status?: string | null;
}

interface DeviceTableProps {
  onSetCredentials: (device: Device) => void;
  onDeleteDevice: (deviceId: number) => void;
  onRowClick?: (device: Device) => void;
  searchTerm?: string;
  refreshTrigger?: number;
  userRole?: string;
  onSelectionChange?: (ids: number[]) => void;
  clearSelectionKey?: number;
  filters?: DeviceFilters;
  onDevicesLoaded?: (devices: Device[]) => void;
  favorites?: number[];
  visibleColumns?: string[];
  onToggleFavorite?: (deviceId: number) => void;
}

interface StatusIconProps {
  status: string;
  tooltipText?: string;
  size?: number;
}

interface HASyncCellProps {
  haState?: string | null;
  syncStatus?: string | null;
  syncColor?: string | null;
}

// Status Icon Component - compact status display
const StatusIcon: FC<StatusIconProps> = ({ status, tooltipText, size = 20 }) => {
  const config: Record<string, { icon: typeof CheckCircleIcon; color: string }> = {
    success: { icon: CheckCircleIcon, color: '#10b981' },
    error: { icon: ErrorIcon, color: '#ef4444' },
    failed: { icon: ErrorIcon, color: '#ef4444' },
    warning: { icon: WarningIcon, color: '#f59e0b' },
    pending: { icon: HelpOutlineIcon, color: '#6b7280' },
    running: { icon: SyncIcon, color: '#3b82f6' },
    default: { icon: HelpOutlineIcon, color: '#6b7280' },
  };
  
  const { icon: Icon, color } = config[status?.toLowerCase()] || config.default;
  
  return (
    <Tooltip title={tooltipText || status} arrow>
      <Icon sx={{ fontSize: size, color }} />
    </Tooltip>
  );
};

// HA/Sync Combined Cell
const HASyncCell: FC<HASyncCellProps> = ({ haState, syncStatus, syncColor }) => {
  const haConfig: Record<string, { icon: typeof PlayArrowIcon; color: string; bg: string }> = {
    ACTIVE: { icon: PlayArrowIcon, color: '#10b981', bg: alpha('#10b981', 0.1) },
    STANDBY: { icon: PauseIcon, color: '#6b7280', bg: alpha('#6b7280', 0.1) },
    STANDALONE: { icon: DevicesIcon, color: '#6366f1', bg: alpha('#6366f1', 0.1) },
  };
  
  const syncColorMap: Record<string, string> = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
  };
  
  const ha = haState ? haConfig[haState] : { icon: HelpOutlineIcon, color: '#6b7280', bg: 'transparent' };
  const HaIcon = ha?.icon || HelpOutlineIcon;
  const syncColorValue = syncColor ? syncColorMap[syncColor] : '#6b7280';
  
  if (!haState && !syncStatus) {
    return <Typography color="text.disabled">—</Typography>;
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {haState && (
        <Tooltip title={`HA: ${haState}`} arrow>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: ha.bg,
            }}
          >
            <HaIcon sx={{ fontSize: 16, color: ha.color }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: ha.color }}>
              {haState}
            </Typography>
          </Box>
        </Tooltip>
      )}
      {syncStatus && (
        <Tooltip title={`Sync: ${syncStatus}`} arrow>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: alpha(syncColorValue, 0.1),
            }}
          >
            {syncColor === 'green' ? (
              <SyncIcon sx={{ fontSize: 14, color: syncColorValue }} />
            ) : syncColor === 'red' ? (
              <SyncDisabledIcon sx={{ fontSize: 14, color: syncColorValue }} />
            ) : (
              <SyncProblemIcon sx={{ fontSize: 14, color: syncColorValue }} />
            )}
            <Typography variant="caption" sx={{ fontWeight: 500, color: syncColorValue }}>
              {syncStatus.length > 10 ? syncStatus.substring(0, 10) + '…' : syncStatus}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

const DeviceTable: FC<DeviceTableProps> = ({
  onSetCredentials,
  onDeleteDevice,
  onRowClick,
  searchTerm = '',
  refreshTrigger,
  userRole,
  onSelectionChange,
  clearSelectionKey,
  filters = {},
  onDevicesLoaded,
  visibleColumns = [], // Phase 3: Column visibility
  favorites = [],      // Phase 3: Favorite device IDs
  onToggleFavorite,    // Phase 3: Toggle favorite callback
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionModel, setSelectionModel] = useState<number[]>([]);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'cluster_key', sort: 'asc' },
    { field: 'ip_address', sort: 'asc' },
  ]);

  // Fetch devices
  useEffect(() => {
    const handler = setTimeout(() => {
      setLoading(true);
      let apiUrl = '/devices/';
      if (searchTerm) apiUrl += `?search=${encodeURIComponent(searchTerm)}`;
      apiClient
        .get(apiUrl)
        .then((response) => {
          setDevices(response.data);
          if (onDevicesLoaded) onDevicesLoaded(response.data);
        })
        .catch((error) => {
          console.error('Error fetching devices:', error);
          setDevices([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, refreshTrigger]);

  // Apply client-side filters and sort favorites to top
  const filteredDevices = useMemo(() => {
    let result = devices;
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
        result = result.filter((d) => ['failed', 'error'].includes(d.last_scan_status));
      }
    }
    // Sort favorites to top
    if (favorites.length > 0) {
      result = [...result].sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      });
    }
    return result;
  }, [devices, filters, favorites]);

  useEffect(() => {
    setSelectionModel([]);
  }, [clearSelectionKey]);

  // Column definitions - optimized for enterprise display
  const allColumns = [
    // Favorites column (always first if enabled)
    {
      field: 'favorite',
      headerName: '',
      width: 50,
      sortable: false,
      resizable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const isFavorite = favorites.includes(params.row.id);
        return (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleFavorite) onToggleFavorite(params.row.id);
            }}
            sx={{
              color: isFavorite ? 'warning.main' : 'action.disabled',
              '&:hover': {
                color: 'warning.main',
                backgroundColor: alpha('#f59e0b', 0.1),
              },
            }}
          >
            {isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
          </IconButton>
        );
      },
    },
    {
      field: 'hostname',
      headerName: 'Device',
      flex: 1.2,
      minWidth: 250,
      resizable: true,
      renderCell: (params) => {
        const isPrimary = params.row?.is_primary_preferred === true;
        const hasCredentials = !!params.row?.username;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isPrimary && (
              <Tooltip title="Primary device for cluster operations" arrow>
                <StarIcon sx={{ color: 'warning.main', fontSize: 18 }} />
              </Tooltip>
            )}
            <Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isPrimary ? 600 : 500,
                  color: 'text.primary',
                  lineHeight: 1.3,
                }}
              >
                {params.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {params.row.ip_address}
              </Typography>
            </Box>
            {!hasCredentials && (
              <Tooltip title="No credentials configured" arrow>
                <VpnKeyIcon sx={{ fontSize: 16, color: 'warning.main', ml: 'auto' }} />
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      field: 'site',
      headerName: 'Site',
      flex: 0.4,
      minWidth: 80,
      resizable: true,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'cluster_key',
      headerName: 'Cluster',
      flex: 0.6,
      minWidth: 120,
      resizable: true,
      renderCell: (params) => {
        const cluster = params.value;
        if (!cluster) return <Typography color="text.disabled">—</Typography>;
        return (
          <Chip
            label={cluster}
            size="small"
            variant="outlined"
            sx={{
              fontWeight: 500,
              fontSize: '0.75rem',
              height: 24,
              borderColor: 'primary.light',
              color: 'primary.main',
            }}
          />
        );
      },
    },
    {
      field: 'version',
      headerName: 'Version',
      flex: 0.4,
      minWidth: 90,
      resizable: true,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'ha_sync',
      headerName: 'HA / Sync',
      flex: 0.9,
      minWidth: 180,
      resizable: true,
      sortable: false,
      renderCell: (params) => (
        <HASyncCell
          haState={params.row.ha_state}
          syncStatus={params.row.sync_status}
          syncColor={params.row.last_sync_color}
        />
      ),
    },
    {
      field: 'last_facts_refresh',
      headerName: 'Last Scan',
      flex: 0.6,
      minWidth: 130,
      resizable: true,
      renderCell: (params) => {
        const raw = params?.value;
        if (!raw) return <Typography color="text.disabled">Never</Typography>;
        const d = dayjs.utc(raw).tz(dayjs.tz.guess());
        const relative = d.isValid() ? d.fromNow() : '—';
        const absolute = d.isValid() ? d.format('MMM D, HH:mm') : '';
        return (
          <Tooltip title={absolute} arrow>
            <Typography variant="body2" color="text.secondary">
              {relative}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'last_scan_status',
      headerName: 'Health',
      flex: 0.35,
      minWidth: 70,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = params.value || 'pending';
        const message = params.row.last_scan_message || `Status: ${status}`;
        return <StatusIcon status={status} tooltipText={message} size={22} />;
      },
    },
  ];

  // Add actions column for non-viewers
  if (userRole && userRole !== 'viewer') {
    allColumns.push({
      field: 'actions',
      headerName: '',
      sortable: false,
      flex: 0.5,
      minWidth: 100,
      resizable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const isHovered = hoveredRowId === params.row.id;
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}
          >
            <Tooltip title="Set Credentials" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCredentials(params.row);
                }}
                sx={{
                  color: 'primary.main',
                  '&:hover': { backgroundColor: alpha('#6366f1', 0.1) },
                }}
              >
                <VpnKeyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {userRole === 'admin' && (
              <Tooltip title="Delete Device" arrow>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDevice(params.row.id);
                  }}
                  sx={{
                    color: 'error.main',
                    '&:hover': { backgroundColor: alpha('#ef4444', 0.1) },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    });
  }

  // Filter columns based on visibleColumns prop
  const columns = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) {
      return allColumns;
    }
    return allColumns.filter((col) => {
      // Always show favorite and actions columns
      if (col.field === 'favorite' || col.field === 'actions') return true;
      return visibleColumns.includes(col.field);
    });
  }, [allColumns, visibleColumns, hoveredRowId, favorites]);

  return (
    <Box sx={{ height: 'calc(100vh - 340px)', width: '100%' }}>
      <DataGrid
        rows={Array.isArray(filteredDevices) ? filteredDevices : []}
        columns={columns}
        loading={loading}
        getRowId={(row) => row.id}
        disableSelectionOnClick
        density="comfortable"
        // Sorting
        sortingOrder={['asc', 'desc']}
        sortModel={sortModel}
        onSortModelChange={(m) =>
          setSortModel(m && m.length ? m : [{ field: 'ip_address', sort: 'asc' }])
        }
        // Pagination
        pagination
        pageSize={50}
        rowsPerPageOptions={[25, 50, 100]}
        // Selection
        checkboxSelection
        // Row click handler
        onRowClick={(params, event) => {
          if (event.target.closest('button, .MuiCheckbox-root, .MuiIconButton-root')) {
            return;
          }
          if (onRowClick) {
            onRowClick(params.row);
          }
        }}
        // Selection model
        onSelectionModelChange={(newSelection) => {
          setSelectionModel(newSelection);
          if (onSelectionChange) {
            onSelectionChange(newSelection);
          }
        }}
        selectionModel={selectionModel}
        // Row hover tracking for actions
        componentsProps={{
          row: {
            onMouseEnter: (event) => {
              const rowId = Number(event.currentTarget.getAttribute('data-id'));
              setHoveredRowId(rowId);
            },
            onMouseLeave: () => {
              setHoveredRowId(null);
            },
          },
        }}
        // Enable column resize
        disableColumnResize={false}
        // Styling
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600,
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'text.secondary',
          },
          '& .MuiDataGrid-columnSeparator': {
            visibility: 'visible',
            color: 'rgba(224, 224, 224, 0.3)',
          },
          '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-columnSeparator': {
            color: 'primary.main',
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            },
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          },
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-cell:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid',
            borderColor: 'divider',
          },
        }}
      />
    </Box>
  );
};

export default DeviceTable;
