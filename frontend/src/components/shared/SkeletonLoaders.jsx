// frontend/src/components/shared/SkeletonLoaders.jsx
// ============================================================================
// Reusable skeleton placeholders for loading states
// ============================================================================
// Replaces per-page inline skeleton definitions.
//
// Usage:
//   import { SkeletonStatCard, SkeletonChart, SkeletonTable } from './shared';
//
//   {loading ? <SkeletonStatCard /> : <StatCard ... />}
//   {loading ? <SkeletonChart height={300} /> : <ChartComponent />}
// ============================================================================

import React from 'react';
import { Box, Grid, Paper, Skeleton, useTheme } from '@mui/material';
import { glassmorphicCard } from '../../constants/styleMixins';

// ---------------------------------------------------------------------------
// Stat Card Skeleton — matches the glassmorphic stat card layout
// ---------------------------------------------------------------------------
export const SkeletonStatCard = ({ variant = 'glass' }) => {
  const theme = useTheme();
  const isGlass = variant === 'glass';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        height: 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        ...(isGlass ? glassmorphicCard(theme) : {}),
      }}
    >
      <Skeleton variant="circular" width={32} height={32} sx={{ mb: 1 }} />
      <Skeleton variant="text" width={80} height={20} />
      <Skeleton variant="text" width={60} height={40} />
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Chart Skeleton — generic chart placeholder with title bar
// ---------------------------------------------------------------------------
export const SkeletonChart = ({ height = 300 }) => {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        height,
        ...glassmorphicCard(theme),
      }}
    >
      <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={height - 80}
        sx={{ borderRadius: 2 }}
      />
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Table Skeleton — rows of horizontal bars mimicking a DataGrid
// ---------------------------------------------------------------------------
export const SkeletonTable = ({ rows = 6, columns = 5 }) => {
  const theme = useTheme();

  return (
    <Paper elevation={0} sx={{ p: 2, ...glassmorphicCard(theme) }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} variant="text" width={`${100 / columns}%`} height={24} />
        ))}
      </Box>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <Box key={`r-${row}`} sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={`r-${row}-c-${col}`}
              variant="text"
              width={`${100 / columns}%`}
              height={20}
            />
          ))}
        </Box>
      ))}
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// KPI Bar Skeleton — row of compact stat pills
// ---------------------------------------------------------------------------
export const SkeletonKpiBar = ({ count = 4 }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={`kpi-${i}`}
        variant="rounded"
        width={160}
        height={60}
        sx={{ borderRadius: 3 }}
      />
    ))}
  </Box>
);

// ---------------------------------------------------------------------------
// Dashboard Full-Page Skeleton — composite placeholder
// ---------------------------------------------------------------------------
export const DashboardSkeleton = () => (
  <Grid container spacing={3}>
    {/* Top Stats */}
    {[1, 2, 3, 4].map((i) => (
      <Grid item xs={6} sm={6} md={3} key={i}>
        <SkeletonStatCard />
      </Grid>
    ))}

    {/* Health Score + Trend */}
    <Grid item xs={12} md={4}>
      <SkeletonChart height={280} />
    </Grid>
    <Grid item xs={12} md={8}>
      <SkeletonChart height={280} />
    </Grid>

    {/* Timeline + Devices */}
    <Grid item xs={12} md={8}>
      <SkeletonChart height={300} />
    </Grid>
    <Grid item xs={12} md={4}>
      <SkeletonChart height={300} />
    </Grid>

    {/* Critical + Activity */}
    <Grid item xs={12} md={6}>
      <SkeletonChart height={350} />
    </Grid>
    <Grid item xs={12} md={6}>
      <SkeletonChart height={350} />
    </Grid>
  </Grid>
);

export default {
  SkeletonStatCard,
  SkeletonChart,
  SkeletonTable,
  SkeletonKpiBar,
  DashboardSkeleton,
};
