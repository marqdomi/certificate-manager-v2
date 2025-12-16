// frontend/src/components/NotificationBell.jsx
// Notification bell icon with badge and dropdown menu

import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  CircularProgress,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import SecurityIcon from '@mui/icons-material/Security';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';

import { getNotifications, getUnreadCount, markNotificationsRead, markAllNotificationsRead } from '../services/adminApi';
import { useWebSocketNotifications } from '../hooks/useWebSocketNotifications';

const PRIORITY_COLORS = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

const getNotificationIcon = (type, priority) => {
  if (priority === 'critical' || priority === 'high') {
    return <ErrorIcon color="error" fontSize="small" />;
  }
  
  switch (type) {
    case 'cert_expiring':
    case 'cert_expired':
      return <WarningIcon color="warning" fontSize="small" />;
    case 'cert_deployed':
    case 'cert_renewed':
      return <CheckCircleIcon color="success" fontSize="small" />;
    case 'security_alert':
      return <SecurityIcon color="error" fontSize="small" />;
    default:
      return <InfoIcon color="info" fontSize="small" />;
  }
};

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const NotificationBell = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [notifData, countData] = await Promise.all([
        getNotifications({ limit: 10, unread_only: false }),
        getUnreadCount(),
      ]);
      setNotifications(notifData.items || []);
      setUnreadCount(countData.count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle incoming WebSocket notification
  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 9)]);
    setUnreadCount(prev => prev + 1);
    setHasNew(true);
    
    // Reset "new" animation after 3 seconds
    setTimeout(() => setHasNew(false), 3000);
  }, []);

  // Connect to WebSocket
  const { connected } = useWebSocketNotifications(handleNewNotification);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 60 seconds as fallback
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
    setHasNew(false);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await markNotificationsRead([notificationId]);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/notifications');
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleOpen}
        sx={{
          animation: hasNew ? 'shake 0.5s ease-in-out' : 'none',
          '@keyframes shake': {
            '0%, 100%': { transform: 'rotate(0deg)' },
            '25%': { transform: 'rotate(-15deg)' },
            '75%': { transform: 'rotate(15deg)' },
          },
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.1)' },
              },
            },
          }}
        >
          {hasNew ? (
            <NotificationsActiveIcon />
          ) : (
            <NotificationsIcon />
          )}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 480,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>
            Notifications
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {connected && (
              <Chip
                size="small"
                label="Live"
                color="success"
                variant="outlined"
                sx={{ height: 20, '& .MuiChip-label': { px: 1, fontSize: '0.7rem' } }}
              />
            )}
            {unreadCount > 0 && (
              <Button
                size="small"
                startIcon={<DoneAllIcon />}
                onClick={handleMarkAllRead}
                sx={{ textTransform: 'none' }}
              >
                Mark all read
              </Button>
            )}
          </Box>
        </Box>
        <Divider />

        {/* Notifications List */}
        <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
          {loading && notifications.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No notifications</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    button
                    onClick={() => !notification.read && handleMarkRead(notification.id)}
                    sx={{
                      bgcolor: notification.read ? 'transparent' : alpha(theme.palette.primary.main, 0.05),
                      '&:hover': {
                        bgcolor: notification.read
                          ? 'action.hover'
                          : alpha(theme.palette.primary.main, 0.1),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getNotificationIcon(notification.type, notification.priority)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={notification.read ? 400 : 600}
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 200,
                            }}
                          >
                            {notification.title}
                          </Typography>
                          {notification.priority === 'critical' && (
                            <Chip
                              size="small"
                              label="Critical"
                              color="error"
                              sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' } }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {formatTimeAgo(notification.created_at)}
                          </Typography>
                        </Box>
                      }
                    />
                    {!notification.read && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          ml: 1,
                        }}
                      />
                    )}
                  </ListItem>
                  {index < notifications.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            endIcon={<OpenInNewIcon />}
            onClick={handleViewAll}
            sx={{ textTransform: 'none' }}
          >
            View all notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
};

export default NotificationBell;
