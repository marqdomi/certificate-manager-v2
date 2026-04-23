// frontend/src/components/NotificationCenter.jsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  Button,
  Tab,
  Tabs,
  alpha,
  Avatar
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Security as SecurityIcon,
  Update as UpdateIcon,
  Clear as ClearIcon,
  MarkEmailRead as MarkReadIcon,
  Schedule as ScheduleIcon,
  CheckCircle
} from '@mui/icons-material';

const NotificationCenter = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'warning',
      category: 'certificate',
      title: 'Certificate Expiring Soon',
      message: 'SSL certificate for api.example.com expires in 15 days',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'error',
      category: 'system',
      title: 'Device Connection Failed',
      message: 'Unable to connect to F5 device prod-f5-02',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      read: false,
      priority: 'critical'
    },
    {
      id: 3,
      type: 'success',
      category: 'deployment',
      title: 'Deployment Completed',
      message: 'Certificate deployed successfully to 5 devices',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      read: true,
      priority: 'medium'
    },
    {
      id: 4,
      type: 'info',
      category: 'update',
      title: 'System Update Available',
      message: 'CMT v2.6 is now available with new features',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      read: false,
      priority: 'low'
    },
    {
      id: 5,
      type: 'warning',
      category: 'security',
      title: 'Security Alert',
      message: 'Multiple failed login attempts detected',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      read: true,
      priority: 'high'
    }
  ]);

  const open = Boolean(anchorEl);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const clearNotification = (notificationId) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  const clearAllRead = () => {
    setNotifications(prev => 
      prev.filter(notification => !notification.read)
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'success':
        return <SuccessIcon sx={{ color: 'success.main' }} />;
      case 'info':
      default:
        return <InfoIcon sx={{ color: 'info.main' }} />;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'security':
        return <SecurityIcon sx={{ fontSize: 16 }} />;
      case 'update':
        return <UpdateIcon sx={{ fontSize: 16 }} />;
      case 'deployment':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const filterNotifications = () => {
    switch (activeTab) {
      case 1: // Unread
        return notifications.filter(n => !n.read);
      case 2: // Alerts
        return notifications.filter(n => n.type === 'error' || n.type === 'warning');
      case 0: // All
      default:
        return notifications;
    }
  };

  const filteredNotifications = filterNotifications();

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="medium"
        sx={{
          ml: 1,
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: 'action.hover',
            transform: 'translateY(-1px)'
          }
        }}
      >
        <Badge 
          badgeContent={unreadCount} 
          color="error"
          sx={{
            '& .MuiBadge-badge': {
              fontWeight: 600,
              fontSize: '0.7rem'
            }
          }}
        >
          {unreadCount > 0 ? (
            <NotificationsIcon />
          ) : (
            <NotificationsOffIcon sx={{ color: 'text.secondary' }} />
          )}
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          elevation: 8,
          sx: {
            width: 400,
            maxHeight: 500,
            mt: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            background: theme => theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(32, 32, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }
        }}
      >
        <Box>
          {/* Header */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid', 
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Notifications
            </Typography>
            <Box>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={markAllAsRead}
                  startIcon={<MarkReadIcon />}
                  sx={{ mr: 1, fontSize: '0.75rem' }}
                >
                  Mark All Read
                </Button>
              )}
              <Button
                size="small"
                onClick={clearAllRead}
                startIcon={<ClearIcon />}
                sx={{ fontSize: '0.75rem' }}
              >
                Clear Read
              </Button>
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{ 
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 40,
                fontSize: '0.875rem'
              }
            }}
          >
            <Tab label={`All (${notifications.length})`} />
            <Tab label={`Unread (${unreadCount})`} />
            <Tab label="Alerts" />
          </Tabs>

          {/* Notifications List */}
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {filteredNotifications.length > 0 ? (
              <List sx={{ py: 0 }}>
                {filteredNotifications.map((notification) => (
                  <ListItem
                    key={notification.id}
                    sx={{
                      alignItems: 'flex-start',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: notification.read ? 'transparent' : alpha('#2196f3', 0.05),
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      },
                      '&:last-child': {
                        borderBottom: 'none'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ mt: 1, minWidth: 36 }}>
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: 'transparent'
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: notification.read ? 400 : 600,
                              fontSize: '0.875rem'
                            }}
                          >
                            {notification.title}
                          </Typography>
                          <Chip
                            icon={getCategoryIcon(notification.category)}
                            label={notification.category}
                            size="small"
                            variant="outlined"
                            color={getPriorityColor(notification.priority)}
                            sx={{ 
                              height: 16, 
                              fontSize: '0.6rem',
                              '& .MuiChip-icon': {
                                fontSize: 12
                              }
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ fontSize: '0.75rem', mb: 0.5 }}
                          >
                            {notification.message}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                              <ScheduleIcon sx={{ fontSize: 12 }} />
                              {formatTimestamp(notification.timestamp)}
                            </Typography>
                            <Box>
                              {!notification.read && (
                                <IconButton
                                  size="small"
                                  onClick={() => markAsRead(notification.id)}
                                  sx={{ mr: 0.5 }}
                                >
                                  <MarkReadIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              )}
                              <IconButton
                                size="small"
                                onClick={() => clearNotification(notification.id)}
                              >
                                <ClearIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <NotificationsOffIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No notifications
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;