// frontend/src/pages/DevicesPage.tsx
import React, { useState, useCallback } from 'react';
import { Box, Typography, Button, Alert, TextField, InputAdornment, Paper, Theme, SxProps, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { authProvider } from './LoginPage';
import {
  createDevice,
  deleteDevice,
  updateDeviceCredentials,
  refreshFacts,
  refreshCache,
  scanAllDevices,
} from '../api/devices';
import DeviceTable from '../components/DeviceTable';
import DeviceDetailDrawer from '../components/DeviceDetailDrawer';
import EditDeviceDialog from '../components/EditDeviceDialog';
import CredentialDialog from '../components/CredentialDialog';
import AddDeviceDialog from '../components/AddDeviceDialog';
import FilterChipsBar from '../components/FilterChipsBar';
import BulkActionsBar from '../components/BulkActionsBar';
import BulkCredentialsDialog from '../components/BulkCredentialsDialog';
import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket';
import type { Device, DeviceCredentials, DeviceCreate } from '../types/device';

// Types
type AlertSeverity = 'success' | 'error' | 'warning' | 'info';
type UserRole = 'admin' | 'operator' | 'viewer';

interface Notification {
  open: boolean;
  message: string;
  severity: AlertSeverity;
}

interface DeviceFilters {
  ha_state?: string;
  sync_status?: string;
  site?: string;
  primaryOnly?: boolean;
  noCredentials?: boolean;
  health?: 'healthy' | 'issues';
}

const DevicesPage: React.FC = () => {
  const userRole = authProvider.getRole() as UserRole;
  
  const glassmorphicStyle: SxProps<Theme> = {
    p: { xs: 2, sm: 3 },
    backgroundColor: (theme: Theme) => (theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)'),
    backdropFilter: 'blur(12px)',
    border: '1px solid',
    borderColor: (theme: Theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'),
    borderRadius: '20px',
  };

  const [notification, setNotification] = useState<Notification>({ open: false, message: '', severity: 'info' });
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState<boolean>(false);
  const [drawerDevice, setDrawerDevice] = useState<Device | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [limitCertsInput, setLimitCertsInput] = useState<string>('');
  const [clearSelectionKey, setClearSelectionKey] = useState<number>(0);
  const [filters, setFilters] = useState<DeviceFilters>({});
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [bulkCredentialsOpen, setBulkCredentialsOpen] = useState<boolean>(false);

  const forceTableRefresh = useCallback((): void => setRefreshKey((k) => k + 1), []);

  // WebSocket for real-time updates
  const { isConnected: wsConnected } = useDeviceWebSocket({
    onDeviceAdded: useCallback((deviceId: number, data: Record<string, unknown>) => {
      console.log('[WS] Device added:', deviceId, data);
      setNotification({ 
        open: true, 
        message: `New device added: ${data.hostname || deviceId}`, 
        severity: 'info' 
      });
      forceTableRefresh();
    }, [forceTableRefresh]),
    onDeviceUpdated: useCallback((deviceId: number, _data: Record<string, unknown>) => {
      console.log('[WS] Device updated:', deviceId, _data);
      forceTableRefresh();
    }, [forceTableRefresh]),
    onDeviceDeleted: useCallback((deviceId: number) => {
      console.log('[WS] Device deleted:', deviceId);
      setSelectedIds((prev) => prev.filter((x) => x !== deviceId));
      forceTableRefresh();
    }, [forceTableRefresh]),
    onScanCompleted: useCallback((deviceId: number, data: Record<string, unknown>) => {
      console.log('[WS] Scan completed:', deviceId, data);
      forceTableRefresh();
    }, [forceTableRefresh]),
    onBulkUpdate: useCallback((deviceIds: number[], eventType: string) => {
      console.log('[WS] Bulk update:', eventType, deviceIds);
      forceTableRefresh();
    }, [forceTableRefresh]),
  });

  // Export devices to CSV
  const handleExportCSV = (): void => {
    if (!allDevices || allDevices.length === 0) {
      setNotification({ open: true, message: 'No devices to export.', severity: 'warning' });
      return;
    }

    // Define CSV columns
    const columns: (keyof Device)[] = [
      'id', 'hostname', 'ip_address', 'site', 'cluster_key', 'is_primary_preferred',
      'version', 'ha_state', 'sync_status', 'last_sync_color',
      'last_scan_status', 'last_scan_message', 'last_facts_refresh',
      'active', 'username', 'created_at', 'updated_at'
    ];

    // Create CSV header
    const header = columns.join(',');

    // Create CSV rows
    const rows = allDevices.map((device: Device) => {
      return columns.map((col) => {
        let value: unknown = device[col];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
        // Escape quotes and wrap in quotes if contains comma or newline
        let strValue = String(value).replace(/"/g, '""');
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          strValue = `"${strValue}"`;
        }
        return strValue;
      }).join(',');
    });

    // Combine header and rows
    const csv = [header, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `device_inventory_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({ open: true, message: `Exported ${allDevices.length} devices to CSV.`, severity: 'success' });
  };

  const handleScanAll = (): void => {
    scanAllDevices()
      .then((res) => setNotification({ open: true, message: res?.message || 'Scan queued.', severity: 'success' }))
      .catch((err: Error) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleSaveCredentials = (credentials: DeviceCredentials): void => {
    if (!selectedDevice) return;
    updateDeviceCredentials(selectedDevice.id, credentials)
      .then(() => {
        setNotification({ open: true, message: `Credentials updated.`, severity: 'success' });
        setCredentialModalOpen(false);
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleAddDevice = (deviceData: DeviceCreate): void => {
    createDevice(deviceData)
      .then(() => {
        setNotification({ open: true, message: 'Device added.', severity: 'success' });
        setAddModalOpen(false);
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleDeleteDevice = (id: number): void => {
    deleteDevice(id)
      .then(() => {
        setNotification({ open: true, message: 'Device deleted.', severity: 'success' });
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const bulkRefreshFacts = async (): Promise<void> => {
    await Promise.all(selectedIds.map((id) => refreshFacts(id)));
    setNotification({ open: true, message: `Queued facts refresh for ${selectedIds.length}.`, severity: 'success' });
  };

  const bulkRefreshCache = async (): Promise<void> => {
    const limitCerts = limitCertsInput.trim() ? parseInt(limitCertsInput.trim(), 10) : undefined;
    await Promise.all(selectedIds.map((id) => refreshCache(id, limitCerts)));
    setNotification({ open: true, message: `Queued cache refresh for ${selectedIds.length}.`, severity: 'success' });
  };

  const clearSelection = (): void => {
    setSelectedIds([]);
    setClearSelectionKey((k) => k + 1);
  };

  const handleBulkCredentialsComplete = (): void => {
    setBulkCredentialsOpen(false);
    forceTableRefresh();
  };

  // Device detail drawer handlers
  const handleRowClick = (device: Device): void => {
    setDrawerDevice(device);
    setDetailDrawerOpen(true);
  };

  const handleDrawerClose = (): void => {
    setDetailDrawerOpen(false);
  };

  const handleScanDevice = (device: Device): void => {
    scanAllDevices([device.id])
      .then(() => {
        setNotification({ open: true, message: `Scan queued for ${device.hostname}`, severity: 'success' });
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleRefreshFacts = (device: Device): void => {
    refreshFacts(device.id)
      .then(() => {
        setNotification({ open: true, message: `Facts refresh queued for ${device.hostname}`, severity: 'success' });
        forceTableRefresh();
      })
      .catch((err: Error) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleBulkCredentialSave = async (deviceId: number, credentials: DeviceCredentials): Promise<void> => {
    await updateDeviceCredentials(deviceId, credentials);
  };

  const handleEditDevice = (device: Device): void => {
    setEditDevice(device);
    setEditModalOpen(true);
    setDetailDrawerOpen(false); // Cerrar drawer al abrir edit
  };

  const handleSaveDevice = (updatedDevice: Device): void => {
    setNotification({ open: true, message: `Device ${updatedDevice.hostname} updated successfully.`, severity: 'success' });
    forceTableRefresh();
    // Actualizar drawer si está abierto
    if (drawerDevice && drawerDevice.id === updatedDevice.id) {
      setDrawerDevice(updatedDevice);
    }
  };

  return (
    <Box>
      <Paper elevation={0} sx={glassmorphicStyle}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Device Inventory</Typography>
            <Chip 
              icon={wsConnected ? <WifiIcon /> : <WifiOffIcon />}
              label={wsConnected ? 'Live' : 'Offline'}
              color={wsConnected ? 'success' : 'default'}
              size="small"
              variant="outlined"
              title={wsConnected ? 'Real-time updates active' : 'Reconnecting...'}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by Hostname, IP or Site"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
            />
            {userRole !== 'viewer' && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {userRole === 'admin' && <Button variant="contained" onClick={() => setAddModalOpen(true)}>Add Device</Button>}
                <Button variant="contained" color="secondary" onClick={handleScanAll}>Scan All Devices</Button>
                <Button 
                  variant="outlined" 
                  startIcon={<DownloadIcon />} 
                  onClick={handleExportCSV}
                  disabled={allDevices.length === 0}
                >
                  Export CSV
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {notification.open && <Alert severity={notification.severity}>{notification.message}</Alert>}

        {/* Filter Chips */}
        <FilterChipsBar
          devices={allDevices}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {selectedIds.length > 0 && (
          <BulkActionsBar
            selectionCount={selectedIds.length}
            onRefreshFacts={bulkRefreshFacts}
            onRefreshCache={bulkRefreshCache}
            onScanAll={handleScanAll}
            onClearSelection={clearSelection}
            onBulkSetCredentials={() => setBulkCredentialsOpen(true)}
            limitCertsInput={limitCertsInput}
            setLimitCertsInput={setLimitCertsInput}
            userRole={userRole}
          />
        )}

        <DeviceTable
          onSetCredentials={(d: Device) => { setSelectedDevice(d); setCredentialModalOpen(true); }}
          onDeleteDevice={handleDeleteDevice}
          onRowClick={handleRowClick}
          refreshTrigger={refreshKey}
          searchTerm={searchTerm}
          userRole={userRole}
          onSelectionChange={setSelectedIds}
          clearSelectionKey={clearSelectionKey}
          filters={filters}
          onDevicesLoaded={setAllDevices}
        />
      </Paper>

      {/* Device Detail Drawer */}
      <DeviceDetailDrawer
        open={detailDrawerOpen}
        onClose={handleDrawerClose}
        device={drawerDevice}
        onSetCredentials={(d: Device) => {
          setSelectedDevice(d);
          setCredentialModalOpen(true);
          setDetailDrawerOpen(false);
        }}
        onEdit={handleEditDevice}
        onRefreshFacts={handleRefreshFacts}
        onScan={handleScanDevice}
      />

      <CredentialDialog open={credentialModalOpen} onClose={() => setCredentialModalOpen(false)} onSave={handleSaveCredentials} device={selectedDevice} />
      <EditDeviceDialog 
        open={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        device={editDevice} 
        onSave={handleSaveDevice} 
      />
      <BulkCredentialsDialog
        open={bulkCredentialsOpen}
        onClose={() => {
          setBulkCredentialsOpen(false);
          forceTableRefresh();
        }}
        devices={allDevices.filter(d => selectedIds.includes(d.id))}
        onSave={handleBulkCredentialSave}
      />
      {userRole === 'admin' && <AddDeviceDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdd={handleAddDevice} />}
    </Box>
  );
};

export default DevicesPage;
