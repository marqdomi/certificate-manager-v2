/**
 * 🎯 Demo Page - GUI Enhancements Showcase
 * Página de demostración para mostrar todas las GUI enhancements integradas
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Paper,
  Switch,
  FormControlLabel
} from '@mui/material';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import HelpIcon from '@mui/icons-material/Help';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import SpeedIcon from '@mui/icons-material/Speed';
import BrushIcon from '@mui/icons-material/Brush';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

// GUI Enhancement Hooks
import { BasicTooltip, RichTooltip } from '../components/EnhancedTooltips';
import { useLoading } from '../context/LoadingContext';

const GuiEnhancementsDemo = () => {
  const [demoProgress, setDemoProgress] = useState(0);
  const [isDragMode, setIsDragMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { setIsLoading, setLoadingMessage } = useLoading();

  const handleLoadingDemo = async () => {
    setIsLoading(true);
    setLoadingMessage('Cargando funcionalidades GUI...');
    
    for (let i = 0; i <= 100; i += 10) {
      setDemoProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setIsLoading(false);
    setLoadingMessage('');
    setDemoProgress(0);
  };

  const handleTooltipDemo = (event) => {
    alert('🎉 Enhanced Tooltip Demo!\n\n✨ Características avanzadas:\n• Contenido rico con HTML\n• Posicionamiento inteligente\n• Analytics automáticos\n• Theming adaptativo\n• Performance optimizada');
  };

  const demoFeatures = [
    {
      title: "🎯 Enhanced Tooltips",
      description: "Tooltips inteligentes con contenido rico, analytics y posicionamiento adaptativo",
      icon: <TouchAppIcon />,
      status: "active",
      demo: handleTooltipDemo
    },
    {
      title: "🆘 Contextual Help",
      description: "Sistema de ayuda contextual con tours guiados y documentación embebida",
      icon: <HelpIcon />,
      status: "active",
      demo: () => alert('Tour contextual iniciado! 🎯')
    },
    {
      title: "⌨️ Keyboard Shortcuts",
      description: "Atajos de teclado configurables con resolución de conflictos",
      icon: <KeyboardIcon />,
      status: "active",
      demo: () => alert('Presiona Ctrl+K para ver todos los atajos! ⌨️')
    },
    {
      title: "🚀 Drag & Drop",
      description: "Sistema completo de arrastrar y soltar con feedback visual",
      icon: <DragIndicatorIcon />,
      status: isDragMode ? "active" : "inactive",
      demo: () => setIsDragMode(!isDragMode)
    },
    {
      title: "📊 Progressive Disclosure",
      description: "Revelación progresiva de información basada en experiencia del usuario",
      icon: <AutoFixHighIcon />,
      status: showAdvanced ? "advanced" : "basic",
      demo: () => setShowAdvanced(!showAdvanced)
    }
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Typography variant="h3" gutterBottom>
          🎨 CMT v2.5 - GUI Enhancements Demo
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9 }}>
          Demostración en vivo de todas las mejoras de interfaz de usuario integradas
        </Typography>
      </Paper>

      {/* Demo Controls */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            🎮 Controles de Demostración
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <BasicTooltip title="Simula el sistema de loading global con progreso animado">
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleLoadingDemo}
                color="primary"
              >
                Demo Loading System
              </Button>
            </BasicTooltip>
            <RichTooltip
              title="Enhanced Tooltips"
              description="Sistema avanzado de tooltips con contenido rico, analytics y posicionamiento inteligente"
              type="info"
              shortcut="Hover para ver"
            >
              <Button
                variant="outlined"
                startIcon={<InfoIcon />}
                onClick={(e) => handleTooltipDemo(e)}
              >
                Demo Enhanced Tooltips
              </Button>
            </RichTooltip>
            <FormControlLabel
              control={<Switch checked={isDragMode} onChange={() => setIsDragMode(!isDragMode)} />}
              label="Modo Drag & Drop"
            />
            <FormControlLabel
              control={<Switch checked={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)} />}
              label="Vista Avanzada"
            />
          </Box>
          
          {demoProgress > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">Progreso de carga: {demoProgress}%</Typography>
              <LinearProgress variant="determinate" value={demoProgress} sx={{ mt: 1 }} />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Features Grid */}
      <Grid container spacing={3}>
        {demoFeatures.map((feature, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                transition: 'all 0.3s ease',
                cursor: isDragMode ? 'grab' : 'pointer',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                },
                border: feature.status === 'active' ? '2px solid #4caf50' : 
                        feature.status === 'advanced' ? '2px solid #ff9800' : '1px solid #e0e0e0'
              }}
              onClick={feature.demo}
              draggable={isDragMode}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    {feature.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{feature.title}</Typography>
                    <Chip 
                      label={feature.status} 
                      size="small" 
                      color={feature.status === 'active' ? 'success' : 
                             feature.status === 'advanced' ? 'warning' : 'default'}
                    />
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {feature.description}
                </Typography>

                {showAdvanced && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      🔧 Configuración avanzada disponible para usuarios expertos
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Status Footer */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          ✅ Estado del Sistema
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Typography variant="body2">
              <strong>Error Boundaries:</strong> ✅ Activos
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2">
              <strong>Loading System:</strong> ✅ Funcional
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2">
              <strong>Providers:</strong> ✅ Integrados
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2">
              <strong>GUI Enhancements:</strong> ✅ Operativos
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Keyboard Shortcuts Info */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>💡 Tip:</strong> Usa <kbd>Ctrl+K</kbd> para ver todos los atajos de teclado disponibles, 
          o <kbd>F1</kbd> para abrir el sistema de ayuda contextual.
        </Typography>
      </Alert>
    </Box>
  );
};

export default GuiEnhancementsDemo;