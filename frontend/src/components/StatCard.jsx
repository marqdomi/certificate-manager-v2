// frontend/src/components/StatCard.jsx

import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

// --- ESTE ES EL ESTILO REUTILIZABLE PARA EL EFECTO DE VIDRIO ---
const glassmorphicStyle = {
  p: 2.5,
  height: '100%',
  // Usamos una función para acceder al tema y cambiar el color según el modo
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out', // Transición suave
  '&:hover': {
    transform: 'translateY(-5px)', // Efecto de elevación al pasar el mouse
    boxShadow: (theme) => `0 10px 20px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
  },
};

function StatCard({ title, value, color, onClick }) {
  return (
    <Paper 
      elevation={0} // Quitamos la sombra base porque ya tenemos un borde y un hover
      sx={{ 
        ...glassmorphicStyle,
        cursor: 'pointer', // Indica que es clickeable
      }} 
      onClick={onClick}
    >
      <Box>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', color: color }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

export default StatCard;