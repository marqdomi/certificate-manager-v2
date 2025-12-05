// frontend/src/components/CertificateTable.jsx

import React, { useState, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Button, CircularProgress, Tooltip, IconButton, useTheme } from '@mui/material';
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
    // Favorite column
    ...(onToggleFavorite ? [{
      field: 'favorite',
      headerName: '',
      width: 50,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(params.row.id);
          }}
          sx={{ color: isFavorite(params.row.id) ? '#f59e0b' : 'text.disabled' }}
        >
          {isFavorite(params.row.id) ? <StarIcon /> : <StarBorderIcon />}
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
          return <Chip label="N/A" size="small" />;
        }
        let color = 'success';
        if (days <= 0) color = 'error';
        else if (days <= 30) color = 'warning';
        return <Chip label={days} color={color} size="small" sx={{ fontWeight: 'bold' }} />;
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
        const IconComponent = config.icon;
        
        if (state === 'loading' || !state) {
          return (
            <Tooltip title="Loading usage state...">
              <CircularProgress size={16} />
            </Tooltip>
          );
        }
        
        return (
          <Tooltip title={config.tooltip}>
            <Chip 
              icon={IconComponent ? <IconComponent fontSize="small" /> : undefined}
              label={config.label} 
              color={config.color} 
              size="small" 
              variant="outlined"
              sx={{ 
                fontWeight: 500,
                '& .MuiChip-icon': { fontSize: '1rem' }
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
                
                {/* --- Mantenemos la jerarquía visual de los botones --- */}

                <Tooltip title="Show Usage Details">
                    <IconButton onClick={() => onShowUsage(params.row.id)} size="small" aria-label="show usage">
                        <VisibilityIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={hasActiveRenewal ? "Show Renewal Details (CSR/Key)" : "No active renewal process"}>
                    <span>
                        <IconButton 
                            onClick={() => hasActiveRenewal && onShowRenewalDetails(params.row.renewal_id)} 
                            size="small" 
                            disabled={!hasActiveRenewal}
                            aria-label="show renewal details"
                        >
                            <InfoIcon />
                        </IconButton>
                    </span>
                </Tooltip>
                
                {userRole !== 'viewer' && (
                    hasActiveRenewal 
                    ? ( // Botón secundario para una acción de continuación
                        <Button variant="contained" color="secondary" size="small" onClick={() => onOpenDeploy(params.row)}>
                            DEPLOY
                        </Button>
                    ) : (
                        // Botón primario para la acción principal, con tooltip aclaratorio
                        <Tooltip title="Open renewal wizard">
                          <span>
                            <Button variant="contained" size="small" onClick={() => onInitiateRenewal(params.row)} disabled={!canRenew}>
                              {actionLoading && activeActionCertId === params.row.id ? (
                                <CircularProgress size={20} color="inherit" />
                              ) : (
                                'RENEW'
                              )}
                            </Button>
                          </span>
                        </Tooltip>
                    )
                )}

                {userRole === 'admin' && ( // Acción destructiva
                    <Tooltip title="Delete Certificate">
                        <span>
                            <IconButton color="error" size="small" onClick={() => onDelete(params.row.id)} disabled={actionLoading}>
                                <DeleteIcon />
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