// frontend/src/components/FilterChipsBar.jsx
import React, { useState, useMemo } from 'react';
import {
  Box,
  Chip,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarIcon from '@mui/icons-material/Star';
import WarningIcon from '@mui/icons-material/Warning';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import ErrorIcon from '@mui/icons-material/Error';

const FilterChipsBar = ({ devices, filters, onFiltersChange }) => {
  const [haAnchor, setHaAnchor] = useState(null);
  const [syncAnchor, setSyncAnchor] = useState(null);
  const [siteAnchor, setSiteAnchor] = useState(null);

  // Extract unique values from devices
  const filterOptions = useMemo(() => {
    const haStates = new Set();
    const syncStatuses = new Set();
    const sites = new Set();

    devices.forEach((device) => {
      if (device.ha_state) haStates.add(device.ha_state);
      if (device.sync_status) syncStatuses.add(device.sync_status);
      if (device.site) sites.add(device.site);
    });

    return {
      haStates: Array.from(haStates).sort(),
      syncStatuses: Array.from(syncStatuses).sort(),
      sites: Array.from(sites).sort(),
    };
  }, [devices]);

  const handleFilterChange = (type, value) => {
    const newFilters = { ...filters };
    if (value === null) {
      delete newFilters[type];
    } else {
      newFilters[type] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(filters).length;

  const getHaColor = (state) => {
    if (state === 'ACTIVE') return 'success';
    if (state === 'STANDBY') return 'default';
    return 'warning';
  };

  const getSyncColor = (status) => {
    if (status?.toLowerCase().includes('in sync')) return 'success';
    if (status?.toLowerCase().includes('changes pending')) return 'warning';
    return 'error';
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 2,
        flexWrap: 'wrap',
        p: 1.5,
        borderRadius: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <Badge badgeContent={activeFilterCount} color="primary" overlap="circular">
        <FilterListIcon color="action" sx={{ mr: 1 }} />
      </Badge>

      {/* HA State Filter */}
      <Chip
        icon={<CheckCircleIcon />}
        label={filters.ha_state ? `HA: ${filters.ha_state}` : 'HA State'}
        onClick={(e) => setHaAnchor(e.currentTarget)}
        onDelete={filters.ha_state ? () => handleFilterChange('ha_state', null) : undefined}
        color={filters.ha_state ? getHaColor(filters.ha_state) : 'default'}
        variant={filters.ha_state ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.ha_state ? 600 : 400 }}
      />
      <Menu anchorEl={haAnchor} open={Boolean(haAnchor)} onClose={() => setHaAnchor(null)}>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Filter by HA State
          </Typography>
        </MenuItem>
        <Divider />
        {filterOptions.haStates.map((state) => (
          <MenuItem
            key={state}
            onClick={() => {
              handleFilterChange('ha_state', state);
              setHaAnchor(null);
            }}
            selected={filters.ha_state === state}
          >
            <ListItemIcon>
              <Chip label={state} color={getHaColor(state)} size="small" />
            </ListItemIcon>
            <ListItemText>
              {devices.filter((d) => d.ha_state === state).length} devices
            </ListItemText>
          </MenuItem>
        ))}
        {filterOptions.haStates.length === 0 && (
          <MenuItem disabled>No HA states available</MenuItem>
        )}
      </Menu>

      {/* Sync Status Filter */}
      <Chip
        icon={<SyncIcon />}
        label={filters.sync_status ? `Sync: ${filters.sync_status}` : 'Sync Status'}
        onClick={(e) => setSyncAnchor(e.currentTarget)}
        onDelete={filters.sync_status ? () => handleFilterChange('sync_status', null) : undefined}
        color={filters.sync_status ? getSyncColor(filters.sync_status) : 'default'}
        variant={filters.sync_status ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.sync_status ? 600 : 400 }}
      />
      <Menu anchorEl={syncAnchor} open={Boolean(syncAnchor)} onClose={() => setSyncAnchor(null)}>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Filter by Sync Status
          </Typography>
        </MenuItem>
        <Divider />
        {filterOptions.syncStatuses.map((status) => (
          <MenuItem
            key={status}
            onClick={() => {
              handleFilterChange('sync_status', status);
              setSyncAnchor(null);
            }}
            selected={filters.sync_status === status}
          >
            <ListItemIcon>
              <Chip label={status} color={getSyncColor(status)} size="small" />
            </ListItemIcon>
            <ListItemText>
              {devices.filter((d) => d.sync_status === status).length} devices
            </ListItemText>
          </MenuItem>
        ))}
        {filterOptions.syncStatuses.length === 0 && (
          <MenuItem disabled>No sync statuses available</MenuItem>
        )}
      </Menu>

      {/* Site Filter */}
      <Chip
        icon={<LocationOnIcon />}
        label={filters.site ? `Site: ${filters.site}` : 'Site'}
        onClick={(e) => setSiteAnchor(e.currentTarget)}
        onDelete={filters.site ? () => handleFilterChange('site', null) : undefined}
        color={filters.site ? 'primary' : 'default'}
        variant={filters.site ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.site ? 600 : 400 }}
      />
      <Menu anchorEl={siteAnchor} open={Boolean(siteAnchor)} onClose={() => setSiteAnchor(null)}>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Filter by Site
          </Typography>
        </MenuItem>
        <Divider />
        {filterOptions.sites.map((site) => (
          <MenuItem
            key={site}
            onClick={() => {
              handleFilterChange('site', site);
              setSiteAnchor(null);
            }}
            selected={filters.site === site}
          >
            <ListItemIcon>
              <LocationOnIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary={site} secondary={`${devices.filter((d) => d.site === site).length} devices`} />
          </MenuItem>
        ))}
        {filterOptions.sites.length === 0 && (
          <MenuItem disabled>No sites available</MenuItem>
        )}
      </Menu>

      {/* Primary Only Toggle */}
      <Chip
        icon={<StarIcon />}
        label="Primary Only"
        onClick={() =>
          handleFilterChange('is_primary_preferred', filters.is_primary_preferred ? null : true)
        }
        color={filters.is_primary_preferred ? 'warning' : 'default'}
        variant={filters.is_primary_preferred ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.is_primary_preferred ? 600 : 400 }}
      />

      {/* Has Credentials Toggle */}
      <Chip
        icon={<WarningIcon />}
        label="No Credentials"
        onClick={() =>
          handleFilterChange('no_credentials', filters.no_credentials ? null : true)
        }
        color={filters.no_credentials ? 'error' : 'default'}
        variant={filters.no_credentials ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.no_credentials ? 600 : 400 }}
      />

      {/* Health Status Filters */}
      <Chip
        icon={<HealthAndSafetyIcon />}
        label="Healthy"
        onClick={() =>
          handleFilterChange('health_status', filters.health_status === 'success' ? null : 'success')
        }
        color={filters.health_status === 'success' ? 'success' : 'default'}
        variant={filters.health_status === 'success' ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.health_status === 'success' ? 600 : 400 }}
      />

      <Chip
        icon={<ErrorIcon />}
        label="Failed Scan"
        onClick={() =>
          handleFilterChange('health_status', filters.health_status === 'failed' ? null : 'failed')
        }
        color={filters.health_status === 'failed' ? 'error' : 'default'}
        variant={filters.health_status === 'failed' ? 'filled' : 'outlined'}
        sx={{ fontWeight: filters.health_status === 'failed' ? 600 : 400 }}
      />

      {/* Clear All */}
      {activeFilterCount > 0 && (
        <Tooltip title="Clear all filters">
          <IconButton size="small" onClick={clearAllFilters} sx={{ ml: 1 }}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Filter Summary */}
      {activeFilterCount > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Showing filtered results
        </Typography>
      )}
    </Box>
  );
};

export default FilterChipsBar;
