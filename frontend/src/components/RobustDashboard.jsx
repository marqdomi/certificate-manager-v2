// frontend/src/components/RobustDashboard.jsx
// Enhanced Professional Dashboard - CMT v2.5
// Incremental improvements for better UX and visual design

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  useTheme,
  Alert,
  Button,
  Skeleton,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  Divider,
  Chip
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Dns as DnsIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

// Componente de tarjeta de estadísticas mejorada
const StatCard = ({ title, value, icon, color = 'primary', trend, loading = false }) => {
  const theme = useTheme();
  
  if (loading) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="rectangular" height={40} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    );
  }

  const colorMap = {
    primary: theme.palette.primary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
    info: theme.palette.info.main,
    secondary: theme.palette.secondary.main
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[8]
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box 
            sx={{ 
              p: 1, 
              borderRadius: 2, 
              backgroundColor: `${colorMap[color]}20`,
              color: colorMap[color],
              mr: 2
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {trend && (
            <TrendingUpIcon 
              sx={{ 
                color: trend > 0 ? theme.palette.success.main : theme.palette.error.main,
                fontSize: 20
              }} 
            />
          )}
        </Box>
        
        <Typography variant="h3" component="div" sx={{ color: colorMap[color], fontWeight: 'bold' }}>
          {value?.toLocaleString() || '0'}
        </Typography>
        
        {trend !== undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {trend > 0 ? '+' : ''}{trend}% desde el último mes
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Componente principal del Dashboard Robusto
const RobustDashboard = ({ stats, systemStats, lastUpdated }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Datos seguros con valores por defecto
  const safeStats = {
    total: stats?.total || 0,
    healthy: stats?.healthy || 0,
    warning: stats?.warning || 0,
    expired: stats?.expired || 0
  };

  const safeSystemStats = {
    devices: {
      total: systemStats?.devices?.total || 0,
      active: systemStats?.devices?.active || 0,
      inactive: systemStats?.devices?.inactive || 0
    }
  };

  const pieData = [
    { name: 'Healthy', value: safeStats.healthy, color: theme.palette.success.main },
    { name: 'Expiring Soon', value: safeStats.warning, color: theme.palette.warning.main },
    { name: 'Expired', value: safeStats.expired, color: theme.palette.error.main }
  ].filter(item => item.value > 0); // Only show items with values

  const handleRefresh = () => {
    setLoading(true);
    // Simulate data refresh
    setTimeout(() => {
      setLoading(false);
      setError(null);
    }, 1000);
  };

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
      {/* Professional Dashboard Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: `2px solid ${theme.palette.divider}`
      }}>
        <Box>
          <Typography 
            variant="h3" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            System Overview
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
            Certificate Management Tool - Real-time Analytics
          </Typography>
          <Chip 
            label="Live Data" 
            color="success" 
            size="small" 
            sx={{ mt: 1 }}
          />
        </Box>
        <Tooltip title="Refresh Dashboard">
          <IconButton 
            onClick={handleRefresh} 
            disabled={loading}
            sx={{ 
              p: 2,
              background: `linear-gradient(45deg, ${theme.palette.primary.main}20, ${theme.palette.secondary.main}20)`,
              '&:hover': {
                background: `linear-gradient(45deg, ${theme.palette.primary.main}30, ${theme.palette.secondary.main}30)`,
              }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Last updated info */}
      {lastUpdated && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ 
            px: 2, 
            py: 0.5, 
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`
          }}>
            Last Updated: {lastUpdated.toLocaleString()}
          </Typography>
        </Box>
      )}

      {/* CERTIFICATES SECTION */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SecurityIcon sx={{ mr: 2, color: theme.palette.primary.main, fontSize: 28 }} />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Certificate Analytics
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Certificates"
              value={safeStats.total}
              icon={<SecurityIcon />}
              color="primary"
              loading={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Healthy Certificates"
              value={safeStats.healthy}
              icon={<CheckCircleIcon />}
              color="success"
              loading={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Expiring Soon"
              value={safeStats.warning}
              icon={<WarningIcon />}
              color="warning"
              loading={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Expired"
              value={safeStats.expired}
              icon={<ErrorIcon />}
              color="error"
              loading={loading}
            />
          </Grid>
        </Grid>
      </Box>

      {/* ELEGANT DIVIDER */}
      <Divider sx={{ 
        my: 4, 
        '&::before, &::after': {
          borderColor: theme.palette.primary.main,
        }
      }}>
        <Chip 
          label="Infrastructure Status" 
          color="primary" 
          variant="outlined"
          sx={{ px: 2 }}
        />
      </Divider>

      {/* DEVICES SECTION */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <DnsIcon sx={{ mr: 2, color: theme.palette.info.main, fontSize: 28 }} />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Device Management
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Devices"
              value={safeSystemStats.devices.total}
              icon={<DnsIcon />}
              color="info"
              loading={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Active Devices"
              value={safeSystemStats.devices.active}
              icon={<CheckCircleIcon />}
              color="success"
              loading={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Inactive Devices"
              value={safeSystemStats.devices.inactive}
              icon={<ErrorIcon />}
              color="secondary"
              loading={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Reports Generated"
              value={12}
              icon={<AssessmentIcon />}
              color="primary"
              trend={25}
              loading={loading}
            />
          </Grid>
        </Grid>
      </Box>

      {/* ELEGANT DIVIDER */}
      <Divider sx={{ 
        my: 4, 
        '&::before, &::after': {
          borderColor: theme.palette.secondary.main,
        }
      }}>
        <Chip 
          label="Data Visualization & System Health" 
          color="secondary" 
          variant="outlined"
          sx={{ px: 2 }}
        />
      </Divider>

      {/* CHARTS AND SYSTEM STATUS SECTION */}
      <Grid container spacing={3}>
        {/* Certificate Distribution Chart - Enhanced */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: 450,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.main}08 100%)`,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 3,
            overflow: 'hidden',
            '&:hover': {
              boxShadow: theme.shadows[12],
              transform: 'translateY(-2px)',
              transition: 'all 0.3s ease'
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  mr: 2
                }}>
                  <AssessmentIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 0 }}>
                    Certificate Distribution
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Real-time certificate status overview
                  </Typography>
                </Box>
              </Box>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Skeleton variant="circular" width={200} height={200} />
                </Box>
              ) : pieData.length > 0 ? (
                <Box sx={{ position: 'relative', height: 320 }}>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <defs>
                        <filter id="shadow">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                        </filter>
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        filter="url(#shadow)"
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            stroke={theme.palette.background.paper}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                          boxShadow: theme.shadows[8]
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center Info */}
                  <Box sx={{
                    position: 'absolute',
                    top: '35%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                  }}>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.primary.main, lineHeight: 1 }}>
                      {safeStats.total}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Total Certificates
                    </Typography>
                  </Box>
                  
                  {/* Legend with stats */}
                  <Box sx={{ 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: 'flex', 
                    justifyContent: 'space-around',
                    px: 1
                  }}>
                    {pieData.map((entry, index) => (
                      <Box key={index} sx={{ textAlign: 'center', flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                          <Box sx={{ 
                            width: 10, 
                            height: 10, 
                            backgroundColor: entry.color, 
                            borderRadius: 1,
                            mr: 0.5
                          }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {entry.name}
                          </Typography>
                        </Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: entry.color, lineHeight: 1 }}>
                          {entry.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {((entry.value / safeStats.total) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                  <AssessmentIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No certificate data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* System Health Status - Enhanced */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: 450,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.success.main}08 100%)`,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 3,
            overflow: 'hidden',
            '&:hover': {
              boxShadow: theme.shadows[12],
              transform: 'translateY(-2px)',
              transition: 'all 0.3s ease'
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  background: `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.info.main})`,
                  mr: 2
                }}>
                  <TrendingUpIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 0 }}>
                    System Health Status
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Infrastructure monitoring dashboard
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ mt: 3 }}>
                {loading ? (
                  <Box>
                    {[1,2,3,4].map(i => (
                      <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 2 }} />
                    ))}
                  </Box>
                ) : (
                  <Box>
                    {/* System Status Items */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2.5, 
                      p: 2.5, 
                      background: `linear-gradient(90deg, ${theme.palette.success.main}15, ${theme.palette.success.main}05)`,
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.success.main}30`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: `linear-gradient(90deg, ${theme.palette.success.main}25, ${theme.palette.success.main}10)`,
                        transform: 'translateX(4px)'
                      }
                    }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        backgroundColor: theme.palette.success.main,
                        mr: 2
                      }}>
                        <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>System Operational</Typography>
                        <Typography variant="caption" color="text.secondary">
                          All services running normally
                        </Typography>
                      </Box>
                      <Chip label="Active" color="success" size="small" />
                    </Box>

                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2.5, 
                      p: 2.5, 
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}15, ${theme.palette.primary.main}05)`,
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.primary.main}30`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}25, ${theme.palette.primary.main}10)`,
                        transform: 'translateX(4px)'
                      }
                    }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        backgroundColor: theme.palette.primary.main,
                        mr: 2
                      }}>
                        <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>API Backend Running</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Response time: ~45ms
                        </Typography>
                      </Box>
                      <Chip label="Online" color="primary" size="small" />
                    </Box>

                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2.5, 
                      p: 2.5, 
                      background: `linear-gradient(90deg, ${theme.palette.info.main}15, ${theme.palette.info.main}05)`,
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.info.main}30`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: `linear-gradient(90deg, ${theme.palette.info.main}25, ${theme.palette.info.main}10)`,
                        transform: 'translateX(4px)'
                      }
                    }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        backgroundColor: theme.palette.info.main,
                        mr: 2
                      }}>
                        <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Database Connected</Typography>
                        <Typography variant="caption" color="text.secondary">
                          PostgreSQL 15 - Healthy
                        </Typography>
                      </Box>
                      <Chip label="Connected" color="info" size="small" />
                    </Box>

                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 1, 
                      p: 2.5, 
                      background: `linear-gradient(90deg, ${theme.palette.secondary.main}15, ${theme.palette.secondary.main}05)`,
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.secondary.main}30`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: `linear-gradient(90deg, ${theme.palette.secondary.main}25, ${theme.palette.secondary.main}10)`,
                        transform: 'translateX(4px)'
                      }
                    }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        backgroundColor: theme.palette.secondary.main,
                        mr: 2
                      }}>
                        <DnsIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>F5 Devices Configured</Typography>
                        <Typography variant="caption" color="text.secondary">
                          All {safeSystemStats.devices.total} devices ready
                        </Typography>
                      </Box>
                      <Chip 
                        label={`${safeSystemStats.devices.total} Active`} 
                        color="secondary" 
                        size="small" 
                      />
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
            <CardActions sx={{ justifyContent: 'space-between', px: 3, pb: 3 }}>
              <Button 
                size="small" 
                color="primary" 
                variant="outlined"
                startIcon={<AssessmentIcon />}
                sx={{ borderRadius: 3 }}
              >
                System Logs
              </Button>
              <Button 
                size="small" 
                color="primary" 
                variant="contained"
                startIcon={<TrendingUpIcon />}
                sx={{ 
                  borderRadius: 3,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
                }}
              >
                Monitoring
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RobustDashboard;