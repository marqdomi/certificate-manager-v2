// frontend/src/components/CertificateUsageDetail.jsx

import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { 
    Box, 
    Typography, 
    CircularProgress, 
    List, 
    ListItem, 
    ListItemText, 
    Divider, 
    Chip,
    Paper,
    Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // Solo necesitamos este icono ahora

const CertificateUsageDetail = ({ certId }) => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!certId) return;
    
    setLoading(true);
    setError('');

    apiClient.get(`/certificates/${certId}/usage`)
      .then(response => {
        setUsage(response.data);
      })
      .catch(error => {
        console.error("Error fetching usage data:", error);
        setError(`Failed to load usage details. Please try again.`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [certId]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>;
  }

  const profiles = Array.isArray(usage?.profiles) ? usage.profiles : [];
  const virtualServers = Array.isArray(usage?.virtual_servers) ? usage.virtual_servers : [];

  if (profiles.length === 0 && virtualServers.length === 0) {
    return <Alert severity="info" sx={{ m: 1 }}>No usage data available for this certificate.</Alert>;
  }

  return (
    <Box>
      {profiles.length > 0 && (
        <Box mb={2}>
            <Typography variant="overline" color="text.secondary">SSL Profiles</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {`Used in ${profiles.length} Profile(s)`}
            </Typography>
            <List dense>
                {profiles.map(p => (
                    <ListItem key={p} sx={{ pl: 1 }}>
                        <ListItemText primary={p} />
                    </ListItem>
                ))}
            </List>
        </Box>
      )}

      {virtualServers.length > 0 && (
        <>
            {profiles.length > 0 && <Divider sx={{ my: 2 }} />}

            <Box>
                <Typography variant="overline" color="text.secondary">Virtual Servers</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {`Applied to ${virtualServers.length} Server(s)`}
                </Typography>
                <List>
                    {virtualServers.map(vs => (
                        <Paper key={vs.name} variant="outlined" sx={{ mb: 1.5, p: 1, borderRadius: 2 }}>
                            <ListItem>
                                <ListItemText 
                                    primary={vs.name} 
                                    primaryTypographyProps={{ fontWeight: 'bold' }}
                                    secondary={vs.destination}
                                />
                                {/* ✅ LA CORRECCIÓN ESTÁ AQUÍ ✅ */}
                                {/* Ahora solo mostramos el icono si el estado es 'enabled' */}
                                <Chip 
                                    icon={vs.state === 'enabled' ? <CheckCircleIcon /> : null} 
                                    label={vs.state} 
                                    color={vs.state === 'enabled' ? 'success' : 'default'} 
                                    size="small"
                                    sx={{ textTransform: 'capitalize' }}
                                />
                            </ListItem>
                        </Paper>
                    ))}
                </List>
            </Box>
        </>
      )}
    </Box>
  );
};

export default CertificateUsageDetail;