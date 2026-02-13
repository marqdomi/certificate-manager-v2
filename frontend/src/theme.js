// frontend/src/theme.js
// ============================================================================
// CMT Design System — Theme Configuration
// ============================================================================
// Single source of truth for all visual tokens: colors, typography, spacing,
// radii, shadows, transitions, and component overrides.
//
// RULE: No component should hardcode hex/rgba colors. Everything flows from
// this theme or from `src/constants/designTokens.js`.
// ============================================================================

import { createTheme, alpha } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// 1. Brand Palette
// ---------------------------------------------------------------------------
const brand = {
  purple:     '#5A31A0',
  purpleLight:'#7B52C1',
  purpleDark: '#3F2275',
  teal:       '#0dc6e7',
  tealDark:   '#0bc0d1',
  tealLight:  '#4DD9F0',
};

// ---------------------------------------------------------------------------
// 2. Semantic Palette — per mode
// ---------------------------------------------------------------------------
const semanticLight = {
  background: { default: '#F8F9FA', paper: '#FFFFFF' },
  text:       { primary: '#1C2025', secondary: '#64748B', disabled: '#94A3B8' },
  divider:    'rgba(0, 0, 0, 0.08)',
  success:    { light: '#E8F5E9', main: '#2e7d32', dark: '#1B5E20', contrastText: '#fff' },
  warning:    { light: '#FFF3E0', main: '#ed6c02', dark: '#E65100', contrastText: '#fff' },
  error:      { light: '#FFEBEE', main: '#d32f2f', dark: '#B71C1C', contrastText: '#fff' },
  info:       { light: '#E3F2FD', main: '#0288d1', dark: '#01579B', contrastText: '#fff' },
};

const semanticDark = {
  background: { default: '#121826', paper: '#1A2133' },
  text:       { primary: '#E0E0E0', secondary: '#A0A0A0', disabled: '#666666' },
  divider:    'rgba(255, 255, 255, 0.08)',
  success:    { light: '#1B3A26', main: '#4CAF50', dark: '#81C784', contrastText: '#fff' },
  warning:    { light: '#3E2C1A', main: '#FFB74D', dark: '#FFD54F', contrastText: '#000' },
  error:      { light: '#3A1A1A', main: '#EF5350', dark: '#E57373', contrastText: '#fff' },
  info:       { light: '#1A2C3E', main: '#42A5F5', dark: '#90CAF9', contrastText: '#000' },
};

// ---------------------------------------------------------------------------
// 3. Extended Custom Palette — neutral & accent scales
// ---------------------------------------------------------------------------
const neutralLight = {
  50:  '#FAFAFA',
  100: '#F5F5F5',
  200: '#EEEEEE',
  300: '#E0E0E0',
  400: '#BDBDBD',
  500: '#9E9E9E',
  600: '#757575',
  700: '#616161',
  800: '#424242',
  900: '#212121',
};

const neutralDark = {
  50:  '#1E293B',
  100: '#253349',
  200: '#2D3D57',
  300: '#384B68',
  400: '#4B6180',
  500: '#64748B',
  600: '#94A3B8',
  700: '#B0BEC5',
  800: '#CFD8DC',
  900: '#ECEFF1',
};

// ---------------------------------------------------------------------------
// 4. Radius Scale
// ---------------------------------------------------------------------------
const radius = {
  xs: 4,
  sm: 8,
  md: 12,   // theme.shape.borderRadius default
  lg: 16,
  xl: 24,
  full: 9999,
};

// ---------------------------------------------------------------------------
// 5. Shadows
// ---------------------------------------------------------------------------
const cardShadowLight = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';
const cardShadowDark  = '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)';
const elevatedShadowLight = '0 4px 24px rgba(0,0,0,0.08)';
const elevatedShadowDark  = '0 4px 24px rgba(0,0,0,0.40)';

// ---------------------------------------------------------------------------
// 6. Transitions
// ---------------------------------------------------------------------------
const transitions = {
  fast:     'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  standard: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  slow:     'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  bounce:   'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ---------------------------------------------------------------------------
// 7. Typography Scale
// ---------------------------------------------------------------------------
const typographyBase = {
  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
  fontFamilyMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace',
  h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' },
  h3: { fontSize: '1.5rem',   fontWeight: 600, lineHeight: 1.3 },
  h4: { fontSize: '1.25rem',  fontWeight: 600, lineHeight: 1.35 },
  h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: '1rem',     fontWeight: 600, lineHeight: 1.4 },
  subtitle1:  { fontSize: '1rem',    fontWeight: 500, lineHeight: 1.5 },
  subtitle2:  { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.02em', textTransform: 'uppercase' },
  body1:      { fontSize: '1rem',     fontWeight: 400, lineHeight: 1.6 },
  body2:      { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.6 },
  caption:    { fontSize: '0.75rem',  fontWeight: 400, lineHeight: 1.5 },
  overline:   { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.08em', textTransform: 'uppercase' },
  button:     { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5, textTransform: 'none' },
};

// ---------------------------------------------------------------------------
// 8. Glassmorphic Mixin Generator
// ---------------------------------------------------------------------------
const glassmorphic = (mode) => ({
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  backgroundColor: mode === 'dark' ? 'rgba(26, 33, 51, 0.55)' : 'rgba(255, 255, 255, 0.65)',
  border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
  borderRadius: radius.lg,
  transition: transitions.standard,
});

// ---------------------------------------------------------------------------
// 9. Theme Generator
// ---------------------------------------------------------------------------
export const getDesignTokens = (mode) => {
  const isDark = mode === 'dark';
  const semantic = isDark ? semanticDark : semanticLight;
  const neutral = isDark ? neutralDark : neutralLight;

  return {
    palette: {
      mode,
      primary:   { main: brand.purple, light: brand.purpleLight, dark: brand.purpleDark, contrastText: '#fff' },
      secondary: { main: brand.teal,   light: brand.tealLight,   dark: brand.tealDark,   contrastText: '#000' },
      success:   semantic.success,
      warning:   semantic.warning,
      error:     semantic.error,
      info:      semantic.info,
      background: semantic.background,
      text:       semantic.text,
      divider:    semantic.divider,
      neutral,
      // Additional brand tokens accessible via theme.palette.brand.*
      brand,
    },

    shape: { borderRadius: radius.md },

    // Custom tokens accessible via theme.customRadii, theme.customShadows, etc.
    customRadii: radius,
    customShadows: {
      card:     isDark ? cardShadowDark     : cardShadowLight,
      elevated: isDark ? elevatedShadowDark : elevatedShadowLight,
    },
    customTransitions: transitions,

    // Glassmorphic mixin — use via theme.glassmorphic
    glassmorphic: glassmorphic(mode),

    typography: {
      ...typographyBase,
    },

    // ----- Component Overrides -----
    components: {
      // --- CssBaseline ---
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: isDark
              ? `${neutral[400]} ${neutral[100]}`
              : `${neutral[400]} ${neutral[100]}`,
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': {
              background: isDark ? neutral[100] : neutral[100],
              borderRadius: radius.full,
            },
            '&::-webkit-scrollbar-thumb': {
              background: isDark ? neutral[400] : neutral[400],
              borderRadius: radius.full,
              '&:hover': { background: isDark ? neutral[500] : neutral[500] },
            },
          },
        },
      },

      // --- CssBaseline (global a11y focus ring) ---
      MuiCssBaseline: {
        styleOverrides: {
          // Global focus-visible ring for keyboard navigation
          '*, *::before, *::after': { boxSizing: 'border-box' },
          'a:focus-visible, button:focus-visible, [tabindex]:focus-visible': {
            outline: `2px solid ${brand.teal}`,
            outlineOffset: 2,
            borderRadius: radius.xs,
          },
        },
      },

      // --- AppBar ---
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: 'none',
            ...(theme.palette.mode === 'dark'
              ? {
                  backgroundColor: 'rgba(26, 33, 51, 0.7)',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }
              : {
                  background: `linear-gradient(90deg, ${brand.purple} 0%, ${brand.tealDark} 100%)`,
                  borderBottom: 'none',
                  color: '#ffffff',
                }),
          }),
        },
      },

      // --- Button ---
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: radius.sm,
            transition: transitions.fast,
            '&:focus-visible': {
              outline: `2px solid ${brand.teal}`,
              outlineOffset: 2,
            },
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none', transform: 'translateY(-1px)' },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': { borderWidth: '1.5px' },
          },
        },
      },

      // --- Paper ---
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none', // Remove MUI default gradient overlay in dark mode
            borderRadius: radius.md,
          },
          elevation0: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      // --- Card ---
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.lg,
            border: `1px solid ${theme.palette.divider}`,
            transition: transitions.standard,
          }),
        },
      },

      // --- Chip ---
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: radius.sm,
          },
          sizeSmall: { fontSize: '0.75rem', height: 24 },
        },
      },

      // --- IconButton (a11y focus ring) ---
      MuiIconButton: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: `2px solid ${brand.teal}`,
              outlineOffset: 2,
            },
          },
        },
      },

      // --- Drawer ---
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundImage: 'none',
          }),
        },
      },

      // --- DataGrid ---
      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: 'none',
            borderRadius: radius.md,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: isDark
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.04),
              borderBottom: `1px solid ${theme.palette.divider}`,
              borderRadius: 0,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              fontSize: '0.8125rem',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${theme.palette.divider}`,
              fontSize: '0.875rem',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: isDark
                ? alpha(theme.palette.primary.main, 0.04)
                : alpha(theme.palette.primary.main, 0.02),
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: `1px solid ${theme.palette.divider}`,
            },
          }),
        },
      },

      // --- Dialog ---
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: radius.xl,
            backgroundImage: 'none',
          },
        },
      },

      // --- Tooltip ---
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: radius.sm,
            fontSize: '0.75rem',
            fontWeight: 500,
          },
        },
      },

      // --- TextField ---
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.sm,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
            },
          },
        },
      },

      // --- Tabs ---
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            minHeight: 44,
          },
        },
      },

      // --- LinearProgress ---
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: radius.full, height: 6 },
          bar:  { borderRadius: radius.full },
        },
      },

      // --- ListItemButton (Sidebar nav) ---
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radius.sm,
            mx: 1,
            my: 0.25,
            transition: transitions.fast,
            '&:focus-visible': {
              outline: `2px solid ${brand.teal}`,
              outlineOffset: -2,
            },
            '&.Mui-selected, &.active': {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08),
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '20%',
                height: '60%',
                width: 3,
                borderRadius: '0 4px 4px 0',
                backgroundColor: theme.palette.primary.main,
              },
            },
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
            },
          }),
        },
      },

      // --- Table ---
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableCell-head': {
              fontWeight: 600,
              fontSize: '0.8125rem',
              backgroundColor: isDark
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.04),
            },
          }),
        },
      },
    },
  };
};

// ---------------------------------------------------------------------------
// 10. Exported Theme Instances
// ---------------------------------------------------------------------------
export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme  = createTheme(getDesignTokens('dark'));

// Re-export for convenience
export { brand, radius, transitions, glassmorphic };