// frontend/src/components/shared/PageContainer.jsx
// ============================================================================
// Standard page wrapper — unifies Container vs Box inconsistency
// ============================================================================
// Three layout modes:
//   "full"     → No max-width, fills available space (default for data-heavy pages)
//   "compact"  → maxWidth ~900px, centred (forms, settings, PFX page)
//   "wide"     → Container maxWidth="xl" (reports, audit log)
//
// Usage:
//   <PageContainer>                         → full width
//   <PageContainer layout="compact">        → centered 900px
//   <PageContainer layout="wide">           → xl container
//   <PageContainer glassmorphic>            → wraps children in a glassmorphic Paper
// ============================================================================

import React from 'react';
import { Box, Container, Paper, useTheme } from '@mui/material';
import { glassmorphicCard } from '../../constants/styleMixins';

const PageContainer = ({
  children,
  layout = 'full',
  glassmorphic = false,
  sx = {},
  paperSx = {},
  ...rest
}) => {
  const theme = useTheme();

  // Determine the outer wrapper
  const Wrapper = layout === 'wide' ? Container : Box;
  const wrapperProps =
    layout === 'wide'
      ? { maxWidth: 'xl', sx: { py: 3, ...sx } }
      : layout === 'compact'
        ? { sx: { maxWidth: 900, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3, ...sx } }
        : { sx: { ...sx } };

  const content = glassmorphic ? (
    <Paper
      elevation={0}
      sx={{
        ...glassmorphicCard(theme),
        p: { xs: 2, sm: 3, md: 4 },
        ...paperSx,
      }}
    >
      {children}
    </Paper>
  ) : (
    children
  );

  return (
    <Wrapper {...wrapperProps} {...rest}>
      {content}
    </Wrapper>
  );
};

export default PageContainer;
