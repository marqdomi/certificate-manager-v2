import React, { useState, useEffect } from 'react';
import apiClient from '../services/api'; 
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Button, IconButton, Tooltip, useTheme } from '@mui/material'; // Importamos useTheme
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const DeviceTable = ({ onSetCredentials, onDeleteDevice, searchTerm, refreshTrigger, userRole }) => {
    
    // --- (TODA TU LÓGICA FUNCIONAL SE MANTIENE INTACTA) ---
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const theme = useTheme(); // Usamos el hook para acceder a la paleta del tema

    useEffect(() => {
        const handler = setTimeout(() => {
            setLoading(true);
            let apiUrl = '/devices/'; 
            if (searchTerm) {
                apiUrl += `?search=${encodeURIComponent(searchTerm)}`;
            }
            
            apiClient.get(apiUrl)
                .then(response => {
                    setDevices(response.data);
                })
                .catch(error => {
                    console.error("Error fetching devices:", error);
                    setDevices([]);
                })
                .finally(() => {
                    setLoading(false);
                });
        }, 300);

        return () => clearTimeout(handler);
    }, [searchTerm, refreshTrigger]); 
    // --- (FIN DE LA LÓGICA FUNCIONAL) ---


    // ✅ CAMBIO DE DISEÑO 1: Pulimos la presentación de las columnas
    const columns = [
        { field: 'hostname', headerName: 'Hostname', flex: 1, minWidth: 250 },
        { field: 'ip_address', headerName: 'IP Address', width: 150 },
        { field: 'site', headerName: 'Site', width: 120 },
        { field: 'version', headerName: 'Version', width: 120 },
        {
            field: 'last_scan_status',
            headerName: 'Last Scan Status',
            width: 150,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => {
                const rawStatus = params.value || 'pending';
                const message = params.row.last_scan_message || '';

                // 1) Extraer código corto del mensaje: [EC=AUTH], [EC=TIMEOUT], etc.
                let shortCode = null;
                const m = message.match(/\[EC=([A-Z_]+)\]/);
                if (m && m[1]) shortCode = m[1];

                // 2) Normalizar el código a algo más "bonito" si hace falta
                const normalizeCode = (code) => {
                    switch (code) {
                        case 'AUTH':
                            return 'AUTH';
                        case 'TIMEOUT':
                        case 'CONNECT_TIMEOUT':
                        case 'READ_TIMEOUT':
                            return 'TIMEOUT';
                        case 'SSL':
                        case 'TLS':
                            return 'SSL';
                        case 'CONN':
                        case 'CONNECTION':
                        case 'NETWORK':
                            return 'CONN';
                        case 'HTTP':
                            return 'HTTP';
                        default:
                            return 'UNKNOWN';
                    }
                };

                // 3) Decidir etiqueta y color del chip
                let chipLabel = rawStatus;
                let chipColor = 'default';

                if (rawStatus === 'success') {
                    chipLabel = 'success';
                    chipColor = 'success';
                } else if (rawStatus === 'running') {
                    chipLabel = 'running';
                    chipColor = 'info';
                } else if (rawStatus === 'pending') {
                    chipLabel = 'pending';
                    chipColor = 'warning';
                } else if (rawStatus === 'failed' || rawStatus === 'error') {
                    const label = shortCode ? normalizeCode(shortCode) : 'error';
                    chipLabel = label;
                    // Colores por tipo de error
                    switch (label) {
                        case 'AUTH':
                            chipColor = 'error';
                            break;
                        case 'TIMEOUT':
                            chipColor = 'warning';
                            break;
                        case 'SSL':
                            chipColor = 'info';
                            break;
                        case 'HTTP':
                            chipColor = 'secondary';
                            break;
                        case 'CONN':
                            chipColor = 'default';
                            break;
                        default:
                            chipColor = 'error';
                    }
                }

                return (
                    <Tooltip title={message || rawStatus} arrow>
                        <span>
                            <Chip label={chipLabel} color={chipColor} size="small" sx={{ textTransform: 'uppercase', fontWeight: 600 }} />
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            field: 'last_sync',
            headerName: 'Last Sync',
            width: 240,
            sortable: true,
            renderCell: (params) => {
                const raw = params?.row?.last_sync ?? params?.row?.last_scan_timestamp ?? null;
                if (!raw) {
                    return <span>N/A</span>;
                }
                const d = dayjs.utc(raw).tz(dayjs.tz.guess());
                const absolute = d.isValid() ? d.format('YYYY-MM-DD HH:mm') : 'N/A';
                const relative = d.isValid() ? d.fromNow() : '';
                const title = d.isValid() ? d.toISOString() : 'No sync timestamp';
                return (
                    <Tooltip title={title} arrow>
                        <span>{absolute}{relative ? ` (${relative})` : ''}</span>
                    </Tooltip>
                );
            },
            valueGetter: (params) => params?.row?.last_sync ?? params?.row?.last_scan_timestamp ?? null,
            sortComparator: (v1, v2) => {
                const t1 = v1 ? new Date(v1).getTime() : 0;
                const t2 = v2 ? new Date(v2).getTime() : 0;
                return t1 - t2;
            },
        },
    ];

    const finalColumns = [...columns];
    if (userRole && userRole !== 'viewer') {
        finalColumns.push({
            field: 'actions',
            headerName: 'Actions',
            sortable: false,
            width: 220,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => (
                // ✅ CAMBIO DE DISEÑO 2: Jerarquía de botones de acción
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* El botón principal ahora es "contained" para destacar */}
                    <Button variant="contained" size="small" onClick={() => onSetCredentials(params.row)}>
                        Set Credentials
                    </Button>
                    {/* El botón secundario/destructivo es un IconButton */}
                    {userRole === 'admin' && (
                        <Tooltip title="Delete Device">
                            <IconButton color="error" size="small" onClick={() => onDeleteDevice(params.row.id)}>
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )
        });
    }

    return (
        // ✅ CAMBIO DE DISEÑO 3: Contenedor y estilos del DataGrid
        <Box sx={{ height: 'calc(100vh - 280px)', width: '100%' }}>
            <DataGrid
                rows={devices}
                columns={finalColumns}
                loading={loading}
                getRowId={(row) => row.id}
                initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                }}
                pageSizeOptions={[15, 25, 50, 100]}
                disableRowSelectionOnClick
                // --- AQUÍ ESTÁ EL REDISEÑO VISUAL ---
                sx={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  
                  '& .MuiDataGrid-columnHeaders': {
                    borderBottom: '1px solid',
                    borderColor: theme.palette.divider,
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontWeight: 'bold',
                  },
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid',
                    borderColor: theme.palette.divider,
                  },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: 'none',
                  },
                  '& .MuiDataGrid-row:hover': {
                     backgroundColor: theme.palette.action.hover,
                  },
                  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                     outline: 'none',
                  },
                }}
            />
        </Box>
    );
};

export default DeviceTable;