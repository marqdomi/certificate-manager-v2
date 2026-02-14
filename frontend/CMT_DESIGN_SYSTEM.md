# CMT Design System — Master Reference

> **Version**: 2.5 · **Last Updated**: 2026-02-13  
> **Stack**: React 18.3 · MUI 5.15 · Vite 5 · Framer Motion · Recharts  
> **Golden standards**: `InventoryPage.jsx` · `DevicesPage.tsx`

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Border Radius](#6-border-radius)
7. [Shadows & Elevation](#7-shadows--elevation)
8. [Surfaces & Cards](#8-surfaces--cards)
9. [Shared Component Library](#9-shared-component-library)
10. [Page Anatomy](#10-page-anatomy)
11. [Data Tables](#11-data-tables)
12. [Charts & Visualizations](#12-charts--visualizations)
13. [States & Feedback](#13-states--feedback)
14. [Motion & Animation](#14-motion--animation)
15. [Accessibility](#15-accessibility)
16. [Dark Mode Contract](#16-dark-mode-contract)
17. [Do / Don't Checklist](#17-do--dont-checklist)
18. [File Map](#18-file-map)
19. [Migration Playbook](#19-migration-playbook)

---

## 1. Design Philosophy

### Core Principles

| Principle | Rule |
|---|---|
| **Single source of truth** | Every visual token lives in `theme.js` or `designTokens.js`. Zero hardcoded hex/rgba in components. |
| **Composition over duplication** | All UI primitives (cards, headers, stat widgets) are shared components imported from `components/shared/`. |
| **Semantic, not decorative** | Colors map to meaning (`success`, `warning`, `error`, `info`, `neutral`), never to aesthetics alone. |
| **Progressive disclosure** | Default state is clean and minimal. Complexity appears on hover, expand, or explicit user action. |
| **Dual-mode native** | Every surface, text, and chart renders correctly in both light and dark mode. No mode-specific CSS hacks. |

### Industry Alignment

This system follows patterns established by:

- **Grafana** / **Datadog** — 8px card radius, compact widget headers, neutral chrome
- **Linear** — Inter font, subtle borders, monochrome icons with color accents
- **Vercel** — Clean page headers, typography hierarchy, minimal shadows
- **Stripe Dashboard** — KPI stat bars, filter-as-you-click patterns, enterprise data tables

---

## 2. Architecture Overview

```
src/
├── theme.js                        ← MUI theme (colors, radii, shadows, component overrides)
├── constants/
│   ├── designTokens.js             ← Static tokens (STATUS_COLORS, CHART_COLORS, LAYOUT, RADII)
│   └── styleMixins.js              ← Reusable sx generators (glassmorphicCard, accentCard, etc.)
├── components/
│   └── shared/                     ← Component library
│       ├── index.js                ← Barrel export
│       ├── PageContainer.jsx       ← Page wrapper (full/compact/wide)
│       ├── PageHeader.jsx          ← Title + subtitle + actions row
│       ├── DashboardCard.jsx       ← Widget card for dashboards
│       ├── StatCard.jsx            ← KPI / accent / glass / simple stat cards
│       ├── StatusChip.jsx          ← Semantic status pill
│       ├── EmptyState.jsx          ← No-data placeholder
│       ├── ConfirmDialog.jsx       ← Destructive action confirmation
│       ├── AnimationWrappers.jsx   ← FadeIn, FadeInUp, Stagger, PageTransition
│       ├── SkeletonLoaders.jsx     ← Loading skeletons (stat, chart, table)
│       ├── TabPanel.jsx            ← Accessible tab panel
│       └── InfoRow.jsx             ← Label-value row for detail drawers
└── pages/                          ← Every page follows the anatomy below
```

### Import Convention

```jsx
// ✅ Always import from barrel
import { PageHeader, StatCard, EmptyState, DashboardCard } from '../components/shared';
import { glassmorphicCard, dataGridStyles } from '../constants/styleMixins';
import { STATUS_COLORS, CHART_COLORS } from '../constants/designTokens';

// ❌ Never import individual files directly (except in the barrel itself)
import StatCard from '../components/shared/StatCard';  // ← avoid
```

---

## 3. Color System

### 3.1 Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `brand.purple` | `#5A31A0` | Primary actions, AppBar gradient start, chart accent |
| `brand.purpleLight` | `#7B52C1` | Hover states, dark-mode chart series |
| `brand.purpleDark` | `#3F2275` | Pressed states |
| `brand.teal` | `#0dc6e7` | Secondary actions, AppBar gradient end, focus ring |
| `brand.tealDark` | `#0bc0d1` | Hover on secondary |
| `brand.tealLight` | `#4DD9F0` | Dark-mode secondary |

### 3.2 Semantic Palette

Access via `theme.palette.<key>.main` / `.light` / `.dark`:

| Semantic Key | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `success` | `#2e7d32` | `#4CAF50` | Healthy certs, active devices, valid states |
| `warning` | `#ed6c02` | `#FFB74D` | Expiring soon (≤30d), changes pending |
| `error` | `#d32f2f` | `#EF5350` | Expired, offline, failed operations |
| `info` | `#0288d1` | `#42A5F5` | Running scans, standalone, informational |
| `neutral` | `#757575` | `#9E9E9E` | Unknown, standby, disabled |

### 3.3 Background & Surface

| Surface | Light | Dark |
|---|---|---|
| Page background | `#F8F9FA` | `#121826` |
| Paper / card | `#FFFFFF` | `#1A2133` |
| Divider | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` |

### 3.4 Status Color Resolution

```jsx
import { STATUS_COLORS, getStatusColors, getCertDaysColor } from '../constants/designTokens';

// Generic status → { main, bg, text }
const colors = getStatusColors('success', theme.palette.mode);

// Certificate-specific (by days remaining)
const certColor = getCertDaysColor(daysLeft, theme.palette.mode);
```

### 3.5 Chart Colors

```jsx
import { getChartColors } from '../constants/designTokens';

const chartColors = getChartColors(theme.palette.mode);
// chartColors.series[0..7]   — up to 8 distinct series
// chartColors.categorical    — 6-color categorical palette
// chartColors.expiration     — expired/expiring30/expiring90/healthy/cumulative
// chartColors.pie            — donut/pie chart fills
```

**Rule**: Never use raw hex in Recharts configs. Always reference `chartColors.*`.

---

## 4. Typography

### 4.1 Scale

All typography is defined in `theme.js` → `typographyBase`:

| Variant | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `h1` | 2.25rem (36px) | 700 | 1.2 | Not used in app (reserved) |
| `h2` | 1.875rem (30px) | 700 | 1.25 | Not used in app (reserved) |
| `h3` | 1.5rem (24px) | 600 | 1.3 | Major section titles (rare) |
| `h4` | 1.25rem (20px) | 600 | 1.35 | **Page title** (`PageHeader`) |
| `h5` | 1.125rem (18px) | 600 | 1.4 | Sub-section heading |
| `h6` | 1rem (16px) | 600 | 1.4 | Card title (accent/glass variants) |
| `subtitle1` | 1rem (16px) | 500 | 1.5 | Supporting text |
| `subtitle2` | 0.875rem (14px) | 500 | 1.5 | **Dashboard card title**, uppercase, tracked |
| `body1` | 1rem (16px) | 400 | 1.6 | Primary body text |
| `body2` | 0.875rem (14px) | 400 | 1.6 | Secondary body, table cells |
| `caption` | 0.75rem (12px) | 400 | 1.5 | Timestamps, helper text |
| `overline` | 0.6875rem (11px) | 600 | 1.5 | Section labels, uppercase, wide tracking |
| `button` | 0.875rem (14px) | 600 | 1.5 | Buttons (no text-transform) |

### 4.2 Font Stacks

```
Primary:  "Inter", "Roboto", "Helvetica Neue", Arial, sans-serif
Monospace: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace
```

### 4.3 Rules

- **Page titles** → `variant="h4"` + `fontWeight: 700`
- **Dashboard widget titles** → `variant="subtitle2"` (auto uppercase via theme)
- **Table column headers** → `fontWeight: 600`, `fontSize: 0.8125rem`, `textTransform: uppercase`
- **Monospace text** (IPs, serials, cert names) → use `monoText(theme)` mixin
- **Never** use `textTransform: 'uppercase'` inline — it's built into `subtitle2` and `overline`

---

## 5. Spacing & Layout

### 5.1 Spacing Scale (MUI `theme.spacing`)

MUI default: `1 unit = 8px`

| Token | px | Usage |
|---|---|---|
| `0.5` | 4 | Micro gaps (icon ↔ text inside badge) |
| `1` | 8 | Tight gap (chip ↔ chip, icon button padding) |
| `1.5` | 12 | Dense internal padding |
| `2` | 16 | **Standard card padding** (mobile), toolbar gap |
| `2.5` | 20 | **Standard card padding** (desktop), header padding |
| `3` | 24 | **Section spacing**, page padding, grid gap |
| `4` | 32 | Dialog padding, major section gap |

### 5.2 Page Layout

```jsx
// Constants from designTokens.js
export const LAYOUT = {
  drawerWidth: 240,           // Sidebar expanded
  drawerWidthCollapsed: 64,   // Sidebar mini mode
  appBarHeight: 64,           // Top bar
  breadcrumbHeight: 40,       // Breadcrumb row (inside AppBar)
  pageMaxWidth: 'xl',         // MUI Container maxWidth
  pagePadding: { xs: 2, sm: 3 },  // px / py for page content
  sectionSpacing: 3,          // Gap between page sections (mb: 3)
  cardSpacing: 3,             // Grid gap between cards
};
```

### 5.3 Grid System

```jsx
// Standard dashboard widget grid
<Grid container spacing={3}>
  {/* Stat cards: 4 columns on desktop */}
  <Grid item xs={6} sm={6} md={3}>...</Grid>

  {/* Main charts: 8/4 or 6/6 split */}
  <Grid item xs={12} md={8}>...</Grid>
  <Grid item xs={12} md={4}>...</Grid>

  {/* Full-width widgets */}
  <Grid item xs={12}>...</Grid>
</Grid>
```

### 5.4 KPI Stat Bar

The top KPI bar uses CSS Grid (via `statsRow()` mixin), not MUI Grid:

```jsx
import { statsRow } from '../constants/styleMixins';

<Box sx={statsRow()}>
  <StatCard variant="kpi" label="Total" value={1528} ... />
  <StatCard variant="kpi" label="Healthy" value={919} color="success" ... />
  <StatCard variant="kpi" label="Expiring" value={117} color="warning" ... />
  <StatCard variant="kpi" label="Expired" value={492} color="error" ... />
</Box>
```

Grid template: `xs: 1fr` · `sm: repeat(2, 1fr)` · `md: repeat(4, 1fr)` · gap: `{xs: 2, sm: 3}`

---

## 6. Border Radius

### Current Scale

Defined in `theme.js` → `radius` and exported via `RADII` from `designTokens.js`:

| Token | px | Usage |
|---|---|---|
| `xs` (4) | 4px | Focus rings, small badges |
| **`sm` (8)** | **8px** | **Cards, Paper, DataGrid, inputs, chips, tooltips, buttons** |
| `md` (12) | 12px | Reserved (not actively used on surfaces) |
| `lg` (16) | 16px | Reserved |
| `xl` (24) | 24px | **Dialogs only** |
| `full` (9999) | pill | Scrollbar thumb, progress bars |

### Rules

- **`theme.shape.borderRadius = 8`** — MUI's global default
- **All cards, papers, inputs** → `radius.sm` (8px)
- **Dialogs** → `radius.xl` (24px) — intentionally larger for modal prominence
- **Buttons** → `radius.sm` (8px)
- **Chips** → `radius.sm` (8px)
- **Never** use `borderRadius: '50%'` for non-avatar elements
- **Never** hardcode pixel values — use `theme.customRadii.sm` or `RADII.sm`

---

## 7. Shadows & Elevation

### Philosophy: Minimal Depth

CMT uses **elevation 0** (flat) for nearly everything. Depth is communicated through **borders** and **background contrast**, not drop shadows.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `customShadows.card` | `0 1px 3px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.30)` | Hover state on accent cards |
| `customShadows.elevated` | `0 4px 24px rgba(0,0,0,0.08)` | `0 4px 24px rgba(0,0,0,0.40)` | Hover-lift on interactive cards |

### Rules

- **Default** `elevation={0}` on all `<Paper>` and `<Card>`
- Shadows appear **only on hover** for interactive cards (via `accentCard` mixin)
- AppBar uses `boxShadow: 'none'` + `backdropFilter: blur(10px)`
- Dialogs use MUI's default elevation (24) — they're the only raised surface

---

## 8. Surfaces & Cards

### 8.1 Glassmorphic Card

The signature CMT surface — semi-transparent with backdrop blur.

```jsx
import { glassmorphicCard } from '../constants/styleMixins';

<Paper elevation={0} sx={{ ...glassmorphicCard(theme), p: 3 }}>
  Content
</Paper>
```

**Properties:**
| Property | Light Mode | Dark Mode |
|---|---|---|
| Background | `rgba(255, 255, 255, 0.88)` | `rgba(26, 33, 51, 0.72)` |
| Border | `1px solid rgba(0, 0, 0, 0.10)` | `1px solid rgba(255, 255, 255, 0.12)` |
| Backdrop filter | `blur(12px)` | `blur(12px)` |
| Border radius | 8px (`sm`) | 8px (`sm`) |

**When to use**: Page wrapper, KPI bar container, dashboard widgets, data table wrapper.

### 8.2 Accent Card

Card with a colored left border — used for interactive stat cards.

```jsx
import { accentCard } from '../constants/styleMixins';

<Paper sx={{ ...accentCard(theme, theme.palette.success.main), p: 2 }}>
  Content
</Paper>
```

**Includes**: 4px left accent bar, hover lift (`translateY(-2px)`), elevated shadow on hover.

### 8.3 DashboardCard

Pre-built widget container for dashboard grids:

```jsx
import { DashboardCard } from '../components/shared';

<DashboardCard
  title="Expiration Timeline"
  icon={<TimelineIcon />}
  tooltip="Certificate expiration distribution"
  action={<Chip label="1528" size="small" />}
  divider
  contentHeight={300}
>
  <RechartsChart />
</DashboardCard>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | string | — | Card title (rendered as `subtitle2` — uppercase) |
| `icon` | ReactNode | — | Leading icon, colored by `iconColor` |
| `iconColor` | string | `'primary'` | MUI palette key or CSS color |
| `tooltip` | string | — | Info icon tooltip text |
| `action` | ReactNode | — | Right-aligned slot (Chip, Button, toggle) |
| `divider` | boolean | `false` | Show `<Divider>` below header |
| `noPadding` | boolean | `false` | Remove body padding (full-bleed charts) |
| `centerTitle` | boolean | `false` | Center-align the header row |
| `contentHeight` | number/string | — | Fixed body height (chart containers) |
| `sx` | object | `{}` | Merge onto Paper root |
| `headerSx` | object | `{}` | Merge onto header row |

**Internal layout:**
- Paper `elevation={0}` + `glassmorphicCard(theme)`
- Header: `px: {xs:2, sm:2.5}` · `pt: {xs:2, sm:2.5}` · `minHeight: 40px`
- Body: `px: {xs:2, sm:2.5}` · `pb: {xs:2, sm:2.5}` · `pt: 1.25` (when header exists)
- `height: 100%` for grid alignment

### 8.4 Surface Rules

| Context | Component | Mixin |
|---|---|---|
| Dashboard widgets | `<DashboardCard>` | built-in `glassmorphicCard` |
| Page data section | `<Paper elevation={0}>` | `glassmorphicCard(theme)` |
| Stat filter bar | `<StatCard variant="kpi">` | built-in |
| Detail drawer item | Plain `<Box>` | none — uses `theme.palette` only |
| Dialog | `<Dialog>` | theme override `radius.xl` |
| Sidebar | `<Drawer>` | theme override + `backgroundImage: 'none'` |

---

## 9. Shared Component Library

### Component Catalog

| Component | File | Purpose | Variants |
|---|---|---|---|
| `PageContainer` | `PageContainer.jsx` | Page wrapper | `full` · `compact` · `wide` · `glassmorphic` |
| `PageHeader` | `PageHeader.jsx` | Title + subtitle + actions | — |
| `DashboardCard` | `DashboardCard.jsx` | Dashboard widget card | — |
| `StatCard` | `StatCard.jsx` | Stat/KPI display | `kpi` · `accent` · `glass` · `simple` |
| `StatusChip` | `StatusChip.jsx` | Semantic status pill | `soft` · `filled` · `outlined` |
| `EmptyState` | `EmptyState.jsx` | No-data placeholder | — |
| `ConfirmDialog` | `ConfirmDialog.jsx` | Destructive action confirm | `error` · `warning` · `info` |
| `AnimationWrappers` | `AnimationWrappers.jsx` | Motion components | `FadeIn` · `FadeInUp` · `Stagger` · `PageTransition` |
| `SkeletonLoaders` | `SkeletonLoaders.jsx` | Loading placeholders | `SkeletonStatCard` · `SkeletonChart` · `SkeletonTable` · `SkeletonKpiBar` · `DashboardSkeleton` |
| `TabPanel` | `TabPanel.jsx` | Accessible tab content | — |
| `InfoRow` | `InfoRow.jsx` | Label:value row pair | — |

### Usage Patterns

#### Page Header

```jsx
<PageHeader
  title="Certificate Inventory"
  subtitle="Manage and monitor SSL/TLS certificates across your F5 infrastructure"
  icon={<SecurityIcon />}
  actions={
    <Stack direction="row" spacing={1.5}>
      <ExportButton />
      <Button variant="contained" startIcon={<RefreshIcon />}>Refresh</Button>
    </Stack>
  }
/>
```

#### StatCard Variants

```jsx
// KPI bar (InventoryPage, DevicesPage)
<StatCard variant="kpi" label="Healthy" value={919} color="success"
  icon={<CheckCircleIcon />} onClick={() => setFilter('healthy')} active={filter === 'healthy'} />

// Dashboard glass card
<StatCard variant="glass" label="Total Certificates" value={1528}
  icon={<SecurityIcon />} color="primary" />

// Accent card (HostSearch, CertCleanup)
<StatCard variant="accent" title="Virtual Servers" value={42}
  icon={<DnsIcon />} color="primary" />

// Simple card (AuditLog, Settings)
<StatCard variant="simple" label="Events Today" value={156} />
```

#### Empty States

```jsx
<EmptyState
  icon={<SearchOffIcon />}
  title="No certificates match your filters"
  subtitle="Try adjusting your search criteria or removing some filters"
  action={<Button onClick={clearFilters}>Clear All Filters</Button>}
/>
```

#### Confirm Dialogs

```jsx
<ConfirmDialog
  open={showConfirm}
  title="Delete Certificate"
  message="This will permanently remove the certificate from all F5 devices. This action cannot be undone."
  confirmLabel="Delete"
  severity="error"
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
  loading={deleting}
/>
```

---

## 10. Page Anatomy

Every page follows this exact structure. `InventoryPage.jsx` and `DevicesPage.tsx` are the canonical references.

```
┌─────────────────────────────────────────────────────┐
│  AppBar (fixed, backdrop-blur)                       │
│  ┌─ Breadcrumbs (inline) ─────────────────────────┐  │
├──┼────────────────────────────────────────────────────┤
│  │  Sidebar (68px collapsed / 256px expanded)      │  │
│  │                                                  │  │
│  │  ┌── Page Content Area ───────────────────────┐  │  │
│  │  │                                            │  │  │
│  │  │  PageHeader                                │  │  │
│  │  │  ┌────────────────────────────────────────┐│  │  │
│  │  │  │ Title  Subtitle          [Actions]    ││  │  │
│  │  │  └────────────────────────────────────────┘│  │  │
│  │  │                                            │  │  │
│  │  │  KPI Stat Bar                              │  │  │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │  │  │
│  │  │  │ 1528 │ │  919 │ │  117 │ │  492 │      │  │  │
│  │  │  │Total │ │Healthy│ │Expir.│ │Exprd │      │  │  │
│  │  │  └──────┘ └──────┘ └──────┘ └──────┘      │  │  │
│  │  │                                            │  │  │
│  │  │  Toolbar (Search | Filters | View | Export)│  │  │
│  │  │  ┌────────────────────────────────────────┐│  │  │
│  │  │  │ 🔍 Search...    [Filters] [≡][⊞] [↓] ││  │  │
│  │  │  └────────────────────────────────────────┘│  │  │
│  │  │                                            │  │  │
│  │  │  Data Content (Table / Grid / Charts)      │  │  │
│  │  │  ┌────────────────────────────────────────┐│  │  │
│  │  │  │  DataGrid / Card Grid / Chart Widget   ││  │  │
│  │  │  │  ...                                   ││  │  │
│  │  │  └────────────────────────────────────────┘│  │  │
│  │  │                                            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
└──┴──────────────────────────────────────────────────┘  │
```

### Section Order (top → bottom)

1. **PageHeader** — `h4` title, `body2` subtitle, action buttons right-aligned
2. **KPI Stat Bar** — 4 stat cards in a grid row, clickable as filters
3. **Toolbar** — Search input, filter button (drawer), view toggle, refresh timestamp, export
4. **Data Content** — DataGrid (table) or Card Grid, wrapped in glassmorphic Paper
5. **Detail Drawers** — Slide-in from right, MUI `<Drawer anchor="right">`

### Section Spacing

- PageHeader `mb: 3`
- KPI bar `mb: 3` (built into `statsRow()` mixin)
- Toolbar `mb: 2`
- Sections separated by `mb: 3`

---

## 11. Data Tables

### DataGrid Styling

Use the `dataGridStyles()` mixin for all DataGrid instances:

```jsx
import { dataGridStyles } from '../constants/styleMixins';

<DataGrid
  sx={dataGridStyles(theme, { clickableRows: true })}
  ...
/>
```

**Features provided by the mixin:**
- No border on root
- Uppercase column headers (600 weight, 0.8rem, tracked)
- Subtle header background (`alpha(primary, 0.04)`)
- Visible column separators (show on hover for resize)
- Clean row hover (`alpha(0.02)`)
- Cell borders via `alpha(divider, 0.05)`
- Clean footer separator
- Focus outline removed (keyboard nav uses row focus instead)

### Table Wrapper Pattern

```jsx
<Paper elevation={0} sx={{ ...glassmorphicCard(theme), p: 0 }}>
  <DataGrid
    sx={dataGridStyles(theme, { clickableRows: true })}
    rows={data}
    columns={columns}
    autoHeight
    disableRowSelectionOnClick
    pageSizeOptions={[10, 25, 50]}
    initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
    ...
  />
</Paper>
```

### Column Definitions

```jsx
const columns = [
  {
    field: 'name',
    headerName: 'COMMON NAME',
    flex: 1,
    minWidth: 200,
    renderCell: ({ value }) => (
      <Typography variant="body2" sx={monoText(theme)}>
        {value}
      </Typography>
    ),
  },
  {
    field: 'status',
    headerName: 'STATUS',
    width: 120,
    renderCell: ({ value }) => <StatusChip status={value} />,
  },
  {
    field: 'days_left',
    headerName: 'DAYS LEFT',
    width: 100,
    renderCell: ({ value }) => (
      <Typography
        variant="body2"
        fontWeight={600}
        color={getCertDaysMuiColor(value) + '.main'}
      >
        {value}
      </Typography>
    ),
  },
];
```

---

## 12. Charts & Visualizations

### Rules

1. **All charts wrap** in `<DashboardCard>` with `contentHeight` prop
2. **Colors** from `getChartColors(mode)` — never raw hex
3. **Tooltips** use `contentStyle` from theme:
   ```jsx
   contentStyle={{
     backgroundColor: theme.palette.background.paper,
     border: `1px solid ${theme.palette.divider}`,
     borderRadius: RADII.sm,
     fontSize: '0.8125rem',
   }}
   ```
4. **Grid lines** → `stroke={theme.palette.divider}`
5. **Axis text** → `fill={theme.palette.text.secondary}`, `fontSize: 12`
6. **Legends** → positioned below chart, `fontSize: 12`, `color: text.secondary`
7. **Responsive** → always wrap in `<ResponsiveContainer width="100%" height={...}>`

### Chart Card Pattern

```jsx
<DashboardCard
  title="Expiration Timeline"
  icon={<TimelineIcon />}
  contentHeight={300}
>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
      <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
      <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
      <RechartsTooltip contentStyle={tooltipStyle} />
      <Bar dataKey="value" fill={chartColors.series[0]} radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
</DashboardCard>
```

---

## 13. States & Feedback

### Loading States

| Content | Skeleton |
|---|---|
| Stat cards | `<SkeletonStatCard />` |
| Charts | `<SkeletonChart height={300} />` |
| Tables | `<SkeletonTable rows={6} columns={5} />` |
| KPI bar | `<SkeletonKpiBar />` |
| Full dashboard | `<DashboardSkeleton />` |

**Pattern:**
```jsx
{loading ? <SkeletonTable /> : <DataGrid ... />}
```

### Error States

```jsx
{error && (
  <Alert severity="error" sx={{ mb: 2, borderRadius: RADII.sm }}>
    {error.message || 'An unexpected error occurred'}
  </Alert>
)}
```

### Empty States

Always use `<EmptyState>` — never plain `<Typography>No data</Typography>`.

### Notifications (Snackbar)

```jsx
<Snackbar
  open={notification.open}
  autoHideDuration={4000}
  onClose={handleClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
>
  <Alert severity={notification.severity} onClose={handleClose} sx={{ borderRadius: RADII.sm }}>
    {notification.message}
  </Alert>
</Snackbar>
```

### Destructive Actions

**Always** use `<ConfirmDialog>` for:
- Delete operations
- Bulk actions
- Irreversible state changes

**Never** use `window.confirm()` or `window.alert()`.

---

## 14. Motion & Animation

### Available Wrappers

```jsx
import { FadeIn, FadeInUp, StaggerContainer, StaggerItem, PageTransition } from '../components/shared';
```

| Component | Effect | Duration | Usage |
|---|---|---|---|
| `FadeIn` | Opacity 0→1 | 400ms | Simple reveals |
| `FadeInUp` | Opacity + 20px slide-up | 450ms | Cards, sections appearing |
| `StaggerContainer` + `StaggerItem` | Parent orchestrates 70ms stagger | — | Grid of cards, list items |
| `PageTransition` | Route-level fade | 300ms | Wrap page root content |

### Rules

- **Page-level**: Wrap the return in `<PageTransition>` for smooth route transitions
- **Stat cards**: Use `<FadeInUp delay={index * 0.05}>` for left-to-right stagger
- **Grid items**: Use `<StaggerContainer>` + `<StaggerItem>` for dashboard widgets
- **Never** animate layout shifts (use `minHeight` to prevent CLS)
- **Reduce motion**: Framer Motion respects `prefers-reduced-motion` automatically

### Transitions (CSS)

```jsx
// theme.customTransitions
{
  fast:     'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',   // Hover, focus
  standard: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',   // Card transitions
  slow:     'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',   // Overlay fades
  bounce:   'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', // Playful micro-interactions
}
```

---

## 15. Accessibility

### Keyboard Navigation

- Every interactive element has a **focus-visible ring**: `2px solid teal (#0dc6e7)`, offset 2px
- Configured globally in `MuiCssBaseline` + per-component overrides
- Sidebar items: inner focus ring (`outlineOffset: -2`)

### ARIA

- `StatCard` with `onClick` → renders as `role="button"` implicitly
- `ConfirmDialog` → focus traps while open, ESC to close
- `EmptyState` → decorative icon (`aria-hidden`), screen reader reads title + subtitle
- `TabPanel` → uses `a11yProps(index)` helper for proper `id` / `aria-labelledby`
- `DashboardCard` tooltip → `aria-label` on info button

### Color Contrast

- Text on dark bg: `#E0E0E0` on `#121826` → ratio 12.6:1 ✓
- Text on light bg: `#1C2025` on `#F8F9FA` → ratio 15.2:1 ✓
- Chart palettes tested via Coblis colorblind simulator (protanopia, deuteranopia)

### Screen Reader

- Snackbar alerts: `role="alert"` (automatic via MUI Alert)
- Loading skeletons: hidden from screen readers (MUI Skeleton default)
- DataGrid: built-in ARIA grid semantics from MUI

---

## 16. Dark Mode Contract

Every surface, text, border, and icon **must** render correctly in both modes. The system guarantees this through:

| Layer | Mechanism |
|---|---|
| Background/text | `theme.palette.background.*` / `theme.palette.text.*` |
| Borders | `theme.palette.divider` (adapts per mode) |
| Semantic colors | `STATUS_COLORS[key][mode]` returns mode-aware `{main, bg, text}` |
| Charts | `getChartColors(mode)` returns brighter palette for dark |
| Glassmorphic surface | `glassmorphicCard(theme)` reads `theme.palette.mode` |
| Icons | Always use `color="text.primary"` or semantic `"success.main"` — never hardcoded |

### Testing Checklist

Before merging any page:

- [ ] Toggle dark mode — verify all text is readable
- [ ] Check chart tooltips have correct background in both modes
- [ ] Verify table header backgrounds are subtle in both modes
- [ ] Confirm status chips have visible contrast in both modes
- [ ] Test glassmorphic cards show visible borders in dark mode

---

## 17. Do / Don't Checklist

### ✅ DO

| # | Rule |
|---|---|
| 1 | Import shared components from `'../components/shared'` barrel |
| 2 | Use `glassmorphicCard(theme)` for card surfaces |
| 3 | Use `dataGridStyles(theme)` for all DataGrid instances |
| 4 | Use `STATUS_COLORS` / `getStatusColors()` for semantic color resolution |
| 5 | Use `getChartColors(mode)` for all Recharts color props |
| 6 | Use `<PageHeader>` for every page title |
| 7 | Use `<StatCard variant="kpi">` for top stat bars |
| 8 | Use `<DashboardCard>` for dashboard widget containers |
| 9 | Use `<EmptyState>` for no-data scenarios |
| 10 | Use `<ConfirmDialog>` for destructive actions |
| 11 | Use `monoText(theme)` for IPs, certs, device names |
| 12 | Use `<SkeletonTable>` / `<SkeletonChart>` during loading |
| 13 | Set `elevation={0}` on Paper/Card — use borders instead |
| 14 | Use `theme.customRadii.sm` (8px) for border radius |
| 15 | Wrap page content in `<PageTransition>` |

### ❌ DON'T

| # | Anti-Pattern | Fix |
|---|---|---|
| 1 | Hardcoded hex colors (`'#2e7d32'`) | Use `theme.palette.success.main` |
| 2 | Inline `borderRadius: 12` | Use `theme.customRadii.sm` or `RADII.sm` |
| 3 | `window.confirm()` / `window.alert()` | Use `<ConfirmDialog>` |
| 4 | `<Typography>No data</Typography>` | Use `<EmptyState>` |
| 5 | Copy-pasted glassmorphic styles | Use `glassmorphicCard(theme)` mixin |
| 6 | `elevation={2}` or higher | Use `elevation={0}` + border |
| 7 | `textTransform: 'uppercase'` inline | Use `variant="subtitle2"` or `"overline"` |
| 8 | `fontFamily: 'monospace'` | Use `monoText(theme)` mixin |
| 9 | Inline DataGrid sx styles | Use `dataGridStyles(theme)` mixin |
| 10 | Static chart colors | Use `getChartColors(mode)` |
| 11 | Manual loading skeletons | Use `<SkeletonTable>`, `<SkeletonChart>` |
| 12 | `overflow: 'hidden'` on cards | Avoid — causes text clipping |
| 13 | `borderRadius > 8px` on cards | 8px is the enterprise standard |
| 14 | Custom page title markup | Use `<PageHeader>` |
| 15 | Direct file imports from `shared/` | Use barrel `'../components/shared'` |

---

## 18. File Map

### Source of Truth Files

| File | Responsibility |
|---|---|
| `src/theme.js` | MUI theme: palette, typography, radii, shadows, transitions, component overrides |
| `src/constants/designTokens.js` | Static tokens: STATUS_COLORS, CHART_COLORS, LAYOUT, RADII, TRANSITIONS, MONO_FONT |
| `src/constants/styleMixins.js` | Reusable sx generators: glassmorphicCard, accentCard, clickableCard, dataGridStyles, etc. |
| `src/components/shared/index.js` | Barrel export for all shared UI components |

### Shared Components

| File | Export(s) |
|---|---|
| `shared/PageContainer.jsx` | `PageContainer` |
| `shared/PageHeader.jsx` | `PageHeader` |
| `shared/DashboardCard.jsx` | `DashboardCard` |
| `shared/StatCard.jsx` | `StatCard`, `useCountUp`, `AnimatedValue` |
| `shared/StatusChip.jsx` | `StatusChip` |
| `shared/EmptyState.jsx` | `EmptyState` |
| `shared/ConfirmDialog.jsx` | `ConfirmDialog` |
| `shared/AnimationWrappers.jsx` | `FadeIn`, `FadeInUp`, `StaggerContainer`, `StaggerItem`, `PageTransition`, `AnimatePresence` |
| `shared/SkeletonLoaders.jsx` | `SkeletonStatCard`, `SkeletonChart`, `SkeletonTable`, `SkeletonKpiBar`, `DashboardSkeleton` |
| `shared/TabPanel.jsx` | `TabPanel`, `a11yProps` |
| `shared/InfoRow.jsx` | `InfoRow` |

### Style Mixins

| Mixin | Import | Purpose |
|---|---|---|
| `glassmorphicCard(theme, opts?)` | `styleMixins` | Frosted glass surface |
| `accentCard(theme, color)` | `styleMixins` | Left-border accent card |
| `clickableCard(theme, isSelected, color?)` | `styleMixins` | Interactive/selectable card state |
| `pageContainer(theme)` | `styleMixins` | Page wrapper padding |
| `pageHeader()` | `styleMixins` | Title row flexbox |
| `statsRow()` | `styleMixins` | KPI bar grid |
| `monoText(theme, opts?)` | `styleMixins` | Monospace text styling |
| `columnSeparator(theme)` | `styleMixins` | Table column divider |
| `sectionHeader()` | `styleMixins` | Widget section title |
| `gradientHeader(theme)` | `styleMixins` | Gradient background section |
| `actionButtonHover(color, opacity?)` | `styleMixins` | Icon button hover bg |
| `dataGridStyles(theme, opts?)` | `styleMixins` | Unified DataGrid sx |

---

## 19. Migration Playbook

Use this checklist when standardizing an existing page to match the golden standard set by `InventoryPage.jsx` / `DevicesPage.tsx`.

### Phase 1: Structure (30 min)

- [ ] Replace page title with `<PageHeader title="..." subtitle="..." />`
- [ ] Wrap page root in `<PageTransition>` for route animation
- [ ] Replace custom stat cards with `<StatCard variant="kpi" />`
- [ ] Add `<EmptyState>` for no-data scenarios
- [ ] Replace `window.confirm()` with `<ConfirmDialog>`

### Phase 2: Surfaces (20 min)

- [ ] Replace inline glassmorphic styles with `glassmorphicCard(theme)`
- [ ] Set all `<Paper>` to `elevation={0}`
- [ ] Remove hardcoded `borderRadius` — use `theme.customRadii.sm`
- [ ] Remove `overflow: 'hidden'` from card containers

### Phase 3: Data Tables (20 min)

- [ ] Apply `dataGridStyles(theme)` to all DataGrid `sx` props
- [ ] Remove inline column header styling
- [ ] Use `<StatusChip>` for status columns
- [ ] Use `monoText(theme)` for technical text columns

### Phase 4: Colors & Tokens (15 min)

- [ ] Replace hardcoded hex with `theme.palette.*` or `STATUS_COLORS`
- [ ] Replace chart color arrays with `getChartColors(mode)`
- [ ] Replace `fontFamily: 'monospace'` with `monoText(theme)`

### Phase 5: Loading & Motion (10 min)

- [ ] Add `<Skeleton*>` loaders for loading state
- [ ] Add `<FadeInUp>` to stat cards
- [ ] Add `<StaggerContainer>` to grid layouts

### Phase 6: Verify (10 min)

- [ ] Toggle dark mode — all surfaces, text, charts correct
- [ ] Check mobile responsive behavior (≤600px)
- [ ] Verify keyboard focus rings on interactive elements
- [ ] Run `npx vite build` — zero errors
- [ ] Docker restart and visual QA

---

## Appendix A: Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│  CMT Design Quick Reference                      │
│                                                  │
│  Radius:  8px (cards) · 24px (dialogs)           │
│  Font:    Inter 14px base · JetBrains Mono       │
│  Spacing: 8px grid · 16-20px card padding        │
│  Shadows: None (borders only) · Hover lift       │
│  Surface: Glassmorphic (blur 12, 72% dark bg)    │
│  Colors:  Purple #5A31A0 · Teal #0dc6e7          │
│  Grid:    spacing={3} · xs=12 sm=6 md=3/4/6/8    │
│  Trans:   fast 150ms · standard 250ms · slow 350ms│
│                                                  │
│  Golden refs: InventoryPage · DevicesPage         │
└─────────────────────────────────────────────────┘
```

---

*This document is the single source of truth for CMT's visual language. Every new page and every page refactor must follow these specifications. When in doubt, look at `InventoryPage.jsx` and `DevicesPage.tsx` — they are the gold standard.*
