import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Button, IconButton, Tooltip, Stack } from '@mui/material';
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

  const [busy, setBusy] = useState(false);

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

  // --- (Las columnas no cambian) ---
  const columns = [
    { field: 'hostname', headerName: 'Hostname', flex: 1, minWidth: 260 },
    {
      field: 'ip_address',
      headerName: 'IP Address',
      width: 150,
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
    { field: 'site', headerName: 'Site', width: 110 },
    { field: 'version', headerName: 'Version', width: 120 },
    {
      field: 'ha_state',
      headerName: 'HA',
      width: 110,
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
      width: 130,
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
      width: 210,
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
      width: 140,
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
      width: 220,
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

  const postDevice = async (id, path) => {
    try {
      await apiClient.post(`/devices/${id}/${path}`);
    } catch (e) {
      console.error(`POST /devices/${id}/${path} failed`, e);
    }
  };

  const handleRefreshFactsSelected = async () => {
    if (!selectionModel?.length) return;
    setBusy(true);
    for (const id of selectionModel) {
      await postDevice(id, 'refresh-facts');
    }
    setBusy(false);
  };

  const handleRefreshCacheSelected = async () => {
    if (!selectionModel?.length) return;
    setBusy(true);
    for (const id of selectionModel) {
      await postDevice(id, 'refresh-cache');
    }
    setBusy(false);
  };

  return (
    <Box sx={{ height: 'calc(100vh - 280px)', width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Action bar */}
      <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
        <Button
          variant="contained"
          size="small"
          disabled={!selectionModel?.length || busy}
          onClick={handleRefreshFactsSelected}
        >
          Refresh Facts (selected)
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={!selectionModel?.length || busy}
          onClick={handleRefreshCacheSelected}
        >
          Refresh Cache (selected)
        </Button>
      </Stack>

      <DataGrid
        rows={Array.isArray(devices) ? devices : []}
        columns={columns}
        loading={loading || busy}
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
      />
    </Box>
  );
};

export default DeviceTable;