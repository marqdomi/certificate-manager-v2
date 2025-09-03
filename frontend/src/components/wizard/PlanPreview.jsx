import React from 'react';
import { Box, Typography, Divider, Table, TableHead, TableRow, TableCell, TableBody, Chip, List, ListItem } from '@mui/material';

// Helpers to render possibly-object items coming from the plan API
function labelForProfile(p) {
  if (p == null) return '—';
  if (typeof p === 'string' || typeof p === 'number') return String(p);
  if (typeof p === 'object') {
    const name = p.name || p.profile || p.id || 'Profile';
    const parts = [name];
    if (p.partition) parts.push(p.partition);
    if (p.context) parts.push(p.context);
    // If the backend includes VIPs, show a short hint like "+3 vips"
    if (Array.isArray(p.vips) && p.vips.length) parts.push(`+${p.vips.length} vips`);
    return parts.join(' / ');
  }
  return String(p);
}

function textForAction(a) {
  if (a == null) return '—';
  if (typeof a === 'string' || typeof a === 'number') return String(a);
  if (typeof a === 'object') {
    // Try to build a concise sentence
    const t = a.type || a.action || 'action';
    const what = a.name || a.target || a.profile || '';
    const extra = a.detail || a.reason || '';
    const pieces = [t, what, extra].filter(Boolean);
    return pieces.join(' — ');
  }
  return String(a);
}

export default function PlanPreview({ plan }) {
  if (!plan) return null;

  // Some backends send `{ plan: {...} }`, others give the plan directly
  const p = plan.plan ? plan.plan : plan;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Plan Preview</Typography>

      {p.device && (
        <Typography><strong>Device:</strong> {String(p.device)}</Typography>
      )}
      {p.device_ip && (
        <Typography><strong>Device IP:</strong> {String(p.device_ip)}</Typography>
      )}
      {p.old_cert_name && (
        <Typography><strong>Old Certificate Name:</strong> {String(p.old_cert_name)}</Typography>
      )}
      {p.mode && (
        <Typography><strong>Mode:</strong> {String(p.mode)}</Typography>
      )}
      {p.derived_new_object && (
        <Typography><strong>Derived New Object:</strong> {String(p.derived_new_object)}</Typography>
      )}
      {p.chain_name && (
        <Typography><strong>Chain Name:</strong> {String(p.chain_name)}</Typography>
      )}
      {typeof p.install_chain_from_pfx !== 'undefined' && (
        <Typography><strong>Install Chain From PFX:</strong> {String(!!p.install_chain_from_pfx)}</Typography>
      )}
      {typeof p.update_profiles !== 'undefined' && (
        <Typography><strong>Update Profiles:</strong> {String(!!p.update_profiles)}</Typography>
      )}

      {Array.isArray(p.actions) && p.actions.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1">Actions</Typography>
          <List dense>
            {p.actions.map((a, idx) => (
              <ListItem key={idx}>{textForAction(a)}</ListItem>
            ))}
          </List>
        </>
      )}

      {Array.isArray(p.profiles_detected) && p.profiles_detected.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1">Profiles Detected</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {p.profiles_detected.map((pf, idx) => (
              <Chip key={idx} label={labelForProfile(pf)} />
            ))}
          </Box>
        </>
      )}

      {Array.isArray(p.profiles_to_update) && p.profiles_to_update.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1">Profiles to Update</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {p.profiles_to_update.map((pf, idx) => (
              <Chip key={idx} label={labelForProfile(pf)} color="primary" />
            ))}
          </Box>
        </>
      )}

      {Array.isArray(p.virtual_servers) && p.virtual_servers.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>Virtual Servers</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Destination</TableCell>
                <TableCell>Partition</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {p.virtual_servers.map((vs, idx) => (
                <TableRow key={idx}>
                  <TableCell>{(vs && (vs.name || vs.id)) ? String(vs.name || vs.id) : '—'}</TableCell>
                  <TableCell>{vs && vs.destination ? String(vs.destination) : '—'}</TableCell>
                  <TableCell>{vs && vs.partition ? String(vs.partition) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
