// frontend/src/components/shared/TabPanel.jsx
// ============================================================================
// Simple TabPanel wrapper for use with MUI Tabs
// ============================================================================
// Usage:
//   <Tabs value={tab} onChange={(_, v) => setTab(v)}>
//     <Tab label="Overview" />
//     <Tab label="Details" />
//   </Tabs>
//   <TabPanel value={tab} index={0}>Overview content...</TabPanel>
//   <TabPanel value={tab} index={1}>Details content...</TabPanel>
// ============================================================================

import React from 'react';
import { Box } from '@mui/material';

/**
 * Tab panel that renders its children only when active.
 *
 * @param {object}  props
 * @param {number}  props.value   — Current active tab index
 * @param {number}  props.index   — This panel's index
 * @param {boolean} [props.keepMounted=false] — Keep DOM mounted when inactive (use for heavy content)
 * @param {object}  [props.sx]    — Extra sx
 */
const TabPanel = ({ children, value, index, keepMounted = false, sx = {}, ...rest }) => {
  const isActive = value === index;

  if (!keepMounted && !isActive) return null;

  return (
    <Box
      role="tabpanel"
      hidden={!isActive}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      sx={{ pt: 3, ...sx }}
      {...rest}
    >
      {isActive && children}
    </Box>
  );
};

/**
 * Helper function for generating a11y props for Tab/TabPanel pairs.
 * Usage: <Tab {...a11yProps(0)} />
 */
export const a11yProps = (index) => ({
  id: `tab-${index}`,
  'aria-controls': `tabpanel-${index}`,
});

export default TabPanel;
