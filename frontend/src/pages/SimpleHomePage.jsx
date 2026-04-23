/**
 * 🏠 Página de Inicio Simplificada
 * Sin importaciones complejas para evitar errores
 */
import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button,
  Stack
} from '@mui/material';

const SimpleHomePage = () => {
  const handleNavigation = (path) => {
    window.location.href = path;
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      p: 3
    }}>
      <Paper sx={{ 
        maxWidth: 600, 
        p: 4, 
        textAlign: 'center',
        borderRadius: 3,
        boxShadow: 3
      }}>
        <Typography variant="h3" gutterBottom color="primary">
          🎉 CMT v2.5
        </Typography>
        
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Certificate Management Tool
        </Typography>
        
        <Typography variant="body1" paragraph sx={{ mb: 4 }}>
          Sistema de gestión de certificados con GUI enhancements integrados.
          ¡Bienvenido a la nueva versión!
        </Typography>

        <Stack spacing={2} direction="row" justifyContent="center">
          <Button 
            variant="contained" 
            size="large"
            onClick={() => handleNavigation('/app/dashboard')}
            sx={{ minWidth: 140 }}
          >
            🏠 Dashboard
          </Button>
          
          <Button 
            variant="outlined" 
            size="large"
            onClick={() => handleNavigation('/app/demo')}
            sx={{ minWidth: 140 }}
          >
            🎨 Ver Demo
          </Button>
        </Stack>

        <Typography variant="caption" display="block" sx={{ mt: 4, opacity: 0.7 }}>
          v2.5 - Release con GUI Enhancements
        </Typography>
      </Paper>
    </Box>
  );
};

export default SimpleHomePage;