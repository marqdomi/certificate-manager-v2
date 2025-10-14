import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Button, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const DeviceTable = ({
  onSetCredentials,
  onDeleteDevice,
  searchTerm,
  refreshTrigger,
  userRole,
  onSelectionChange,
  clearSelectionKey,
}) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionModel, setSelectionModel] = useState([]);

  const [sortModel, setSortModel] = useState([
    { field: 'ip_address', sort: 'asc' },
  ]);



  // --- (Lógica de fetching y selección no cambian) ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setLoading(true);
      let apiUrl = '/devices/';
      if (searchTerm) apiUrl += `?search=${encodeURIComponent(searchTerm)}`;
      apiClient
        .get(apiUrl)
        .then((response) => setDevices(response.data))
        .catch((error) => {
          console.error('Error fetching devices:', error);
          setDevices([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, refreshTrigger]);

  useEffect(() => {
    setSelectionModel([]);
  }, [clearSelectionKey]);

  // --- Columnas con redimensionamiento habilitado ---
  const columns = [
    { 
      field: 'hostname', 
      headerName: 'Hostname', 
      flex: 1, 
      minWidth: 200,
      resizable: true,
    },
    {
      field: 'ip_address',
      headerName: 'IP Address',
      flex: 0.6,
      minWidth: 130,
      resizable: true,
      sortComparator: (a, b) => {
        const toParts = (ip) => (typeof ip === 'string' ? ip.split('.') : []);
        const pa = toParts(a).map((n) => parseInt(n, 10));
        const pb = toParts(b).map((n) => parseInt(n, 10));
        for (let i = 0; i < 4; i++) {
          const da = pa[i] || 0;
          const db = pb[i] || 0;
          if (da !== db) return da - db;
        }
        return 0;
      },
    },
    { 
      field: 'site', 
      headerName: 'Site', 
      flex: 0.4,
      minWidth: 100,
      resizable: true,
    },
    { 
      field: 'version', 
      headerName: 'Version', 
      flex: 0.5,
      minWidth: 100,
      resizable: true,
    },
    {
      field: 'ha_state',
      headerName: 'HA',
      flex: 0.4,
      minWidth: 100,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const v = (params.value || '').toString();
        const label = v || '—';
        const color = v === 'ACTIVE' ? 'success' : v === 'STANDBY' ? 'default' : 'warning';
        return <Chip label={label} color={color} size="small" sx={{ fontWeight: 600 }} />;
      },
    },
    {
      field: 'sync_status',
      headerName: 'Sync',
      flex: 0.5,
      minWidth: 110,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = params.value || '—';
        const colorMap = { green: 'success', yellow: 'warning', red: 'error' };
        const color = colorMap[params.row?.last_sync_color] || 'default';
        return <Chip label={status} color={color} size="small" sx={{ fontWeight: 600 }} />;
      },
    },
    {
      field: 'last_facts_refresh',
      headerName: 'Last Facts',
      flex: 0.8,
      minWidth: 180,
      resizable: true,
      renderCell: (params) => {
        const raw = params?.value;
        if (!raw) return <span>—</span>;
        const d = dayjs.utc(raw).tz(dayjs.tz.guess());
        const absolute = d.isValid() ? d.format('YYYY-MM-DD HH:mm') : '—';
        const relative = d.isValid() ? d.fromNow() : '';
        const title = d.isValid() ? d.toISOString() : '';
        return (
          <Tooltip title={title} arrow>
            <span>{absolute}{relative ? ` (${relative})` : ''}</span>
          </Tooltip>
        );
      },
    },
    {
      field: 'last_scan_status',
      headerName: 'Last Scan',
      flex: 0.5,
      minWidth: 120,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const rawStatus = params.value || 'pending';
        const message = params.row.last_scan_message || '';
        return (
          <Tooltip title={message || rawStatus} arrow>
            <span>
              <Chip label={rawStatus} size="small" sx={{ textTransform: 'uppercase', fontWeight: 600 }} />
            </span>
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
      flex: 0.8,
      minWidth: 200,
      resizable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="contained" size="small" onClick={() => onSetCredentials(params.row)}>
            Set Credentials
          </Button>
          {userRole === 'admin' && (
            <Tooltip title="Delete Device">
              <IconButton color="error" size="small" onClick={() => onDeleteDevice(params.row.id)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    });
  }



  return (
    <Box sx={{ height: 'calc(100vh - 280px)', width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <DataGrid
        rows={Array.isArray(devices) ? devices : []}
        columns={columns}
        loading={loading}
        getRowId={(row) => row.id}
        disableSelectionOnClick

        // Sorting (default by IP asc)
        sortingOrder={[ 'asc', 'desc' ]}
        sortModel={sortModel}
        onSortModelChange={(m) => setSortModel(m && m.length ? m : [{ field: 'ip_address', sort: 'asc' }])}

        // Pagination
        pagination
        pageSize={100}
        rowsPerPageOptions={[25, 50, 100]}

        // Selection
        checkboxSelection
        
        // En v6, el parámetro de onSelectionModelChange es el array de IDs.
        // Mantenemos esta prop y quitamos disableSelectionOnClick para evitar conflictos.
        onSelectionModelChange={(newSelection) => {
          setSelectionModel(newSelection);
          if (onSelectionChange) {
            onSelectionChange(newSelection);
          }
        }}
        selectionModel={selectionModel}

        // Habilitar redimensionamiento de columnas
        disableColumnResize={false}
        
        // Ajuste automático de columnas al contenedor
        sx={{
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

export default DeviceTable;