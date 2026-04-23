// frontend/src/components/MetricsSection.jsx

import React from 'react';
import { Box, Typography, Grid, Divider, useTheme, GlobalStyles } from '@mui/material';

const MetricsSection = ({ title, subtitle, children, icon: Icon, delay = 0 }) => {
  const theme = useTheme();

  return (
    <>
      <GlobalStyles styles={{
        '@keyframes fadeInSlideUp': {
          from: {
            opacity: 0,
            transform: 'translateY(20px)'
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)'
          }
        }
      }} />
      <Box sx={{ mb: 4 }}>
        {title && (
          <>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 2,
              opacity: 0,
              animation: `fadeInSlideUp 0.6s ease-out ${delay}ms forwards`
            }}>
              {Icon && (
                <Icon sx={{ 
                  mr: 1.5, 
                  color: theme.palette.primary.main,
                  fontSize: '1.5rem'
                }} />
              )}
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'text.primary',
                    mb: subtitle ? 0.5 : 0
                  }}
                >
                  {title}
                </Typography>
                {subtitle && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary',
                      fontSize: '0.875rem'
                    }}
                  >
                    {subtitle}
                  </Typography>
                )}
              </Box>
            </Box>
            <Divider sx={{ 
              mb: 3, 
              bgcolor: theme.palette.divider,
              opacity: 0.3
            }} />
          </>
        )}
        
        <Grid container spacing={3}>
          {children}
        </Grid>
      </Box>
    </>
  );
};

export default MetricsSection;