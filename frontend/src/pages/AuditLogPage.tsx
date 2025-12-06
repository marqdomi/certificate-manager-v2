/**
 * AuditLogPage - CMT v2.5
 * 
 * Full page view for audit log with statistics and filtering.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import AuditLogTable from '../components/AuditLogTable';
import { fetchAuditStats } from '../api/audit';
import type { AuditStatsResponse } from '../types/audit';

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: `${color}15`,
            color: color,
            display: 'flex',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {value.toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const AuditLogPage: React.FC = () => {
  const [stats, setStats] = useState<AuditStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsDays, setStatsDays] = useState(7);

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await fetchAuditStats(statsDays);
        setStats(data);
      } catch (err) {
        setStatsError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [statsDays]);

  const successCount = stats?.by_result?.success || 0;
  const failureCount = (stats?.by_result?.failure || 0) + (stats?.by_result?.partial || 0);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Audit Log
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track all certificate operations, deployments, and user activity for compliance.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={statsDays}
            label="Period"
            onChange={(e) => setStatsDays(Number(e.target.value))}
          >
            <MenuItem value={1}>Last 24h</MenuItem>
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Stats Cards */}
      {statsError && <Alert severity="error" sx={{ mb: 3 }}>{statsError}</Alert>}
      
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          {statsLoading ? (
            <Card><CardContent><CircularProgress size={24} /></CardContent></Card>
          ) : (
            <StatCard
              title={`Total Events (${statsDays}d)`}
              value={stats?.total_entries || 0}
              icon={<TimelineIcon />}
              color="#2196f3"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {statsLoading ? (
            <Card><CardContent><CircularProgress size={24} /></CardContent></Card>
          ) : (
            <StatCard
              title="Successful"
              value={successCount}
              icon={<SuccessIcon />}
              color="#4caf50"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {statsLoading ? (
            <Card><CardContent><CircularProgress size={24} /></CardContent></Card>
          ) : (
            <StatCard
              title="Failures"
              value={failureCount}
              icon={<ErrorIcon />}
              color="#f44336"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {statsLoading ? (
            <Card><CardContent><CircularProgress size={24} /></CardContent></Card>
          ) : (
            <StatCard
              title="Warnings"
              value={stats?.by_result?.partial || 0}
              icon={<WarningIcon />}
              color="#ff9800"
            />
          )}
        </Grid>
      </Grid>

      {/* Action Breakdown */}
      {stats && Object.keys(stats.by_action).length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Activity by Type
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(stats.by_action)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([action, count]) => (
                  <Chip
                    key={action}
                    label={`${action.replace(/_/g, ' ')}: ${count}`}
                    variant="outlined"
                    size="small"
                  />
                ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      <AuditLogTable />
    </Container>
  );
};

export default AuditLogPage;
