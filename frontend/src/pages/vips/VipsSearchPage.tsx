import React from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Typography,
  CircularProgress,
  Stack,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import api from '../../services/api';
import { searchVips } from '../../api/vips';

type Device = { id: number; hostname: string };

interface SearchParams {
  q?: string;
  device_id?: number;
  enabled?: boolean;
  limit?: number;
}

interface VipRow {
  id: string;
  device_id: number;
  device_hostname: string;
  vip_name: string;
  destination?: string | null;
  enabled?: boolean | null;
  profiles_count: number;
  last_updated?: string | null;
}

const columns: GridColDef<VipRow>[] = [
  { field: 'vip_name', headerName: 'VIP Name', flex: 1, minWidth: 220 },
  {
    field: 'destination',
    headerName: 'Destination',
    flex: 1,
    minWidth: 180,
    valueGetter: (params: { row: VipRow }) => params.row.destination ?? '',
  },
  { field: 'device_hostname', headerName: 'Device', flex: 1, minWidth: 240 },
  {
    field: 'enabled',
    headerName: 'Enabled',
    width: 110,
    valueFormatter: (params: { value: boolean | null | undefined }) =>
      params?.value === true ? 'Yes' : params?.value === false ? 'No' : '-',
  },
  { field: 'profiles_count', headerName: '# Profiles', width: 120 },
  {
    field: 'last_updated',
    headerName: 'Last Sync',
    width: 180,
    valueGetter: (params: { row: VipRow }) => params.row.last_updated ?? '',
  },
];

const VipsSearchPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [params, setParams] = React.useState<SearchParams>({ limit: 200 });
  const [rows, setRows] = React.useState<VipRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadDevices = React.useCallback(async () => {
    try {
      const res = await api.get('/api/v1/devices/');
      setDevices(res.data);
    } catch {
      setDevices([]);
    }
  }, []);

  React.useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onSearch = async () => {
    setLoading(true);
    try {
      const data = await searchVips(params);
      const mapped: VipRow[] = data.map((r: any) => ({
        id: `${r.device.id}:${r.vip_name}`,
        device_id: r.device.id,
        device_hostname: r.device.hostname,
        vip_name: r.vip_name,
        destination: r.destination ?? null,
        enabled: typeof r.enabled === 'boolean' ? r.enabled : null,
        profiles_count: r.profiles_count ?? 0,
        last_updated: r.last_updated ?? null,
      }));
      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {!embedded && (
        <Typography variant="h5" sx={{ mb: 2 }}>
          Search VIPs
        </Typography>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1.5fr 1fr auto' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            fullWidth
            label="Search (IP / VIP name / host)"
            placeholder="10.119.x.x  |  /Partition/vip  |  example.com"
            value={params.q ?? ''}
            onChange={(e) => setParams((p) => ({ ...p, q: e.target.value }))}
          />

          <TextField
            select
            fullWidth
            label="Device (optional)"
            value={params.device_id ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setParams((p) => ({
                ...p,
                device_id: v === '' ? undefined : Number(v),
              }));
            }}
          >
            <MenuItem value="">All devices</MenuItem>
            {devices.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.hostname}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Checkbox
                checked={!!params.enabled}
                onChange={(e) => setParams((p) => ({ ...p, enabled: e.target.checked }))}
              />
            }
            label="Enabled only"
          />

          <Box>
            <Button variant="contained" onClick={onSearch} disabled={loading}>
              {loading ? <CircularProgress size={22} /> : 'Search'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ height: 520, p: 1 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          density="compact"
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default VipsSearchPage;