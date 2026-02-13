// frontend/src/constants/styleMixins.js
// ============================================================================
// CMT Design System — Reusable Style Mixins
// ============================================================================
// Pre-built sx objects and style generators for common patterns that were
// previously copy-pasted across components. Import these instead of
// redefining the same styles in every file.
//
// These all accept a `theme` parameter so they integrate with MUI's theming.
// ============================================================================

import { alpha } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// 1. Glassmorphic Card
// ---------------------------------------------------------------------------
// Previously defined inline in: Dashboard.jsx, InventoryPage.jsx, PfxPage.jsx,
// DevicesPage.tsx, DashboardPage.jsx (5 separate copies!)

/**
 * Generate glassmorphic card styles.
 * @param {import('@mui/material').Theme} theme
 * @param {object} [options]
 * @param {number} [options.blur=12] - Blur intensity in px
 * @param {number} [options.opacity] - Background opacity (0-1)
 * @returns {object} sx-compatible style object
 */
export function glassmorphicCard(theme, { blur = 12, opacity } = {}) {
  const isDark = theme.palette.mode === 'dark';
  const bgOpacity = opacity ?? (isDark ? 0.55 : 0.65);

  return {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    backgroundColor: isDark
      ? `rgba(26, 33, 51, ${bgOpacity})`
      : `rgba(255, 255, 255, ${bgOpacity})`,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    borderRadius: theme.customRadii?.lg ?? 16,
    transition: theme.customTransitions?.standard ?? 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  };
}

// ---------------------------------------------------------------------------
// 2. Stat Card with Left Accent Border
// ---------------------------------------------------------------------------
// Previously defined inline in: HostSearchPage.jsx, CertificateCleanupPage.jsx

/**
 * Generate stat card styles with a colored left accent border.
 * @param {import('@mui/material').Theme} theme
 * @param {string} accentColor - A valid CSS color for the left accent
 * @returns {object} sx-compatible style object
 */
export function accentCard(theme, accentColor) {
  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.customRadii?.lg ?? 16,
    border: `1px solid ${theme.palette.divider}`,
    transition: theme.customTransitions?.standard ?? 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: accentColor,
      borderRadius: '4px 0 0 4px',
    },
    '&:hover': {
      boxShadow: theme.customShadows?.elevated ?? '0 4px 24px rgba(0,0,0,0.08)',
      transform: 'translateY(-2px)',
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Page Container
// ---------------------------------------------------------------------------
// Standardizes the wrapper for all page content.

/**
 * Standard page container styles.
 * @param {import('@mui/material').Theme} theme
 * @returns {object} sx-compatible style object
 */
export function pageContainer(theme) {
  return {
    px: { xs: 2, sm: 3 },
    py: { xs: 2, sm: 3 },
    maxWidth: '100%',
  };
}

// ---------------------------------------------------------------------------
// 4. Page Header
// ---------------------------------------------------------------------------

/**
 * Standard page header wrapper styles (title + actions row).
 * @returns {object} sx-compatible style object
 */
export function pageHeader() {
  return {
    display: 'flex',
    flexDirection: { xs: 'column', sm: 'row' },
    alignItems: { xs: 'flex-start', sm: 'center' },
    justifyContent: 'space-between',
    gap: 2,
    mb: 3,
  };
}

// ---------------------------------------------------------------------------
// 5. Stats Row
// ---------------------------------------------------------------------------

/**
 * Standard stats card row layout.
 * @returns {object} sx-compatible style object
 */
export function statsRow() {
  return {
    display: 'grid',
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(2, 1fr)',
      md: 'repeat(4, 1fr)',
    },
    gap: { xs: 2, sm: 3 },
    mb: 3,
  };
}

// ---------------------------------------------------------------------------
// 6. Clickable Card (for stat cards that act as filters)
// ---------------------------------------------------------------------------

/**
 * Add clickable/selectable behavior to a card.
 * @param {import('@mui/material').Theme} theme
 * @param {boolean} isSelected
 * @param {string} [accentColor] - Color when selected
 * @returns {object} sx-compatible style object
 */
export function clickableCard(theme, isSelected, accentColor) {
  const color = accentColor ?? theme.palette.primary.main;
  return {
    cursor: 'pointer',
    transition: theme.customTransitions?.fast ?? 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    borderColor: isSelected ? color : theme.palette.divider,
    boxShadow: isSelected ? `0 0 0 1px ${color}` : 'none',
    backgroundColor: isSelected ? alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.04) : 'transparent',
    '&:hover': {
      borderColor: alpha(color, 0.5),
      transform: 'translateY(-1px)',
      boxShadow: isSelected
        ? `0 0 0 1px ${color}`
        : theme.customShadows?.card ?? '0 1px 3px rgba(0,0,0,0.06)',
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Monospace Text
// ---------------------------------------------------------------------------
// Replaces the scattered `fontFamily: 'monospace'` inline styles.

/**
 * Monospace text styles for code/technical content.
 * @param {import('@mui/material').Theme} theme
 * @param {object} [options]
 * @param {string} [options.fontSize='0.8125rem']
 * @returns {object} sx-compatible style object
 */
export function monoText(theme, { fontSize = '0.8125rem' } = {}) {
  return {
    fontFamily: theme.typography.fontFamilyMono ?? '"JetBrains Mono", "Fira Code", "Consolas", monospace',
    fontSize,
    letterSpacing: '-0.01em',
  };
}

// ---------------------------------------------------------------------------
// 8. Table Column Separator
// ---------------------------------------------------------------------------
// Replaces hardcoded rgba(224, 224, 224, 0.5) and rgba(224, 224, 224, 0.3)

/**
 * Subtle column separator for DataGrid or Table cells.
 * @param {import('@mui/material').Theme} theme
 * @returns {object} sx-compatible style object
 */
export function columnSeparator(theme) {
  return {
    borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    '&:last-child': { borderRight: 'none' },
  };
}

// ---------------------------------------------------------------------------
// 9. Section Header
// ---------------------------------------------------------------------------

/**
 * Consistent section header within a page (e.g., widget title).
 * @returns {object} sx-compatible style object
 */
export function sectionHeader() {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 2,
    '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
  };
}

// ---------------------------------------------------------------------------
// 10. Gradient Background Header (e.g., CertificateCleanupPage)
// ---------------------------------------------------------------------------

/**
 * Subtle gradient background for page header areas.
 * @param {import('@mui/material').Theme} theme
 * @returns {object} sx-compatible style object
 */
export function gradientHeader(theme) {
  return {
    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
    borderRadius: theme.customRadii?.lg ?? 16,
    p: { xs: 2, sm: 3 },
    mb: 3,
    border: `1px solid ${theme.palette.divider}`,
  };
}

// ---------------------------------------------------------------------------
// 11. Hover Highlight for Action Buttons
// ---------------------------------------------------------------------------

/**
 * Generates hover background for icon buttons based on semantic color.
 * @param {string} color - CSS color value
 * @param {number} [hoverOpacity=0.1]
 * @returns {object} sx-compatible style object
 */
export function actionButtonHover(color, hoverOpacity = 0.1) {
  return {
    '&:hover': {
      backgroundColor: alpha(color, hoverOpacity),
    },
  };
}

// ---------------------------------------------------------------------------
// 12. DataGrid Standard Styles
// ---------------------------------------------------------------------------
// Replaces 3+ divergent DataGrid sx blocks (DeviceTable, CertificateTable,
// CertificateCleanupPage) with one canonical set of rules.

/**
 * Unified DataGrid styling — uppercase headers, visible column separators,
 * subtle row hover, clean focus outlines.
 * @param {import('@mui/material').Theme} theme
 * @param {object} [options]
 * @param {boolean} [options.clickableRows=false] — add pointer cursor
 * @param {boolean} [options.transparentBg=false] — transparent background
 * @returns {object} sx-compatible style object for DataGrid `sx` prop
 */
export function dataGridStyles(theme, { clickableRows = false, transparentBg = false } = {}) {
  const isDark = theme.palette.mode === 'dark';
  return {
    border: 'none',
    ...(transparentBg && { backgroundColor: 'transparent' }),
    ...(clickableRows && { cursor: 'pointer' }),

    // Column headers
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: alpha(isDark ? '#fff' : '#000', 0.02),
      borderBottom: '1px solid',
      borderColor: 'divider',
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 600,
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'text.secondary',
    },

    // Column separator (visible for resize)
    '& .MuiDataGrid-columnSeparator': {
      visibility: 'visible',
      color: alpha(theme.palette.divider, 0.5),
    },
    '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-columnSeparator': {
      color: 'primary.main',
    },

    // Rows
    '& .MuiDataGrid-row': {
      ...(clickableRows && { cursor: 'pointer' }),
      '&:hover': {
        backgroundColor: alpha(isDark ? '#fff' : '#000', 0.02),
      },
    },

    // Cells
    '& .MuiDataGrid-cell': {
      borderBottom: '1px solid',
      borderColor: alpha(isDark ? '#fff' : '#000', 0.05),
    },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
      outline: 'none',
    },

    // Footer
    '& .MuiDataGrid-footerContainer': {
      borderTop: '1px solid',
      borderColor: 'divider',
    },
  };
}
