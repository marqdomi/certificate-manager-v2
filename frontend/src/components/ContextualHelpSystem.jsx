/**
 * 🎓 Contextual Help System - CMT v2.5
 * Sistema completo de ayuda contextual con tours guiados, documentación inline y asistente virtual
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Chip,
  Avatar,
  Card,
  CardContent,
  CardActions,
  Fab,
  Badge,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Alert,
  Slide,
  Fade,
  Grid,
  useTheme,
  alpha
} from '@mui/material';

import {
  Help as HelpIcon,
  Close as CloseIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Book as GuideIcon,
  QuestionAnswer as QAIcon,
  Lightbulb as TipIcon,
  VideoLibrary as VideoIcon,
  Assignment as TutorialIcon,
  Speed as QuickStartIcon,
  Support as SupportIcon,
  Chat as ChatIcon,
  ContactSupport as ContactIcon,
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  Star as FavoriteIcon,
  History as RecentIcon,
  Bookmark as BookmarkIcon
} from '@mui/icons-material';

/**
 * 🎯 Componente principal del sistema de ayuda
 */
export const ContextualHelpSystem = ({ 
  context = 'dashboard',
  onClose,
  initialTour = null,
  showFab = true
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState('overview'); // overview, tours, guides, search, chat
  const [activeTour, setActiveTour] = useState(null);
  const [tourStep, setTourStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpHistory, setHelpHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (initialTour) {
      setActiveTour(initialTour);
      setCurrentView('tours');
      setIsOpen(true);
    }
  }, [initialTour]);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Floating Action Button */}
      {showFab && (
        <Fab
          color="primary"
          onClick={handleOpen}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: theme.zIndex.fab,
            boxShadow: theme.shadows[8]
          }}
        >
          <Badge badgeContent={helpHistory.length > 0 ? '!' : null} color="error">
            <HelpIcon />
          </Badge>
        </Fab>
      )}

      {/* Panel principal de ayuda */}
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 480, md: 520 },
            maxWidth: '90vw'
          }
        }}
      >
        <HelpPanelContent
          context={context}
          currentView={currentView}
          setCurrentView={setCurrentView}
          activeTour={activeTour}
          setActiveTour={setActiveTour}
          tourStep={tourStep}
          setTourStep={setTourStep}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          helpHistory={helpHistory}
          setHelpHistory={setHelpHistory}
          favorites={favorites}
          setFavorites={setFavorites}
          onClose={handleClose}
        />
      </Drawer>

      {/* Overlay del tour activo */}
      {activeTour && (
        <TourOverlay
          tour={activeTour}
          currentStep={tourStep}
          onNext={() => setTourStep(prev => prev + 1)}
          onPrevious={() => setTourStep(prev => prev - 1)}
          onComplete={() => {
            setActiveTour(null);
            setTourStep(0);
          }}
          onCancel={() => {
            setActiveTour(null);
            setTourStep(0);
          }}
        />
      )}
    </>
  );
};

/**
 * 📚 Contenido principal del panel de ayuda
 */
const HelpPanelContent = ({
  context,
  currentView,
  setCurrentView,
  activeTour,
  setActiveTour,
  tourStep,
  setTourStep,
  searchQuery,
  setSearchQuery,
  helpHistory,
  setHelpHistory,
  favorites,
  setFavorites,
  onClose
}) => {
  const contextData = getContextualHelpData(context);

  const addToHistory = (item) => {
    setHelpHistory(prev => [
      { ...item, timestamp: Date.now() },
      ...prev.filter(h => h.id !== item.id).slice(0, 9)
    ]);
  };

  const toggleFavorite = (item) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id);
      if (exists) {
        return prev.filter(f => f.id !== item.id);
      } else {
        return [...prev, item].slice(0, 20);
      }
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.05)
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <HelpIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Centro de Ayuda
            </Typography>
            <Chip 
              label={contextData.name} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Navegación rápida */}
        <Box display="flex" gap={1} mt={2} flexWrap="wrap">
          {[
            { id: 'overview', label: 'Resumen', icon: HelpIcon },
            { id: 'tours', label: 'Tours', icon: StartIcon },
            { id: 'guides', label: 'Guías', icon: GuideIcon },
            { id: 'search', label: 'Buscar', icon: SearchIcon },
            { id: 'chat', label: 'Asistente', icon: ChatIcon }
          ].map(tab => (
            <Button
              key={tab.id}
              size="small"
              variant={currentView === tab.id ? 'contained' : 'outlined'}
              startIcon={<tab.icon fontSize="small" />}
              onClick={() => setCurrentView(tab.id)}
              sx={{ minWidth: 'auto' }}
            >
              {tab.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Contenido principal */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {currentView === 'overview' && (
          <OverviewContent 
            context={context}
            contextData={contextData}
            onStartTour={(tour) => {
              setActiveTour(tour);
              setTourStep(0);
            }}
            onViewGuide={(guide) => {
              setCurrentView('guides');
              addToHistory(guide);
            }}
          />
        )}

        {currentView === 'tours' && (
          <ToursContent
            context={context}
            onStartTour={(tour) => {
              setActiveTour(tour);
              setTourStep(0);
            }}
            addToHistory={addToHistory}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        )}

        {currentView === 'guides' && (
          <GuidesContent
            context={context}
            addToHistory={addToHistory}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        )}

        {currentView === 'search' && (
          <SearchContent
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            context={context}
            addToHistory={addToHistory}
          />
        )}

        {currentView === 'chat' && (
          <ChatAssistant
            context={context}
            onNavigateToGuide={(guide) => {
              setCurrentView('guides');
              addToHistory(guide);
            }}
          />
        )}
      </Box>

      {/* Footer con historial y favoritos */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.default, 0.5)
        }}
      >
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Acceso rápido
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          {helpHistory.slice(0, 3).map((item, index) => (
            <Chip
              key={index}
              label={item.title}
              size="small"
              icon={<RecentIcon fontSize="small" />}
              onClick={() => addToHistory(item)}
              sx={{ fontSize: '0.7rem' }}
            />
          ))}
          {favorites.slice(0, 2).map((item, index) => (
            <Chip
              key={`fav-${index}`}
              label={item.title}
              size="small"
              icon={<FavoriteIcon fontSize="small" />}
              color="primary"
              variant="outlined"
              onClick={() => addToHistory(item)}
              sx={{ fontSize: '0.7rem' }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * 📋 Contenido de resumen
 */
const OverviewContent = ({ context, contextData, onStartTour, onViewGuide }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ p: 2 }}>
      {/* Bienvenida contextual */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Estás en <strong>{contextData.name}</strong>. 
          {contextData.quickTip && ` ${contextData.quickTip}`}
        </Typography>
      </Alert>

      {/* Acciones rápidas */}
      <Typography variant="h6" gutterBottom>
        🚀 Empezar Rápido
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <QuickStartIcon color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Tour Interactivo
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Descubre las funciones principales con un tour paso a paso
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                variant="contained"
                onClick={() => onStartTour(contextData.quickStartTour)}
              >
                Comenzar Tour
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TutorialIcon color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Guía Rápida
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Conceptos básicos y tareas más comunes
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                variant="outlined"
                onClick={() => onViewGuide(contextData.quickGuide)}
              >
                Ver Guía
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Recursos destacados */}
      <Typography variant="h6" gutterBottom>
        📚 Recursos Destacados
      </Typography>
      
      <List>
        {contextData.featuredResources?.map((resource, index) => (
          <ListItemButton key={index} onClick={() => onViewGuide(resource)}>
            <ListItemIcon>
              <resource.icon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={resource.title}
              secondary={resource.description}
            />
          </ListItemButton>
        ))}
      </List>

      {/* Tips contextuales */}
      {contextData.tips && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            💡 Tips para {contextData.name}
          </Typography>
          {contextData.tips.map((tip, index) => (
            <Alert key={index} severity="success" sx={{ mb: 1 }}>
              <Typography variant="body2">{tip}</Typography>
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * 🎬 Contenido de tours
 */
const ToursContent = ({ context, onStartTour, addToHistory, favorites, toggleFavorite }) => {
  const tours = getAvailableTours(context);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        🎬 Tours Interactivos
      </Typography>
      
      {tours.map((tour, index) => (
        <Card key={index} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {tour.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {tour.description}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => toggleFavorite(tour)}
                color={favorites.some(f => f.id === tour.id) ? 'primary' : 'default'}
              >
                <FavoriteIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box display="flex" gap={1} mb={2}>
              <Chip label={`${tour.steps?.length || 0} pasos`} size="small" />
              <Chip label={tour.difficulty} size="small" color="primary" variant="outlined" />
              <Chip label={`~${tour.duration} min`} size="small" color="secondary" variant="outlined" />
            </Box>
          </CardContent>
          
          <CardActions>
            <Button
              variant="contained"
              startIcon={<StartIcon />}
              onClick={() => {
                onStartTour(tour);
                addToHistory(tour);
              }}
            >
              Iniciar Tour
            </Button>
            <Button size="small">Previsualizar</Button>
          </CardActions>
        </Card>
      ))}
    </Box>
  );
};

/**
 * 📖 Contenido de guías
 */
const GuidesContent = ({ context, addToHistory, favorites, toggleFavorite }) => {
  const guides = getAvailableGuides(context);
  const [expandedGuide, setExpandedGuide] = useState(null);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        📖 Guías y Documentación
      </Typography>

      {guides.map((guide, index) => (
        <Accordion 
          key={index}
          expanded={expandedGuide === index}
          onChange={(e, isExpanded) => setExpandedGuide(isExpanded ? index : null)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <guide.icon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                {guide.title}
              </Typography>
              <Box sx={{ ml: 'auto', mr: 1 }}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(guide);
                  }}
                  color={favorites.some(f => f.id === guide.id) ? 'primary' : 'default'}
                >
                  <FavoriteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </AccordionSummary>
          
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>
              {guide.description}
            </Typography>
            
            {guide.sections?.map((section, sIndex) => (
              <Box key={sIndex} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {section.title}
                </Typography>
                <Typography variant="body2" paragraph>
                  {section.content}
                </Typography>
              </Box>
            ))}

            <Button
              variant="outlined"
              size="small"
              onClick={() => addToHistory(guide)}
            >
              Marcar como Leído
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

/**
 * 🔍 Contenido de búsqueda
 */
const SearchContent = ({ searchQuery, setSearchQuery, context, addToHistory }) => {
  const theme = useTheme();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.trim()) {
      setLoading(true);
      // Simular búsqueda
      setTimeout(() => {
        const mockResults = searchHelpContent(searchQuery, context);
        setResults(mockResults);
        setLoading(false);
      }, 500);
    } else {
      setResults([]);
    }
  }, [searchQuery, context]);

  return (
    <Box sx={{ p: 2 }}>
      <TextField
        fullWidth
        placeholder="Buscar en la ayuda..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
        sx={{ mb: 3 }}
      />

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {results.length > 0 && (
        <List>
          {results.map((result, index) => (
            <ListItemButton 
              key={index} 
              onClick={() => addToHistory(result)}
              sx={{ mb: 1, borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
            >
              <ListItemIcon>
                <result.icon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={result.title}
                secondary={result.snippet}
              />
            </ListItemButton>
          ))}
        </List>
      )}

      {searchQuery && !loading && results.length === 0 && (
        <Alert severity="info">
          No se encontraron resultados para "{searchQuery}"
        </Alert>
      )}
    </Box>
  );
};

/**
 * 🤖 Asistente de chat
 */
const ChatAssistant = ({ context, onNavigateToGuide }) => {
  const [messages, setMessages] = useState([
    {
      type: 'assistant',
      content: `¡Hola! Soy tu asistente virtual para CMT. Estoy aquí para ayudarte con ${getContextualHelpData(context).name}. ¿En qué puedo ayudarte?`,
      timestamp: Date.now()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      type: 'user',
      content: inputMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // Simular respuesta del asistente
    setTimeout(() => {
      const response = generateAssistantResponse(inputMessage, context);
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: response.content,
        suggestions: response.suggestions,
        timestamp: Date.now()
      }]);
    }, 1000);
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        🤖 Asistente Virtual
      </Typography>

      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              mb: 2
            }}
          >
            <Paper
              sx={{
                p: 2,
                maxWidth: '80%',
                bgcolor: message.type === 'user' ? 'primary.main' : 'background.paper',
                color: message.type === 'user' ? 'primary.contrastText' : 'text.primary'
              }}
            >
              <Typography variant="body2">
                {message.content}
              </Typography>
              
              {message.suggestions && (
                <Box sx={{ mt: 1 }}>
                  {message.suggestions.map((suggestion, sIndex) => (
                    <Button
                      key={sIndex}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                      onClick={() => onNavigateToGuide(suggestion)}
                    >
                      {suggestion.title}
                    </Button>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        ))}
      </Box>

      <Box display="flex" gap={1}>
        <TextField
          fullWidth
          size="small"
          placeholder="Escribe tu pregunta..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <Button variant="contained" onClick={sendMessage}>
          Enviar
        </Button>
      </Box>
    </Box>
  );
};

/**
 * 🎯 Overlay del tour activo
 */
const TourOverlay = ({ tour, currentStep, onNext, onPrevious, onComplete, onCancel }) => {
  const step = tour.steps[currentStep];
  const isLastStep = currentStep === tour.steps.length - 1;

  if (!step) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: alpha('#000', 0.5),
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Paper
        sx={{
          p: 3,
          maxWidth: 400,
          m: 2,
          position: 'relative'
        }}
      >
        {/* Progress */}
        <Box sx={{ mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">{tour.title}</Typography>
            <IconButton size="small" onClick={onCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(currentStep + 1) / tour.steps.length * 100} 
          />
          <Typography variant="caption" color="text.secondary">
            Paso {currentStep + 1} de {tour.steps.length}
          </Typography>
        </Box>

        {/* Step content */}
        <Typography variant="h6" gutterBottom>
          {step.title}
        </Typography>
        <Typography variant="body2" paragraph>
          {step.content}
        </Typography>

        {/* Navigation */}
        <Box display="flex" justifyContent="between" gap={1}>
          <Button
            onClick={onPrevious}
            disabled={currentStep === 0}
            startIcon={<BackIcon />}
          >
            Anterior
          </Button>
          
          <Box sx={{ flex: 1 }} />
          
          {isLastStep ? (
            <Button
              variant="contained"
              onClick={onComplete}
              endIcon={<CompletedIcon />}
            >
              Completar
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onNext}
              endIcon={<NextIcon />}
            >
              Siguiente
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

/**
 * 🔧 Funciones auxiliares y datos
 */
const getContextualHelpData = (context) => {
  const helpData = {
    dashboard: {
      name: 'Panel Principal',
      quickTip: 'Aquí puedes ver un resumen de todos tus certificados y dispositivos.',
      quickStartTour: {
        id: 'dashboard-quick',
        title: 'Tour del Dashboard',
        description: 'Conoce las funciones principales del panel',
        steps: [
          { title: 'Bienvenido', content: 'Este es tu panel de control principal...' },
          { title: 'Métricas', content: 'Aquí puedes ver las estadísticas importantes...' },
          { title: 'Acciones Rápidas', content: 'Usa estos botones para acciones comunes...' }
        ],
        difficulty: 'Principiante',
        duration: 3
      },
      featuredResources: [
        { 
          id: 'cert-basics', 
          title: 'Conceptos Básicos de Certificados', 
          description: 'Aprende qué son y cómo funcionan',
          icon: SecurityIcon 
        },
        { 
          id: 'first-steps', 
          title: 'Primeros Pasos', 
          description: 'Guía para nuevos usuarios',
          icon: QuickStartIcon 
        }
      ],
      tips: [
        'Usa los filtros para encontrar certificados específicos rápidamente',
        'Los certificados próximos a vencer se muestran en amarillo',
        'Haz clic en cualquier métrica para ver más detalles'
      ]
    },
    certificates: {
      name: 'Gestión de Certificados',
      quickTip: 'Gestiona todos tus certificados SSL/TLS desde aquí.',
      featuredResources: [
        { 
          id: 'cert-upload', 
          title: 'Subir Certificados', 
          description: 'Cómo añadir nuevos certificados',
          icon: VideoIcon 
        }
      ]
    }
    // Agregar más contextos según sea necesario
  };

  return helpData[context] || helpData.dashboard;
};

const getAvailableTours = (context) => {
  return [
    {
      id: 'getting-started',
      title: 'Primeros Pasos en CMT',
      description: 'Tour completo para nuevos usuarios',
      difficulty: 'Principiante',
      duration: 10,
      steps: [
        { title: 'Bienvenida', content: 'Bienvenido a CMT...' },
        { title: 'Navegación', content: 'Aprende a navegar...' },
        { title: 'Certificados', content: 'Gestión de certificados...' }
      ]
    },
    {
      id: 'advanced-features',
      title: 'Funciones Avanzadas',
      description: 'Descubre las características más potentes',
      difficulty: 'Avanzado',
      duration: 15,
      steps: []
    }
  ];
};

const getAvailableGuides = (context) => {
  return [
    {
      id: 'cert-management',
      title: 'Gestión de Certificados',
      description: 'Guía completa para manejar certificados SSL/TLS',
      icon: SecurityIcon,
      sections: [
        {
          title: 'Introducción',
          content: 'Los certificados SSL/TLS son fundamentales...'
        },
        {
          title: 'Instalación',
          content: 'Para instalar un certificado...'
        }
      ]
    }
  ];
};

const searchHelpContent = (query, context) => {
  // Simulación de búsqueda
  return [
    {
      id: 'search-result-1',
      title: `Resultado para "${query}"`,
      snippet: 'Descripción del resultado de búsqueda...',
      icon: HelpIcon
    }
  ];
};

const generateAssistantResponse = (message, context) => {
  // Simulación de respuesta del asistente
  return {
    content: `Entiendo que necesitas ayuda con "${message}". Te puedo sugerir algunos recursos útiles.`,
    suggestions: [
      { id: 'suggestion-1', title: 'Ver Guía Relacionada' },
      { id: 'suggestion-2', title: 'Iniciar Tour' }
    ]
  };
};

// Provider para el sistema de ayuda contextual
export const ContextualHelpProvider = ({ children }) => {
  return (
    <Box>
      {children}
    </Box>
  );
};

export default ContextualHelpSystem;