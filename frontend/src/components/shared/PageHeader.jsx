// frontend/src/components/shared/PageHeader.jsx
// ============================================================================
// Standard page header — replaces 6+ different header implementations
// ============================================================================
// Usage:
//   <PageHeader
//     title="Certificate Inventory"
//     subtitle="Manage and monitor SSL/TLS certificates"
//     icon={<SecurityIcon />}
//     actions={<Button>Refresh</Button>}
//     badge={<Chip label="Live" color="success" size="small" />}
//   />
// ============================================================================

import React from 'react';
import { Box, Typography, Stack } from '@mui/material';

/**
 * Standardised page header.
 *
 * @param {object}          props
 * @param {string}          props.title      — Main heading (h4)
 * @param {string}          [props.subtitle] — Optional secondary text
 * @param {React.ReactNode} [props.icon]     — Optional leading icon
 * @param {React.ReactNode} [props.badge]    — Inline badge next to title (e.g. Chip)
 * @param {React.ReactNode} [props.actions]  — Right-aligned action buttons
 * @param {object}          [props.sx]       — Extra sx for the outer wrapper
 */
const PageHeader = ({ title, subtitle, icon, badge, actions, sx = {} }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      mb: 3,
      ...sx,
    }}
  >
    {/* Left: icon + title block */}
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: icon ? 2 : 0 }}>
      {icon &&
        React.cloneElement(icon, {
          sx: { fontSize: 32, color: 'primary.main', mt: 0.5, ...(icon.props?.sx || {}) },
        })}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {badge}
        </Stack>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>

    {/* Right: action buttons */}
    {actions && (
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
        {actions}
      </Stack>
    )}
  </Box>
);

export default PageHeader;
