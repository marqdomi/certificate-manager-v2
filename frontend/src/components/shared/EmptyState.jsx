// frontend/src/components/shared/EmptyState.jsx
// ============================================================================
// Attractive empty-state placeholder — replaces plain "No data" typography
// ============================================================================
// Usage:
//   <EmptyState
//     icon={<SearchOffIcon />}
//     title="No certificates found"
//     subtitle="Try adjusting your search filters"
//     action={<Button>Clear Filters</Button>}
//   />
// ============================================================================

import React from 'react';
import { Box, Typography, Stack, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import InboxIcon from '@mui/icons-material/Inbox';

/**
 * Visual empty-state placeholder.
 *
 * @param {object}          props
 * @param {React.ReactNode} [props.icon]      — Large icon (defaults to InboxIcon)
 * @param {string}          props.title       — Main message
 * @param {string}          [props.subtitle]  — Secondary helper text
 * @param {React.ReactNode} [props.action]    — CTA button or link
 * @param {number}          [props.minHeight=200] — Min height in px
 * @param {object}          [props.sx]        — Extra sx
 */
const EmptyState = ({
  icon,
  title = 'No data found',
  subtitle,
  action,
  minHeight = 200,
  sx = {},
}) => {
  const theme = useTheme();
  const IconComponent = icon || <InboxIcon />;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight,
        py: 6,
        ...sx,
      }}
    >
      <Stack alignItems="center" spacing={1.5}>
        {React.cloneElement(IconComponent, {
          sx: {
            fontSize: 56,
            color: alpha(theme.palette.text.secondary, 0.3),
            mb: 1,
            ...(IconComponent.props?.sx || {}),
          },
        })}
        <Typography variant="h6" fontWeight={600} color="text.secondary" textAlign="center">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={360}>
            {subtitle}
          </Typography>
        )}
        {action && <Box sx={{ mt: 1 }}>{action}</Box>}
      </Stack>
    </Box>
  );
};

export default EmptyState;
