// frontend/src/pages/PfxPage.jsx

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import PfxGenerator from '../components/PfxGenerator';

// --- ESTILO REUTILIZABLE PARA EL EFECTO DE VIDRIO ---
const glassmorphicStyle = {
  p: { xs: 2, sm: 3, md: 4 }, // Padding responsivo para más espacio
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  borderRadius: '20px', // Mantenemos el radio de borde grande y sutil
};

function PfxPage() {
  return (
    <Box>
      {/* El título y la descripción ahora están fuera del Paper para un look más limpio */}
      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
        PFX File Generator
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Use this tool to combine a certificate, a private key, and an optional chain file into a single, password-protected PFX file.
      </Typography>
      
      {/* 
        ✅ ¡AQUÍ ESTÁ EL REDISEÑO! ✅
        Este Paper ahora es el contenedor principal del formulario, con el estilo "de vidrio".
        Limitamos su ancho para que se vea bien en pantallas grandes.
      */}
      <Paper elevation={0} sx={{ ...glassmorphicStyle, maxWidth: '800px' }}>
        {/* 
          Renderizamos tu componente PfxGenerator aquí dentro.
          NOTA: Para que esto funcione perfectamente, asegúrate de que el componente
          PfxGenerator NO tenga su propio <Paper> o fondo, para que sea "transparente"
          y se integre con este nuevo contenedor.
        */}
        <PfxGenerator />
      </Paper>
    </Box>
  );
}

export default PfxPage;