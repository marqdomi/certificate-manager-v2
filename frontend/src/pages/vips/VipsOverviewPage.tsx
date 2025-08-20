import React from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import api from '../../services/api';
import ScanModal from './ScanModal';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

interface OverviewItem {
  device_id: number;
  hostname: string;
  vips: number;
  profiles: number;
  last_sync?: string | null;
}

interface Row extends OverviewItem {
  id: number; // alias of device_id for DataGrid
}

const columns: GridColDef<Row>[] = [
  { field: 'hostname', headerName: 'Device', flex: 1, minWidth: 260 },
  { field: 'vips', headerName: 'VIPs', width: 100 },
  { field: 'profiles', headerName: 'Profiles', width: 110 },
  {
    field: 'last_sync',
    headerName: 'Last Sync',
    width: 190,
    sortable: true,
    renderCell: (params: any) => {
      const ts = params?.row?.last_sync as string | null | undefined;
      if (!ts) return '—';
      const d = dayjs(ts);
      if (!d.isValid()) return String(ts);
      const abs = d.format('YYYY-MM-DD HH:mm');
      const rel = d.fromNow();
      return (
        <Tooltip title={abs} arrow>
          <span>{rel}</span>
        </Tooltip>
      );
    },
  },
];

const VipsOverviewPage: React.FC = () => {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const [scanOpen, setScanOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{open: boolean; msg: string; type: 'success'|'error'}>({ open: false, msg: '', type: 'success' });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<OverviewItem[]>('/vips/overview');
      const mapped: Row[] = res.data.map((r) => ({ ...r, id: r.device_id }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

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
            gridTemplateColumns: { xs: '1fr', md: '1fr auto auto' },
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
          <Button variant="outlined" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={22} /> : 'Refresh'}
          </Button>
          <Button variant="contained" onClick={() => setScanOpen(true)}>
            Scan
          </Button>
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

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onLaunched={(ok) => {
          setToast({ open: true, msg: ok ? 'Scan launched successfully' : 'Failed to launch scan', type: ok ? 'success' : 'error' });
          if (ok) load();
        }}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VipsOverviewPage;