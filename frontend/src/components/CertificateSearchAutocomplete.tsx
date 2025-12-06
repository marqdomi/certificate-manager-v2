/**
 * CertificateSearchAutocomplete
 * 
 * Autocomplete component for searching and selecting certificates.
 * Used in CSR Generator to pre-fill renewal data from existing certificates.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Security as CertIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import debounce from 'lodash/debounce';
import apiClient from '../services/api';

export interface CertificateOption {
  id: number;
  name: string;
  common_name: string;
  san_names?: string[];
  device_hostname?: string;
  expiration_date?: string;
  days_remaining?: number;
}

interface CertificateSearchAutocompleteProps {
  onSelect: (certificate: CertificateOption | null) => void;
  selectedCertificate?: CertificateOption | null;
  disabled?: boolean;
}

const CertificateSearchAutocomplete: React.FC<CertificateSearchAutocompleteProps> = ({
  onSelect,
  selectedCertificate = null,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CertificateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Debounced search function
  const searchCertificates = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await apiClient.get('/certificates/', {
          params: {
            search: query,
            primaries_only: 1,
            dedupe: 1,
            limit: 20,
          },
        });
        
        const certs = response.data.map((cert: any) => ({
          id: cert.id,
          name: cert.name,
          common_name: cert.common_name || cert.name,
          san_names: cert.san_names ? 
            (typeof cert.san_names === 'string' ? JSON.parse(cert.san_names) : cert.san_names) 
            : [],
          device_hostname: cert.device_hostname,
          expiration_date: cert.expiration_date,
          days_remaining: cert.days_remaining,
        }));
        
        setOptions(certs);
      } catch (error) {
        console.error('Error searching certificates:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (inputValue) {
      searchCertificates(inputValue);
    }
  }, [inputValue, searchCertificates]);

  const getStatusColor = (daysRemaining?: number): 'error' | 'warning' | 'success' | 'default' => {
    if (!daysRemaining) return 'default';
    if (daysRemaining <= 0) return 'error';
    if (daysRemaining <= 30) return 'error';
    if (daysRemaining <= 60) return 'warning';
    return 'success';
  };

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={selectedCertificate}
      onChange={(_, newValue) => onSelect(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
      options={options}
      loading={loading}
      disabled={disabled}
      getOptionLabel={(option) => option.common_name || option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      filterOptions={(x) => x} // Disable client-side filtering, use server search
      noOptionsText={inputValue.length < 2 ? "Type at least 2 characters to search" : "No certificates found"}
      PaperComponent={(props) => (
        <Paper {...props} elevation={8} sx={{ mt: 1 }} />
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search certificate to renew (optional)"
          placeholder="Type certificate name, CN, or SAN..."
          helperText="Select an existing certificate to pre-fill the form with its details"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <CertIcon sx={{ color: 'action.active', mr: 1 }} />
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <Box
            component="li"
            key={option.id}
            {...otherProps}
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'flex-start !important',
              py: 1.5,
              px: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {option.common_name || option.name}
              </Typography>
              {option.days_remaining !== undefined && option.days_remaining <= 60 && (
                <Chip
                  size="small"
                  icon={<WarningIcon />}
                  label={option.days_remaining <= 0 ? 'Expired' : `${option.days_remaining}d left`}
                  color={getStatusColor(option.days_remaining)}
                  sx={{ ml: 'auto' }}
                />
              )}
            </Box>
            
            {option.san_names && option.san_names.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                SANs: {option.san_names.slice(0, 3).join(', ')}
                {option.san_names.length > 3 && ` (+${option.san_names.length - 3} more)`}
              </Typography>
            )}
            
            {option.device_hostname && (
              <Typography variant="caption" color="text.secondary">
                Device: {option.device_hostname}
              </Typography>
            )}
          </Box>
        );
      }}
    />
  );
};

export default CertificateSearchAutocomplete;
