// frontend/src/components/Dashboard.jsx
// Enhanced Dashboard with detailed metrics

import React from 'react';
import { Grid, Paper, Typography, Box, useTheme, Divider } from '@mui/material';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DevicesIcon from '@mui/icons-material/Dns';
import StorageIcon from '@mui/icons-material/Storage';

const glassmorphicStyle = {
  p: { xs: 2, sm: 2.5 },
  height: '100%',
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  borderRadius: '16px',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
};

const StatCard = ({ title, value, color, icon: Icon, onClick, subtitle }) => (
  <Paper 
    elevation={0}
    sx={{ 
      ...glassmorphicStyle,
      textAlign: 'center',
      cursor: onClick ? 'pointer' : 'default',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 120,
      '&:hover': onClick ? {
        transform: 'translateY(-5px)',
        boxShadow: (theme) => `0 10px 20px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(90, 100, 120, 0.15)'}`,
      } : {},
    }} 
    onClick={onClick}
  >
    {Icon && <Icon sx={{ fontSize: 32, color, mb: 1, opacity: 0.8 }} />}
    <Typography variant="body2" color="text.secondary" gutterBottom>
      {title}
    </Typography>
    <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', color }}>
      {value}
    </Typography>
    {subtitle && (
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    )}
  </Paper>
);

const MiniStatCard = ({ title, value, color }) => (
  <Box sx={{ textAlign: 'center', p: 1 }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {title}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 'bold', color }}>
      {value}
    </Typography>
  </Box>
);

const Dashboard = ({ stats, onFilterSelect }) => {
  const theme = useTheme();
  
  const safeStats = stats || {};
  const total = safeStats.total ?? 0;
  const healthy = safeStats.healthy ?? 0;
  const warning = safeStats.warning ?? 0;
  const expired = safeStats.expired ?? 0;
  const expirationBands = safeStats.expirationBands || {};
  const topDevices = safeStats.topDevices || [];
  const usageStates = safeStats.usageStates || {};
  const deviceStats = safeStats.deviceStats || {};

  // Main health pie chart
  const healthPieData = [
    { name: 'Healthy (> 30d)', value: healthy, color: theme.palette.success.main },
    { name: 'Warning (< 30d)', value: warning, color: theme.palette.warning.main },
    { name: 'Expired', value: expired, color: theme.palette.error.main },
  ].filter(d => d.value > 0);

  // Expiration timeline bar data
  const expirationBarData = [
    { name: 'Expired', value: expirationBands.expired || 0, fill: theme.palette.error.main },
    { name: '< 7d', value: expirationBands.critical || 0, fill: theme.palette.error.light },
    { name: '8-30d', value: expirationBands.urgent || 0, fill: theme.palette.warning.main },
    { name: '31-60d', value: expirationBands.soon || 0, fill: theme.palette.warning.light },
    { name: '61-90d', value: expirationBands.ok || 0, fill: theme.palette.info.main },
    { name: '> 90d', value: expirationBands.healthy || 0, fill: theme.palette.success.main },
  ];

  // Usage state pie data
  const usagePieData = [
    { name: 'Active (in VIPs)', value: usageStates.active || 0, color: theme.palette.success.main },
    { name: 'No Profiles', value: usageStates.noProfiles || 0, color: theme.palette.grey[400] },
    { name: 'Profiles, No VIPs', value: usageStates.profilesNoVips || 0, color: theme.palette.warning.light },
    { name: 'Unknown', value: usageStates.unknown || 0, color: theme.palette.grey[600] },
  ].filter(d => d.value > 0);
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }) => {
    if (percent * 100 < 5) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill={theme.palette.getContrastText(payload.color)} textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize={12}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Grid container spacing={3}>
      {/* Top Stats Row */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard 
          title="Total Certificates" 
          value={total} 
          color={theme.palette.text.primary} 
          icon={SecurityIcon}
          onClick={() => onFilterSelect(null)} 
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard 
          title="Healthy" 
          value={healthy} 
          color={theme.palette.success.main} 
          icon={CheckCircleIcon}
          onClick={() => onFilterSelect({ type: 'status', value: 'healthy' })} 
          subtitle="> 30 days"
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard 
          title="Warning" 
          value={warning} 
          color={theme.palette.warning.main} 
          icon={WarningAmberIcon}
          onClick={() => onFilterSelect({ type: 'status', value: 'warning' })} 
          subtitle="< 30 days"
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard 
          title="Expired" 
          value={expired} 
          color={theme.palette.error.main} 
          icon={ErrorIcon}
          onClick={() => onFilterSelect({ type: 'status', value: 'expired' })} 
        />
      </Grid>

      {/* Expiration Timeline */}
      <Grid item xs={12} md={8}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            Expiration Timeline
          </Typography>
          <Box sx={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={expirationBarData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis type="number" stroke={theme.palette.text.secondary} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={60} 
                  stroke={theme.palette.text.secondary}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    borderColor: theme.palette.divider,
                    borderRadius: 8
                  }}
                  formatter={(value) => [value, 'Certificates']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {expirationBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Device Stats */}
      <Grid item xs={12} md={4}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <DevicesIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              F5 Devices
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Grid container>
            <Grid item xs={4}>
              <MiniStatCard title="Total" value={deviceStats.total || 0} color={theme.palette.text.primary} />
            </Grid>
            <Grid item xs={4}>
              <MiniStatCard title="With Creds" value={deviceStats.withCreds || 0} color={theme.palette.success.main} />
            </Grid>
            <Grid item xs={4}>
              <MiniStatCard title="No Creds" value={deviceStats.withoutCreds || 0} color={theme.palette.warning.main} />
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <StorageIcon sx={{ mr: 1, fontSize: 18, color: theme.palette.info.main }} />
            <Typography variant="body2" color="text.secondary">
              Top devices by certificates
            </Typography>
          </Box>
          {topDevices.slice(0, 5).map((device, idx) => (
            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                {device.name}
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {device.count}
              </Typography>
            </Box>
          ))}
        </Paper>
      </Grid>

      {/* Health Pie Chart */}
      <Grid item xs={12} md={6}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Typography variant="h6" align="center" sx={{ fontWeight: 'bold', mb: 2 }}>
            Certificate Health
          </Typography>
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie 
                  data={healthPieData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius="75%"
                  innerRadius="45%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {healthPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke={theme.palette.background.paper} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    borderColor: theme.palette.divider,
                    borderRadius: 8
                  }}
                  formatter={(value) => [value, 'Certificates']} 
                />
                <Legend iconSize={10} verticalAlign="bottom" wrapperStyle={{paddingTop: 10}} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Usage State Pie Chart */}
      <Grid item xs={12} md={6}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Typography variant="h6" align="center" sx={{ fontWeight: 'bold', mb: 2 }}>
            Certificate Usage
          </Typography>
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie 
                  data={usagePieData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius="75%"
                  innerRadius="45%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {usagePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke={theme.palette.background.paper} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    borderColor: theme.palette.divider,
                    borderRadius: 8
                  }}
                  formatter={(value) => [value, 'Certificates']} 
                />
                <Legend iconSize={10} verticalAlign="bottom" wrapperStyle={{paddingTop: 10}} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Quick Stats Row */}
      <Grid item xs={12}>
        <Paper elevation={0} sx={{ ...glassmorphicStyle, py: 2 }}>
          <Grid container spacing={2} justifyContent="center">
            <Grid item xs={6} sm={4} md={2}>
              <MiniStatCard title="Critical (< 7d)" value={expirationBands.critical || 0} color={theme.palette.error.main} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <MiniStatCard title="Urgent (8-30d)" value={expirationBands.urgent || 0} color={theme.palette.warning.main} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <MiniStatCard title="Soon (31-60d)" value={expirationBands.soon || 0} color={theme.palette.warning.light} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <MiniStatCard title="OK (61-90d)" value={expirationBands.ok || 0} color={theme.palette.info.main} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <MiniStatCard title="Orphan Certs" value={(usageStates.noProfiles || 0) + (usageStates.profilesNoVips || 0)} color={theme.palette.grey[500]} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <MiniStatCard title="Active in VIPs" value={usageStates.active || 0} color={theme.palette.success.main} />
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Dashboard;