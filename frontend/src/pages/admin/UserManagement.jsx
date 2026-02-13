// frontend/src/pages/admin/UserManagement.jsx
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
  IconButton,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EngineeringIcon from '@mui/icons-material/Engineering';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';

import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '../../services/adminApi';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/shared/EmptyState';
import { SkeletonTable } from '../../components/shared/SkeletonLoaders';

const ROLES = [
  { value: 'admin', label: 'Admin', icon: <AdminPanelSettingsIcon fontSize="small" />, color: 'error' },
  { value: 'operator', label: 'Operator', icon: <EngineeringIcon fontSize="small" />, color: 'warning' },
  { value: 'viewer', label: 'Viewer', icon: <VisibilityIcon fontSize="small" />, color: 'info' },
];

const getRoleChip = (role) => {
  const roleConfig = ROLES.find(r => r.value === role) || ROLES[2];
  return (
    <Chip
      icon={roleConfig.icon}
      label={roleConfig.label}
      color={roleConfig.color}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  );
};

const UserDialog = ({ open, onClose, user, onSave, loading }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'viewer',
    is_active: true,
    password: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        full_name: user.full_name || '',
        role: user.role || 'viewer',
        is_active: user.is_active !== false,
        password: '',
      });
    } else {
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role: 'viewer',
        is_active: true,
        password: '',
      });
    }
    setErrors({});
  }, [user, open]);

  const validate = () => {
    const errs = {};
    if (!formData.username.trim()) errs.username = 'Username is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email format';
    if (!user && !formData.password) errs.password = 'Password is required for new users';
    else if (!user && formData.password.length < 8) errs.password = 'Password must be at least 8 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const data = { ...formData };
    if (user) {
      delete data.password; // Don't send empty password on update
      if (!formData.password) delete data.password;
    }
    onSave(data);
  };

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {user ? 'Edit User' : 'Create New User'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Username"
            value={formData.username}
            onChange={handleChange('username')}
            error={!!errors.username}
            helperText={errors.username}
            disabled={!!user}
            fullWidth
            required
          />
          <TextField
            label="Email"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
            required
          />
          <TextField
            label="Full Name"
            value={formData.full_name}
            onChange={handleChange('full_name')}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role}
              onChange={handleChange('role')}
              label="Role"
            >
              {ROLES.map(role => (
                <MenuItem key={role.value} value={role.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {role.icon}
                    {role.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!user && (
            <TextField
              label="Password"
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              error={!!errors.password}
              helperText={errors.password || 'Minimum 8 characters'}
              fullWidth
              required
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={handleChange('is_active')}
              />
            }
            label="Active"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : (user ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ResetPasswordDialog = ({ open, onClose, user, onReset, loading }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setError('');
  }, [open]);

  const handleSubmit = () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    onReset(password);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Reset Password for {user?.username}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            fullWidth
            required
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
            fullWidth
            required
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="warning" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Reset Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DeleteConfirmDialog = ({ open, onClose, user, onConfirm, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete User</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete user <strong>{user?.username}</strong>?
          This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const UserManagement = () => {
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const [editDialog, setEditDialog] = useState({ open: false, user: null });
  const [resetDialog, setResetDialog] = useState({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        search: search || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setSnackbar({ open: true, message: `Error loading users: ${err.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (userData) => {
    try {
      setActionLoading(true);
      await createUser(userData);
      setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
      setEditDialog({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      setSnackbar({ open: true, message: `Error creating user: ${err.response?.data?.detail || err.message}`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (userData) => {
    try {
      setActionLoading(true);
      await updateUser(editDialog.user.id, userData);
      setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
      setEditDialog({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      setSnackbar({ open: true, message: `Error updating user: ${err.response?.data?.detail || err.message}`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (newPassword) => {
    try {
      setActionLoading(true);
      await resetUserPassword(resetDialog.user.id, newPassword);
      setSnackbar({ open: true, message: 'Password reset successfully', severity: 'success' });
      setResetDialog({ open: false, user: null });
    } catch (err) {
      setSnackbar({ open: true, message: `Error resetting password: ${err.response?.data?.detail || err.message}`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setActionLoading(true);
      await deleteUser(deleteDialog.user.id);
      setSnackbar({ open: true, message: 'User deleted successfully', severity: 'success' });
      setDeleteDialog({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      setSnackbar({ open: true, message: `Error deleting user: ${err.response?.data?.detail || err.message}`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user accounts, roles, and permissions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditDialog({ open: true, user: null })}
        >
          Add User
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }} elevation={0}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            size="small"
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
              label="Role"
            >
              <MenuItem value="">All Roles</MenuItem>
              {ROLES.map(role => (
                <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchUsers} aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }} elevation={0}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Login</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                    <SkeletonTable rows={4} columns={6} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      title="No users found"
                      subtitle="Try adjusting your search or filters."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PersonIcon fontSize="small" color="primary" />
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {user.full_name || user.username}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            @{user.username}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleChip(user.role)}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Active' : 'Inactive'}
                        color={user.is_active ? 'success' : 'default'}
                        size="small"
                        variant={user.is_active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString()
                          : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => setEditDialog({ open: true, user })}
                          aria-label="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset Password">
                        <IconButton
                          size="small"
                          onClick={() => setResetDialog({ open: true, user })}
                          aria-label="Reset Password"
                        >
                          <LockResetIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog({ open: true, user })}
                            disabled={user.id === currentUser?.id}
                            aria-label="Delete"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      <UserDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, user: null })}
        user={editDialog.user}
        onSave={editDialog.user ? handleUpdateUser : handleCreateUser}
        loading={actionLoading}
      />

      <ResetPasswordDialog
        open={resetDialog.open}
        onClose={() => setResetDialog({ open: false, user: null })}
        user={resetDialog.user}
        onReset={handleResetPassword}
        loading={actionLoading}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        user={deleteDialog.user}
        onConfirm={handleDeleteUser}
        loading={actionLoading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
