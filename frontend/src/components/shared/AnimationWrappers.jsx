// frontend/src/components/shared/AnimationWrappers.jsx
// ============================================================================
// Reusable animation wrappers powered by framer-motion.
//
//   <FadeIn>          — simple opacity fade
//   <FadeInUp>        — fade + 20px slide-up  (default for cards/sections)
//   <StaggerContainer + StaggerItem> — parent/child stagger for grids & lists
//   <PageTransition>  — wrap page content for route-level fade
//   <CountUp>         — integer counter animation
// ============================================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Shared spring config ────────────────────────────────────────────────────
const SPRING = { type: 'spring', stiffness: 260, damping: 24 };

// ── FadeIn ──────────────────────────────────────────────────────────────────
export const FadeIn = ({ children, delay = 0, duration = 0.4, ...rest }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration, delay }}
    {...rest}
  >
    {children}
  </motion.div>
);

// ── FadeInUp ────────────────────────────────────────────────────────────────
export const FadeInUp = ({ children, delay = 0, y = 20, duration = 0.45, ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration, delay, ease: [0.4, 0, 0.2, 1] }}
    {...rest}
  >
    {children}
  </motion.div>
);

// ── Stagger Container + Item ────────────────────────────────────────────────
// Usage:
//   <StaggerContainer>
//     {items.map(i => <StaggerItem key={i}><Card>…</Card></StaggerItem>)}
//   </StaggerContainer>
const staggerContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
};

export const StaggerContainer = ({ children, ...rest }) => (
  <motion.div
    variants={staggerContainerVariants}
    initial="hidden"
    animate="visible"
    {...rest}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, ...rest }) => (
  <motion.div variants={staggerItemVariants} {...rest}>
    {children}
  </motion.div>
);

// ── PageTransition ──────────────────────────────────────────────────────────
// Wrap page root content:  <PageTransition>…</PageTransition>
export const PageTransition = ({ children, ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    {...rest}
  >
    {children}
  </motion.div>
);

// Re-export AnimatePresence for route-level wrapping
export { AnimatePresence };

export default {
  FadeIn,
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  PageTransition,
  AnimatePresence,
};
