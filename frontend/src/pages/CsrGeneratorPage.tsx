// frontend/src/pages/CsrGeneratorPage.tsx
/**
 * CSR Generator Page v2.5
 * 
 * NEW APPROACH: Generate private key locally (not from F5)
 * This solves the F5 key export limitation.
 * 
 * Features:
 * - Generate new CSR + Private Key
 * - View pending CSR requests
 * - Complete CSRs with signed certificates
 * - Download ready PFX files
 */

import React, { useState, FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    Box, Typography, Paper, Alert, Button, 
    Tabs, Tab,
} from '@mui/material';
import {
    Add as AddIcon,
    List as ListIcon,
} from '@mui/icons-material';
import CSRGeneratorWizard from '../components/CSRGeneratorWizard';
import PendingCSRsPanel from '../components/PendingCSRsPanel';
import type { CertificateToRenew, CSRCompleteResponse } from '../types/csr';

interface TabPanelProps {
    children?: React.ReactNode;
    value: number;
    index: number;
}

const TabPanel: FC<TabPanelProps> = ({ children, value, index, ...other }) => {
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
};

interface LocationState {
    certificateToRenew?: CertificateToRenew;
}

const CsrGeneratorPage: FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Certificate passed from inventory (optional)
    const locationState = location.state as LocationState | null;
    const certificateToRenew = locationState?.certificateToRenew;
    
    const [tabValue, setTabValue] = useState<number>(0);
    const [wizardOpen, setWizardOpen] = useState<boolean>(!!certificateToRenew);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    const handleOpenWizard = (): void => {
        setWizardOpen(true);
    };

    const handleCloseWizard = (): void => {
        setWizardOpen(false);
        // Clear the location state so refreshing doesn't reopen
        if (certificateToRenew) {
            navigate('/generate-csr', { replace: true });
        }
    };

    const handleCompleted = (result: CSRCompleteResponse): void => {
        // Refresh the pending list
        setRefreshKey(prev => prev + 1);
        setTabValue(0); // Switch to pending tab
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    CSR Generator
                </Typography>
                <Button 
                    variant="contained" 
                    startIcon={<AddIcon />}
                    onClick={handleOpenWizard}
                >
                    Generate New CSR
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>How it works:</strong> CMT generates the private key locally (not on F5). 
                    Submit the CSR to your Certificate Authority, then complete the process here to get a PFX file 
                    ready for deployment.
                </Typography>
            </Alert>

            <Paper sx={{ p: 0 }}>
                <Tabs 
                    value={tabValue} 
                    onChange={(_, v) => setTabValue(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label="Pending Requests" icon={<ListIcon />} iconPosition="start" />
                </Tabs>
                
                <Box sx={{ p: 3 }}>
                    <TabPanel value={tabValue} index={0}>
                        <PendingCSRsPanel 
                            key={refreshKey}
                            onRefresh={() => setRefreshKey(prev => prev + 1)} 
                        />
                    </TabPanel>
                </Box>
            </Paper>

            <CSRGeneratorWizard
                open={wizardOpen}
                onClose={handleCloseWizard}
                certificate={certificateToRenew}
                onCompleted={handleCompleted}
            />
        </Box>
    );
};

export default CsrGeneratorPage;
