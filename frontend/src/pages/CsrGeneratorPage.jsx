// frontend/src/pages/CsrGeneratorPage.jsx
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

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    Box, Typography, Paper, Alert, Button, 
    Divider, Tabs, Tab,
} from '@mui/material';
import {
    Add as AddIcon,
    List as ListIcon,
} from '@mui/icons-material';
import CSRGeneratorWizard from '../components/CSRGeneratorWizard';
import PendingCSRsPanel from '../components/PendingCSRsPanel';

function TabPanel({ children, value, index, ...other }) {
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

function CsrGeneratorPage() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Certificate passed from inventory (optional)
    const certificateToRenew = location.state?.certificateToRenew;
    
    const [tabValue, setTabValue] = useState(0);
    const [wizardOpen, setWizardOpen] = useState(!!certificateToRenew);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleOpenWizard = () => {
        setWizardOpen(true);
    };

    const handleCloseWizard = () => {
        setWizardOpen(false);
        // Clear the location state so refreshing doesn't reopen
        if (certificateToRenew) {
            navigate('/generate-csr', { replace: true });
        }
    };

    const handleCompleted = (result) => {
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
                    onChange={(e, v) => setTabValue(v)}
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
}

export default CsrGeneratorPage;