// frontend/src/components/CertificateTable.jsx

import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Button, CircularProgress, Tooltip, IconButton, useTheme } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import { authProvider } from '../pages/LoginPage';

const CertificateTable = ({ 
    certificates, 
    loading, 
    onInitiateRenewal, 
    onOpenDeploy, 
    onShowUsage,
    onShowRenewalDetails,
    onDelete,
    actionLoading, 
    activeActionCertId 
}) => {
  const userRole = authProvider.getRole();
  const theme = useTheme(); // Usamos el hook para acceder a la paleta de colores

  // ✅ CAMBIO 1: Las columnas se mantienen, pero ajustamos el renderizado de 'days_remaining' y 'actions'
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'common_name', headerName: 'Common Name', flex: 1, minWidth: 200 },
    { field: 'name', headerName: 'Certificate Name', flex: 1, minWidth: 200 },
    { field: 'f5_device_hostname', headerName: 'F5 Device', flex: 0.8, minWidth: 220 },
    {
      field: 'expiration_date',
      headerName: 'Expiration Date',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (value) => (value ? new Date(value).toLocaleDateString() : 'N/A'),
    },
    {
      field: 'days_remaining',
      headerName: 'Days Left',
      width: 120,
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
        // Usamos un Chip "filled" (por defecto) y con texto en negrita, mucho más visual
        return <Chip label={days} color={color} size="small" sx={{ fontWeight: 'bold' }} />;
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 250,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const hasActiveRenewal = params.row.renewal_status === 'CSR_GENERATED';
        const canRenew = !!params.row.common_name;

        // La lógica funcional es la misma, solo hemos pulido la presentación
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
      {/* ✅ CAMBIO 2: Aplicamos estilos profundos al DataGrid con el prop 'sx' */}
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
        disableRowSelectionOnClick
        // --- AQUÍ EMPIEZA LA MAGIA DEL DISEÑO ---
        sx={{
          border: 'none', // Quitamos el borde principal del DataGrid
          backgroundColor: 'transparent', // Hacemos el fondo transparente para que se vea el "vidrio"
          
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
        }}
      />
    </Box>
  );
};

export default CertificateTable;