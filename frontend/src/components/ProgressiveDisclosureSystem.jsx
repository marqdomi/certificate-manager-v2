/**
 * 🎯 Progressive Disclosure System - CMT v2.5
 * Sistema de revelación progresiva que adapta la complejidad de la UI
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Button,
  Chip,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Slider,
  Rating,
  Badge,
  Alert,
  LinearProgress,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tooltip,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  useTheme,
  alpha,
  styled
} from '@mui/material';

import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
  School as BeginnerIcon,
  Work as IntermediateIcon,
  Star as ExpertIcon,
  TrendingUp as AdvancedIcon,
  Lightbulb as TipIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CompleteIcon,
  RadioButtonUnchecked as IncompleteIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon,
  Assessment as ReportsIcon,
  Help as HelpIcon,
  Tune as TuneIcon,
  Psychology as AdaptiveIcon,
  AutoAwesome as IntelligentIcon
} from '@mui/icons-material';

/**
 * 🎯 Componente principal de revelación progresiva
 */
export const ProgressiveDisclosureSystem = ({ 
  userLevel = 'beginner',
  onLevelChange,
  adaptiveMode = true,
  content,
  context = 'dashboard'
}) => {
  const theme = useTheme();
  
  const [currentLevel, setCurrentLevel] = useState(userLevel);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [userProgress, setUserProgress] = useState({});
  const [preferences, setPreferences] = useState({
    showTooltips: true,
    showProgressIndicators: true,
    autoAdvance: true,
    showExpertFeatures: false
  });
  const [adaptiveState, setAdaptiveState] = useState({
    suggestedLevel: userLevel,
    confidence: 0.5,
    interactions: 0,
    successRate: 1.0
  });

  // Configuraciones por nivel de usuario
  const levelConfigs = {
    beginner: {
      label: 'Principiante',
      icon: BeginnerIcon,
      color: 'success',
      maxComplexity: 1,
      showAdvanced: false,
      guidanceLevel: 'high',
      defaultExpanded: true
    },
    intermediate: {
      label: 'Intermedio',
      icon: IntermediateIcon,
      color: 'info',
      maxComplexity: 2,
      showAdvanced: false,
      guidanceLevel: 'medium',
      defaultExpanded: false
    },
    advanced: {
      label: 'Avanzado',
      icon: AdvancedIcon,
      color: 'warning',
      maxComplexity: 3,
      showAdvanced: true,
      guidanceLevel: 'low',
      defaultExpanded: false
    },
    expert: {
      label: 'Experto',
      icon: ExpertIcon,
      color: 'error',
      maxComplexity: 4,
      showAdvanced: true,
      guidanceLevel: 'minimal',
      defaultExpanded: false
    }
  };

  const currentConfig = levelConfigs[currentLevel];

  // Efecto para actualizar nivel adaptativo
  useEffect(() => {
    if (adaptiveMode) {
      updateAdaptiveLevel();
    }
  }, [adaptiveState.interactions, adaptiveState.successRate, adaptiveMode]);

  return (
    <Box>
      {/* Control Panel */}
      <DisclosureControlPanel
        currentLevel={currentLevel}
        levelConfigs={levelConfigs}
        onLevelChange={handleLevelChange}
        preferences={preferences}
        onPreferencesChange={setPreferences}
        adaptiveState={adaptiveState}
        adaptiveMode={adaptiveMode}
      />

      {/* Progressive Content Areas */}
      <ProgressiveContentArea
        level={currentLevel}
        config={currentConfig}
        expandedSections={expandedSections}
        onSectionToggle={handleSectionToggle}
        preferences={preferences}
        context={context}
        onInteraction={trackInteraction}
      />

      {/* Quick Actions */}
      <ProgressiveQuickActions
        level={currentLevel}
        config={currentConfig}
        context={context}
      />

      {/* Adaptive Learning Panel */}
      {adaptiveMode && (
        <AdaptiveLearningPanel
          adaptiveState={adaptiveState}
          currentLevel={currentLevel}
          onLevelSuggestion={handleLevelSuggestion}
        />
      )}
    </Box>
  );

  function handleLevelChange(newLevel) {
    setCurrentLevel(newLevel);
    setAdaptiveState(prev => ({ ...prev, suggestedLevel: newLevel }));
    
    if (onLevelChange) {
      onLevelChange(newLevel);
    }

    // Resetear secciones expandidas según el nuevo nivel
    if (levelConfigs[newLevel].defaultExpanded) {
      setExpandedSections(new Set(['basic', 'quick-actions']));
    } else {
      setExpandedSections(new Set());
    }
  }

  function handleSectionToggle(sectionId) {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });

    trackInteraction('section_toggle', { sectionId, level: currentLevel });
  }

  function trackInteraction(action, data = {}) {
    setAdaptiveState(prev => ({
      ...prev,
      interactions: prev.interactions + 1
    }));

    // Analytics tracking
    console.log('📊 Progressive Disclosure Interaction:', { action, data, level: currentLevel });
  }

  function updateAdaptiveLevel() {
    const { interactions, successRate } = adaptiveState;
    
    // Lógica para sugerir cambio de nivel
    if (interactions > 10) {
      if (successRate > 0.8 && currentLevel !== 'expert') {
        const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const currentIndex = levels.indexOf(currentLevel);
        const suggestedLevel = levels[Math.min(currentIndex + 1, levels.length - 1)];
        
        setAdaptiveState(prev => ({
          ...prev,
          suggestedLevel,
          confidence: Math.min(successRate, 0.9)
        }));
      } else if (successRate < 0.6 && currentLevel !== 'beginner') {
        const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const currentIndex = levels.indexOf(currentLevel);
        const suggestedLevel = levels[Math.max(currentIndex - 1, 0)];
        
        setAdaptiveState(prev => ({
          ...prev,
          suggestedLevel,
          confidence: 1 - successRate
        }));
      }
    }
  }

  function handleLevelSuggestion(acceptSuggestion) {
    if (acceptSuggestion) {
      handleLevelChange(adaptiveState.suggestedLevel);
    }
    
    // Reset adaptive state
    setAdaptiveState(prev => ({
      ...prev,
      interactions: 0,
      confidence: 0.5
    }));
  }
};

/**
 * ⚙️ Panel de control de revelación
 */
const DisclosureControlPanel = ({
  currentLevel,
  levelConfigs,
  onLevelChange,
  preferences,
  onPreferencesChange,
  adaptiveState,
  adaptiveMode
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        avatar={
          <Badge 
            badgeContent={adaptiveMode ? 'AUTO' : null} 
            color="primary" 
            variant="dot"
          >
            <AdaptiveIcon color="primary" />
          </Badge>
        }
        title="Nivel de Experiencia"
        subheader={`Actual: ${levelConfigs[currentLevel].label}`}
        action={
          <IconButton onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        }
      />
      
      <Collapse in={isExpanded}>
        <CardContent>
          <Grid container spacing={3}>
            {/* Level Selection */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Seleccionar Nivel
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {Object.entries(levelConfigs).map(([level, config]) => (
                  <Chip
                    key={level}
                    icon={<config.icon />}
                    label={config.label}
                    color={currentLevel === level ? config.color : 'default'}
                    variant={currentLevel === level ? 'filled' : 'outlined'}
                    onClick={() => onLevelChange(level)}
                    clickable
                  />
                ))}
              </Box>
            </Grid>

            {/* Preferences */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Preferencias
              </Typography>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.showTooltips}
                      onChange={(e) => onPreferencesChange(prev => ({ 
                        ...prev, 
                        showTooltips: e.target.checked 
                      }))}
                    />
                  }
                  label="Mostrar tooltips"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.showProgressIndicators}
                      onChange={(e) => onPreferencesChange(prev => ({ 
                        ...prev, 
                        showProgressIndicators: e.target.checked 
                      }))}
                    />
                  }
                  label="Indicadores de progreso"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.autoAdvance}
                      onChange={(e) => onPreferencesChange(prev => ({ 
                        ...prev, 
                        autoAdvance: e.target.checked 
                      }))}
                    />
                  }
                  label="Avance automático"
                />
              </Box>
            </Grid>

            {/* Adaptive Info */}
            {adaptiveMode && (
              <Grid item xs={12}>
                <Alert severity="info" icon={<IntelligentIcon />}>
                  <Typography variant="body2">
                    <strong>Modo Adaptativo Activo:</strong> 
                    {` ${adaptiveState.interactions} interacciones realizadas. `}
                    {adaptiveState.suggestedLevel !== currentLevel && (
                      <>Se sugiere cambiar a: <strong>{levelConfigs[adaptiveState.suggestedLevel].label}</strong></>
                    )}
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
};

/**
 * 📝 Área de contenido progresivo
 */
const ProgressiveContentArea = ({
  level,
  config,
  expandedSections,
  onSectionToggle,
  preferences,
  context,
  onInteraction
}) => {
  // Contenido por secciones y niveles
  const contentSections = {
    basic: {
      title: 'Funciones Básicas',
      complexity: 1,
      icon: DashboardIcon,
      content: getBasicContent(level, context)
    },
    intermediate: {
      title: 'Herramientas Intermedias',
      complexity: 2,
      icon: SpeedIcon,
      content: getIntermediateContent(level, context)
    },
    advanced: {
      title: 'Características Avanzadas',
      complexity: 3,
      icon: SecurityIcon,
      content: getAdvancedContent(level, context)
    },
    expert: {
      title: 'Funciones de Experto',
      complexity: 4,
      icon: ReportsIcon,
      content: getExpertContent(level, context)
    }
  };

  const visibleSections = Object.entries(contentSections).filter(
    ([_, section]) => section.complexity <= config.maxComplexity
  );

  return (
    <Box>
      {visibleSections.map(([sectionId, section]) => (
        <ProgressiveSection
          key={sectionId}
          sectionId={sectionId}
          section={section}
          isExpanded={expandedSections.has(sectionId)}
          onToggle={onSectionToggle}
          level={level}
          config={config}
          preferences={preferences}
          onInteraction={onInteraction}
        />
      ))}
    </Box>
  );
};

/**
 * 📋 Sección progresiva individual
 */
const ProgressiveSection = ({
  sectionId,
  section,
  isExpanded,
  onToggle,
  level,
  config,
  preferences,
  onInteraction
}) => {
  const handleItemClick = (item) => {
    onInteraction('item_click', { item: item.id, section: sectionId });
  };

  return (
    <Accordion 
      expanded={isExpanded}
      onChange={() => onToggle(sectionId)}
      sx={{ mb: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1} width="100%">
          <section.icon color="primary" />
          <Typography variant="h6" flex={1}>
            {section.title}
          </Typography>
          
          {preferences.showProgressIndicators && (
            <ComplexityIndicator complexity={section.complexity} maxComplexity={4} />
          )}
          
          <Chip 
            label={`Nivel ${section.complexity}`} 
            size="small" 
            color={section.complexity <= config.maxComplexity ? 'primary' : 'default'}
            variant="outlined"
          />
        </Box>
      </AccordionSummary>
      
      <AccordionDetails>
        <ProgressiveContent
          content={section.content}
          level={level}
          config={config}
          preferences={preferences}
          onItemClick={handleItemClick}
        />
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * 📄 Contenido progresivo renderizado
 */
const ProgressiveContent = ({ 
  content, 
  level, 
  config, 
  preferences, 
  onItemClick 
}) => {
  if (!content || !content.items) return null;

  return (
    <Box>
      {/* Descripción de la sección */}
      {content.description && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {content.description}
        </Alert>
      )}

      {/* Items del contenido */}
      <Grid container spacing={2}>
        {content.items.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={item.id || index}>
            <ProgressiveContentItem
              item={item}
              level={level}
              config={config}
              preferences={preferences}
              onClick={() => onItemClick(item)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Tips y sugerencias */}
      {content.tips && content.tips.length > 0 && (
        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            💡 Consejos:
          </Typography>
          {content.tips.map((tip, index) => (
            <Alert key={index} severity="info" sx={{ mb: 1 }}>
              {tip}
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * 🃏 Item de contenido individual
 */
const ProgressiveContentItem = ({ 
  item, 
  level, 
  config, 
  preferences, 
  onClick 
}) => {
  const isAccessible = item.requiredLevel 
    ? getLevelOrder(level) >= getLevelOrder(item.requiredLevel)
    : true;

  return (
    <Card 
      sx={{ 
        cursor: isAccessible ? 'pointer' : 'not-allowed',
        opacity: isAccessible ? 1 : 0.6,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={isAccessible ? onClick : undefined}
    >
      <CardContent sx={{ flex: 1 }}>
        <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
          {item.icon && <item.icon color={isAccessible ? 'primary' : 'disabled'} />}
          <Box flex={1}>
            <Typography variant="subtitle1" component="h3">
              {item.title}
            </Typography>
            {item.description && (
              <Typography variant="body2" color="text.secondary">
                {item.description}
              </Typography>
            )}
          </Box>
          
          {item.status && (
            <Chip 
              label={item.status} 
              size="small" 
              color={item.status === 'completed' ? 'success' : 'default'}
              variant="outlined"
            />
          )}
        </Box>

        {/* Progress indicator */}
        {preferences.showProgressIndicators && item.progress !== undefined && (
          <Box mt={1}>
            <LinearProgress 
              variant="determinate" 
              value={item.progress} 
              color={item.progress === 100 ? 'success' : 'primary'}
            />
            <Typography variant="caption" color="text.secondary">
              {item.progress}% completado
            </Typography>
          </Box>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <Box mt={1}>
            {item.tags.map((tag, index) => (
              <Chip 
                key={index}
                label={tag} 
                size="small" 
                variant="outlined" 
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * ⚡ Acciones rápidas progresivas
 */
const ProgressiveQuickActions = ({ level, config, context }) => {
  const quickActions = getQuickActionsForLevel(level, context);

  if (!quickActions || quickActions.length === 0) return null;

  return (
    <SpeedDial
      ariaLabel="Acciones rápidas"
      sx={{ position: 'fixed', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
    >
      {quickActions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={action.handler}
        />
      ))}
    </SpeedDial>
  );
};

/**
 * 🧠 Panel de aprendizaje adaptativo
 */
const AdaptiveLearningPanel = ({ 
  adaptiveState, 
  currentLevel, 
  onLevelSuggestion 
}) => {
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => {
    if (adaptiveState.suggestedLevel !== currentLevel && adaptiveState.confidence > 0.7) {
      setShowSuggestion(true);
    }
  }, [adaptiveState.suggestedLevel, currentLevel, adaptiveState.confidence]);

  if (!showSuggestion) return null;

  return (
    <Alert 
      severity="info" 
      sx={{ 
        position: 'fixed', 
        bottom: 80, 
        right: 16, 
        maxWidth: 400,
        zIndex: theme => theme.zIndex.snackbar
      }}
      action={
        <Box>
          <Button 
            color="inherit" 
            size="small" 
            onClick={() => onLevelSuggestion(true)}
          >
            Aceptar
          </Button>
          <Button 
            color="inherit" 
            size="small" 
            onClick={() => onLevelSuggestion(false)}
          >
            Ignorar
          </Button>
        </Box>
      }
    >
      <Typography variant="body2">
        <strong>💡 Sugerencia Inteligente:</strong><br />
        Basado en tu actividad, recomendamos cambiar al nivel{' '}
        <strong>{adaptiveState.suggestedLevel}</strong> para una mejor experiencia.
      </Typography>
    </Alert>
  );
};

/**
 * 📊 Indicador de complejidad
 */
const ComplexityIndicator = ({ complexity, maxComplexity }) => {
  return (
    <Box display="flex" alignItems="center" gap={0.5}>
      <Typography variant="caption" color="text.secondary">
        Complejidad:
      </Typography>
      <Rating 
        value={complexity} 
        max={maxComplexity} 
        size="small" 
        readOnly 
        icon={<StarIcon fontSize="inherit" />}
        emptyIcon={<StarIcon fontSize="inherit" />}
      />
    </Box>
  );
};

/**
 * 🔧 Funciones auxiliares para contenido
 */
const getBasicContent = (level, context) => ({
  description: "Funciones esenciales para comenzar a usar el sistema.",
  items: [
    {
      id: 'dashboard-overview',
      title: 'Panel Principal',
      description: 'Vista general del estado del sistema',
      icon: DashboardIcon,
      status: 'available',
      progress: 100,
      tags: ['esencial', 'vista general']
    },
    {
      id: 'certificate-list',
      title: 'Lista de Certificados',
      description: 'Ver todos los certificados registrados',
      icon: SecurityIcon,
      status: 'available',
      progress: 100,
      tags: ['certificados', 'listado']
    },
    {
      id: 'quick-search',
      title: 'Búsqueda Rápida',
      description: 'Encontrar certificados específicos',
      icon: SearchIcon,
      status: 'available',
      progress: 90,
      tags: ['búsqueda', 'filtros']
    }
  ],
  tips: [
    "Comienza explorando el panel principal para familiarizarte con el sistema",
    "Usa la búsqueda rápida para encontrar certificados específicos"
  ]
});

const getIntermediateContent = (level, context) => ({
  description: "Herramientas para usuarios con experiencia básica.",
  items: [
    {
      id: 'certificate-upload',
      title: 'Subir Certificados',
      description: 'Agregar nuevos certificados al sistema',
      icon: UploadIcon,
      status: 'available',
      progress: 75,
      tags: ['upload', 'gestión']
    },
    {
      id: 'advanced-filters',
      title: 'Filtros Avanzados',
      description: 'Búsqueda detallada con múltiples criterios',
      icon: FilterIcon,
      status: 'in-progress',
      progress: 60,
      tags: ['filtros', 'búsqueda avanzada']
    },
    {
      id: 'export-reports',
      title: 'Exportar Reportes',
      description: 'Generar reportes en diferentes formatos',
      icon: ReportsIcon,
      status: 'available',
      progress: 85,
      tags: ['reportes', 'exportación']
    }
  ],
  tips: [
    "Los filtros avanzados te permiten búsquedas más específicas",
    "Puedes exportar reportes en formato PDF, Excel o CSV"
  ]
});

const getAdvancedContent = (level, context) => ({
  description: "Características avanzadas para usuarios experimentados.",
  items: [
    {
      id: 'automation-rules',
      title: 'Reglas de Automatización',
      description: 'Configurar acciones automáticas',
      icon: AutomationIcon,
      status: 'available',
      requiredLevel: 'advanced',
      progress: 45,
      tags: ['automatización', 'reglas']
    },
    {
      id: 'api-integration',
      title: 'Integración API',
      description: 'Conectar con sistemas externos',
      icon: ApiIcon,
      status: 'beta',
      requiredLevel: 'advanced',
      progress: 30,
      tags: ['API', 'integración']
    },
    {
      id: 'custom-workflows',
      title: 'Flujos Personalizados',
      description: 'Crear procesos de trabajo a medida',
      icon: WorkflowIcon,
      status: 'in-development',
      requiredLevel: 'advanced',
      progress: 20,
      tags: ['workflow', 'personalización']
    }
  ],
  tips: [
    "Las reglas de automatización pueden ahorrarte mucho tiempo",
    "La integración API permite conectar con tu infraestructura existente"
  ]
});

const getExpertContent = (level, context) => ({
  description: "Funciones para usuarios expertos y administradores del sistema.",
  items: [
    {
      id: 'system-config',
      title: 'Configuración del Sistema',
      description: 'Parámetros avanzados de configuración',
      icon: SettingsIcon,
      status: 'available',
      requiredLevel: 'expert',
      progress: 100,
      tags: ['configuración', 'sistema']
    },
    {
      id: 'security-audit',
      title: 'Auditoría de Seguridad',
      description: 'Análisis completo de seguridad',
      icon: SecurityAuditIcon,
      status: 'available',
      requiredLevel: 'expert',
      progress: 90,
      tags: ['seguridad', 'auditoría']
    },
    {
      id: 'performance-tuning',
      title: 'Optimización de Rendimiento',
      description: 'Ajustes avanzados de performance',
      icon: TuneIcon,
      status: 'expert-only',
      requiredLevel: 'expert',
      progress: 70,
      tags: ['rendimiento', 'optimización']
    }
  ],
  tips: [
    "Estas funciones requieren conocimientos técnicos avanzados",
    "Siempre haz un backup antes de cambiar configuraciones del sistema"
  ]
});

const getQuickActionsForLevel = (level, context) => {
  const baseActions = [
    { name: 'Ayuda', icon: <HelpIcon />, handler: () => console.log('Mostrar ayuda') }
  ];

  const levelActions = {
    beginner: [
      { name: 'Tutorial', icon: <SchoolIcon />, handler: () => console.log('Iniciar tutorial') },
      { name: 'Vista Simple', icon: <DashboardIcon />, handler: () => console.log('Vista simple') }
    ],
    intermediate: [
      { name: 'Búsqueda', icon: <SearchIcon />, handler: () => console.log('Búsqueda avanzada') },
      { name: 'Reportes', icon: <ReportsIcon />, handler: () => console.log('Generar reporte') }
    ],
    advanced: [
      { name: 'Configurar', icon: <SettingsIcon />, handler: () => console.log('Configuración') },
      { name: 'Automatizar', icon: <AutomationIcon />, handler: () => console.log('Automatización') }
    ],
    expert: [
      { name: 'Sistema', icon: <TuneIcon />, handler: () => console.log('Config sistema') },
      { name: 'Auditoría', icon: <SecurityIcon />, handler: () => console.log('Auditoría') }
    ]
  };

  return [...baseActions, ...(levelActions[level] || [])];
};

const getLevelOrder = (level) => {
  const order = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  return order[level] || 1;
};

// Icons para contenido (simulados)
const StarIcon = () => <span>⭐</span>;
const SearchIcon = () => <span>🔍</span>;
const UploadIcon = () => <span>📤</span>;
const FilterIcon = () => <span>🔽</span>;
const AutomationIcon = () => <span>🤖</span>;
const ApiIcon = () => <span>🔌</span>;
const WorkflowIcon = () => <span>🔄</span>;
const SecurityAuditIcon = () => <span>🛡️</span>;
const SchoolIcon = () => <span>🎓</span>;

// Provider para el sistema de progressive disclosure
export const ProgressiveDisclosureProvider = ({ children }) => {
  return (
    <Box>
      {children}
    </Box>
  );
};

export default ProgressiveDisclosureSystem;