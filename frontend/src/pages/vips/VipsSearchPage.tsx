import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
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
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import api from '../../services/api';
import { searchVips } from '../../api/vips';
import type { DeviceMinimal } from '../../types/device';

// Helper to display timestamps that may include microseconds, using local timezone with dayjs
const fmtTimestamp = (v: string | null | undefined): string => {
  if (!v) return '';
  let s = String(v).replace(' ', 'T');
  // Trim fractional seconds to milliseconds (JS Date only supports 3 digits)
  s = s.replace(/(\.\d{3})\d+/, '$1');
  try {
    const d = dayjs(s).tz(dayjs.tz.guess());
    // Check if valid date
    if (!d.isValid()) return String(v);
    return d.format('YYYY-MM-DD HH:mm:ss');
  } catch {
    return String(v);
  }
};

interface SearchParams {
  q?: string;
  device_id?: number;
  enabled?: boolean;
  limit?: number;
}

interface VipRow {
  id: string;
  device_hostname: string;
  vip_name: string;
  destination?: string | null;
  destination_raw?: string | null;
  partition?: string | null;
  enabled?: boolean | null;
  profiles_count: number;
  last_updated?: string | null;
}

const columns: GridColDef<VipRow>[] = [
  { field: 'vip_name', headerName: 'VIP Name', flex: 1, minWidth: 220 },

  { field: 'partition', headerName: 'Partition', width: 120 },

  {
    field: 'destination',
    headerName: 'Destination',
    flex: 1,
    minWidth: 180,
    renderCell: (params: GridRenderCellParams<VipRow, string | null>) => {
      const value = params.row?.destination ?? '';
      const raw = params.row?.destination_raw ?? '';
      const showTooltip = !!raw && raw !== value;
      return showTooltip ? (
        <Tooltip title={`raw: ${raw}`} placement="top" arrow>
          <span>{value}</span>
        </Tooltip>
      ) : (
        <span>{value}</span>
      );
    },
    valueGetter: (_value, row) => row?.destination ?? '',
  },

  { field: 'device_hostname', headerName: 'Device', flex: 1, minWidth: 240 },

  { field: 'profiles_count', headerName: '# Profiles', width: 120 },

  {
    field: 'last_updated',
    headerName: 'Last Sync',
    width: 200,
    valueGetter: (_value, row) => row?.last_updated ?? '',
    valueFormatter: (value) => fmtTimestamp(value as string | null | undefined),
  },
];

const VipsSearchPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const [devices, setDevices] = React.useState<DeviceMinimal[]>([]);
  const [params, setParams] = React.useState<SearchParams>({ limit: 200 });
  const [rows, setRows] = React.useState<VipRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadDevices = React.useCallback(async () => {
    try {
      const res = await api.get('/devices/');
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
      const mapped: VipRow[] = data.map((r: any) => {
        const destination =
          r.destination ||
          (r.ip && r.service_port ? `${r.ip}:${r.service_port}` : r.destination_raw || '');
        const enabled =
          typeof r.enabled === 'boolean'
            ? r.enabled
            : (r.status ?? '').toString().toLowerCase() === 'enabled'
              ? true
              : (r.status ?? '').toString().toLowerCase() === 'disabled'
                ? false
                : null;
        const last_updated = r.last_sync || r.updated_at || r.last_updated || null;

        return {
          id: `${r.device}:${r.vip_name}`,
          device_hostname: r.device,
          vip_name: r.vip_name,
          destination,
          destination_raw: r.destination_raw ?? null,
          partition: r.partition ?? (typeof r.vip_full_path === 'string' && r.vip_full_path.startsWith('/') ? (r.vip_full_path.split('/')[1] || null) : null),
          profiles_count: r.profiles ?? 0,
          last_updated,
        };
      });
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