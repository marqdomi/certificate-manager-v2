import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, IconButton, Tooltip, Button } from '@mui/material';
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
}) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sortModel, setSortModel] = useState([
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
        .then((response) => setDevices(response.data))
        .catch((error) => {
          console.error('Error fetching devices:', error);
          setDevices([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, refreshTrigger]);

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
            <span>
              {absolute}
              {relative ? ` (${relative})` : ''}
            </span>
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
              <Chip
                label={rawStatus}
                size="small"
                sx={{ textTransform: 'uppercase', fontWeight: 600 }}
              />
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

  return (
    <Box sx={{ height: 'calc(100vh - 280px)', width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <DataGrid
        rows={Array.isArray(devices) ? devices : []}
        columns={columns}
        loading={loading}
        getRowId={(row) => row.id}
        sortingOrder={['asc', 'desc']}
        sortModel={sortModel}
        onSortModelChange={(m) => setSortModel(m && m.length ? m : [{ field: 'ip_address', sort: 'asc' }])}
        pagination
        pageSize={100}
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Box>
  );
};

export default DeviceTable;