// frontend/src/components/shared/StatCard.jsx
// ============================================================================
// Universal Stat Card — Replaces 5+ different implementations
// ============================================================================
// Variants:
//   - "kpi"     → Compact inline stat for KPI bars (InventoryPage, DevicesPage)
//   - "accent"  → Card with left colored border (HostSearchPage, CertCleanup)
//   - "glass"   → Glassmorphic card (Dashboard)
//   - "simple"  → Clean card without decoration (AuditLog, BatchRenewal)
//
// Usage:
//   <StatCard variant="kpi" label="Healthy" value={42} color="success" ... />
//   <StatCard variant="accent" title="Total" value={100} icon={<Icon />} ... />
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Paper,
  Typography,
  Tooltip,
  Stack,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { glassmorphicCard, accentCard, clickableCard } from '../../constants/styleMixins';

// ---------------------------------------------------------------------------
// Animated Number Hook (moved from Dashboard.jsx)
// ---------------------------------------------------------------------------
const useCountUp = (end, duration = 800, startOnMount = true) => {
  const [count, setCount] = React.useState(0);
  const frameRef = React.useRef(null);
  const startTime = React.useRef(null);

  React.useEffect(() => {
    if (!startOnMount || end === 0) {
      setCount(end);
      return;
    }

    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const currentValue = Math.round(eased * end);
      setCount(currentValue);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    startTime.current = null;
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, startOnMount]);

  return count;
};

// ---------------------------------------------------------------------------
// Resolve color prop → actual CSS color
// ---------------------------------------------------------------------------
// Accepts: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | '#hex'
function resolveColor(theme, color) {
  if (!color) return theme.palette.primary.main;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  return theme.palette[color]?.main ?? theme.palette.primary.main;
}

// ---------------------------------------------------------------------------
// VARIANT: KPI — Compact inline stat for filter bars
// ---------------------------------------------------------------------------
const KpiStat = ({ icon, label, value, color, onClick, active, animated, tooltip, theme }) => {
  const resolvedColor = resolveColor(theme, color);
  const isDark = theme.palette.mode === 'dark';

  const content = (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.5,
        py: 1.5,
        borderRadius: theme.customRadii?.sm ?? 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: theme.customTransitions?.fast ?? 'all 0.15s ease',
        border: '2px solid',
        borderColor: active ? resolvedColor : 'transparent',
        backgroundColor: active
          ? alpha(resolvedColor, isDark ? 0.2 : 0.1)
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.02)',
        '&:hover': onClick
          ? {
              backgroundColor: alpha(resolvedColor, isDark ? 0.15 : 0.08),
              transform: 'translateY(-2px)',
              boxShadow: `0 4px 12px ${alpha(resolvedColor, 0.25)}`,
            }
          : {},
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: theme.customRadii?.sm ?? 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(resolvedColor, 0.12),
            color: resolvedColor,
          }}
        >
          {icon}
        </Box>
      )}
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ color: resolvedColor, lineHeight: 1.2 }}>
          {animated ? <AnimatedValue value={value} /> : value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top" enterDelay={300}>
      {content}
    </Tooltip>
  ) : content;
};

// ---------------------------------------------------------------------------
// VARIANT: Accent — Card with left colored border
// ---------------------------------------------------------------------------
const AccentStat = ({ icon, title, label, value, subtitle, color, onClick, animated, tooltip, theme }) => {
  const resolvedColor = resolveColor(theme, color);
  const displayTitle = title || label;

  const content = (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        ...accentCard(theme, resolvedColor),
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {displayTitle}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ color: resolvedColor }}>
              {animated ? <AnimatedValue value={value} /> : value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                p: 1,
                borderRadius: theme.customRadii?.sm ?? 8,
                bgcolor: alpha(resolvedColor, 0.1),
                color: resolvedColor,
                display: 'flex',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top" enterDelay={300}>
      {content}
    </Tooltip>
  ) : content;
};

// ---------------------------------------------------------------------------
// VARIANT: Glass — Glassmorphic card (Dashboard style)
// ---------------------------------------------------------------------------
const GlassStat = ({ icon: Icon, title, label, value, subtitle, color, onClick, animated, tooltip, theme }) => {
  const resolvedColor = resolveColor(theme, color);
  const displayTitle = title || label;
  const isDark = theme.palette.mode === 'dark';

  const content = (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        ...glassmorphicCard(theme),
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: { xs: 100, sm: 120 },
        p: { xs: 2, sm: 2.5 },
        height: '100%',
        '&:hover': onClick
          ? {
              transform: 'translateY(-4px)',
              boxShadow: `0 10px 20px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(90, 100, 120, 0.12)'}`,
            }
          : {},
      }}
    >
      {Icon && React.isValidElement(Icon) ? (
        React.cloneElement(Icon, {
          sx: { fontSize: { xs: 28, sm: 32 }, color: resolvedColor, mb: 1, opacity: 0.8, ...(Icon.props?.sx || {}) },
        })
      ) : Icon ? (
        <Icon sx={{ fontSize: { xs: 28, sm: 32 }, color: resolvedColor, mb: 1, opacity: 0.8 }} />
      ) : null}
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
        {displayTitle}
      </Typography>
      <Typography
        variant="h3"
        component="p"
        sx={{
          fontWeight: 'bold',
          color: resolvedColor,
          fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
        }}
      >
        {animated ? <AnimatedValue value={value} /> : value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top" enterDelay={400}>
      {content}
    </Tooltip>
  ) : content;
};

// ---------------------------------------------------------------------------
// VARIANT: Simple — Clean card without decoration (AuditLog style)
// ---------------------------------------------------------------------------
const SimpleStat = ({ icon, title, label, value, subtitle, color, onClick, animated, tooltip, theme }) => {
  const resolvedColor = resolveColor(theme, color);
  const displayTitle = title || label;

  const content = (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        ...glassmorphicCard(theme),
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        p: 2,
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: theme.customShadows?.elevated ?? '0 4px 24px rgba(0,0,0,0.08)',
            }
          : {},
      }}
    >
        <Stack direction="row" spacing={2} alignItems="center">
          {icon && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: theme.customRadii?.sm ?? 8,
                bgcolor: alpha(resolvedColor, 0.1),
                color: resolvedColor,
                display: 'flex',
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ color: resolvedColor }}>
              {animated ? <AnimatedValue value={value} /> : (typeof value === 'number' ? value.toLocaleString() : value)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {displayTitle}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
    </Paper>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top" enterDelay={300}>
      {content}
    </Tooltip>
  ) : content;
};

// ---------------------------------------------------------------------------
// Animated Value Helper
// ---------------------------------------------------------------------------
const AnimatedValue = ({ value, duration = 800 }) => {
  const animatedValue = useCountUp(typeof value === 'number' ? value : 0, duration);
  return <>{animatedValue.toLocaleString()}</>;
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
/**
 * Universal StatCard component.
 *
 * @param {object} props
 * @param {'kpi'|'accent'|'glass'|'simple'} [props.variant='accent'] - Visual variant
 * @param {React.ReactNode} [props.icon] - Icon element or component
 * @param {string} [props.title] - Card title (alias: label)
 * @param {string} [props.label] - Card label (alias: title, for backward compat)
 * @param {number|string} props.value - Main value to display
 * @param {string} [props.subtitle] - Optional secondary text
 * @param {string} [props.color='primary'] - MUI palette key or hex color
 * @param {function} [props.onClick] - Click handler (makes card interactive)
 * @param {boolean} [props.active] - Whether the card is in selected/active state (kpi variant)
 * @param {boolean} [props.animated=false] - Animate the value counting up
 * @param {string} [props.tooltip] - Tooltip text
 */
const StatCard = ({
  variant = 'accent',
  animated = false,
  ...props
}) => {
  const theme = useTheme();
  const commonProps = { ...props, animated, theme };

  switch (variant) {
    case 'kpi':
      return <KpiStat {...commonProps} />;
    case 'glass':
      return <GlassStat {...commonProps} />;
    case 'simple':
      return <SimpleStat {...commonProps} />;
    case 'accent':
    default:
      return <AccentStat {...commonProps} />;
  }
};

// Also export the animation hook for external use
export { useCountUp, AnimatedValue };
export default StatCard;
