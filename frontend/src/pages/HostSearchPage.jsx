/**
 * HostSearchPage - Enterprise F5 Infrastructure Search
 * 
 * Advanced search tool for finding hostnames, IPs, and patterns across F5 devices.
 * Useful for decommissioning, compliance audits, and infrastructure discovery.
 * 
 * Features:
 * - Multi-term search (hostnames, IPs, patterns)
 * - Component filtering (Virtual Servers, Pools, Nodes, iRules, Data Groups)
 * - Device selection with multi-select
 * - Parallel search execution for performance
 * - Export results to multiple formats
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Autocomplete,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
  Badge,
  alpha,
  Grid,
  Switch,
  Collapse,
  useTheme,
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
  Clear as ClearIcon,
  ContentPaste as PasteIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  DeviceHub as DeviceHubIcon,
  ExpandLess as ExpandLessIcon,
  Speed as SpeedIcon,
  FindInPage as FindInPageIcon,
  TravelExplore as TravelExploreIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';
import { StatCard as SharedStatCard, PageHeader, PageTransition } from '../components/shared';
import { HOST_COMPONENT_COLORS, MONO_FONT } from '../constants/designTokens';
import { glassmorphicCard } from '../constants/styleMixins';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const SEARCH_COMPONENTS = {
  virtual_servers: {
    key: 'virtual_servers',
    label: 'Virtual Servers',
    shortLabel: 'VIPs',
    icon: RouterIcon,
    color: HOST_COMPONENT_COLORS.virtual_servers,
    description: 'Load balancer virtual servers and their destinations',
  },
  pools: {
    key: 'pools',
    label: 'Pools',
    shortLabel: 'Pools',
    icon: StorageIcon,
    color: HOST_COMPONENT_COLORS.pools,
    description: 'Server pools and their configurations',
  },
  pool_members: {
    key: 'pool_members',
    label: 'Pool Members',
    shortLabel: 'Members',
    icon: GroupsIcon,
    color: HOST_COMPONENT_COLORS.pool_members,
    description: 'Individual servers within pools',
  },
  nodes: {
    key: 'nodes',
    label: 'Nodes',
    shortLabel: 'Nodes',
    icon: DnsIcon,
    color: HOST_COMPONENT_COLORS.nodes,
    description: 'Backend server nodes and their addresses',
  },
  irules: {
    key: 'irules',
    label: 'iRules',
    shortLabel: 'iRules',
    icon: CodeIcon,
    color: HOST_COMPONENT_COLORS.irules,
    description: 'Traffic management scripts and code',
  },
  data_groups: {
    key: 'data_groups',
    label: 'Data Groups',
    shortLabel: 'DGs',
    icon: TableIcon,
    color: HOST_COMPONENT_COLORS.data_groups,
    description: 'Lists and lookup tables',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATS CARD COMPONENT — using shared StatCard 'accent' variant
// ═══════════════════════════════════════════════════════════════════════════════

const StatsCard = (props) => <SharedStatCard variant="accent" {...props} />;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT FILTER CHIP
// ═══════════════════════════════════════════════════════════════════════════════

const ComponentFilterChip = ({ component, selected, onChange, count = 0 }) => {
  const Icon = component.icon;
  
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 18 }} />}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {component.shortLabel}
          {count > 0 && (
            <Badge 
              badgeContent={count} 
              color="primary" 
              sx={{ 
                ml: 1,
                '& .MuiBadge-badge': { 
                  fontSize: 10, 
                  height: 16, 
                  minWidth: 16,
                  bgcolor: selected ? component.color : 'grey.400'
                } 
              }}
            />
          )}
        </Box>
      }
      onClick={() => onChange(!selected)}
      variant={selected ? 'filled' : 'outlined'}
      sx={{
        borderColor: selected ? component.color : 'divider',
        bgcolor: selected ? alpha(component.color, 0.15) : 'transparent',
        color: selected ? component.color : 'text.secondary',
        fontWeight: selected ? 600 : 400,
        '&:hover': {
          bgcolor: alpha(component.color, 0.2),
          borderColor: component.color,
        },
        '& .MuiChip-icon': {
          color: selected ? component.color : 'text.secondary',
        }
      }}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE RESULTS ACCORDION
// ═══════════════════════════════════════════════════════════════════════════════

const DeviceResultsAccordion = ({ device, enabledComponents }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(device.total_matches > 0);
  
  const hasMatches = device.total_matches > 0;
  const hasError = !!device.error;
  
  // Calculate matches by component
  const componentCounts = useMemo(() => {
    const counts = {};
    Object.keys(SEARCH_COMPONENTS).forEach(key => {
      counts[key] = (device[key] || []).length;
    });
    return counts;
  }, [device]);
  
  return (
    <Accordion 
      expanded={expanded} 
      onChange={() => setExpanded(!expanded)}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.customRadii?.sm ?? 8}px !important`,
        mb: 1,
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: '0 0 8px 0' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          borderRadius: expanded ? '8px 8px 0 0' : '8px',
          bgcolor: hasError 
            ? alpha(theme.palette.error.main, 0.05)
            : hasMatches 
              ? alpha(theme.palette.success.main, 0.05)
              : 'transparent',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
          {/* Status Icon */}
          {hasError ? (
            <ErrorIcon color="error" />
          ) : hasMatches ? (
            <CheckCircleIcon color="success" />
          ) : (
            <DnsIcon color="disabled" />
          )}
          
          {/* Device Info */}
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={600}>
              {device.device_hostname}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {device.device_ip} {device.site && `• ${device.site}`}
            </Typography>
          </Box>
          
          {/* Match Count Chips */}
          <Stack direction="row" spacing={0.5} sx={{ mr: 2 }}>
            {Object.entries(SEARCH_COMPONENTS).map(([key, config]) => {
              const count = componentCounts[key];
              if (count === 0 || !enabledComponents[key]) return null;
              const Icon = config.icon;
              return (
                <Chip
                  key={key}
                  size="small"
                  icon={<Icon sx={{ fontSize: 14 }} />}
                  label={count}
                  sx={{
                    bgcolor: alpha(config.color, 0.15),
                    color: config.color,
                    fontWeight: 600,
                    fontSize: 12,
                    height: 24,
                    '& .MuiChip-icon': { color: config.color },
                  }}
                />
              );
            })}
          </Stack>
          
          {/* Total Badge */}
          {hasMatches && (
            <Chip
              label={`${device.total_matches} matches`}
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
          
          {hasError && (
            <Chip
              label="Error"
              color="error"
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </AccordionSummary>
      
      <AccordionDetails sx={{ p: 0 }}>
        {hasError && (
          <Alert severity="error" sx={{ m: 2 }}>
            {device.error}
          </Alert>
        )}
        
        {hasMatches && (
          <Box>
            {Object.entries(SEARCH_COMPONENTS).map(([key, config]) => {
              const items = device[key] || [];
              if (items.length === 0 || !enabledComponents[key]) return null;
              
              const Icon = config.icon;
              
              return (
                <Box key={key}>
                  <Box 
                    sx={{ 
                      px: 2, 
                      py: 1, 
                      bgcolor: alpha(config.color, 0.05),
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Icon sx={{ color: config.color, fontSize: 20 }} />
                    <Typography fontWeight={600} sx={{ color: config.color }}>
                      {config.label}
                    </Typography>
                    <Chip size="small" label={items.length} sx={{ height: 20 }} />
                  </Box>
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                          {key === 'virtual_servers' && <TableCell sx={{ fontWeight: 600 }}>Destination</TableCell>}
                          {key === 'pool_members' && <TableCell sx={{ fontWeight: 600 }}>Pool</TableCell>}
                          {key === 'pool_members' && <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>}
                          {key === 'nodes' && <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>}
                          {key === 'nodes' && <TableCell sx={{ fontWeight: 600 }}>FQDN</TableCell>}
                          {key === 'irules' && <TableCell sx={{ fontWeight: 600 }}>Snippet</TableCell>}
                          {key === 'data_groups' && <TableCell sx={{ fontWeight: 600 }}>Matched Records</TableCell>}
                          <TableCell sx={{ fontWeight: 600 }}>Matched Terms</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {item.name || item.fullPath}
                              </Typography>
                              {item.fullPath && item.fullPath !== item.name && (
                                <Typography variant="caption" color="text.secondary">
                                  {item.fullPath}
                                </Typography>
                              )}
                            </TableCell>
                            {key === 'virtual_servers' && (
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: MONO_FONT }}>
                                  {item.destination}
                                </Typography>
                              </TableCell>
                            )}
                            {key === 'pool_members' && (
                              <>
                                <TableCell>
                                  <Typography variant="body2">{item.pool}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: MONO_FONT }}>
                                    {item.address}
                                  </Typography>
                                </TableCell>
                              </>
                            )}
                            {key === 'nodes' && (
                              <>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: MONO_FONT }}>
                                    {item.address}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {item.fqdn || '-'}
                                  </Typography>
                                </TableCell>
                              </>
                            )}
                            {key === 'irules' && (
                              <TableCell sx={{ maxWidth: 300 }}>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    fontFamily: MONO_FONT,
                                    display: 'block',
                                    whiteSpace: 'pre-wrap',
                                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                                    p: 0.5,
                                    borderRadius: 1,
                                  }}
                                >
                                  {item.snippet || '-'}
                                </Typography>
                              </TableCell>
                            )}
                            {key === 'data_groups' && (
                              <TableCell>
                                {(item.matched_records || []).slice(0, 3).map((rec, i) => (
                                  <Typography key={i} variant="caption" display="block">
                                    {rec.name}: {rec.data || '(no data)'}
                                  </Typography>
                                ))}
                                {(item.matched_records || []).length > 3 && (
                                  <Typography variant="caption" color="text.secondary">
                                    +{item.matched_records.length - 3} more
                                  </Typography>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                {(item.matched_terms || []).map((term, i) => (
                                  <Chip
                                    key={i}
                                    size="small"
                                    label={term}
                                    sx={{
                                      height: 20,
                                      fontSize: 11,
                                      bgcolor: alpha(theme.palette.warning.main, 0.15),
                                      color: theme.palette.warning.dark,
                                    }}
                                  />
                                ))}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              );
            })}
          </Box>
        )}
        
        {!hasMatches && !hasError && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No matches found on this device
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function HostSearchPage() {
  const theme = useTheme();
  
  // Search state
  const [searchText, setSearchText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [selectedDatacenters, setSelectedDatacenters] = useState([]);
  const [enabledComponents, setEnabledComponents] = useState({
    virtual_servers: true,
    pools: true,
    pool_members: true,
    nodes: true,
    irules: true,
    data_groups: true,
  });
  
  // UI state
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [searchTime, setSearchTime] = useState(null);
  
  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      // Get all active devices (not just primaries) for search flexibility
      const { data } = await apiClient.get('/devices/', { params: { only_active: true } });
      // Filter devices with credentials
      const devicesWithCreds = (data || []).filter(d => d.has_credentials);
      setDevices(devicesWithCreds);
    } catch (err) {
      console.error('Failed to load devices:', err);
      setError('Failed to load F5 devices. Please refresh the page.');
    } finally {
      setLoadingDevices(false);
    }
  };
  
  // Get unique datacenters from devices
  const datacenters = useMemo(() => {
    const dcSet = new Set();
    devices.forEach(d => {
      if (d.site) dcSet.add(d.site);
    });
    return Array.from(dcSet).sort();
  }, [devices]);
  
  // Group devices by datacenter
  const devicesByDatacenter = useMemo(() => {
    const grouped = {};
    devices.forEach(d => {
      const dc = d.site || 'Unknown';
      if (!grouped[dc]) grouped[dc] = [];
      grouped[dc].push(d);
    });
    // Sort devices within each DC
    Object.keys(grouped).forEach(dc => {
      grouped[dc].sort((a, b) => a.hostname.localeCompare(b.hostname));
    });
    return grouped;
  }, [devices]);
  
  // Filtered devices based on selected datacenters
  const filteredDevices = useMemo(() => {
    if (selectedDatacenters.length === 0) return devices;
    return devices.filter(d => selectedDatacenters.includes(d.site));
  }, [devices, selectedDatacenters]);
  
  // Toggle datacenter selection
  const toggleDatacenter = (dc) => {
    setSelectedDatacenters(prev => {
      if (prev.includes(dc)) {
        // Remove DC and its devices from selection
        const dcDevices = devicesByDatacenter[dc] || [];
        setSelectedDevices(current => 
          current.filter(d => !dcDevices.some(dd => dd.id === d.id))
        );
        return prev.filter(d => d !== dc);
      } else {
        return [...prev, dc];
      }
    });
  };
  
  // Select all devices from a datacenter
  const selectAllFromDatacenter = (dc) => {
    const dcDevices = devicesByDatacenter[dc] || [];
    setSelectedDevices(prev => {
      const existingIds = new Set(prev.map(d => d.id));
      const newDevices = dcDevices.filter(d => !existingIds.has(d.id));
      return [...prev, ...newDevices];
    });
  };
  
  // Clear devices from a datacenter
  const clearDatacenterDevices = (dc) => {
    const dcDevices = devicesByDatacenter[dc] || [];
    const dcIds = new Set(dcDevices.map(d => d.id));
    setSelectedDevices(prev => prev.filter(d => !dcIds.has(d.id)));
  };

  // Parse search terms from text
  const searchTerms = useMemo(() => {
    return searchText
      .split(/[\n,]+/)
      .map(term => term.trim())
      .filter(term => term.length > 0);
  }, [searchText]);

  // Calculate result stats
  const resultStats = useMemo(() => {
    if (!results) return null;
    
    const stats = {
      totalDevices: results.devices_searched,
      devicesWithMatches: results.devices_with_matches,
      totalMatches: results.total_matches,
      byComponent: {},
    };
    
    Object.keys(SEARCH_COMPONENTS).forEach(key => {
      stats.byComponent[key] = 0;
    });
    
    results.results.forEach(device => {
      Object.keys(SEARCH_COMPONENTS).forEach(key => {
        stats.byComponent[key] += (device[key] || []).length;
      });
    });
    
    return stats;
  }, [results]);

  // Toggle component filter
  const toggleComponent = (key) => {
    setEnabledComponents(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Select/deselect all components
  const selectAllComponents = (selected) => {
    const newState = {};
    Object.keys(SEARCH_COMPONENTS).forEach(key => {
      newState[key] = selected;
    });
    setEnabledComponents(newState);
  };

  // Perform search
  const handleSearch = async () => {
    if (searchTerms.length === 0) {
      setError('Please enter at least one search term');
      return;
    }

    const enabledCount = Object.values(enabledComponents).filter(Boolean).length;
    if (enabledCount === 0) {
      setError('Please select at least one component to search');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    const startTime = Date.now();

    try {
      const payload = {
        search_terms: searchTerms,
        device_ids: selectedDevices.length > 0 ? selectedDevices.map(d => d.id) : null,
        case_sensitive: caseSensitive,
      };

      // Use longer timeout for infrastructure search (5 minutes)
      const { data } = await apiClient.post('/f5/host-search', payload, { timeout: 300000 });
      
      // Filter results based on enabled components
      const filteredResults = {
        ...data,
        results: data.results.map(device => {
          const filtered = { ...device };
          let totalMatches = 0;
          
          Object.keys(SEARCH_COMPONENTS).forEach(key => {
            if (!enabledComponents[key]) {
              filtered[key] = [];
            } else {
              totalMatches += (filtered[key] || []).length;
            }
          });
          
          filtered.total_matches = totalMatches;
          return filtered;
        }),
      };
      
      // Recalculate totals
      filteredResults.total_matches = filteredResults.results.reduce(
        (sum, d) => sum + d.total_matches, 0
      );
      filteredResults.devices_with_matches = filteredResults.results.filter(
        d => d.total_matches > 0
      ).length;
      
      setResults(filteredResults);
      setSearchTime((Date.now() - startTime) / 1000);

    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSearchText(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  // Clear search
  const handleClear = () => {
    setSearchText('');
    setResults(null);
    setError(null);
    setSearchTime(null);
  };

  // Export results
  const handleExport = (format = 'txt') => {
    if (!results) return;

    if (format === 'txt') {
      const lines = [
        '═══════════════════════════════════════════════════════════════════',
        '                    F5 HOST SEARCH RESULTS',
        '═══════════════════════════════════════════════════════════════════',
        '',
        `Generated: ${new Date().toLocaleString()}`,
        `Search Terms: ${results.search_terms.join(', ')}`,
        `Devices Searched: ${results.devices_searched}`,
        `Devices with Matches: ${results.devices_with_matches}`,
        `Total Matches: ${results.total_matches}`,
        '',
      ];

      results.results.forEach(device => {
        if (device.total_matches > 0 || device.error) {
          lines.push(`\n${'─'.repeat(60)}`);
          lines.push(`DEVICE: ${device.device_hostname}`);
          lines.push(`IP: ${device.device_ip}`);
          if (device.site) lines.push(`Site: ${device.site}`);
          lines.push(`Total Matches: ${device.total_matches}`);
          
          if (device.error) {
            lines.push(`⚠️  ERROR: ${device.error}`);
          }

          Object.entries(SEARCH_COMPONENTS).forEach(([key, config]) => {
            const items = device[key] || [];
            if (items.length > 0 && enabledComponents[key]) {
              lines.push(`\n  📁 ${config.label} (${items.length}):`);
              items.forEach(item => {
                lines.push(`     • ${item.name || item.fullPath}`);
                if (item.destination) lines.push(`       Destination: ${item.destination}`);
                if (item.address) lines.push(`       Address: ${item.address}`);
                if (item.fqdn) lines.push(`       FQDN: ${item.fqdn}`);
                if (item.pool) lines.push(`       Pool: ${item.pool}`);
                if (item.matched_terms) lines.push(`       Matched: ${item.matched_terms.join(', ')}`);
              });
            }
          });
        }
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `f5-host-search-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const rows = [['Device', 'IP', 'Site', 'Component', 'Name', 'Details', 'Matched Terms']];
      
      results.results.forEach(device => {
        Object.entries(SEARCH_COMPONENTS).forEach(([key, config]) => {
          const items = device[key] || [];
          if (enabledComponents[key]) {
            items.forEach(item => {
              let details = '';
              if (item.destination) details = item.destination;
              else if (item.address) details = item.address;
              else if (item.pool) details = item.pool;
              
              rows.push([
                device.device_hostname,
                device.device_ip,
                device.site || '',
                config.label,
                item.name || item.fullPath,
                details,
                (item.matched_terms || []).join('; ')
              ]);
            });
          }
        });
      });

      const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `f5-host-search-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Get active component count
  const activeComponentCount = Object.values(enabledComponents).filter(Boolean).length;

  return (
    <PageTransition>
      {/* Header */}
      <PageHeader
        title="Infrastructure Search"
        subtitle="Find hostnames, IPs, and patterns across your F5 infrastructure"
      />

      {/* Main Search Card */}
      <Paper 
        elevation={0} 
        sx={{ 
          ...glassmorphicCard(theme),
          p: 3, 
          mb: 3, 
        }}
      >
        {/* Search Terms Input */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Search Terms
            </Typography>
            <Chip 
              size="small" 
              label={`${searchTerms.length} terms`}
              sx={{ height: 20 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Enter hostnames, IPs, or patterns (one per line or comma-separated)&#10;&#10;Example:&#10;server1.domain.com&#10;192.168.1.100&#10;webapp, apiserver"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: MONO_FONT,
                  fontSize: 13,
                }
              }}
            />
            <Stack spacing={1}>
              <Tooltip title="Paste from clipboard">
                <IconButton onClick={handlePaste} disabled={loading} aria-label="Paste from clipboard">
                  <PasteIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear">
                <IconButton onClick={handleClear} disabled={loading || !searchText} aria-label="Clear">
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Filters Section */}
        <Box>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              mb: showFilters ? 2 : 0,
            }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterListIcon color="action" />
              <Typography variant="subtitle2" fontWeight={600}>
                Search Filters
              </Typography>
              <Chip 
                size="small" 
                label={`${activeComponentCount} components`}
                variant="outlined"
                sx={{ height: 22 }}
              />
              <Chip 
                size="small" 
                label={selectedDevices.length > 0 
                  ? `${selectedDevices.length} devices` 
                  : `All ${devices.length} devices`
                }
                variant="outlined"
                color={selectedDevices.length > 0 ? 'primary' : 'default'}
                sx={{ height: 22 }}
              />
            </Box>
            {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>

          <Collapse in={showFilters}>
            <Grid container spacing={3}>
              {/* Component Filters */}
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Components to Search
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => selectAllComponents(true)}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      All
                    </Button>
                    <Button 
                      size="small" 
                      onClick={() => selectAllComponents(false)}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      None
                    </Button>
                  </Box>
                  
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Object.entries(SEARCH_COMPONENTS).map(([key, config]) => (
                      <ComponentFilterChip
                        key={key}
                        component={config}
                        selected={enabledComponents[key]}
                        onChange={() => toggleComponent(key)}
                        count={resultStats?.byComponent[key] || 0}
                      />
                    ))}
                  </Stack>
                </Box>
              </Grid>

              {/* Device Selection */}
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1.5 }}>
                    Devices to Search
                  </Typography>
                  
                  {/* Datacenter Quick Filters */}
                  {datacenters.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Quick Select by Datacenter:
                        </Typography>
                        <Button 
                          size="small" 
                          onClick={() => setSelectedDevices([])}
                          sx={{ minWidth: 'auto', px: 1 }}
                          disabled={selectedDevices.length === 0}
                        >
                          Clear All
                        </Button>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {datacenters.map((dc) => {
                          const dcDevices = devicesByDatacenter[dc] || [];
                          const selectedCount = selectedDevices.filter(d => d.site === dc).length;
                          const isFullySelected = selectedCount === dcDevices.length && dcDevices.length > 0;
                          const isPartiallySelected = selectedCount > 0 && selectedCount < dcDevices.length;
                          
                          return (
                            <Chip
                              key={dc}
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {dc.toUpperCase()}
                                  <Typography 
                                    component="span" 
                                    sx={{ 
                                      fontSize: 11, 
                                      opacity: 0.8,
                                      bgcolor: isFullySelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                                      px: 0.5,
                                      borderRadius: 0.5,
                                    }}
                                  >
                                    {selectedCount > 0 ? `${selectedCount}/` : ''}{dcDevices.length}
                                  </Typography>
                                </Box>
                              }
                              variant={isFullySelected ? 'filled' : 'outlined'}
                              color={isFullySelected ? 'primary' : isPartiallySelected ? 'primary' : 'default'}
                              onClick={() => {
                                if (isFullySelected) {
                                  clearDatacenterDevices(dc);
                                } else {
                                  selectAllFromDatacenter(dc);
                                }
                              }}
                              icon={<StorageIcon sx={{ fontSize: 16 }} />}
                              sx={{
                                fontWeight: 600,
                                borderStyle: isPartiallySelected ? 'dashed' : 'solid',
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                  
                  {/* Device Multi-Select Autocomplete */}
                  <Autocomplete
                    multiple
                    options={filteredDevices}
                    value={selectedDevices}
                    onChange={(_, newValue) => setSelectedDevices(newValue)}
                    loading={loadingDevices}
                    getOptionLabel={(option) => option.hostname}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    groupBy={(option) => option.site || 'Unknown'}
                    filterSelectedOptions
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={selectedDevices.length === 0 ? "Select devices or leave empty for all..." : "Add more devices..."}
                        size="small"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingDevices ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.slice(0, 5).map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option.id}
                          label={option.hostname}
                          size="small"
                          icon={<DnsIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            '& .MuiChip-deleteIcon': { color: 'text.secondary' },
                          }}
                        />
                      )).concat(
                        value.length > 5 ? [
                          <Chip
                            key="more"
                            label={`+${value.length - 5} more`}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        ] : []
                      )
                    }
                    renderGroup={(params) => (
                      <li key={params.key}>
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            px: 2, 
                            py: 1,
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <StorageIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle2" fontWeight={700} color="primary">
                              {params.group.toUpperCase()}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={`${(devicesByDatacenter[params.group] || []).length} devices`}
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          </Box>
                          <Button
                            size="small"
                            variant="text"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllFromDatacenter(params.group);
                            }}
                            sx={{ minWidth: 'auto', fontSize: 11 }}
                          >
                            Select All
                          </Button>
                        </Box>
                        <ul style={{ padding: 0, margin: 0 }}>{params.children}</ul>
                      </li>
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                          <DnsIcon fontSize="small" color="action" />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {option.hostname}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.ip_address}
                              {option.ha_state && ` • ${option.ha_state}`}
                            </Typography>
                          </Box>
                          {option.ha_state === 'ACTIVE' && (
                            <Chip size="small" label="ACTIVE" color="success" sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Box>
                      </li>
                    )}
                    disabled={loading}
                    sx={{
                      '& .MuiAutocomplete-listbox': {
                        maxHeight: 400,
                      },
                    }}
                  />
                  
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {loadingDevices ? 'Loading devices...' : (
                        selectedDevices.length === 0 
                          ? `Will search all ${devices.length} devices`
                          : `${selectedDevices.length} of ${devices.length} devices selected`
                      )}
                    </Typography>
                    {selectedDevices.length > 0 && (
                      <Button 
                        size="small" 
                        onClick={() => setSelectedDevices([])}
                        sx={{ minWidth: 'auto' }}
                      >
                        Clear Selection
                      </Button>
                    )}
                  </Box>
                </Box>
              </Grid>

              {/* Additional Options */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={3} alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        disabled={loading}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Case sensitive search
                      </Typography>
                    }
                  />
                </Stack>
              </Grid>
            </Grid>
          </Collapse>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            onClick={handleSearch}
            disabled={loading || searchTerms.length === 0 || activeComponentCount === 0}
            sx={{ minWidth: 180 }}
          >
            {loading ? 'Searching...' : 'Search All Devices'}
          </Button>
          
          {results && (
            <>
              <Tooltip title="Export as Text">
                <IconButton onClick={() => handleExport('txt')} aria-label="Export as Text">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export as CSV">
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => handleExport('csv')}
                >
                  Export CSV
                </Button>
              </Tooltip>
            </>
          )}
          
          {searchTime && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Search completed in {searchTime.toFixed(1)}s
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Loading Progress */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Searching {selectedDevices.length || devices.length} devices in parallel...
          </Typography>
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Results Stats */}
      {resultStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <StatsCard
              icon={<DeviceHubIcon />}
              title="Devices Searched"
              value={resultStats.totalDevices}
              color="primary"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatsCard
              icon={<CheckCircleIcon />}
              title="Devices with Matches"
              value={resultStats.devicesWithMatches}
              subtitle={`${((resultStats.devicesWithMatches / resultStats.totalDevices) * 100).toFixed(0)}% of devices`}
              color="success"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatsCard
              icon={<FindInPageIcon />}
              title="Total Matches"
              value={resultStats.totalMatches}
              color="warning"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatsCard
              icon={<SpeedIcon />}
              title="Search Time"
              value={`${searchTime?.toFixed(1)}s`}
              subtitle="Parallel execution"
              color="info"
            />
          </Grid>
        </Grid>
      )}

      {/* Component Summary */}
      {resultStats && resultStats.totalMatches > 0 && (
        <Paper 
          elevation={0} 
          sx={{ 
            ...glassmorphicCard(theme),
            p: 2, 
            mb: 3, 
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Matches by Component
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {Object.entries(SEARCH_COMPONENTS).map(([key, config]) => {
              const count = resultStats.byComponent[key];
              if (!enabledComponents[key]) return null;
              const Icon = config.icon;
              return (
                <Chip
                  key={key}
                  icon={<Icon sx={{ color: `${config.color} !important` }} />}
                  label={`${config.label}: ${count}`}
                  variant="outlined"
                  sx={{
                    borderColor: count > 0 ? config.color : 'divider',
                    color: count > 0 ? config.color : 'text.disabled',
                    fontWeight: count > 0 ? 600 : 400,
                  }}
                />
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Results List */}
      {results && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Search Results
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing {results.results.length} devices
            </Typography>
          </Box>
          
          {results.results.map((device) => (
            <DeviceResultsAccordion
              key={device.device_id}
              device={device}
              enabledComponents={enabledComponents}
            />
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!results && !loading && (
        <Paper 
          elevation={0} 
          sx={{ 
            ...glassmorphicCard(theme),
            p: 6, 
            textAlign: 'center',
          }}
        >
          <TravelExploreIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Ready to Search
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
            Enter hostnames, IP addresses, or patterns above and click "Search All Devices" 
            to find them across your F5 infrastructure.
          </Typography>
        </Paper>
      )}
    </PageTransition>
  );
}
