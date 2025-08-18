import React from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Stack,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import api from '../../services/api';

type Device = { id: number; hostname: string };

interface CacheStatus {
  device_id: number;
  profiles_count: number;
  vips_count: number;
  links_count: number;
  last_updated?: string | null;
}

interface Row extends CacheStatus {
  id: number; // same as device_id
  hostname: string;
}

const columns: GridColDef<Row>[] = [
  { field: 'hostname', headerName: 'Device', flex: 1, minWidth: 260 },
  { field: 'vips_count', headerName: 'VIPs', width: 100 },
  { field: 'profiles_count', headerName: 'Profiles', width: 110 },
  { field: 'links_count', headerName: 'Links', width: 100 },
  {
    field: 'last_updated',
    headerName: 'Last Sync',
    width: 180,
    valueGetter: (params: { row: Row }) => params.row.last_updated ?? '',
  },
];

const VipsOverviewPage: React.FC = () => {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const devRes = await api.get<Device[]>('/api/v1/devices/');
      const devices = devRes.data;

      const statuses = await Promise.all(
        devices.map(async (d) => {
          try {
            const s = await api.get<CacheStatus>(
              `/api/v1/f5/cache/status?device_id=${d.id}`,
            );
            return {
              id: d.id,
              hostname: d.hostname,
              ...s.data,
            } as Row;
          } catch {
            return {
              id: d.id,
              hostname: d.hostname,
              device_id: d.id,
              profiles_count: 0,
              vips_count: 0,
              links_count: 0,
              last_updated: null,
            } as Row;
          }
        }),
      );

      setRows(statuses);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.hostname.toLowerCase().includes(q));
  }, [rows, filter]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        VIPs Overview
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            fullWidth
            label="Filter devices"
            placeholder="hostname contains…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Box>
            <Button variant="outlined" onClick={load} disabled={loading}>
              {loading ? <CircularProgress size={22} /> : 'Refresh'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ height: 560, p: 1 }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          density="compact"
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default VipsOverviewPage;