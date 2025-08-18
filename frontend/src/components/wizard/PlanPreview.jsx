import React, { useState } from 'react';
import { Box, Typography, Divider, Table, TableHead, TableRow, TableCell, TableBody, Chip, List, ListItem } from '@mui/material';

export default function PlanPreview({ plan }) {
  if (!plan) return null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Plan Preview</Typography>

      {plan.device && (
        <Typography><strong>Device:</strong> {plan.device}</Typography>
      )}
      {plan.device_ip && (
        <Typography><strong>Device IP:</strong> {plan.device_ip}</Typography>
      )}
      {plan.old_cert_name && (
        <Typography><strong>Old Certificate Name:</strong> {plan.old_cert_name}</Typography>
      )}
      {plan.mode && (
        <Typography><strong>Mode:</strong> {plan.mode}</Typography>
      )}
      {plan.derived_new_object && (
        <Typography><strong>Derived New Object:</strong> {plan.derived_new_object}</Typography>
      )}
      {plan.chain_name && (
        <Typography><strong>Chain Name:</strong> {plan.chain_name}</Typography>
      )}
      {typeof plan.install_chain_from_pfx !== 'undefined' && (
        <Typography><strong>Install Chain From PFX:</strong> {String(plan.install_chain_from_pfx)}</Typography>
      )}
      {typeof plan.update_profiles !== 'undefined' && (
        <Typography><strong>Update Profiles:</strong> {String(plan.update_profiles)}</Typography>
      )}

      {plan.actions && plan.actions.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1">Actions</Typography>
          <List dense>
            {plan.actions.map((action, idx) => (
              <ListItem key={idx}>{action}</ListItem>
            ))}
          </List>
        </>
      )}

      {plan.profiles_detected && plan.profiles_detected.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1">Profiles Detected</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {plan.profiles_detected.map((profile, idx) => (
              <Chip key={idx} label={profile} />
            ))}
          </Box>
        </>
      )}

      {plan.profiles_to_update && plan.profiles_to_update.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1">Profiles to Update</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {plan.profiles_to_update.map((profile, idx) => (
              <Chip key={idx} label={profile} color="primary" />
            ))}
          </Box>
        </>
      )}

      {plan.virtual_servers && plan.virtual_servers.length > 0 && (
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
              {plan.virtual_servers.map((vs, idx) => (
                <TableRow key={idx}>
                  <TableCell>{vs.name || '—'}</TableCell>
                  <TableCell>{vs.destination || '—'}</TableCell>
                  <TableCell>{vs.partition || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
