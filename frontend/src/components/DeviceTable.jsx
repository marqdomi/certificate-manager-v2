import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Box, 
  IconButton, 
  Tooltip, 
  Button, 
  Avatar, 
  Stack,
  Typography,
  Paper,
  useTheme
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ComputerIcon from '@mui/icons-material/Computer';
import SecurityIcon from '@mui/icons-material/Security';
import SyncIcon from '@mui/icons-material/Sync';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Import cluster components and utilities
import { ClusterInfo } from './cluster/ClusterComponents';
import { 
  getCondensedView, 
  getExpandedView,
  filterDevicesByCluster,
  getClusterStats 
} from '../utils/clusterUtils';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const DeviceTable = ({
  onSetCredentials,
  onDeleteDevice,
  searchTerm,
  refreshTrigger,
  userRole,
  // New cluster-related props
  clusterFilters = {},
  onClusterFilterChange = () => {},
  viewMode = 'condensed' // 'condensed' | 'expanded'
}) => {
  // Helper function to check if user has admin privileges
  const isAdmin = () => {
    return userRole === 'admin' || userRole === 'super_admin';
  };

  // Helper function to get HA state color
  const getHAStateColor = (haState) => {
    switch (haState?.toLowerCase()) {
      case 'active':
        return '#4caf50'; // Green
      case 'standby':
        return '#ff9800'; // Orange
      case 'offline':
        return '#f44336'; // Red
      default:
        return '#9e9e9e'; // Gray
    }
  };

const [devices, setDevices] = useState([]);
const [rawDevices, setRawDevices] = useState([]); // Store original data
const [loading, setLoading] = useState(true);
const [expandedClusters, setExpandedClusters] = useState({});
const [clusterStats, setClusterStats] = useState({});
const theme = useTheme();
const isDarkMode = theme.palette.mode === 'dark';

  // Helper function to get theme-aware colors for status indicators
const getStatusColors = (baseColor, isDark = isDarkMode) => {
    const colors = {
      '#4caf50': { // Green - Success
        main: isDark ? '#66bb6a' : '#4caf50',
        bg: isDark ? 'rgba(102, 187, 106, 0.15)' : 'rgba(76, 175, 80, 0.1)',
      },
      '#f44336': { // Red - Error
        main: isDark ? '#ef5350' : '#f44336',
        bg: isDark ? 'rgba(239, 83, 80, 0.15)' : 'rgba(244, 67, 54, 0.1)',
      },
      '#ff9800': { // Orange - Warning
        main: isDark ? '#ffa726' : '#ff9800',
        bg: isDark ? 'rgba(255, 167, 38, 0.15)' : 'rgba(255, 152, 0, 0.1)',
      },
      '#2196f3': { // Blue - Info
        main: isDark ? '#42a5f5' : '#2196f3',
        bg: isDark ? 'rgba(66, 165, 245, 0.15)' : 'rgba(33, 150, 243, 0.1)',
      },
      '#9e9e9e': { // Gray - Default
        main: isDark ? '#bdbdbd' : '#9e9e9e',
        bg: isDark ? 'rgba(189, 189, 189, 0.15)' : 'rgba(158, 158, 158, 0.1)',
      },
    };
    return colors[baseColor] || colors['#9e9e9e'];
};

  const getHaSortRank = (state) => {
    const normalized = (state || '').toLowerCase();
    if (normalized === 'active') return 0;
    if (normalized === 'standby') return 1;
    return 2;
  };

  const clusterSort = (value1, value2, cellParams1, cellParams2) => {
    const aKey = (value1 || '').trim();
    const bKey = (value2 || '').trim();
    const aEmpty = aKey === '';
    const bEmpty = bKey === '';

    if (aEmpty && !bEmpty) return 1; // Nulls last
    if (!aEmpty && bEmpty) return -1;
    if (!aEmpty && !bEmpty) {
      const keyCompare = aKey.localeCompare(bKey);
      if (keyCompare !== 0) return keyCompare;
    }

    const rowA = cellParams1?.row || {};
    const rowB = cellParams2?.row || {};
    const haCompare = getHaSortRank(rowA.ha_state) - getHaSortRank(rowB.ha_state);
    if (haCompare !== 0) return haCompare;

    return (rowA.hostname || '').localeCompare(rowB.hostname || '');
  };

  const haSortComparator = (a, b) => getHaSortRank(a) - getHaSortRank(b);

  const defaultSortModel = [
    { field: 'cluster_key', sort: 'asc' },
    { field: 'ha_state', sort: 'asc' },
    { field: 'hostname', sort: 'asc' }
  ];

  const [sortModel, setSortModel] = useState(defaultSortModel);

  // Fetch devices
  useEffect(() => {
    const handler = setTimeout(() => {
      setLoading(true);
      let apiUrl = '/devices/';
      if (searchTerm) apiUrl += `?search=${encodeURIComponent(searchTerm)}`;
      apiClient
        .get(apiUrl)
        .then((response) => {
          const fetchedDevices = response.data || [];
          setRawDevices(fetchedDevices);
          
          // Calculate cluster stats
          const stats = getClusterStats(fetchedDevices);
          setClusterStats(stats);
          
          // Apply cluster filtering and view mode
          const filteredDevices = filterDevicesByCluster(fetchedDevices, {
            ...clusterFilters,
            searchTerm
          });
          
          let processedDevices;
          if (viewMode === 'condensed') {
            processedDevices = getCondensedView(filteredDevices);
          } else {
            processedDevices = getExpandedView(filteredDevices, expandedClusters);
          }
          
          setDevices(processedDevices);
        })
        .catch((error) => {
          console.error('Error fetching devices:', error);
          setDevices([]);
          setRawDevices([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, refreshTrigger, clusterFilters, viewMode, expandedClusters]);

  // Handle cluster expansion
  const handleClusterToggle = (clusterKey) => {
    setExpandedClusters(prev => ({
      ...prev,
      [clusterKey]: !prev[clusterKey]
    }));
  };

  const columns = [
    {
      field: 'cluster_key',
      headerName: 'Cluster Key',
      hide: true,
      sortable: true,
      sortComparator: clusterSort,
      valueGetter: (params) => params.row?.cluster_key || ''
    },
    { 
      field: 'hostname', 
      headerName: 'Device', 
      flex: 1, 
      minWidth: 300,
      renderCell: (params) => {
        const device = params.row;
        const theme = useTheme();
        
        return (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
            <Avatar 
              sx={{ 
                bgcolor: getStatusColors(getHAStateColor(device.ha_state)).main,
                width: 40, 
                height: 40 
              }}
            >
              <ComputerIcon />
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {device.hostname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {device.ip_address} • {device.site || 'No Site'}
              </Typography>
            </Box>
          </Stack>
        );
      }
    },
    {
      field: 'cluster_info',
      headerName: 'Cluster Info',
      width: 280,
      align: 'left',
      headerAlign: 'left',
      sortable: false,
      renderCell: (params) => {
        const device = params.row;
        
        // Don't show cluster info for cluster members (secondary rows)
        if (device.isClusterMember) {
          return null;
        }
        
      return (
        <ClusterInfo
          device={device}
          clusterLabel={device.cluster_label}
          clusterMembers={device.clusterMembers || []}
          expanded={expandedClusters[device.cluster_key]}
          onToggleExpand={() => handleClusterToggle(device.cluster_key)}
          showExpandButton={viewMode === 'expanded'}
          size="small"
        />
      );
    }
  },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const device = params.row;
        const hasCredentials = device.has_credentials;
        const lastScanStatus = device.last_scan_status?.toLowerCase() || 'pending';
        
        // Determine overall device status
        let status = 'offline';
        let baseColor = '#f44336';
        let label = 'Offline';
        
        if (!hasCredentials) {
          status = 'no_credentials';
          baseColor = '#ff9800';
          label = 'No Creds';
        } else if (lastScanStatus === 'success' || lastScanStatus === 'completed') {
          status = 'online';
          baseColor = '#4caf50';
          label = 'Online';
        } else if (lastScanStatus === 'running' || lastScanStatus === 'in_progress') {
          status = 'scanning';
          baseColor = '#2196f3';
          label = 'Scanning';
        } else if (lastScanStatus === 'failed' || lastScanStatus === 'error') {
          status = 'error';
          baseColor = '#f44336';
          label = 'Error';
        } else {
          status = 'unknown';
          baseColor = '#9e9e9e';
          label = 'Unknown';
        }

        const colors = getStatusColors(baseColor);
        
        // Create intelligent tooltip with comprehensive information
        const deviceData = params.row;
        const lastFactsRefresh = deviceData.last_facts_refresh;
        let tooltipContent = [];
        
        // Add primary status info
        tooltipContent.push(`Status: ${label}`);
        
        if (hasCredentials) {
          tooltipContent.push(`Last scan: ${lastScanStatus}`);
          
          // Add timestamp information if available
          if (lastFactsRefresh) {
            const factDate = dayjs.utc(lastFactsRefresh).tz(dayjs.tz.guess());
            if (factDate.isValid()) {
              const timeAgo = factDate.fromNow();
              const fullDate = factDate.format('YYYY-MM-DD HH:mm');
              tooltipContent.push(`Last updated: ${timeAgo} (${fullDate})`);
            }
          }
        } else {
          tooltipContent.push('No credentials configured');
          tooltipContent.push('Configure credentials to enable scanning');
        }
        
        const tooltipText = tooltipContent.join('\n');

        return (
          <Tooltip title={tooltipText} arrow>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: '8px',
              bgcolor: colors.bg,
              border: `1px solid ${colors.main}30`,
            }}>
              <Box sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: colors.main,
                ...(status === 'scanning' && {
                  animation: 'spin 1s linear infinite',
                  background: `conic-gradient(from 0deg, ${colors.main}, transparent, ${colors.main})`,
                })
              }} />
              <Typography variant="body2" sx={{ 
                fontWeight: 500,
                color: colors.main,
                fontSize: '0.75rem'
              }}>
                {label}
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    { field: 'version', headerName: 'Version', width: 120 },
    {
      field: 'ha_state',
      headerName: 'HA State',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      sortComparator: haSortComparator,
      renderCell: (params) => {
        const haState = params.value;
        
        if (!haState) {
          return (
            <Typography variant="body2" sx={{ 
              color: theme.palette.text.secondary, 
              fontStyle: 'italic',
              fontSize: '0.75rem'
            }}>
              N/A
            </Typography>
          );
        }
        
        let baseColor = '#9e9e9e';
        let icon = null;
        
        switch (haState.toLowerCase()) {
          case 'active':
            baseColor = '#4caf50';
            icon = '●';
            break;
          case 'standby':
            baseColor = '#ff9800';
            icon = '◐';
            break;
          case 'offline':
            baseColor = '#f44336';
            icon = '○';
            break;
          default:
            icon = '◯';
        }

        const colors = getStatusColors(baseColor);

        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: '6px',
            bgcolor: colors.bg,
          }}>
            <Typography sx={{ 
              color: colors.main, 
              fontSize: '0.9rem',
              lineHeight: 1
            }}>
              {icon}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: colors.main,
              fontWeight: 500,
              fontSize: '0.75rem',
              textTransform: 'capitalize'
            }}>
              {haState}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'sync_status',
      headerName: 'Sync Status',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const syncStatus = params.value;
        
        if (!syncStatus) {
          return (
            <Typography variant="body2" sx={{ 
              color: theme.palette.text.secondary, 
              fontStyle: 'italic',
              fontSize: '0.75rem'
            }}>
              Never
            </Typography>
          );
        }
        
        let baseColor = '#9e9e9e';
        let displayText = syncStatus;
        
        switch (syncStatus.toLowerCase()) {
          case 'synced':
          case 'success':
            baseColor = '#4caf50';
            displayText = 'Synced';
            break;
          case 'pending':
          case 'in_progress':
            baseColor = '#2196f3';
            displayText = 'Syncing';
            break;
          case 'failed':
          case 'error':
            baseColor = '#f44336';
            displayText = 'Failed';
            break;
          case 'outdated':
            baseColor = '#ff9800';
            displayText = 'Outdated';
            break;
        }

        const colors = getStatusColors(baseColor);

        return (
          <Typography variant="body2" sx={{ 
            color: colors.main,
            fontWeight: 500,
            fontSize: '0.75rem',
            px: 1,
            py: 0.25,
            borderRadius: '4px',
            bgcolor: colors.bg,
          }}>
            {displayText}
          </Typography>
        );
      },
    },
    {
      field: 'last_scan_status',
      headerName: 'Last Activity',
      width: 140,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const scanStatus = params.value;
        const deviceData = params.row;
        const lastFactsRefresh = deviceData.last_facts_refresh;
        
        if (!scanStatus) {
          return (
            <Typography variant="body2" sx={{ 
              color: theme.palette.text.secondary, 
              fontStyle: 'italic',
              fontSize: '0.75rem'
            }}>
              Never
            </Typography>
          );
        }
        
        let baseColor = '#9e9e9e';
        let displayText = scanStatus;
        
        switch (scanStatus.toLowerCase()) {
          case 'success':
          case 'completed':
            baseColor = '#4caf50';
            displayText = 'Success';
            break;
          case 'running':
          case 'in_progress':
            baseColor = '#2196f3';
            displayText = 'Running';
            break;
          case 'failed':
          case 'error':
            baseColor = '#f44336';
            displayText = 'Failed';
            break;
          case 'pending':
            baseColor = '#ff9800';
            displayText = 'Pending';
            break;
        }

        const colors = getStatusColors(baseColor);
        
        // Create tooltip with timing information
        let tooltipContent = [`Activity: ${displayText}`];
        
        if (lastFactsRefresh) {
          const factDate = dayjs.utc(lastFactsRefresh).tz(dayjs.tz.guess());
          if (factDate.isValid()) {
            const timeAgo = factDate.fromNow();
            const fullDate = factDate.format('YYYY-MM-DD HH:mm');
            tooltipContent.push(`${timeAgo} (${fullDate})`);
          }
        }

        return (
          <Tooltip title={tooltipContent.join('\n')} arrow>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: '4px',
              bgcolor: colors.bg,
            }}>
              <Box sx={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                bgcolor: colors.main,
                ...(displayText === 'Running' && {
                  animation: 'spin 1s linear infinite',
                  background: `conic-gradient(from 0deg, ${colors.main}, transparent, ${colors.main})`,
                })
              }} />
              <Typography variant="body2" sx={{ 
                color: colors.main,
                fontWeight: 500,
                fontSize: '0.75rem',
              }}>
                {displayText}
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
  ];

  if (userRole && userRole !== 'viewer') {
    columns.push({
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 200,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<SecurityIcon />}
            onClick={() => onSetCredentials(params.row)}
            sx={{
              fontSize: '0.75rem',
              py: 0.5,
              px: 1.5,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 500,
              bgcolor: 'rgba(25, 118, 210, 0.04)',
              borderColor: 'rgba(25, 118, 210, 0.2)',
              color: 'primary.main',
              '&:hover': {
                bgcolor: 'rgba(25, 118, 210, 0.08)',
                borderColor: 'primary.main',
              }
            }}
          >
            Credentials
          </Button>
          {isAdmin() && (
            <Tooltip title="Delete Device" arrow>
              <IconButton 
                color="error" 
                size="small" 
                onClick={() => onDeleteDevice(params.row)}
                sx={{
                  p: 0.5,
                  borderRadius: '8px',
                  bgcolor: 'rgba(211, 47, 47, 0.04)',
                  '&:hover': {
                    bgcolor: 'rgba(211, 47, 47, 0.08)',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    });
  }

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        height: 'calc(100vh - 280px)', 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: isDarkMode 
          ? 'rgba(30, 30, 30, 0.95)' 
          : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        '& .MuiDataGrid-root': {
          border: 'none',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        '& .MuiDataGrid-cell': {
          borderBottom: `1px solid ${theme.palette.divider}`,
          py: 1.5,
          px: 2,
          fontSize: '0.875rem',
          color: theme.palette.text.primary,
        },
        '& .MuiDataGrid-columnHeaders': {
          bgcolor: isDarkMode 
            ? 'rgba(45, 45, 45, 0.9)' 
            : 'rgba(248, 249, 250, 0.9)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          fontWeight: 600,
          fontSize: '0.8rem',
          color: theme.palette.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600,
          }
        },
        '& .MuiDataGrid-row': {
          '&:nth-of-type(even)': {
            bgcolor: isDarkMode 
              ? 'rgba(45, 45, 45, 0.3)' 
              : 'rgba(248, 249, 250, 0.3)',
          },
          '&:hover': {
            bgcolor: theme.palette.action.hover,
            transform: 'translateY(-1px)',
            boxShadow: isDarkMode 
              ? '0 2px 12px rgba(0,0,0,0.3)' 
              : '0 2px 12px rgba(0,0,0,0.08)',
            '& .MuiDataGrid-cell': {
              borderBottomColor: theme.palette.primary.main + '40',
            }
          },
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
        },
        '& .MuiDataGrid-footerContainer': {
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: isDarkMode 
            ? 'rgba(45, 45, 45, 0.5)' 
            : 'rgba(248, 249, 250, 0.5)',
        },
        '& .MuiDataGrid-virtualScroller': {
          // Custom scrollbar
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: isDarkMode 
              ? 'rgba(255,255,255,0.05)' 
              : 'rgba(0,0,0,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: isDarkMode 
              ? 'rgba(255,255,255,0.3)' 
              : 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              bgcolor: isDarkMode 
                ? 'rgba(255,255,255,0.4)' 
                : 'rgba(0,0,0,0.3)',
            }
          }
        },
        '@keyframes spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        }
      }}
    >
      <DataGrid
        rows={Array.isArray(devices) ? devices : []}
        columns={columns}
        loading={loading}
        getRowId={(row) => row.id}
        sortingOrder={['asc', 'desc']}
      sortModel={sortModel}
        onSortModelChange={(m) => setSortModel(m && m.length ? m : defaultSortModel)}
        pagination
        pageSize={100}
        rowsPerPageOptions={[25, 50, 100]}
        disableSelectionOnClick
        rowHeight={64}
        headerHeight={48}
        sx={{
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-columnHeader:focus': {
            outline: 'none',
          }
        }}
      />
    </Paper>
  );
};

export default DeviceTable;
