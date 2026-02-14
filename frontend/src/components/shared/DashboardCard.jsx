// frontend/src/components/shared/DashboardCard.jsx
// ============================================================================
// Universal Dashboard Widget Card — Enterprise Level
// ============================================================================
// Industry-standard dashboard card with:
//   - 8px border radius (compact, professional — matches Grafana/Datadog patterns)
//   - Compact header: 14px semibold title, 18px icon, subtle info button
//   - Consistent inner padding (16–20px), no overflow clipping
//   - height: 100% for grid alignment
//   - Reusable across every dashboard surface
//
// Usage:
//   <DashboardCard
//     title="Health Score"
//     icon={<SpeedIcon />}
//     tooltip="Overall health of your certificates"
//     action={<Chip label="68%" />}
//     divider
//   >
//     {/* chart, list, or any content */}
//   </DashboardCard>
// ============================================================================

import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { glassmorphicCard } from '../../constants/styleMixins';

/**
 * @param {object} props
 * @param {string} props.title        — Card title text
 * @param {React.ReactNode} [props.icon]     — Leading icon (colored with primary by default)
 * @param {string} [props.iconColor]  — Override icon color (MUI palette key or CSS)
 * @param {string} [props.tooltip]    — Info tooltip next to title
 * @param {React.ReactNode} [props.action]   — Trailing element: chip, button, text
 * @param {boolean} [props.divider=false]    — Show a divider below the header
 * @param {boolean} [props.noPadding=false]  — Remove body padding (for full-bleed charts)
 * @param {boolean} [props.centerTitle=false]— Center-align the title row
 * @param {object} [props.sx]        — Extra sx overrides merged onto the Paper
 * @param {React.ReactNode} props.children   — Widget body content
 * @param {object} [props.headerSx]  — Extra sx for the header row
 * @param {number|string} [props.contentHeight] — Fixed height for the body (useful for chart containers)
 */
const DashboardCard = ({
  title,
  icon,
  iconColor,
  tooltip,
  action,
  divider = false,
  noPadding = false,
  centerTitle = false,
  sx = {},
  headerSx = {},
  contentHeight,
  children,
}) => {
  const theme = useTheme();
  const resolvedIconColor = iconColor
    ? (theme.palette[iconColor]?.main || iconColor)
    : theme.palette.primary.main;

  const hasHeader = title || icon || tooltip || action;

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...glassmorphicCard(theme),
        ...sx,
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      {hasHeader && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: centerTitle ? 'center' : 'space-between',
            gap: 1,
            px: { xs: 2, sm: 2.5 },
            pt: { xs: 2, sm: 2.5 },
            minHeight: 40,
            ...headerSx,
          }}
        >
          {/* Left side: icon + title + info */}
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 0.75 }}>
            {icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  color: resolvedIconColor,
                  '& .MuiSvgIcon-root': { fontSize: 18 },
                }}
              >
                {icon}
              </Box>
            )}
            {title && (
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>
            )}
            {tooltip && (
              <Tooltip title={tooltip} arrow placement="top" enterDelay={300}>
                <IconButton
                  size="small"
                  aria-label={`${title || 'Widget'} info`}
                  sx={{ p: 0.25, ml: -0.25 }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Right side: action slot */}
          {action && !centerTitle && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {action}
            </Box>
          )}
        </Box>
      )}

      {/* Optional divider */}
      {divider && hasHeader && (
        <Divider sx={{ mx: { xs: 2, sm: 2.5 }, mt: 1.25 }} />
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          ...(noPadding
            ? {}
            : {
                px: { xs: 2, sm: 2.5 },
                pb: { xs: 2, sm: 2.5 },
                pt: hasHeader ? 1.25 : { xs: 2, sm: 2.5 },
              }),
          ...(contentHeight ? { height: contentHeight, minHeight: contentHeight } : {}),
        }}
      >
        {children}
      </Box>
    </Paper>
  );
};

export default DashboardCard;
