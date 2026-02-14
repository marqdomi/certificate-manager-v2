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

  if (seconds < 60) return 'hace unos segundos';
  if (minutes < 60) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (days < 7) return `hace ${days} día${days > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-ES');
};

// Priority chip component
const PriorityChip = ({ priority }) => {
  const config = {
    critical: { color: 'error', label: 'Crítico' },
    high: { color: 'warning', label: 'Alto' },
    medium: { color: 'info', label: 'Medio' },
    low: { color: 'default', label: 'Bajo' },
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
      setError('Error al cargar las notificaciones');
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
        message: `${ids.length} notificación(es) marcada(s) como leída(s)`,
        severity: 'success',
      });
      setSelected([]);
      fetchNotifications();
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error al marcar como leídas',
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
          message: 'No hay notificaciones sin leer',
          severity: 'info',
        });
        return;
      }
      await markNotificationsRead(unreadIds);
      setSnackbar({
        open: true,
        message: 'Todas las notificaciones marcadas como leídas',
        severity: 'success',
      });
      fetchNotifications();
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error al marcar todas como leídas',
        severity: 'error',
      });
    }
  };
  
  const handleDelete = async (ids = selected) => {
    try {
      await deleteNotifications(ids);
      setSnackbar({
        open: true,
        message: `${ids.length} notificación(es) eliminada(s)`,
        severity: 'success',
      });
      setSelected([]);
      fetchNotifications();
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error al eliminar notificaciones',
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
        title="Notificaciones"
        subtitle="Centro de alertas y eventos del sistema"
        badge={isConnected ? {
          label: 'Tiempo real',
          color: 'success',
        } : undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Marcar todas como leídas">
              <Button
                variant="outlined"
                startIcon={<ClearAllIcon />}
                onClick={handleMarkAllRead}
              >
                Marcar todas
              </Button>
            </Tooltip>
            <Tooltip title="Actualizar">
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
            placeholder="Buscar notificaciones..."
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
            <InputLabel>Tipo</InputLabel>
            <Select
              value={typeFilter}
              label="Tipo"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Advertencia</MenuItem>
              <MenuItem value="error">Error</MenuItem>
              <MenuItem value="success">Éxito</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Prioridad</InputLabel>
            <Select
              value={priorityFilter}
              label="Prioridad"
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="all">Todas</MenuItem>
              <MenuItem value="critical">Crítica</MenuItem>
              <MenuItem value="high">Alta</MenuItem>
              <MenuItem value="medium">Media</MenuItem>
              <MenuItem value="low">Baja</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={readFilter}
              label="Estado"
              onChange={(e) => setReadFilter(e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="unread">No leídas</MenuItem>
              <MenuItem value="read">Leídas</MenuItem>
            </Select>
          </FormControl>
          
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={handleResetFilters}
              startIcon={<FilterIcon />}
            >
              Limpiar filtros
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
              {selected.length} seleccionada(s)
            </Typography>
            <Tooltip title="Marcar como leídas">
              <IconButton onClick={() => handleMarkRead()} color="primary" aria-label="Mark as read">
                <MarkReadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
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
                <TableCell sx={{ width: 50 }}>Tipo</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Mensaje</TableCell>
                <TableCell>Prioridad</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
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
                      title="No hay notificaciones"
                      subtitle={hasActiveFilters 
                        ? 'Prueba ajustando los filtros'
                        : 'Las nuevas notificaciones aparecerán aquí'
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
                        <Tooltip title={new Date(notification.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}>
                          <Typography variant="body2" color="text.secondary">
                            {getRelativeTime(notification.created_at)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {notification.is_read ? (
                          <Chip size="small" label="Leída" variant="outlined" />
                        ) : (
                          <Chip size="small" label="Nueva" color="primary" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0} justifyContent="flex-end">
                          {!notification.is_read && (
                            <Tooltip title="Marcar como leída">
                              <IconButton
                                size="small"
                                onClick={() => handleMarkRead([notification.id])}
                                aria-label="Mark as read"
                              >
                                <MarkReadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Eliminar">
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
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      </Paper>
      
      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteIds !== null}
        severity="warning"
        title="Eliminar Notificaciones"
        message={confirmDeleteIds?.length === 1 ? '¿Eliminar esta notificación?' : `¿Eliminar ${confirmDeleteIds?.length || 0} notificación(es) seleccionada(s)?`}
        confirmLabel="Eliminar"
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
