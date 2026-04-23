/**
 * 🏠 Home Page Simple
 * Página simple para verificar que la aplicación funciona
 */
import React from 'react';
import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            🎉 ¡Bienvenido a CMT v2.5!
          </Typography>
          <Typography variant="body1" paragraph>
            El sistema de gestión de certificados está funcionando correctamente.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/demo')}
            sx={{ mr: 2 }}
          >
            Ver Demo GUI
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/dashboard')}
          >
            Ir al Dashboard
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default HomePage;