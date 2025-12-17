/**
 * HostSearchPage - Search for hostnames across F5 devices
 * 
 * Useful for decommissioning tasks where you need to find all references
 * to specific servers across your F5 infrastructure.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Divider,
  Card,
  CardContent,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
  Badge,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Dns as DnsIcon,
  Router as RouterIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  TableChart as TableIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Clear as ClearIcon,
  ContentPaste as PasteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';

// Category icons and colors
const CATEGORY_CONFIG = {
  virtual_servers: { icon: RouterIcon, label: 'Virtual Servers', color: '#2196f3' },
  pools: { icon: StorageIcon, label: 'Pools', color: '#4caf50' },
  pool_members: { icon: DnsIcon, label: 'Pool Members', color: '#ff9800' },
  nodes: { icon: DnsIcon, label: 'Nodes', color: '#9c27b0' },
  irules: { icon: CodeIcon, label: 'iRules', color: '#f44336' },
  data_groups: { icon: TableIcon, label: 'Data Groups', color: '#607d8b' },
};

export default function HostSearchPage() {
  const [searchText, setSearchText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedDevices, setExpandedDevices] = useState({});

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const { data } = await apiClient.get('/devices');
      setDevices(data || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const parseSearchTerms = (text) => {
    // Split by newlines, commas, or spaces and filter empty
    return text
      .split(/[\n,\s]+/)
      .map(term => term.trim())
      .filter(term => term.length > 0);
  };

  const handleSearch = async () => {
    const terms = parseSearchTerms(searchText);
    if (terms.length === 0) {
      setError('Please enter at least one hostname to search');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const payload = {
        search_terms: terms,
        device_ids: selectedDevices.length > 0 ? selectedDevices.map(d => d.id) : null,
        case_sensitive: caseSensitive,
      };

      const { data } = await apiClient.post('/f5/host-search', payload);
      setResults(data);

      // Auto-expand devices with matches
      const expanded = {};
      data.results.forEach(r => {
        if (r.total_matches > 0) {
          expanded[r.device_id] = true;
        }
      });
      setExpandedDevices(expanded);

    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSearchText(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  const handleClear = () => {
    setSearchText('');
    setResults(null);
    setError(null);
  };

  const handleExport = () => {
    if (!results) return;

    const lines = ['Host Search Results', '==================', ''];
    lines.push(`Search Terms: ${results.search_terms.join(', ')}`);
    lines.push(`Devices Searched: ${results.devices_searched}`);
    lines.push(`Devices with Matches: ${results.devices_with_matches}`);
    lines.push(`Total Matches: ${results.total_matches}`);
    lines.push('');

    results.results.forEach(device => {
      if (device.total_matches > 0 || device.error) {
        lines.push(`\n${'='.repeat(60)}`);
        lines.push(`Device: ${device.device_hostname} (${device.device_ip})`);
        if (device.site) lines.push(`Site: ${device.site}`);
        lines.push(`Matches: ${device.total_matches}`);
        
        if (device.error) {
          lines.push(`ERROR: ${device.error}`);
        }

        Object.entries(CATEGORY_CONFIG).forEach(([key, config]) => {
          const items = device[key] || [];
          if (items.length > 0) {
            lines.push(`\n  ${config.label}:`);
            items.forEach(item => {
              lines.push(`    - ${item.name || item.fullPath}`);
              if (item.destination) lines.push(`      Destination: ${item.destination}`);
              if (item.address) lines.push(`      Address: ${item.address}`);
              if (item.fqdn) lines.push(`      FQDN: ${item.fqdn}`);
              if (item.pool) lines.push(`      Pool: ${item.pool}`);
              if (item.matched_terms) lines.push(`      Matched: ${item.matched_terms.join(', ')}`);
            });
          }
        });
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `host-search-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleDeviceExpanded = (deviceId) => {
    setExpandedDevices(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };

  const renderMatchCategory = (items, categoryKey) => {
    if (!items || items.length === 0) return null;
    
    const config = CATEGORY_CONFIG[categoryKey];
    const Icon = config.icon;

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Icon sx={{ color: config.color, fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {config.label}
          </Typography>
          <Chip label={items.length} size="small" sx={{ bgcolor: alpha(config.color, 0.1), color: config.color }} />
        </Box>
        
        <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'background.default' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                {categoryKey === 'virtual_servers' && <TableCell sx={{ fontWeight: 600 }}>Destination</TableCell>}
                {categoryKey === 'pool_members' && <TableCell sx={{ fontWeight: 600 }}>Pool</TableCell>}
                {(categoryKey === 'pool_members' || categoryKey === 'nodes') && (
                  <TableCell sx={{ fontWeight: 600 }}>Address/FQDN</TableCell>
                )}
                {categoryKey === 'irules' && <TableCell sx={{ fontWeight: 600 }}>Snippet</TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Matched Terms</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {item.name || item.fullPath}
                    </Typography>
                  </TableCell>
                  {categoryKey === 'virtual_servers' && (
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {item.destination}
                      </Typography>
                    </TableCell>
                  )}
                  {categoryKey === 'pool_members' && (
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {item.pool}
                      </Typography>
                    </TableCell>
                  )}
                  {(categoryKey === 'pool_members' || categoryKey === 'nodes') && (
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {item.fqdn || item.address}
                      </Typography>
                    </TableCell>
                  )}
                  {categoryKey === 'irules' && (
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>
                        {item.snippet}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    {item.matched_terms?.map((term, i) => (
                      <Chip
                        key={i}
                        label={term}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5, bgcolor: alpha(config.color, 0.15) }}
                      />
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderDeviceResult = (device) => {
    const hasMatches = device.total_matches > 0;
    const hasError = !!device.error;

    return (
      <Accordion
        key={device.device_id}
        expanded={expandedDevices[device.device_id] || false}
        onChange={() => toggleDeviceExpanded(device.device_id)}
        sx={{
          mb: 1,
          '&:before': { display: 'none' },
          border: hasMatches ? '1px solid' : '1px solid',
          borderColor: hasMatches ? 'success.main' : hasError ? 'error.main' : 'divider',
          borderRadius: '8px !important',
          overflow: 'hidden',
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            bgcolor: hasMatches ? alpha('#4caf50', 0.05) : hasError ? alpha('#f44336', 0.05) : 'transparent',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2 }}>
            {hasMatches ? (
              <CheckCircleIcon color="success" />
            ) : hasError ? (
              <ErrorIcon color="error" />
            ) : (
              <WarningIcon color="disabled" />
            )}
            
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {device.device_hostname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {device.device_ip} {device.site && `• ${device.site}`}
              </Typography>
            </Box>

            {hasMatches && (
              <Badge badgeContent={device.total_matches} color="success" max={99}>
                <Chip label="Matches" color="success" size="small" variant="outlined" />
              </Badge>
            )}
            
            {hasError && !hasMatches && (
              <Chip label="Error" color="error" size="small" variant="outlined" />
            )}
            
            {!hasMatches && !hasError && (
              <Chip label="No matches" size="small" variant="outlined" />
            )}
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ bgcolor: 'background.default' }}>
          {hasError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {device.error}
            </Alert>
          )}

          {hasMatches ? (
            <Box>
              {Object.keys(CATEGORY_CONFIG).map(key => renderMatchCategory(device[key], key))}
            </Box>
          ) : (
            <Typography color="text.secondary">
              No matches found on this device.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const searchTermCount = parseSearchTerms(searchText).length;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          <SearchIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Host Search
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Search for hostnames, IPs, or FQDNs across your F5 infrastructure.
          Useful for decommissioning tasks.
        </Typography>
      </Box>

      {/* Search Input */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Hostnames to Search"
              placeholder={`Enter hostnames, one per line or separated by commas:\n\nserver1.example.com\nserver2.example.com\n10.0.0.50`}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              variant="outlined"
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.9rem' }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {searchTermCount} hostname{searchTermCount !== 1 ? 's' : ''} to search
              </Typography>
              <Box>
                <Tooltip title="Paste from clipboard">
                  <IconButton size="small" onClick={handlePaste}>
                    <PasteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clear">
                  <IconButton size="small" onClick={handleClear}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          <Box sx={{ width: 300 }}>
            <Autocomplete
              multiple
              options={devices}
              getOptionLabel={(option) => option.hostname || ''}
              value={selectedDevices}
              onChange={(_, newValue) => setSelectedDevices(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter Devices (optional)"
                  placeholder="All devices"
                  helperText="Leave empty to search all"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option.hostname}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                />
              }
              label="Case sensitive"
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            onClick={handleSearch}
            disabled={loading || searchTermCount === 0}
          >
            {loading ? 'Searching...' : `Search ${selectedDevices.length > 0 ? selectedDevices.length : 'All'} Device${selectedDevices.length === 1 ? '' : 's'}`}
          </Button>

          {results && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
            >
              Export Results
            </Button>
          )}
        </Box>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>
              Searching across {selectedDevices.length > 0 ? selectedDevices.length : 'all'} device{selectedDevices.length === 1 ? '' : 's'}...
            </Typography>
          </Box>
          <LinearProgress sx={{ mt: 2 }} />
        </Paper>
      )}

      {/* Results Summary */}
      {results && (
        <>
          <Paper sx={{ p: 3, mb: 3, bgcolor: alpha('#2196f3', 0.05) }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Search Results Summary
            </Typography>
            
            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary">Search Terms</Typography>
                <Typography variant="h5">{results.search_terms.length}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Devices Searched</Typography>
                <Typography variant="h5">{results.devices_searched}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Devices with Matches</Typography>
                <Typography variant="h5" color="success.main">{results.devices_with_matches}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Matches</Typography>
                <Typography variant="h5" color="primary.main">{results.total_matches}</Typography>
              </Box>
            </Stack>

            {results.search_terms.length <= 20 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Searched for:
                </Typography>
                {results.search_terms.map((term, i) => (
                  <Chip key={i} label={term} size="small" sx={{ mr: 0.5, mb: 0.5 }} variant="outlined" />
                ))}
              </Box>
            )}
          </Paper>

          {/* Device Results */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Results by Device
          </Typography>
          
          {results.results.map(device => renderDeviceResult(device))}
        </>
      )}
    </Box>
  );
}
