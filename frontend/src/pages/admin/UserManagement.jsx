// frontend/src/pages/admin/UserManagement.jsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  InputAdornment,
  Switch,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { adminService } from '../../services/admin';
import { useAuth } from '../../context/AuthContext';

const UserManagement = () => {
  const { user, hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Dialog states
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'viewer',
    auth_type: 'local',
    is_active: true,
    password: '',
    confirm_password: ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadUsers();
  }, [page, rowsPerPage, searchTerm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminService.getUsers({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        search: searchTerm || undefined
      });
      
      setUsers(response.data.items || []);
      setTotalUsers(response.data.total || 0);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openCreateDialog = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      role: 'viewer',
      auth_type: 'local',
      is_active: true,
      password: '',
      confirm_password: ''
    });
    setFormErrors({});
    setEditMode(false);
    setSelectedUser(null);
    setOpenUserDialog(true);
  };

  const openEditDialog = (userToEdit) => {
    setFormData({
      username: userToEdit.username,
      email: userToEdit.email || '',
      full_name: userToEdit.full_name || '',
      role: userToEdit.role,
      auth_type: userToEdit.auth_type,
      is_active: userToEdit.is_active,
      password: '',
      confirm_password: ''
    });
    setFormErrors({});
    setEditMode(true);
    setSelectedUser(userToEdit);
    setOpenUserDialog(true);
  };

  const openDeleteConfirmDialog = (userToDelete) => {
    setSelectedUser(userToDelete);
    setOpenDeleteDialog(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!editMode && formData.auth_type === 'local') {
      if (!formData.password) {
        errors.password = 'Password is required for local users';
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long';
      }
      
      if (formData.password !== formData.confirm_password) {
        errors.confirm_password = 'Passwords do not match';
      }
    }
    
    if (editMode && formData.password && formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setDialogLoading(true);
      
      const userData = {
        username: formData.username,
        email: formData.email || null,
        full_name: formData.full_name,
        role: formData.role,
        auth_type: formData.auth_type,
        is_active: formData.is_active
      };
      
      // Only include password if it's provided
      if (formData.password) {
        userData.password = formData.password;
      }
      
      if (editMode) {
        await adminService.updateUser(selectedUser.id, userData);
      } else {
        await adminService.createUser(userData);
      }
      
      setOpenUserDialog(false);
      loadUsers(); // Refresh the list
    } catch (err) {
      console.error('Error saving user:', err);
      setError(`Failed to ${editMode ? 'update' : 'create'} user. Please try again.`);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setDialogLoading(true);
      await adminService.deleteUser(selectedUser.id);
      setOpenDeleteDialog(false);
      loadUsers(); // Refresh the list
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. Please try again.');
    } finally {
      setDialogLoading(false);
    }
  };

  const getRoleColor = (role) => {
    const roleColors = {
      super_admin: 'error',
      admin: 'warning',
      manager: 'info',
      operator: 'primary',
      analyst: 'secondary',
      support: 'default',
      viewer: 'default'
    };
    return roleColors[role] || 'default';
  };

  const getAuthTypeColor = (authType) => {
    const colors = {
      local: 'primary',
      ldap: 'secondary',
      azure_ad: 'info'
    };
    return colors[authType] || 'default';
  };

  if (!hasPermission('admin_read')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          You don't have permission to access user management.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Box display="flex" gap={2}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadUsers} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {hasPermission('admin_write') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
            >
              Add User
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search users..."
              value={searchTerm}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="textSecondary">
              {totalUsers} user{totalUsers !== 1 ? 's' : ''} found
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Full Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Auth Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              {hasPermission('admin_write') && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Loading users...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="textSecondary">
                    No users found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((userItem) => (
                <TableRow key={userItem.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {userItem.username}
                      {userItem.id === user?.id && (
                        <Chip label="You" size="small" color="primary" sx={{ ml: 1 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{userItem.full_name}</TableCell>
                  <TableCell>{userItem.email || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={adminService.formatRole(userItem.role)}
                      size="small"
                      color={getRoleColor(userItem.role)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={adminService.formatAuthType(userItem.auth_type)}
                      size="small"
                      color={getAuthTypeColor(userItem.auth_type)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {userItem.is_active ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Active"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<BlockIcon />}
                        label="Inactive"
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {userItem.last_login ? 
                      new Date(userItem.last_login).toLocaleString() : 
                      'Never'
                    }
                  </TableCell>
                  {hasPermission('admin_write') && (
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(userItem)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        {userItem.id !== user?.id && (
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => openDeleteConfirmDialog(userItem)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalUsers}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* User Create/Edit Dialog */}
      <Dialog 
        open={openUserDialog} 
        onClose={() => setOpenUserDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editMode ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                value={formData.username}
                onChange={(e) => handleFormChange('username', e.target.value)}
                error={!!formErrors.username}
                helperText={formErrors.username}
                disabled={editMode} // Username shouldn't be editable
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => handleFormChange('full_name', e.target.value)}
                error={!!formErrors.full_name}
                helperText={formErrors.full_name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => handleFormChange('role', e.target.value)}
                >
                  <MenuItem value="viewer">Viewer</MenuItem>
                  <MenuItem value="support">Support</MenuItem>
                  <MenuItem value="analyst">Analyst</MenuItem>
                  <MenuItem value="operator">Operator</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  {hasPermission('admin_write') && user?.role === 'super_admin' && (
                    <MenuItem value="super_admin">Super Admin</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Authentication Type</InputLabel>
                <Select
                  value={formData.auth_type}
                  label="Authentication Type"
                  onChange={(e) => handleFormChange('auth_type', e.target.value)}
                >
                  <MenuItem value="local">Local</MenuItem>
                  <MenuItem value="ldap">LDAP/Active Directory</MenuItem>
                  <MenuItem value="azure_ad">Azure AD</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {(formData.auth_type === 'local') && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={editMode ? "New Password (optional)" : "Password"}
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleFormChange('password', e.target.value)}
                    error={!!formErrors.password}
                    helperText={formErrors.password}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Confirm Password"
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => handleFormChange('confirm_password', e.target.value)}
                    error={!!formErrors.confirm_password}
                    helperText={formErrors.confirm_password}
                  />
                </Grid>
              </>
            )}
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleFormChange('is_active', e.target.checked)}
                  />
                }
                label="Active User"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUserDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveUser}
            disabled={dialogLoading}
          >
            {dialogLoading ? <CircularProgress size={20} /> : (editMode ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={() => setOpenDeleteDialog(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{selectedUser?.username}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDeleteUser}
            disabled={dialogLoading}
          >
            {dialogLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;