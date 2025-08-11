// frontend/src/components/Dashboard.jsx (VERSIÓN CON FILTRO CORREGIDO)

import React from 'react';
import { Grid, Paper, Typography, Box, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- (El estilo y el componente StatCard permanecen igual) ---
const glassmorphicStyle = {
  p: { xs: 2, sm: 2.5 },
  height: '100%',
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  borderRadius: (theme) => theme.shape.borderRadius,
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
};

const StatCard = ({ title, value, color, onClick }) => (
  <Paper 
    elevation={0}
    sx={{ 
      ...glassmorphicStyle,
      textAlign: 'center',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      borderRadius: '16px',
      '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: (theme) => `0 10px 20px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(90, 100, 120, 0.15)'}`,
      },
    }} 
    onClick={onClick}
  >
    <Typography variant="body1" color="text.secondary" gutterBottom>
      {title}
    </Typography>
    <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', color }}>
      {value}
    </Typography>
  </Paper>
);


// --- Componente principal del Dashboard ---
const Dashboard = ({ stats, onFilterSelect }) => {
  const theme = useTheme();
  
  const safeStats = stats || {};
  const total = safeStats.total ?? 0;
  const healthy = safeStats.healthy ?? 0;
  const warning = safeStats.warning ?? 0;
  const expired = safeStats.expired ?? 0;

  const pieData = [
    { name: 'Healthy (> 30d)', value: healthy, color: theme.palette.success.main },
    { name: 'Warning (< 30d)', value: warning, color: theme.palette.warning.main },
    { name: 'Expired', value: expired, color: theme.palette.error.main },
  ];
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }) => {
    if (percent * 100 < 5) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill={theme.palette.getContrastText(payload.color)} textAnchor="middle" dominantBaseline="central" fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Grid container spacing={3}>
      
      {/* --- ✅ CORRECCIÓN DE LA FUNCIONALIDAD DE FILTRO AQUÍ ✅ --- */}
      {/* Volvemos a pasar el objeto que la página de inventario espera recibir */}

      <Grid item xs={12} sm={6} md={3}>
        {/* Para 'Total', pasamos null para que no se aplique ningún filtro */}
        <StatCard title="Total Certificates" value={total} color={theme.palette.text.primary} onClick={() => onFilterSelect(null)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard title="Healthy (> 30 days)" value={healthy} color={theme.palette.success.main} onClick={() => onFilterSelect({ type: 'status', value: 'healthy' })} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard title="Warning (< 30 days)" value={warning} color={theme.palette.warning.main} onClick={() => onFilterSelect({ type: 'status', value: 'warning' })} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard title="Expired" value={expired} color={theme.palette.error.main} onClick={() => onFilterSelect({ type: 'status', value: 'expired' })} />
      </Grid>
      
      {/* --- (El resto del componente del gráfico no cambia) --- */}
      <Grid item xs={12}>
        <Paper 
              elevation={0} 
              sx={{ 
                ...glassmorphicStyle, 
                borderRadius: '16px' // Aplicamos el mismo radio de borde que a las StatCards
              }}
            >
           <Typography variant="h6" align="center" sx={{ fontWeight: 'bold', mb: 2 }}>
             Certificate Health Overview
           </Typography>
           <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie 
                            data={pieData} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius="80%"
                            innerRadius="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke={theme.palette.background.paper} strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            borderColor: theme.palette.divider,
                            borderRadius: theme.shape.borderRadius
                          }}
                          formatter={(value) => [value, 'Certificates']} 
                        />
                        <Legend iconSize={12} verticalAlign="bottom" wrapperStyle={{paddingTop: 20}} />
                    </PieChart>
                </ResponsiveContainer>
            </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Dashboard;