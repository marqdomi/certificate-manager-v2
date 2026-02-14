// frontend/src/components/MainLayout.jsx
// ============================================================================
// Enterprise Navigation — Categorized Sidebar + Smart Navbar
// ============================================================================
// Features:
//   - Categorized sidebar (OVERVIEW, CERTIFICATE OPS, INFRASTRUCTURE, REPORTS, ADMIN)
//   - Mini sidebar (collapsed, 68px) with tooltips
//   - Badge counters: notifications, pending CSRs
//   - Active state: 3px left accent bar + alpha background
//   - Footer: app version + connection status
//   - Navbar: global search (Cmd+K), breadcrumbs, responsive hamburger
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, Divider, IconButton,
  Badge, Tooltip, useTheme, alpha, useMediaQuery, Chip,
  InputBase, Dialog, DialogContent, Fade, Paper,
} from '@mui/material';

// --- Icons ---
import DashboardIcon from '@mui/icons-material/Dashboard';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DnsIcon from '@mui/icons-material/Dns';
import BuildIcon from '@mui/icons-material/Build';
import PublishIcon from '@mui/icons-material/Publish';
import RadarIcon from '@mui/icons-material/Radar';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import SearchIcon from '@mui/icons-material/Search';
import CircleIcon from '@mui/icons-material/Circle';
import KeyboardCommandKeyIcon from '@mui/icons-material/KeyboardCommandKey';
import KeyIcon from '@mui/icons-material/Key';

// --- Components ---
import NotificationBell from './NotificationBell';
import UserAvatarMenu from './UserAvatarMenu';
import Breadcrumbs from './Breadcrumbs';
import soleraLogo from '../assets/solera_logo.svg';

// --- Context & Services ---
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../services/adminApi';
import { listPendingCSRs } from '../services/api';

// ============================================================================
// Constants
// ============================================================================
const DRAWER_WIDTH = 256;
const MINI_DRAWER_WIDTH = 68;
const NAVBAR_HEIGHT = 56;
const APP_VERSION = '2.5.0';

// ============================================================================
// Navigation Config — Categorized
// ============================================================================
const NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'OVERVIEW',
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    ],
  },
  {
    id: 'cert-ops',
    label: 'CERTIFICATE OPS',
    items: [
      { text: 'Certificates', icon: <VpnKeyIcon />, path: '/certificates', badgeKey: 'expiring' },
      { text: 'CSR Generator', icon: <AssignmentIcon />, path: '/generate-csr', badgeKey: 'pendingCSR' },
      { text: 'PFX Generator', icon: <BuildIcon />, path: '/pfx-generator' },
      { text: 'Batch Renewal', icon: <AutorenewIcon />, path: '/batch-renewal' },
      { text: 'Cert Cleanup', icon: <CleaningServicesIcon />, path: '/certificate-cleanup' },
    ],
  },
  {
    id: 'infra',
    label: 'INFRASTRUCTURE',
    items: [
      { text: 'Devices', icon: <DnsIcon />, path: '/devices' },
      { text: 'Discovery', icon: <RadarIcon />, path: '/discovery' },
      { text: 'Deploy Center', icon: <PublishIcon />, path: '/deploy' },
      { text: 'Host Search', icon: <TravelExploreIcon />, path: '/host-search' },
    ],
  },
  {
    id: 'reports',
    label: 'REPORTS',
    items: [
      { text: 'Audit Log', icon: <HistoryIcon />, path: '/audit-log' },
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications', badgeKey: 'unread' },
    ],
  },
];

const ADMIN_SECTION = {
  id: 'admin',
  label: 'ADMINISTRATION',
  items: [
    { text: 'Admin Dashboard', icon: <AdminPanelSettingsIcon />, path: '/admin' },
    { text: 'User Management', icon: <PeopleIcon />, path: '/admin/users' },
    { text: 'Credentials', icon: <KeyIcon />, path: '/admin/credentials' },
    { text: 'System Health', icon: <MonitorHeartIcon />, path: '/admin/health' },
  ],
};

// All searchable items (flat)
const ALL_NAV_ITEMS = [
  ...NAV_SECTIONS.flatMap(s => s.items.map(i => ({ ...i, section: s.label }))),
  ...ADMIN_SECTION.items.map(i => ({ ...i, section: ADMIN_SECTION.label })),
];

// ============================================================================
// Global Search Dialog (Cmd+K)
// ============================================================================
const GlobalSearchDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_NAV_ITEMS.filter(i => isAdmin || i.section !== 'ADMINISTRATION');
    const q = query.toLowerCase();
    return ALL_NAV_ITEMS
      .filter(i => isAdmin || i.section !== 'ADMINISTRATION')
      .filter(i => i.text.toLowerCase().includes(q) || i.section.toLowerCase().includes(q));
  }, [query, isAdmin]);

  const handleSelect = (path) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          mt: '10vh',
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          backgroundImage: 'none',
        },
      }}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <SearchIcon sx={{ mr: 1.5, color: 'text.secondary' }} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Search pages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].path);
              if (e.key === 'Escape') onClose();
            }}
            sx={{ fontSize: '1rem' }}
          />
          <Chip label="ESC" size="small" variant="outlined" sx={{ ml: 1, fontFamily: 'monospace', fontSize: 11 }} />
        </Box>
        <List sx={{ maxHeight: 400, overflow: 'auto', py: 0.5 }}>
          {filtered.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              No results found
            </Typography>
          )}
          {filtered.map(item => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => handleSelect(item.path)}
                sx={{ px: 2.5, py: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.text}
                  secondary={item.section}
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Sidebar Content — Reusable for permanent + mobile drawer
// ============================================================================
const SidebarContent = ({ collapsed, badges, isAdmin, onNavigate }) => {
  const theme = useTheme();
  const location = useLocation();

  const sections = useMemo(() => {
    const s = [...NAV_SECTIONS];
    if (isAdmin) s.push(ADMIN_SECTION);
    return s;
  }, [isAdmin]);

  const renderBadge = (badgeKey, children) => {
    if (!badgeKey || !badges[badgeKey]) return children;
    return (
      <Badge
        badgeContent={badges[badgeKey]}
        color={badgeKey === 'expiring' ? 'warning' : badgeKey === 'unread' ? 'error' : 'info'}
        max={99}
        sx={{
          '& .MuiBadge-badge': {
            fontSize: 10,
            height: 18,
            minWidth: 18,
            fontWeight: 700,
          },
        }}
      >
        {children}
      </Badge>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable nav area */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1, px: collapsed ? 0.5 : 0 }}>
        {sections.map((section, sIdx) => (
          <React.Fragment key={section.id}>
            {/* Section label */}
            {!collapsed && (
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  px: 2.5,
                  pt: sIdx === 0 ? 1 : 2,
                  pb: 0.5,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: section.id === 'admin' ? 'error.main' : 'text.disabled',
                  userSelect: 'none',
                }}
              >
                {section.label}
              </Typography>
            )}

            {/* Divider between sections in collapsed mode */}
            {collapsed && sIdx > 0 && (
              <Divider sx={{ my: 0.8, mx: 1 }} />
            )}

            <List disablePadding>
              {section.items.map(item => {
                const isActive = location.pathname === item.path
                  || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));

                const button = (
                  <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                      component={NavLink}
                      to={item.path}
                      onClick={onNavigate}
                      sx={{
                        minHeight: 42,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        px: collapsed ? 1.5 : 2.5,
                        py: 0.75,
                        mx: collapsed ? 0.5 : 1,
                        my: 0.2,
                        borderRadius: 2,
                        position: 'relative',
                        transition: 'all 0.15s ease',
                        // Active state: left accent bar + tinted background
                        ...(isActive && {
                          bgcolor: alpha(
                            section.id === 'admin' ? theme.palette.error.main : theme.palette.primary.main,
                            0.08
                          ),
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: '20%',
                            bottom: '20%',
                            width: 3,
                            borderRadius: '0 4px 4px 0',
                            bgcolor: section.id === 'admin' ? theme.palette.error.main : theme.palette.primary.main,
                          },
                        }),
                        '&:hover': {
                          bgcolor: isActive
                            ? alpha(
                                section.id === 'admin' ? theme.palette.error.main : theme.palette.primary.main,
                                0.12
                              )
                            : alpha(theme.palette.action.hover, 0.06),
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: collapsed ? 0 : 36,
                          mr: collapsed ? 0 : 1.5,
                          justifyContent: 'center',
                          color: isActive
                            ? (section.id === 'admin' ? 'error.main' : 'primary.main')
                            : 'text.secondary',
                          transition: 'color 0.15s',
                        }}
                      >
                        {renderBadge(item.badgeKey, item.icon)}
                      </ListItemIcon>
                      {!collapsed && (
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{
                            fontSize: '0.84rem',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive
                              ? (section.id === 'admin' ? 'error.main' : 'text.primary')
                              : 'text.secondary',
                            noWrap: true,
                          }}
                        />
                      )}
                      {/* Badge count chip (expanded mode only) */}
                      {!collapsed && item.badgeKey && badges[item.badgeKey] > 0 && (
                        <Chip
                          label={badges[item.badgeKey] > 99 ? '99+' : badges[item.badgeKey]}
                          size="small"
                          color={item.badgeKey === 'expiring' ? 'warning' : item.badgeKey === 'unread' ? 'error' : 'info'}
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            '& .MuiChip-label': { px: 0.8 },
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );

                // Wrap in tooltip when collapsed
                return collapsed ? (
                  <Tooltip key={item.text} title={item.text} placement="right" arrow>
                    {button}
                  </Tooltip>
                ) : (
                  <React.Fragment key={item.text}>{button}</React.Fragment>
                );
              })}
            </List>
          </React.Fragment>
        ))}
      </Box>

      {/* Footer: version + connection status */}
      <Box
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          px: collapsed ? 1 : 2,
          py: 1.5,
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 0.5,
        }}
      >
        {!collapsed && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
            CMT v{APP_VERSION}
          </Typography>
        )}
        <Tooltip title={collapsed ? `CMT v${APP_VERSION} — Connected` : 'Connected'} placement="right">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CircleIcon sx={{ fontSize: 8, color: 'success.main' }} />
            {!collapsed && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                Online
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main Layout
// ============================================================================
const MainLayout = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Responsive
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

  // Sidebar state
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('cmt-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Search dialog
  const [searchOpen, setSearchOpen] = useState(false);

  // Badge data
  const [badges, setBadges] = useState({ unread: 0, expiring: 0, pendingCSR: 0 });

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('cmt-sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  // Auto-collapse on tablet
  useEffect(() => {
    if (isTablet && !collapsed) setCollapsed(true);
  }, [isTablet]);

  // Fetch badge counts
  const fetchBadges = useCallback(async () => {
    try {
      const [unreadData, csrData] = await Promise.allSettled([
        getUnreadCount(),
        listPendingCSRs('pending'),
      ]);
      setBadges(prev => ({
        ...prev,
        unread: unreadData.status === 'fulfilled' ? (unreadData.value?.count || 0) : prev.unread,
        pendingCSR: csrData.status === 'fulfilled' ? (Array.isArray(csrData.value) ? csrData.value.length : 0) : prev.pendingCSR,
      }));
    } catch {
      // Fail silently
    }
  }, []);

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Computed drawer width
  const currentDrawerWidth = isMobile ? 0 : (collapsed ? MINI_DRAWER_WIDTH : DRAWER_WIDTH);

  const handleMobileClose = () => setMobileOpen(false);

  const drawerContent = (
    <SidebarContent
      collapsed={isMobile ? false : collapsed}
      badges={badges}
      isAdmin={isAdmin}
      onNavigate={isMobile ? handleMobileClose : undefined}
    />
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ================================================================ */}
      {/* AppBar / Navbar                                                   */}
      {/* ================================================================ */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          ml: `${currentDrawerWidth}px`,
          width: `calc(100% - ${currentDrawerWidth}px)`,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: `${NAVBAR_HEIGHT}px !important`, px: { xs: 1.5, sm: 2 } }}>
          {/* Mobile hamburger */}
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Desktop collapse toggle */}
          {!isMobile && (
            <IconButton
              color="inherit"
              onClick={() => setCollapsed(prev => !prev)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              sx={{ mr: 1 }}
            >
              {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
            </IconButton>
          )}

          {/* Logo + Title */}
          <Box
            component="img"
            sx={{ height: 22, mr: 1.5, display: { xs: 'none', sm: 'block' } }}
            alt="Solera Logo"
            src={soleraLogo}
          />
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              letterSpacing: '-0.01em',
              mr: 2,
            }}
          >
            CMT
          </Typography>

          {/* Breadcrumbs (desktop only) */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 1, alignItems: 'center' }}>
            <Breadcrumbs />
          </Box>

          {/* Spacer on mobile */}
          <Box sx={{ flexGrow: 1, display: { md: 'none' } }} />

          {/* Global Search Button */}
          <Tooltip title="Search (⌘K)">
            <Box
              onClick={() => setSearchOpen(true)}
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                mr: 1,
                borderRadius: 2,
                bgcolor: alpha('#fff', 0.1),
                border: `1px solid ${alpha('#fff', 0.2)}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: alpha('#fff', 0.18) },
                minWidth: 180,
              }}
            >
              <SearchIcon sx={{ fontSize: 18, opacity: 0.8 }} />
              <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.8rem', flexGrow: 1 }}>
                Search...
              </Typography>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.3,
                px: 0.6, py: 0.1, borderRadius: 1,
                bgcolor: alpha('#fff', 0.12),
                fontSize: '0.65rem', fontFamily: 'monospace',
              }}>
                <KeyboardCommandKeyIcon sx={{ fontSize: 12 }} />
                K
              </Box>
            </Box>
          </Tooltip>

          {/* Mobile search icon */}
          <IconButton
            color="inherit"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            sx={{ display: { sm: 'none' } }}
          >
            <SearchIcon />
          </IconButton>

          {/* Notification Bell */}
          <NotificationBell />

          {/* User Avatar Menu */}
          <UserAvatarMenu />
        </Toolbar>
      </AppBar>

      {/* ================================================================ */}
      {/* Mobile Drawer (temporary)                                         */}
      {/* ================================================================ */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              backgroundImage: 'none',
            },
          }}
        >
          {/* Mobile logo header */}
          <Toolbar sx={{ minHeight: `${NAVBAR_HEIGHT}px !important` }}>
            <Box component="img" sx={{ height: 22, mr: 1.5 }} alt="Solera Logo" src={soleraLogo} />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Certificate Manager
            </Typography>
          </Toolbar>
          <Divider />
          {drawerContent}
        </Drawer>
      )}

      {/* ================================================================ */}
      {/* Desktop Drawer (permanent, collapsible)                           */}
      {/* ================================================================ */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              backgroundImage: 'none',
              borderRight: `1px solid ${theme.palette.divider}`,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {/* Spacer for AppBar */}
          <Toolbar sx={{ minHeight: `${NAVBAR_HEIGHT}px !important` }} />
          {drawerContent}
        </Drawer>
      )}

      {/* ================================================================ */}
      {/* Main Content Area                                                 */}
      {/* ================================================================ */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          p: { xs: 2, sm: 3 },
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: `${NAVBAR_HEIGHT}px !important` }} />
        {/* Breadcrumbs on mobile (below navbar) */}
        <Box sx={{ display: { md: 'none' }, mb: 1 }}>
          <Breadcrumbs />
        </Box>
        {children}
      </Box>

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
};

export default MainLayout;