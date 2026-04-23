// frontend/src/components/QuickActions.jsx

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Button,
  useTheme,
  Chip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Assessment as ReportsIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const QuickActions = ({ systemStats }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const actions = [
    {
      id: 'scan-all',
      title: 'Scan All Devices',
      description: 'Queue full scan for all active devices',
      icon: RefreshIcon,
      color: theme.palette.primary.main,
      action: () => {
        // TODO: Implement scan all functionality
        console.log('Scanning all devices...');
      },
      badge: systemStats?.devices?.active || 0
    },
    {
      id: 'upload-cert',
      title: 'Upload Certificate',
      description: 'Deploy new certificate from PFX file',
      icon: UploadIcon,
      color: theme.palette.success.main,
      action: () => navigate('/deploy'),
      badge: null
    },
    {
      id: 'search-vips',
      title: 'Search VIPs',
      description: 'Find VIPs across all devices',
      icon: SearchIcon,
      color: theme.palette.info.main,
      action: () => navigate('/vips/search'),
      badge: systemStats?.vips?.total || 0
    },
    {
      id: 'generate-report',
      title: 'Generate Report',
      description: 'Export certificate inventory report',
      icon: ReportsIcon,
      color: theme.palette.secondary.main,
      action: () => {
        // TODO: Implement report generation
        console.log('Generating report...');
      },
      badge: systemStats?.certificates?.total || 0
    },
    {
      id: 'system-health',
      title: 'System Health',
      description: 'View detailed system diagnostics',
      icon: SecurityIcon,
      color: theme.palette.warning.main,
      action: () => navigate('/admin'),
      badge: null
    },
    {
      id: 'pfx-generator',
      title: 'PFX Generator',
      description: 'Create PFX from certificates',
      icon: DownloadIcon,
      color: theme.palette.success.main,
      action: () => navigate('/pfx'),
      badge: null
    }
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
        borderRadius: '16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <PlayIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Quick Actions
        </Typography>
      </Box>
      
      <Grid container spacing={2}>
        {actions.map((action, index) => (
          <Grid item xs={12} sm={6} md={4} key={action.id}>
            <Button
              fullWidth
              onClick={action.action}
              sx={{
                p: 2,
                height: 'auto',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                textAlign: 'left',
                backgroundColor: theme.palette.action.hover,
                border: '1px solid',
                borderColor: theme.palette.divider,
                borderRadius: '12px',
                '&:hover': {
                  backgroundColor: theme.palette.action.selected,
                  borderColor: action.color,
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4]
                },
                transition: 'all 0.2s ease-in-out',
                color: 'inherit'
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%', 
                mb: 1 
              }}>
                <action.icon 
                  sx={{ 
                    mr: 1, 
                    color: action.color,
                    fontSize: '1.5rem'
                  }} 
                />
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    flex: 1
                  }}
                >
                  {action.title}
                </Typography>
                {action.badge !== null && (
                  <Chip 
                    label={action.badge} 
                    size="small" 
                    sx={{ 
                      backgroundColor: action.color,
                      color: 'white',
                      fontSize: '0.75rem',
                      height: 20
                    }}
                  />
                )}
              </Box>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  lineHeight: 1.4
                }}
              >
                {action.description}
              </Typography>
            </Button>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

export default QuickActions;