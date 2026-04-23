// frontend/src/components/GlobalSearch.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  InputBase,
  IconButton,
  Popper,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  alpha,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  VpnKey as CertIcon,
  Dns as DeviceIcon,
  Lan as VipIcon,
  History as RecentIcon,
  TrendingUp as PopularIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const GlobalSearch = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches] = useState([
    { id: 1, query: 'certificate expiring', type: 'recent' },
    { id: 2, query: 'device health', type: 'recent' },
    { id: 3, query: 'VIP configuration', type: 'recent' }
  ]);
  
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  
  const open = Boolean(anchorEl);

  // Mock search results - in real app, this would be an API call
  const mockResults = [
    {
      id: 1,
      title: 'SSL Certificate - example.com',
      subtitle: 'Expires in 30 days',
      type: 'certificate',
      icon: <CertIcon />,
      path: '/certificates'
    },
    {
      id: 2,
      title: 'F5 Device - prod-f5-01',
      subtitle: 'Status: Healthy',
      type: 'device',
      icon: <DeviceIcon />,
      path: '/devices'
    },
    {
      id: 3,
      title: 'VIP - api.example.com',
      subtitle: 'Port 443, SSL Profile: example_ssl',
      type: 'vip',
      icon: <VipIcon />,
      path: '/vips/search'
    }
  ];

  const handleSearchFocus = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleSearchBlur = () => {
    // Delay closing to allow for click events
    setTimeout(() => {
      setAnchorEl(null);
      setSearchQuery('');
      setSearchResults([]);
    }, 200);
  };

  const handleSearchChange = (event) => {
    const query = event.target.value;
    setSearchQuery(query);
    
    if (query.length > 2) {
      setIsLoading(true);
      // Simulate API search delay
      setTimeout(() => {
        setSearchResults(mockResults.filter(item => 
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase())
        ));
        setIsLoading(false);
      }, 300);
    } else {
      setSearchResults([]);
      setIsLoading(false);
    }
  };

  const handleResultClick = (result) => {
    navigate(result.path);
    handleSearchBlur();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if (event.key === 'Escape' && open) {
        handleSearchBlur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const getTypeColor = (type) => {
    switch (type) {
      case 'certificate':
        return 'primary';
      case 'device':
        return 'secondary';
      case 'vip':
        return 'success';
      default:
        return 'default';
    }
  };

  const shortcuts = [
    { key: '⌘K', action: 'Search' },
    { key: '↵', action: 'Select' },
    { key: 'Esc', action: 'Close' }
  ];

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          borderRadius: 2,
          backgroundColor: theme => alpha(theme.palette.common.white, 0.15),
          '&:hover': {
            backgroundColor: theme => alpha(theme.palette.common.white, 0.25),
          },
          marginLeft: 0,
          marginRight: 0,
          width: '100%',
          maxWidth: { xs: '100%', sm: '400px', md: '450px', lg: '500px' },
          minWidth: { xs: '200px', sm: '300px' },
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s ease-in-out',
          '&:focus-within': {
            borderColor: 'primary.main',
            backgroundColor: theme => alpha(theme.palette.primary.main, 0.05),
            transform: 'translateY(-1px)',
            boxShadow: theme => `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 1.5, sm: 2 }, py: 1 }}>
          <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
          <InputBase
            ref={searchInputRef}
            placeholder="Search certificates, devices, VIPs..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            sx={{
              color: 'inherit',
              flex: 1,
              '& .MuiInputBase-input': {
                padding: 0,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                '&::placeholder': {
                  opacity: 0.7
                }
              }
            }}
          />
          
          {searchQuery ? (
            <IconButton
              size="small"
              onClick={handleClearSearch}
              sx={{ p: 0.5, ml: 1 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : (
            <Chip
              label="⌘K"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 500,
                bgcolor: 'action.selected',
                color: 'text.secondary',
                display: { xs: 'none', sm: 'flex' } // Hide shortcut on mobile
              }}
            />
          )}
        </Box>
      </Box>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{ 
          zIndex: 1300, 
          width: anchorEl ? Math.min(anchorEl.offsetWidth, 500) : 400,
          minWidth: { xs: 300, sm: 400 }
        }}
      >
        <Paper
          elevation={8}
          sx={{
            mt: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            background: theme => theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(32, 32, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
            maxHeight: 400,
            overflow: 'hidden'
          }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>Searching...</Typography>
            </Box>
          ) : searchResults.length > 0 ? (
            <List sx={{ py: 1 }}>
              {searchResults.map((result) => (
                <ListItem
                  key={result.id}
                  button
                  onClick={() => handleResultClick(result)}
                  sx={{
                    borderRadius: 1,
                    mx: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {result.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={result.title}
                    secondary={result.subtitle}
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <Chip
                    label={result.type}
                    size="small"
                    color={getTypeColor(result.type)}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </ListItem>
              ))}
            </List>
          ) : searchQuery.length > 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No results found for "{searchQuery}"
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <>
                  <Typography 
                    variant="overline" 
                    sx={{ 
                      px: 1, 
                      color: 'text.secondary',
                      fontSize: '0.65rem',
                      fontWeight: 600
                    }}
                  >
                    Recent Searches
                  </Typography>
                  <List sx={{ py: 0 }}>
                    {recentSearches.map((search) => (
                      <ListItem
                        key={search.id}
                        button
                        onClick={() => setSearchQuery(search.query)}
                        sx={{
                          borderRadius: 1,
                          py: 0.5,
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <RecentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={search.query}
                          primaryTypographyProps={{ fontSize: '0.875rem' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {/* Keyboard Shortcuts */}
              <Typography 
                variant="overline" 
                sx={{ 
                  px: 1, 
                  color: 'text.secondary',
                  fontSize: '0.65rem',
                  fontWeight: 600
                }}
              >
                Keyboard Shortcuts
              </Typography>
              <Box sx={{ px: 1, py: 1 }}>
                {shortcuts.map((shortcut, index) => (
                  <Box 
                    key={index}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      py: 0.5
                    }}
                  >
                    <Typography variant="body2" fontSize="0.75rem" color="text.secondary">
                      {shortcut.action}
                    </Typography>
                    <Chip
                      label={shortcut.key}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.6rem',
                        bgcolor: 'action.selected',
                        color: 'text.secondary'
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      </Popper>
    </>
  );
};

export default GlobalSearch;