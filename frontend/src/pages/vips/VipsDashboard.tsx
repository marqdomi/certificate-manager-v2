import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Tooltip, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Stack, Button, Snackbar, Alert, Chip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SyncIcon from '@mui/icons-material/Sync';
import api from '../../services/api';

// Tipos locales para este componente
export type Device = {
  id: number;
  hostname: string;
  ip_address?: string;
  site?: string | null;
};

export type CacheStatus = {
  device_id: number;
  profiles_count: number;
  vips_count: number;
  links_count: number;
  last_updated: string | null;
};

type Row = {
  device: Device;
  status?: CacheStatus;
  loading: boolean;
  error?: string;
};

const VipsDashboard: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{open:boolean; msg:string; sev:'success'|'error'|'info'}>({open:false,msg:'',sev:'success'});

  // load devices once
  useEffect(() => {
    let cancelled = false;
    api.get<Device[]>('/devices/')
      .then(res => {
        if (!cancelled) {
          const d = res.data;
          setDevices(d);
          setRows(d.map(dev => ({ device: dev, loading: true })));
        }
      })
      .catch(e => setToast({open:true,msg:String(e),sev:'error'}));
    return () => { cancelled = true; };
  }, []);

  // fetch cache status for devices
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: Row[] = [];
      for (const dev of devices) {
        try {
          const { data: st } = await api.get<CacheStatus>('/f5/cache/status', { params: { device_id: dev.id } });
          if (cancelled) return;
          next.push({ device: dev, status: st, loading: false });
        } catch (e:any) {
          next.push({ device: dev, loading: false, error: e?.message || 'error' });
        }
      }
      if (!cancelled) setRows(next);
    };
    if (devices.length) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      r.device.hostname.toLowerCase().includes(term) ||
      (r.device.ip_address || '').toLowerCase().includes(term)
    );
  }, [rows, search]);

  const handleRescanOne = async (id: number) => {
    try {
      setBusy(true);
      await api.post('/f5/cache/refresh', { device_ids: [id], full_resync: false });
      setToast({open:true, msg:'Refresh encolado', sev:'success'});
    } catch (e:any) {
      setToast({open:true, msg:String(e), sev:'error'});
    } finally {
      setBusy(false);
    }
  };

  const handleRescanAllFiltered = async () => {
    try {
      setBusy(true);
      const ids = filtered.map(r => r.device.id);
      await api.post('/f5/cache/refresh', { device_ids: ids, full_resync: false });
      setToast({open:true, msg:`Refresh encolado para ${ids.length} device(s)`, sev:'success'});
    } catch (e:any) {
      setToast({open:true, msg:String(e), sev:'error'});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} spacing={2}>
        <Typography variant="h5">VIPs Dashboard</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search device or IP…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Tooltip title="Rescan all (filtered)">
            <span>
              <IconButton onClick={handleRescanAllFiltered} disabled={busy || filtered.length === 0}>
                <SyncIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Device</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Site</TableCell>
                <TableCell align="right">Profiles</TableCell>
                <TableCell align="right">VIPs</TableCell>
                <TableCell align="right">Links</TableCell>
                <TableCell>Last updated</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.device.id} hover>
                  <TableCell>{r.device.hostname}</TableCell>
                  <TableCell>{r.device.ip_address}</TableCell>
                  <TableCell>{r.device.site || '—'}</TableCell>
                  <TableCell align="right">
                    {r.loading ? <CircularProgress size={16} /> : (r.status?.profiles_count ?? '0')}
                  </TableCell>
                  <TableCell align="right">
                    {r.loading ? <CircularProgress size={16} /> : (r.status?.vips_count ?? '0')}
                  </TableCell>
                  <TableCell align="right">
                    {r.loading ? <CircularProgress size={16} /> : (r.status?.links_count ?? '0')}
                  </TableCell>
                  <TableCell>
                    {r.loading ? <Chip size="small" label="Loading…" /> : (r.status?.last_updated || '—')}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Rescan now">
                        <span>
                          <IconButton size="small" onClick={() => handleRescanOne(r.device.id)} disabled={busy}>
                            <RefreshIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {/* Placeholder for "Open" action to a detailed view if exists */}
                      {/* <Tooltip title="Open details"><IconButton size="small"><PlayArrowIcon fontSize="small" /></IconButton></Tooltip> */}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    No devices found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(v => ({...v, open:false}))}>
        <Alert severity={toast.sev} onClose={() => setToast(v => ({...v, open:false}))}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default VipsDashboard;