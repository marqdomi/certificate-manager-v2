// frontend/src/components/shared/InfoRow.jsx
// ============================================================================
// Label → Value row for detail drawers — replaces 2 identical copies
// ============================================================================
// Usage:
//   <InfoRow label="Common Name" value={cert.cn} copyable />
//   <InfoRow label="Serial" value={cert.serial} mono />
// ============================================================================

import React from 'react';
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { monoText } from '../../constants/styleMixins';

/**
 * Label + Value row used inside detail drawers / panels.
 *
 * @param {object}  props
 * @param {string}  props.label     — Caption label
 * @param {*}       props.value     — Displayed value (string, number, ReactNode)
 * @param {boolean} [props.copyable=false]  — Show a copy button
 * @param {boolean} [props.mono=false]      — Render value in monospace font
 * @param {object}  [props.sx]              — Extra sx for the outer Box
 */
const InfoRow = ({ label, value, copyable = false, mono = false, sx = {} }) => {
  const theme = useTheme();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silently fail — non-critical UX action
    }
  };

  return (
    <Box sx={{ mb: 1.5, ...sx }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.25, fontWeight: 500, letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            wordBreak: 'break-all',
            ...(mono ? monoText(theme) : {}),
          }}
        >
          {value ?? '—'}
        </Typography>
        {copyable && value && (
          <Tooltip title={copied ? 'Copied!' : 'Copy'} arrow>
            <IconButton size="small" onClick={handleCopy} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }} aria-label="Copy to clipboard">
              {copied ? (
                <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default InfoRow;
