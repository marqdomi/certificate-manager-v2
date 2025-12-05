// frontend/src/components/CertificateTable.jsx

import React, { useState, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Button, CircularProgress, Tooltip, IconButton, useTheme, Typography, alpha } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { authProvider } from '../pages/LoginPage';

// Usage state display configuration
const USAGE_STATE_CONFIG = {
  'active': { label: 'In Use', color: 'success', icon: CheckCircleIcon, tooltip: 'Certificate is actively used by VIPs' },
  'in-use': { label: 'In Use', color: 'success', icon: CheckCircleIcon, tooltip: 'Certificate is actively used by VIPs' },
  'profiles-no-vips': { label: 'Orphan', color: 'warning', icon: WarningIcon, tooltip: 'Linked to SSL profiles but no VIPs are using those profiles' },
  'no-profiles': { label: 'Unused', color: 'default', icon: HelpOutlineIcon, tooltip: 'Not linked to any SSL profile' },
  'error': { label: 'Error', color: 'error', icon: ErrorIcon, tooltip: 'Could not determine usage state' },
  'loading': { label: '...', color: 'default', icon: null, tooltip: 'Loading usage state...' },
};

const CertificateTable = ({ 
    certificates, 
    loading, 
    onInitiateRenewal, 
    onOpenDeploy, 
    onShowUsage,
    onShowRenewalDetails,
    onDelete,
    actionLoading, 
    activeActionCertId,
    // New props for real-time usage
    usageStates = {},
    onRefreshUsage,
    usageLoading = false,
    // Bulk selection props
    onSelectionChange,
    clearSelectionKey,
    // Row click handler for detail drawer
    onRowClick,
    // Favorites props
    favorites = [],
    onToggleFavorite,
}) => {
  const userRole = authProvider.getRole();
  const theme = useTheme();
  const [rowSelectionModel, setRowSelectionModel] = useState([]);

  // Clear selection when clearSelectionKey changes
  useEffect(() => {
    if (clearSelectionKey) {
      setRowSelectionModel([]);
    }
  }, [clearSelectionKey]);

  // Notify parent of selection changes
  const handleSelectionChange = (newSelection) => {
    setRowSelectionModel(newSelection);
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    }
  };

  // Helper to get effective usage state (from prop override or from cert data)
  const getEffectiveUsageState = (row) => {
    // Priority: real-time usageStates > certificate's cached usage_state
    if (usageStates[row.id]) return usageStates[row.id];
    return row.usage_state;
  };

  // Helper to check if certificate is favorite
  const isFavorite = (certId) => favorites.includes(certId);

  // Columnas con redimensionamiento y ajuste automático habilitados
  const columns = [
    // Favorite column - subtle star
    ...(onToggleFavorite ? [{
      field: 'favorite',
      headerName: '',
      width: 44,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(params.row.id);
          }}
          sx={{ 
            color: isFavorite(params.row.id) ? '#f59e0b' : 'text.disabled',
            opacity: isFavorite(params.row.id) ? 1 : 0.4,
            '&:hover': { opacity: 1 },
            transition: 'opacity 0.2s',
          }}
        >
          {isFavorite(params.row.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
        </IconButton>
      ),
    }] : []),
    { 
      field: 'id', 
      headerName: 'ID', 
      flex: 0.3,
      minWidth: 60,
      resizable: true,
    },
    { 
      field: 'common_name',
      headerName: 'Common Name', 
      flex: 1.2, 
      minWidth: 180,
      resizable: true,
    },
    { 
      field: 'name', 
      headerName: 'Certificate Name', 
      flex: 1.2, 
      minWidth: 180,
      resizable: true,
    },
    { 
      field: 'f5_device_hostname', 
      headerName: 'F5 Device', 
      flex: 1, 
      minWidth: 180,
      resizable: true,
    },
    {
      field: 'expiration_date',
      headerName: 'Expiration Date',
      flex: 0.6,
      minWidth: 120,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => (params.value ? new Date(params.value).toLocaleDateString() : 'N/A'),
    },
    {
      field: 'days_remaining',
      headerName: 'Days Left',
      flex: 0.5,
      minWidth: 100,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const days = params.value;
        if (days === null || typeof days === 'undefined') {
          return <Typography variant="body2" color="text.secondary">—</Typography>;
        }
        // Color based on status - more subtle palette
        let color = '#10b981'; // green for healthy
        if (days <= 0) color = '#ef4444'; // red for expired
        else if (days <= 30) color = '#f59e0b'; // amber for warning
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500,
                color: days <= 0 ? 'error.main' : 'text.primary',
              }}
            >
              {days <= 0 ? 'Expired' : days}
            </Typography>
          </Box>
        );
      },
    },
    // NEW: Usage State column
    {
      field: 'usage_state',
      headerName: 'Status',
      flex: 0.6,
      minWidth: 110,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const state = getEffectiveUsageState(params.row);
        const config = USAGE_STATE_CONFIG[state] || USAGE_STATE_CONFIG['loading'];
        
        if (state === 'loading' || !state) {
          return (
            <Tooltip title="Loading usage state...">
              <CircularProgress size={14} />
            </Tooltip>
          );
        }

        // Subtle background colors
        const bgColors = {
          success: alpha('#10b981', 0.1),
          warning: alpha('#f59e0b', 0.1),
          error: alpha('#ef4444', 0.1),
          default: alpha('#6b7280', 0.1),
        };
        const textColors = {
          success: '#059669',
          warning: '#d97706',
          error: '#dc2626',
          default: '#6b7280',
        };
        
        return (
          <Tooltip title={config.tooltip}>
            <Chip 
              label={config.label} 
              size="small" 
              sx={{ 
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
                backgroundColor: bgColors[config.color] || bgColors.default,
                color: textColors[config.color] || textColors.default,
                border: 'none',
                '& .MuiChip-label': {
                  px: 1.5,
                }
              }} 
            />
          </Tooltip>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 230,
      resizable: true,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const hasActiveRenewal = params.row.renewal_status === 'CSR_GENERATED';
        const canRenew = !!params.row.common_name;
        
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                
                {/* View Usage - subtle icon button */}
                <Tooltip title="Show Usage Details">
                    <IconButton 
                      onClick={() => onShowUsage(params.row.id)} 
                      size="small" 
                      aria-label="show usage"
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    >
                        <VisibilityIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                {/* Renewal Details - subtle icon button */}
                <Tooltip title={hasActiveRenewal ? "Show Renewal Details (CSR/Key)" : "No active renewal process"}>
                    <span>
                        <IconButton 
                            onClick={() => hasActiveRenewal && onShowRenewalDetails(params.row.renewal_id)} 
                            size="small" 
                            disabled={!hasActiveRenewal}
                            aria-label="show renewal details"
                            sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}
                        >
                            <InfoIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                
                {userRole !== 'viewer' && (
                    hasActiveRenewal 
                    ? ( // Deploy button - outlined style
                        <Button 
                          variant="outlined" 
                          color="primary" 
                          size="small" 
                          onClick={() => onOpenDeploy(params.row)}
                          sx={{ 
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            minWidth: 64,
                            height: 28,
                            borderRadius: 1.5,
                          }}
                        >
                          Deploy
                        </Button>
                    ) : (
                        // Renew button - subtle outlined style
                        <Tooltip title="Open renewal wizard">
                          <span>
                            <Button 
                              variant="outlined" 
                              size="small" 
                              onClick={() => onInitiateRenewal(params.row)} 
                              disabled={!canRenew}
                              startIcon={actionLoading && activeActionCertId === params.row.id ? null : <AutorenewIcon sx={{ fontSize: 16 }} />}
                              sx={{ 
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                minWidth: 72,
                                height: 28,
                                borderRadius: 1.5,
                                borderColor: 'divider',
                                color: 'text.primary',
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                                },
                              }}
                            >
                              {actionLoading && activeActionCertId === params.row.id ? (
                                <CircularProgress size={16} color="inherit" />
                              ) : (
                                'Renew'
                              )}
                            </Button>
                          </span>
                        </Tooltip>
                    )
                )}

                {userRole === 'admin' && ( // Delete - subtle red icon
                    <Tooltip title="Delete Certificate">
                        <span>
                            <IconButton 
                              size="small" 
                              onClick={() => onDelete(params.row.id)} 
                              disabled={actionLoading}
                              sx={{ 
                                color: 'text.disabled',
                                '&:hover': { color: 'error.main' },
                              }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Box>
        )
      }
    }
  ];

  return (
    // La altura se ajusta para ser más flexible
    <Box sx={{ height: 'calc(100vh - 220px)', width: '100%' }}>
      {/* Refresh Usage Button - only show if handler is provided */}
      {onRefreshUsage && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Tooltip title="Refresh usage states (real-time F5 query)">
            <Button
              size="small"
              variant="outlined"
              startIcon={usageLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={onRefreshUsage}
              disabled={usageLoading}
            >
              {usageLoading ? 'Loading...' : 'Refresh Usage'}
            </Button>
          </Tooltip>
        </Box>
      )}
      {/* DataGrid con columnas redimensionables y responsive */}
      <DataGrid
        rows={certificates}
        columns={columns}
        loading={loading}
        initialState={{
          pagination: { paginationModel: { pageSize: 25, page: 0 } },
          sorting: { sortModel: [{ field: 'days_remaining', sort: 'asc' }] },
        }}
        pageSizeOptions={[15, 25, 50, 100]}
        getRowId={(row) => row.id}
        
        // Bulk selection
        checkboxSelection
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={handleSelectionChange}
        disableRowSelectionOnClick
        
        // Row click handler for detail drawer
        onRowClick={(params, event) => {
          // Ignore clicks on action buttons or checkboxes
          if (event.target.closest('button') || event.target.closest('.MuiCheckbox-root')) {
            return;
          }
          if (onRowClick) {
            onRowClick(params.row);
          }
        }}
        
        // Habilitar redimensionamiento de columnas
        disableColumnResize={false}
        
        // Estilos mejorados con separadores de columna visibles
        sx={{
          border: 'none', // Quitamos el borde principal del DataGrid
          backgroundColor: 'transparent', // Hacemos el fondo transparente para que se vea el "vidrio"
          cursor: onRowClick ? 'pointer' : 'default',
          
          // Estilo de las cabeceras de columna
          '& .MuiDataGrid-columnHeaders': {
            borderBottom: '1px solid',
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
          },
          // Estilo del texto de la cabecera
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 'bold',
          },
          // Estilo de cada celda de la tabla
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid',
            borderColor: theme.palette.divider,
          },
          // Quitamos los bordes de los pies de la tabla
          '& .MuiDataGrid-footerContainer': {
            borderTop: 'none',
          },
          // Estilo de las filas al pasar el ratón
          '& .MuiDataGrid-row:hover': {
             backgroundColor: theme.palette.action.hover,
          },
          // Quitamos los bordes raros al hacer clic en una celda
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
             outline: 'none',
          },
          // Hacer visible el separador de columnas para redimensionar
          '& .MuiDataGrid-columnSeparator': {
            visibility: 'visible',
            color: 'rgba(224, 224, 224, 0.5)',
          },
          '& .MuiDataGrid-columnHeader': {
            '&:hover .MuiDataGrid-columnSeparator': {
              color: 'primary.main',
            },
          },
        }}
      />
    </Box>
  );
};

export default CertificateTable;