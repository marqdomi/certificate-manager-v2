// frontend/src/components/Dashboard.jsx
// Enhanced Dashboard with detailed metrics - Phase 1, 2 & 3 Improvements

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Grid, Paper, Typography, Box, useTheme, Divider, Button, Chip, 
  LinearProgress, Avatar, alpha, Tooltip as MuiTooltip, IconButton 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
  RadialBarChart, RadialBar,
  Treemap,
} from 'recharts';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DevicesIcon from '@mui/icons-material/Dns';
import StorageIcon from '@mui/icons-material/Storage';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import HistoryIcon from '@mui/icons-material/History';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SyncIcon from '@mui/icons-material/Sync';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import TimelineIcon from '@mui/icons-material/Timeline';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// ============================================
// PHASE 2 - Animated Counter Hook
// ============================================
const useCountUp = (end, duration = 1000, startOnMount = true) => {
  const [count, setCount] = useState(0);
  const prevEndRef = useRef(end);
  const frameRef = useRef(null);
  
  useEffect(() => {
    if (!startOnMount) return;
    
    const startValue = prevEndRef.current !== end ? prevEndRef.current : 0;
    prevEndRef.current = end;
    
    const startTime = performance.now();
    const diff = end - startValue;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: easeOutExpo
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentValue = Math.round(startValue + diff * easeOut);
      
      setCount(currentValue);
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    
    frameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, startOnMount]);
  
  return count;
};

// Animated number component
const AnimatedNumber = ({ value, duration = 800 }) => {
  const animatedValue = useCountUp(value, duration);
  return <>{animatedValue.toLocaleString()}</>;
};

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

const StatCard = ({ title, value, color, icon: Icon, onClick, subtitle, animated = true, tooltip }) => {
  const cardContent = (
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
        minHeight: { xs: 100, sm: 120 },
        '&:hover': onClick ? {
          transform: 'translateY(-5px)',
          boxShadow: (theme) => `0 10px 20px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(90, 100, 120, 0.15)'}`,
        } : {},
      }} 
      onClick={onClick}
    >
      {Icon && <Icon sx={{ fontSize: { xs: 28, sm: 32 }, color, mb: 1, opacity: 0.8 }} />}
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
        {title}
      </Typography>
      <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', color, fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
        {animated ? <AnimatedNumber value={value} /> : value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  );

  return tooltip ? (
    <MuiTooltip title={tooltip} arrow placement="top" enterDelay={400}>
      {cardContent}
    </MuiTooltip>
  ) : cardContent;
};

const MiniStatCard = ({ title, value, color, animated = true }) => (
  <Box sx={{ textAlign: 'center', p: 1 }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {title}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 'bold', color }}>
      {animated ? <AnimatedNumber value={value} duration={600} /> : value}
    </Typography>
  </Box>
);

// ============================================
// PHASE 1 - NEW COMPONENT: Health Score Gauge
// ============================================
const HealthScoreGauge = ({ score, theme }) => {
  const getScoreColor = (s) => {
    if (s >= 80) return theme.palette.success.main;
    if (s >= 60) return theme.palette.info.main;
    if (s >= 40) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getScoreLabel = (s) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Critical';
  };

  const color = getScoreColor(score);
  const data = [{ value: score, fill: color }];

  return (
    <Paper elevation={0} sx={glassmorphicStyle}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SpeedIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Health Score
        </Typography>
        <MuiTooltip 
          title="Overall certificate health score (0-100). Calculated based on the ratio of healthy, warning, and expired certificates. Higher is better."
          arrow
          placement="top"
        >
          <IconButton size="small" sx={{ ml: 0.5 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </IconButton>
        </MuiTooltip>
      </Box>
      <Box sx={{ width: '100%', height: 200, position: 'relative' }}>
        <ResponsiveContainer>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            barSize={20}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background={{ fill: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
              dataKey="value"
              cornerRadius={10}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -20%)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h2" sx={{ fontWeight: 'bold', color, lineHeight: 1, fontSize: { xs: '2.5rem', sm: '3.5rem' } }}>
            <AnimatedNumber value={score} duration={1200} />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getScoreLabel(score)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: theme.palette.success.main, display: 'inline-block', mr: 0.5 }} />
          <Typography variant="caption" color="text.secondary">80-100</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: theme.palette.info.main, display: 'inline-block', mr: 0.5 }} />
          <Typography variant="caption" color="text.secondary">60-79</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: theme.palette.warning.main, display: 'inline-block', mr: 0.5 }} />
          <Typography variant="caption" color="text.secondary">40-59</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: theme.palette.error.main, display: 'inline-block', mr: 0.5 }} />
          <Typography variant="caption" color="text.secondary">0-39</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

// ============================================
// PHASE 1 - NEW COMPONENT: Expiration Trend Chart
// ============================================
const ExpirationTrendChart = ({ certificates, theme }) => {
  // Calculate certificates expiring per month for next 12 months
  const trendData = useMemo(() => {
    const now = new Date();
    const months = [];
    
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      const expiringCount = certificates.filter(cert => {
        const expDate = new Date(cert.expiration_date);
        return expDate >= monthStart && expDate <= monthEnd;
      }).length;
      
      months.push({
        month: monthName,
        expiring: expiringCount,
        cumulative: 0, // Will be calculated below
      });
    }
    
    // Calculate cumulative
    let cumulative = 0;
    months.forEach(m => {
      cumulative += m.expiring;
      m.cumulative = cumulative;
    });
    
    return months;
  }, [certificates]);

  const maxExpiring = Math.max(...trendData.map(d => d.expiring), 1);

  return (
    <Paper elevation={0} sx={glassmorphicStyle}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUpIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Expiration Forecast
          </Typography>
          <MuiTooltip 
            title="12-month forecast showing certificates expiring each month. The dashed line shows cumulative expiring certificates. Plan renewals accordingly."
            arrow
            placement="top"
          >
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </IconButton>
          </MuiTooltip>
        </Box>
        <Chip 
          label={`${trendData.reduce((sum, d) => sum + d.expiring, 0)} in 12mo`}
          size="small"
          color="warning"
          variant="outlined"
        />
      </Box>
      <Box sx={{ width: '100%', height: { xs: 200, sm: 250 } }}>
        <ResponsiveContainer>
          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorExpiring" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.warning.main} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={theme.palette.warning.main} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
            <XAxis 
              dataKey="month" 
              stroke={theme.palette.text.secondary}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              stroke={theme.palette.text.secondary}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, maxExpiring + 5]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                borderColor: theme.palette.divider,
                borderRadius: 8,
              }}
              formatter={(value, name) => [value, name === 'expiring' ? 'Expiring' : 'Cumulative']}
            />
            <Area
              type="monotone"
              dataKey="expiring"
              stroke={theme.palette.warning.main}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExpiring)"
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={theme.palette.error.main}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 3, bgcolor: theme.palette.warning.main, mr: 1, borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">Monthly</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 3, bgcolor: theme.palette.error.main, mr: 1, borderRadius: 1, opacity: 0.7 }} />
          <Typography variant="caption" color="text.secondary">Cumulative</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

// ============================================
// PHASE 1 - NEW COMPONENT: Activity Timeline
// ============================================
const ActivityTimeline = ({ auditStats, theme, navigate }) => {
  const recentActivities = auditStats?.recent_activities || [];
  
  const getActivityIcon = (action) => {
    const iconMap = {
      'scan': <SyncIcon fontSize="small" />,
      'renew': <AutorenewIcon fontSize="small" />,
      'delete': <DeleteIcon fontSize="small" />,
      'cleanup': <DeleteIcon fontSize="small" />,
      'deploy': <CloudUploadIcon fontSize="small" />,
      'view': <VisibilityIcon fontSize="small" />,
      'create': <AddCircleOutlineIcon fontSize="small" />,
    };
    const key = Object.keys(iconMap).find(k => action?.toLowerCase().includes(k));
    return iconMap[key] || <HistoryIcon fontSize="small" />;
  };

  const getActivityColor = (action, status) => {
    if (status === 'failed' || status === 'error') return theme.palette.error.main;
    if (action?.toLowerCase().includes('delete') || action?.toLowerCase().includes('cleanup')) return theme.palette.warning.main;
    if (action?.toLowerCase().includes('renew') || action?.toLowerCase().includes('deploy')) return theme.palette.success.main;
    return theme.palette.info.main;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Paper elevation={0} sx={glassmorphicStyle}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TimelineIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Recent Activity
          </Typography>
          <MuiTooltip 
            title="Latest system activities including scans, renewals, deployments, and certificate cleanup operations. Color-coded by action type."
            arrow
            placement="top"
          >
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </IconButton>
          </MuiTooltip>
        </Box>
        <Button 
          size="small" 
          onClick={() => navigate('/audit-log')}
          endIcon={<ArrowForwardIcon />}
        >
          View All
        </Button>
      </Box>
      <Divider sx={{ mb: 2 }} />
      
      {recentActivities.length > 0 ? (
        <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
          {recentActivities.slice(0, 8).map((activity, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                py: 1.5,
                px: 1,
                borderRadius: 1,
                mb: 0.5,
                '&:hover': { backgroundColor: 'action.hover' },
                borderLeft: '3px solid',
                borderLeftColor: getActivityColor(activity.action, activity.status),
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  mr: 1.5,
                  bgcolor: alpha(getActivityColor(activity.action, activity.status), 0.15),
                  color: getActivityColor(activity.action, activity.status),
                }}
              >
                {getActivityIcon(activity.action)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {activity.action?.replace(/_/g, ' ')}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {activity.details || activity.target || 'System operation'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', ml: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatTimeAgo(activity.timestamp)}
                </Typography>
                {activity.user && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {activity.user}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <HistoryIcon sx={{ fontSize: 40, color: theme.palette.grey[400], mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No recent activity
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// ============================================
// PHASE 1 - NEW COMPONENT: Critical Certificates
// ============================================
const CriticalCertificates = ({ certificates, theme, navigate }) => {
  // Get top 5 most critical expired certificates (by usage/impact)
  const criticalCerts = useMemo(() => {
    return certificates
      .filter(c => c.days_remaining <= 0)
      .sort((a, b) => {
        // Sort by usage count (profiles), then by days expired
        const aUsage = a.usage_count || a.profile_count || 0;
        const bUsage = b.usage_count || b.profile_count || 0;
        if (bUsage !== aUsage) return bUsage - aUsage;
        return a.days_remaining - b.days_remaining;
      })
      .slice(0, 5);
  }, [certificates]);

  const getDaysExpiredText = (days) => {
    const absDays = Math.abs(days);
    if (absDays === 0) return 'Today';
    if (absDays === 1) return '1 day ago';
    if (absDays < 30) return `${absDays} days ago`;
    if (absDays < 365) return `${Math.floor(absDays / 30)} months ago`;
    return `${Math.floor(absDays / 365)} years ago`;
  };

  return (
    <Paper elevation={0} sx={glassmorphicStyle}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PriorityHighIcon sx={{ mr: 1, color: theme.palette.error.main }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Critical Expired
          </Typography>
          <MuiTooltip 
            title="Top 5 most critical expired certificates, prioritized by the number of profiles/services using them. Higher usage = higher priority for renewal."
            arrow
            placement="top"
          >
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </IconButton>
          </MuiTooltip>
        </Box>
        {criticalCerts.length > 0 && (
          <Chip 
            label={`${criticalCerts.length} urgent`}
            size="small"
            color="error"
          />
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />
      
      {criticalCerts.length > 0 ? (
        <Box>
          {criticalCerts.map((cert, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1.5,
                px: 1,
                borderRadius: 1,
                mb: 0.5,
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' },
                backgroundColor: idx === 0 ? alpha(theme.palette.error.main, 0.08) : 'transparent',
              }}
              onClick={() => navigate('/certificates', { state: { searchTerm: cert.common_name || cert.name } })}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  mr: 1.5,
                  bgcolor: alpha(theme.palette.error.main, 0.15),
                  color: theme.palette.error.main,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              >
                {idx + 1}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {cert.common_name || cert.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="error.main">
                    {getDaysExpiredText(cert.days_remaining)}
                  </Typography>
                  {(cert.usage_count > 0 || cert.profile_count > 0) && (
                    <>
                      <Typography variant="caption" color="text.secondary">•</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LinkIcon sx={{ fontSize: 12, mr: 0.3, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {cert.usage_count || cert.profile_count} profiles
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
              <ArrowForwardIcon fontSize="small" color="action" />
            </Box>
          ))}
          <Button
            fullWidth
            variant="text"
            size="small"
            sx={{ mt: 1 }}
            onClick={() => navigate('/certificates', { state: { initialFilter: { type: 'status', value: 'expired' } } })}
            color="error"
          >
            View All Expired
          </Button>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No expired certificates!
          </Typography>
          <Typography variant="caption" color="success.main">
            All certificates are up to date
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// ============================================
// PHASE 3 - NEW COMPONENT: Certificates by Site/Location
// ============================================
const CertificatesBySite = ({ certificates, devices, theme, navigate }) => {
  const siteData = useMemo(() => {
    // Create a device hostname to site mapping
    const deviceSiteMap = {};
    (devices || []).forEach(device => {
      const site = device.site || 'Unknown Site';
      deviceSiteMap[device.hostname] = site;
    });

    // Group certificates by site
    const siteCounts = {};
    (certificates || []).forEach(cert => {
      const hostname = cert.f5_device_hostname || '';
      const site = deviceSiteMap[hostname] || 'Unknown Site';
      
      if (!siteCounts[site]) {
        siteCounts[site] = { 
          total: 0, 
          expired: 0, 
          warning: 0, 
          healthy: 0,
          devices: new Set()
        };
      }
      
      siteCounts[site].total++;
      siteCounts[site].devices.add(hostname);
      
      const daysRemaining = cert.days_remaining ?? 0;
      if (daysRemaining <= 0) {
        siteCounts[site].expired++;
      } else if (daysRemaining <= 30) {
        siteCounts[site].warning++;
      } else {
        siteCounts[site].healthy++;
      }
    });

    // Convert to array and sort by total certificates
    return Object.entries(siteCounts)
      .map(([name, data]) => ({
        name,
        value: data.total,
        expired: data.expired,
        warning: data.warning,
        healthy: data.healthy,
        deviceCount: data.devices.size,
        healthPercent: data.total > 0 ? Math.round((data.healthy / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 sites
  }, [certificates, devices]);

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    '#8884d8',
    '#82ca9d',
  ];

  const getHealthColor = (percent) => {
    if (percent >= 80) return theme.palette.success.main;
    if (percent >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper
          sx={{
            p: 1.5,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {data.name}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption">
              <strong>{data.value}</strong> certificates
            </Typography>
            <Typography variant="caption" color="success.main">
              ✓ {data.healthy} healthy
            </Typography>
            <Typography variant="caption" color="warning.main">
              ⚠ {data.warning} warning
            </Typography>
            <Typography variant="caption" color="error.main">
              ✕ {data.expired} expired
            </Typography>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" color="text.secondary">
              {data.deviceCount} device{data.deviceCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper elevation={0} sx={glassmorphicStyle}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LocationOnIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Certificates by Site
          </Typography>
          <MuiTooltip 
            title="Distribution of SSL certificates across different data center sites. Shows certificate count and health status per location."
            arrow
            placement="top"
          >
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </IconButton>
          </MuiTooltip>
        </Box>
        <Chip 
          label={`${siteData.length} sites`}
          size="small"
          color="primary"
          variant="outlined"
        />
      </Box>

      {siteData.length > 0 ? (
        <>
          {/* Horizontal Bar Chart */}
          <Box sx={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart 
                data={siteData} 
                layout="vertical" 
                margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={true} vertical={false} />
                <XAxis type="number" stroke={theme.palette.text.secondary} fontSize={11} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={80}
                  stroke={theme.palette.text.secondary}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 10)}...` : value}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {siteData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Site Health Summary */}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
            {siteData.slice(0, 4).map((site, idx) => (
              <Chip
                key={idx}
                size="small"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: getHealthColor(site.healthPercent) 
                      }} 
                    />
                    <span>{site.name.length > 10 ? `${site.name.slice(0, 8)}...` : site.name}</span>
                    <Typography variant="caption" fontWeight="bold">
                      {site.healthPercent}%
                    </Typography>
                  </Box>
                }
                sx={{ 
                  backgroundColor: alpha(getHealthColor(site.healthPercent), 0.1),
                  '&:hover': { backgroundColor: alpha(getHealthColor(site.healthPercent), 0.2) }
                }}
              />
            ))}
          </Box>
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <LocationOnIcon sx={{ fontSize: 40, color: theme.palette.grey[400], mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No site data available
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Configure sites in device settings
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// ============================================
// PHASE 3 - Helper: Info Tooltip Component
// ============================================
const InfoTooltip = ({ title, children }) => (
  <MuiTooltip 
    title={title}
    arrow
    placement="top"
    enterDelay={300}
    leaveDelay={100}
  >
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}>
      {children}
      <HelpOutlineIcon sx={{ fontSize: 14, ml: 0.5, color: 'text.secondary', opacity: 0.7 }} />
    </Box>
  </MuiTooltip>
);

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
const Dashboard = ({ stats, onFilterSelect }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  const safeStats = stats || {};
  const total = safeStats.total ?? 0;
  const healthy = safeStats.healthy ?? 0;
  const warning = safeStats.warning ?? 0;
  const expired = safeStats.expired ?? 0;
  const expirationBands = safeStats.expirationBands || {};
  const topDevices = safeStats.topDevices || [];
  const deviceStats = safeStats.deviceStats || {};
  const pendingRenewals = safeStats.pendingRenewals || { total: 0, items: [] };
  const auditStats = safeStats.auditStats || {};
  const certificates = safeStats.certificates || [];
  const devices = safeStats.devices || []; // Phase 3: devices for site grouping

  // Calculate Health Score (0-100)
  const healthScore = useMemo(() => {
    if (total === 0) return 100;
    const healthyWeight = 1;
    const warningWeight = 0.5;
    const expiredWeight = 0;
    const score = Math.round(
      ((healthy * healthyWeight + warning * warningWeight + expired * expiredWeight) / total) * 100
    );
    return Math.max(0, Math.min(100, score));
  }, [total, healthy, warning, expired]);

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
      {/* Top Stats Row - Phase 3: Added tooltips */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard 
          title="Total Certificates" 
          value={total} 
          color={theme.palette.text.primary} 
          icon={SecurityIcon}
          onClick={() => onFilterSelect(null)}
          tooltip="Total number of SSL certificates discovered across all F5 devices. Click to view all certificates."
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
          tooltip="Certificates with more than 30 days until expiration. These are in good standing and don't require immediate attention."
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
          tooltip="Certificates expiring within 30 days. Consider initiating renewal process for these certificates."
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard 
          title="Expired" 
          value={expired} 
          color={theme.palette.error.main} 
          icon={ErrorIcon}
          onClick={() => onFilterSelect({ type: 'status', value: 'expired' })}
          tooltip="Certificates that have already expired. These require immediate attention and renewal to avoid service disruptions."
        />
      </Grid>

      {/* NEW: Health Score Gauge */}
      <Grid item xs={12} md={4}>
        <HealthScoreGauge score={healthScore} theme={theme} />
      </Grid>

      {/* NEW: Expiration Trend Chart (12 months) */}
      <Grid item xs={12} md={8}>
        <ExpirationTrendChart certificates={certificates} theme={theme} />
      </Grid>

      {/* Expiration Timeline (existing) - Phase 2: Responsive improvements */}
      <Grid item xs={12} md={8}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Expiration Timeline
          </Typography>
          <Box sx={{ width: '100%', height: { xs: 200, sm: 250 } }}>
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

      {/* Device Stats (existing) - Phase 2: Added animations and responsive design */}
      <Grid item xs={12} md={4}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <DevicesIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
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
            <Box key={idx} sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              py: 0.5,
              px: 1,
              borderRadius: 1,
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: theme.palette.action.hover
              }
            }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                {device.name}
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                <AnimatedNumber value={device.count} duration={600 + idx * 100} />
              </Typography>
            </Box>
          ))}
        </Paper>
      </Grid>

      {/* NEW: Critical Expired Certificates */}
      <Grid item xs={12} md={6}>
        <CriticalCertificates certificates={certificates} theme={theme} navigate={navigate} />
      </Grid>

      {/* NEW: Activity Timeline */}
      <Grid item xs={12} md={6}>
        <ActivityTimeline auditStats={auditStats} theme={theme} navigate={navigate} />
      </Grid>

      {/* PHASE 3: Certificates by Site/Location */}
      <Grid item xs={12} md={6}>
        <CertificatesBySite certificates={certificates} devices={devices} theme={theme} navigate={navigate} />
      </Grid>

      {/* Health Pie Chart (existing) - Phase 2: Responsive improvements */}
      <Grid item xs={12} md={6}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Typography variant="h6" align="center" sx={{ fontWeight: 'bold', mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Certificate Health
          </Typography>
          <Box sx={{ width: '100%', height: { xs: 220, sm: 280 } }}>
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

      {/* Quick Actions Widget (existing) - Phase 2: Responsive improvements */}
      <Grid item xs={12} md={6}>
        <Paper elevation={0} sx={glassmorphicStyle}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AssignmentIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Quick Actions
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddCircleOutlineIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                onClick={() => navigate('/generate-csr')}
                sx={{ 
                  py: { xs: 1, sm: 1.5 }, 
                  justifyContent: 'flex-start',
                  borderColor: 'divider',
                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                  '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                  transition: 'all 0.2s ease'
                }}
              >
                Generate CSR
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<UploadFileIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                onClick={() => navigate('/pfx-generator')}
                sx={{ 
                  py: { xs: 1, sm: 1.5 }, 
                  justifyContent: 'flex-start',
                  borderColor: 'divider',
                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                  '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                  transition: 'all 0.2s ease'
                }}
              >
                Upload PFX
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SyncIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                onClick={() => navigate('/batch-renewal')}
                sx={{ 
                  py: { xs: 1, sm: 1.5 }, 
                  justifyContent: 'flex-start',
                  borderColor: 'divider',
                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                  '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                  transition: 'all 0.2s ease'
                }}
              >
                Batch Renewal
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<HistoryIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                onClick={() => navigate('/audit-log')}
                sx={{ 
                  py: { xs: 1, sm: 1.5 }, 
                  justifyContent: 'flex-start',
                  borderColor: 'divider',
                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                  '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                  transition: 'all 0.2s ease'
                }}
              >
                Audit Log
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      {/* Quick Stats Row (existing) */}
      <Grid item xs={12}>
        <Paper elevation={0} sx={{ ...glassmorphicStyle, py: 2 }}>
          <Grid container spacing={2} justifyContent="center">
            <Grid item xs={6} sm={4} md={3}>
              <MiniStatCard title="Critical (< 7d)" value={expirationBands.critical || 0} color={theme.palette.error.main} />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <MiniStatCard title="Urgent (8-30d)" value={expirationBands.urgent || 0} color={theme.palette.warning.main} />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <MiniStatCard title="Soon (31-60d)" value={expirationBands.soon || 0} color={theme.palette.warning.light} />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <MiniStatCard title="OK (61-90d)" value={expirationBands.ok || 0} color={theme.palette.info.main} />
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      {/* Device HA Status (existing) - Phase 2: Added animations */}
      <Grid item xs={12}>
        <Paper elevation={0} sx={{ ...glassmorphicStyle, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <DevicesIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Device HA Status
            </Typography>
          </Box>
          <Grid container spacing={2} justifyContent="center">
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <PlayArrowIcon sx={{ color: theme.palette.success.main, mr: 0.5, fontSize: { xs: 18, sm: 24 } }} />
                  <Typography variant="caption" color="text.secondary">Active</Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.success.main, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  <AnimatedNumber value={deviceStats.active || 0} duration={700} />
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <PauseIcon sx={{ color: theme.palette.grey[500], mr: 0.5, fontSize: { xs: 18, sm: 24 } }} />
                  <Typography variant="caption" color="text.secondary">Standby</Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.grey[500], fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  <AnimatedNumber value={deviceStats.standby || 0} duration={700} />
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <CheckCircleIcon sx={{ color: theme.palette.success.main, mr: 0.5, fontSize: { xs: 18, sm: 24 } }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>With Credentials</Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.success.main, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  <AnimatedNumber value={deviceStats.withCreds || 0} duration={700} />
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                  <WarningAmberIcon sx={{ color: theme.palette.warning.main, mr: 0.5, fontSize: { xs: 18, sm: 24 } }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>No Credentials</Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.warning.main, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  <AnimatedNumber value={deviceStats.withoutCreds || 0} duration={700} />
                </Typography>
              </Box>
            </Grid>
          </Grid>
          {/* Progress bar showing credential coverage */}
          {deviceStats.total > 0 && (
            <Box sx={{ px: { xs: 2, sm: 3 }, mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Credential Coverage
                </Typography>
                <Typography variant="caption" fontWeight="bold">
                  <AnimatedNumber value={Math.round((deviceStats.withCreds / deviceStats.total) * 100)} duration={800} />%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(deviceStats.withCreds / deviceStats.total) * 100}
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: theme.palette.grey[300],
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: theme.palette.success.main,
                    borderRadius: 4,
                    transition: 'transform 1s ease-out',
                  }
                }}
              />
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Dashboard;