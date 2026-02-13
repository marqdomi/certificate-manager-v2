// frontend/src/pages/PfxPage.jsx

import React from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import PfxGenerator from '../components/PfxGenerator';
import { PageHeader } from '../components/shared';
import { glassmorphicCard } from '../constants/styleMixins';

function PfxPage() {
  const theme = useTheme();
  return (
    <Box>
      <PageHeader
        title="PFX File Generator"
        subtitle="Use this tool to combine a certificate, a private key, and an optional chain file into a single, password-protected PFX file."
      />
      <Paper elevation={0} sx={{ ...glassmorphicCard(theme), p: { xs: 2, sm: 3, md: 4 }, maxWidth: '800px' }}>
        <PfxGenerator />
      </Paper>
    </Box>
  );
}

export default PfxPage;