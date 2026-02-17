import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Toolbar,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Stack,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  MarkEmailRead as MarkReadIcon,
  FilterList as FilterIcon,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Circle as CircleIcon,
  ClearAll as ClearAllIcon,
} from '@mui/icons-material';
import { getNotifications, markNotificationsRead, deleteNotifications } from '../services/adminApi';
import useWebSocketNotifications from '../hooks/useWebSocketNotifications';
import { glassmorphicCard } from '../constants/styleMixins';
import { EmptyState, ConfirmDialog, SkeletonTable, PageHeader, PageTransition } from '../components/shared';

// Helper function to calculate time difference in relative format
const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'a few seconds ago';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US');
};

// Priority chip component
const PriorityChip = ({ priority }) => {
  const config = {
    critical: { color: 'error', label: 'Critical' },
    high: { color: 'warning', label: 'High' },
    medium: { color: 'info', label: 'Medium' },
    low: { color: 'default', label: 'Low' },
  };
  const { color, label } = config[priority] || config.medium;
  return <Chip size="small" color={color} label={label} />;
};

// Type icon component
const TypeIcon = ({ type }) => {
  const iconProps = { fontSize: 'small' };
  switch (type) {
    case 'error':
      return <ErrorIcon {...iconProps} color="error" />;
    case 'warning':
      return <WarningIcon {...iconProps} color="warning" />;
    case 'success':
      return <SuccessIcon {...iconProps} color="success" />;
    case 'info':
    default:
      return <InfoIcon {...iconProps} color="info" />;
  }
};

const NotificationsPage = () => {
  const theme = useTheme();
  
  // State
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  
  // WebSocket for real-time updates
  const { lastMessage, isConnected } = useWebSocketNotifications();
  
  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      };
      
      if (typeFilter !== 'all') params.type = typeFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (readFilter !== 'all') params.is_read = readFilter === 'read';
      if (searchTerm) params.search = searchTerm;
      
      const data = await getNotifications(params);
      setNotifications(data.items || []);
      setTotalCount(data.total || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Error loading notifications');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, typeFilter, priorityFilter, readFilter, searchTerm]);
  
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  
  // Handle real-time notification
  useEffect(() => {
    if (lastMessage) {
      // Refresh notifications when new one arrives
      fetchNotifications();
    }
  }, [lastMessage, fetchNotifications]);
  
  // Selection handlers
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(notifications.map(n => n.id));
    } else {
      setSelected([]);
    }
  };
  
  const handleSelect = (id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];
    
    if (selectedIndex === -1) {
      newSelected = [...selected, id];
    } else {
      newSelected = selected.filter(s => s !== id);
    }
    
    setSelected(newSelected);
  };
  
  const isSelected = (id) => selected.includes(id);
  
  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    setSelected([]);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    setSelected([]);
  };
  
  // Action handlers
  const handleMarkRead = async (ids = selected) => {
    try {
      await markNotificationsRead(ids);
      setSnackbar({
        open: true,
        message: `${ids.length} notification(s) marked as read`,
        severity: 'success',
      });
      setSelected([]);
      fetchNotifications();
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error marking as read',
        severity: 'error',
      });
    }
  };
  
  const handleMarkAllRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) {
        setSnackbar({
          open: true,
          message: 'No unread notifications',
          severity: 'info',
        });
        return;
      }
      await markNotificationsRead(unreadIds);
      setSnackbar({
        open: true,
        message: 'All notifications marked as read',
        severity: 'success',
      });
      fetchNotifications();
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error marking all as read',
        severity: 'error',
      });
    }
  };
  
  const handleDelete = async (ids = selected) => {
    try {
      await deleteNotifications(ids);
      setSnackbar({
        open: true,
        message: `${ids.length} notification(s) deleted`,
        severity: 'success',
      });
      setSelected([]);
      fetchNotifications();
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error deleting notifications',
        severity: 'error',
      });
    } finally {
      setConfirmDeleteIds(null);
    }
  };

  const [confirmDeleteIds, setConfirmDeleteIds] = useState(null);
  
  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setPriorityFilter('all');
    setReadFilter('all');
    setPage(0);
  };
  
  const hasActiveFilters = searchTerm || typeFilter !== 'all' || priorityFilter !== 'all' || readFilter !== 'all';
  
  return (
    <PageTransition>
      {/* Header */}
      <PageHeader
        title="Notifications"
        subtitle="System alerts and events center"
        badge={isConnected ? {
          label: 'Real-time',
          color: 'success',
        } : undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Mark all as read">
              <Button
                variant="outlined"
                startIcon={<ClearAllIcon />}
                onClick={handleMarkAllRead}
              >
                Mark all
              </Button>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchNotifications} color="primary" aria-label="Refresh notifications">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      
      {/* Filters */}
      <Paper elevation={0} sx={{ ...glassmorphicCard(theme), p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="error">Error</MenuItem>
              <MenuItem value="success">Success</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              label="Priority"
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={readFilter}
              label="Status"
              onChange={(e) => setReadFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="unread">Unread</MenuItem>
              <MenuItem value="read">Read</MenuItem>
            </Select>
          </FormControl>
          
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={handleResetFilters}
              startIcon={<FilterIcon />}
            >
              Clear filters
            </Button>
          )}
        </Stack>
      </Paper>
      
      {/* Error alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Table */}
      <Paper elevation={0} sx={{ ...glassmorphicCard(theme) }}>
        {/* Selection toolbar */}
        {selected.length > 0 && (
          <Toolbar
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography sx={{ flex: 1 }} color="primary" variant="subtitle1">
              {selected.length} selected
            </Typography>
            <Tooltip title="Mark as read">
              <IconButton onClick={() => handleMarkRead()} color="primary" aria-label="Mark as read">
                <MarkReadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton onClick={() => setConfirmDeleteIds(selected)} color="error" aria-label="Delete">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        )}
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < notifications.length}
                    checked={notifications.length > 0 && selected.length === notifications.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ width: 50 }}>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0, border: 'none' }}>
                    <SkeletonTable rows={5} columns={6} />
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      icon={<NotificationsIcon />}
                      title="No notifications"
                      subtitle={hasActiveFilters 
                        ? 'Try adjusting the filters'
                        : 'New notifications will appear here'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => {
                  const isItemSelected = isSelected(notification.id);
                  return (
                    <TableRow
                      key={notification.id}
                      hover
                      selected={isItemSelected}
                      sx={{
                        bgcolor: notification.is_read 
                          ? 'transparent' 
                          : alpha(theme.palette.primary.main, 0.04),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isItemSelected}
                          onChange={() => handleSelect(notification.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <TypeIcon type={notification.type} />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight={notification.is_read ? 'normal' : 'bold'}
                        >
                          {notification.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notification.message}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <PriorityChip priority={notification.priority} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={new Date(notification.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}>
                          <Typography variant="body2" color="text.secondary">
                            {getRelativeTime(notification.created_at)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {notification.is_read ? (
                          <Chip size="small" label="Read" variant="outlined" />
                        ) : (
                          <Chip size="small" label="New" color="primary" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0} justifyContent="flex-end">
                          {!notification.is_read && (
                            <Tooltip title="Mark as read">
                              <IconButton
                                size="small"
                                onClick={() => handleMarkRead([notification.id])}
                                aria-label="Mark as read"
                              >
                                <MarkReadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setConfirmDeleteIds([notification.id])}
                              aria-label="Delete"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Rows per page:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
          }
        />
      </Paper>
      
      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteIds !== null}
        severity="warning"
        title="Delete Notifications"
        message={confirmDeleteIds?.length === 1 ? 'Delete this notification?' : `Delete ${confirmDeleteIds?.length || 0} selected notification(s)?`}
        confirmLabel="Delete"
        onConfirm={() => handleDelete(confirmDeleteIds)}
        onCancel={() => setConfirmDeleteIds(null)}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageTransition>
  );
};

export default NotificationsPage;
