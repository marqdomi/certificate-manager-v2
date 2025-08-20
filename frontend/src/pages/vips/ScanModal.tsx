import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  TextField,
  MenuItem,
  Stack,
  CircularProgress,
} from '@mui/material';
import api from '../../services/api';
import { scanDevicesAll, scanDevicesByIds } from '../../api/devices';

export type Device = { id: number; hostname: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunched?: (ok: boolean) => void; // para disparar snackbar en el padre
}

const ScanModal: React.FC<Props> = ({ open, onClose, onLaunched }) => {
  const [mode, setMode] = React.useState<'all' | 'selected'>('all');
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [full, setFull] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await api.get<Device[]>('/devices/');
        setDevices(res.data ?? []);
      } catch {
        setDevices([]);
      }
    })();
  }, [open]);

  const launch = async () => {
    setLoading(true);
    try {
      if (mode === 'all') {
        await scanDevicesAll(full);
      } else {
        await scanDevicesByIds(selectedIds, full);
      }
      onLaunched?.(true);
      onClose();
    } catch (e) {
      console.error('Scan launch failed', e);
      onLaunched?.(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Launch scan</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <RadioGroup
            row
            value={mode}
            onChange={(e) => setMode(e.target.value as 'all' | 'selected')}
          >
            <FormControlLabel value="all" control={<Radio />} label="All devices" />
            <FormControlLabel value="selected" control={<Radio />} label="Selected devices" />
          </RadioGroup>

          {mode === 'selected' && (
            <TextField
              select
              label="Devices"
              fullWidth
              SelectProps={{ multiple: true, renderValue: (v) => `${(v as any[]).length} selected` }}
              value={selectedIds}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedIds(Array.isArray(value) ? value.map(Number) : []);
              }}
            >
              {devices.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.hostname}
                </MenuItem>
              ))}
            </TextField>
          )}

          <FormControlLabel
            control={<Checkbox checked={full} onChange={(e) => setFull(e.target.checked)} />}
            label="Full re-sync (slow)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={launch} disabled={loading || (mode==='selected' && selectedIds.length===0)}>
          {loading ? <CircularProgress size={20} /> : 'Launch'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScanModal;
