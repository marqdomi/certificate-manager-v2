// frontend/src/components/ExportButton.jsx
/**
 * Export functionality for certificate data.
 * Supports CSV and JSON export formats.
 */
import React, { useState } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import DataObjectIcon from '@mui/icons-material/DataObject';

/**
 * Helper function to trigger file download
 */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Escape CSV field values to handle commas and quotes
 */
const escapeCSVField = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * ExportButton Component
 * Provides CSV and JSON export options for certificate data
 * 
 * @param {Object} props
 * @param {Array} props.certificates - Array of certificate objects to export
 * @param {boolean} props.disabled - Whether the button should be disabled
 * @param {string} props.filenamePrefix - Prefix for downloaded files (default: 'certificates')
 * @param {Object} props.usageStates - Optional map of cert_id -> real-time usage_state
 */
const ExportButton = ({ 
  certificates = [], 
  disabled = false,
  filenamePrefix = 'certificates',
  usageStates = {}
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Helper to get effective usage state (real-time override or cached)
  const getUsageState = (cert) => usageStates[cert.id] || cert.usage_state;

  const exportCSV = () => {
    const headers = [
      'ID',
      'Common Name',
      'Certificate Name',
      'F5 Device',
      'Partition',
      'Expiration Date',
      'Days Remaining',
      'Usage State',
      'Issuer'
    ];

    const rows = certificates.map(cert => [
      escapeCSVField(cert.id),
      escapeCSVField(cert.common_name),
      escapeCSVField(cert.name),
      escapeCSVField(cert.f5_device_hostname || cert.device_name),
      escapeCSVField(cert.partition),
      escapeCSVField(cert.expiration_date ? new Date(cert.expiration_date).toLocaleDateString() : ''),
      escapeCSVField(cert.days_remaining),
      escapeCSVField(getUsageState(cert)),
      escapeCSVField(cert.issuer)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(csv, `${filenamePrefix}_${timestamp}.csv`, 'text/csv;charset=utf-8;');
    handleClose();
  };

  const exportJSON = () => {
    // Clean up the certificate data for export
    const cleanData = certificates.map(cert => ({
      id: cert.id,
      common_name: cert.common_name,
      name: cert.name,
      f5_device: cert.f5_device_hostname || cert.device_name,
      partition: cert.partition,
      expiration_date: cert.expiration_date,
      days_remaining: cert.days_remaining,
      usage_state: getUsageState(cert),
      issuer: cert.issuer,
      device_id: cert.device_id
    }));

    const json = JSON.stringify(cleanData, null, 2);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(json, `${filenamePrefix}_${timestamp}.json`, 'application/json');
    handleClose();
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={handleClick}
        disabled={disabled || certificates.length === 0}
        aria-label="Export certificates"
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        Export ({certificates.length})
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'export-button',
        }}
      >
        <MenuItem onClick={exportCSV}>
          <ListItemIcon>
            <TableChartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as CSV</ListItemText>
        </MenuItem>
        <MenuItem onClick={exportJSON}>
          <ListItemIcon>
            <DataObjectIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as JSON</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportButton;
