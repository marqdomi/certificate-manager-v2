// frontend/src/components/shared/index.js
// ============================================================================
// Barrel export — shared component library
// ============================================================================
// Usage:
//   import { StatCard, PageHeader, StatusChip } from '../components/shared';
// ============================================================================

// ── Layout ──────────────────────────────────────────────────────────────────
export { default as PageContainer } from './PageContainer';
export { default as PageHeader } from './PageHeader';
export { default as TabPanel, a11yProps } from './TabPanel';

// ── Data Display ────────────────────────────────────────────────────────────
export { default as StatCard, useCountUp, AnimatedValue } from './StatCard';
export { default as StatusChip } from './StatusChip';
export { default as InfoRow } from './InfoRow';
export { default as EmptyState } from './EmptyState';

// ── Feedback ────────────────────────────────────────────────────────────────
export { default as ConfirmDialog } from './ConfirmDialog';

// ── Animation ───────────────────────────────────────────────────────────────
export {
  FadeIn,
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  PageTransition,
  AnimatePresence,
} from './AnimationWrappers';

// ── Skeleton Loaders ────────────────────────────────────────────────────────
export {
  SkeletonStatCard,
  SkeletonChart,
  SkeletonTable,
  SkeletonKpiBar,
  DashboardSkeleton,
} from './SkeletonLoaders';
