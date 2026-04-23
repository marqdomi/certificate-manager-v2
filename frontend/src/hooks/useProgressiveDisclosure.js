/**
 * 🎯 Hook personalizado para Progressive Disclosure - CMT v2.5
 * Sistema de revelación progresiva con aprendizaje adaptativo
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 🚀 Hook principal para revelación progresiva
 */
export const useProgressiveDisclosure = (options = {}) => {
  const {
    initialLevel = 'beginner',
    adaptiveMode = true,
    persistState = true,
    onLevelChange,
    context = 'global'
  } = options;

  const [userLevel, setUserLevel] = useState(initialLevel);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [preferences, setPreferences] = useState({
    showTooltips: true,
    showProgressIndicators: true,
    autoAdvance: true,
    showExpertFeatures: false,
    complexityThreshold: 2
  });

  const [adaptiveState, setAdaptiveState] = useState({
    interactions: 0,
    successfulActions: 0,
    timeSpent: 0,
    errorCount: 0,
    featureUsage: {},
    suggestedLevel: initialLevel,
    confidence: 0.5,
    lastLevelChange: Date.now()
  });

  const interactionTimer = useRef(null);
  const sessionStart = useRef(Date.now());

  // Configuraciones de nivel
  const levelConfigs = {
    beginner: {
      maxComplexity: 1,
      showAdvanced: false,
      guidanceLevel: 'high',
      defaultExpanded: true,
      autoTooltips: true,
      confirmActions: true
    },
    intermediate: {
      maxComplexity: 2,
      showAdvanced: false,
      guidanceLevel: 'medium',
      defaultExpanded: false,
      autoTooltips: true,
      confirmActions: false
    },
    advanced: {
      maxComplexity: 3,
      showAdvanced: true,
      guidanceLevel: 'low',
      defaultExpanded: false,
      autoTooltips: false,
      confirmActions: false
    },
    expert: {
      maxComplexity: 4,
      showAdvanced: true,
      guidanceLevel: 'minimal',
      defaultExpanded: false,
      autoTooltips: false,
      confirmActions: false
    }
  };

  // Cargar estado persistido
  useEffect(() => {
    if (persistState) {
      loadPersistedState();
    }
  }, [persistState]);

  // Guardar estado
  useEffect(() => {
    if (persistState) {
      saveState();
    }
  }, [userLevel, preferences, adaptiveState, persistState]);

  // Timer para tiempo de sesión
  useEffect(() => {
    interactionTimer.current = setInterval(() => {
      setAdaptiveState(prev => ({
        ...prev,
        timeSpent: Date.now() - sessionStart.current
      }));
    }, 1000);

    return () => {
      if (interactionTimer.current) {
        clearInterval(interactionTimer.current);
      }
    };
  }, []);

  // Análisis adaptativo
  useEffect(() => {
    if (adaptiveMode && adaptiveState.interactions > 5) {
      analyzeUserBehavior();
    }
  }, [adaptiveState.interactions, adaptiveState.successfulActions, adaptiveMode]);

  /**
   * 📊 Registrar interacción del usuario
   */
  const trackInteraction = useCallback((action, metadata = {}) => {
    setAdaptiveState(prev => {
      const newFeatureUsage = { ...prev.featureUsage };
      const feature = metadata.feature || action;
      newFeatureUsage[feature] = (newFeatureUsage[feature] || 0) + 1;

      return {
        ...prev,
        interactions: prev.interactions + 1,
        featureUsage: newFeatureUsage,
        successfulActions: metadata.success ? prev.successfulActions + 1 : prev.successfulActions,
        errorCount: metadata.error ? prev.errorCount + 1 : prev.errorCount
      };
    });

    // Analytics
    console.log('📊 Interaction tracked:', { action, metadata, level: userLevel });
  }, [userLevel]);

  /**
   * 🎯 Cambiar nivel de usuario
   */
  const changeLevel = useCallback((newLevel) => {
    const previousLevel = userLevel;
    setUserLevel(newLevel);
    
    setAdaptiveState(prev => ({
      ...prev,
      suggestedLevel: newLevel,
      lastLevelChange: Date.now()
    }));

    // Actualizar secciones expandidas según el nuevo nivel
    const config = levelConfigs[newLevel];
    if (config.defaultExpanded) {
      setExpandedSections(new Set(['basic', 'quick-start']));
    } else {
      setExpandedSections(new Set());
    }

    if (onLevelChange) {
      onLevelChange(newLevel, previousLevel);
    }

    trackInteraction('level_change', {
      previousLevel,
      newLevel,
      source: 'manual'
    });
  }, [userLevel, onLevelChange, trackInteraction]);

  /**
   * 🔍 Analizar comportamiento del usuario
   */
  const analyzeUserBehavior = useCallback(() => {
    const {
      interactions,
      successfulActions,
      timeSpent,
      errorCount,
      featureUsage
    } = adaptiveState;

    const successRate = interactions > 0 ? successfulActions / interactions : 0;
    const errorRate = interactions > 0 ? errorCount / interactions : 0;
    const avgTimePerAction = interactions > 0 ? timeSpent / interactions : 0;

    // Calcular puntuación de competencia
    const competencyScore = calculateCompetencyScore({
      successRate,
      errorRate,
      avgTimePerAction,
      featureUsage,
      timeSpent
    });

    // Sugerir cambio de nivel si es necesario
    const suggestedLevel = determineSuggestedLevel(competencyScore, userLevel);
    const confidence = calculateConfidence(competencyScore, interactions);

    if (suggestedLevel !== userLevel && confidence > 0.7) {
      setAdaptiveState(prev => ({
        ...prev,
        suggestedLevel,
        confidence
      }));
    }
  }, [adaptiveState, userLevel]);

  /**
   * 🎚️ Alternar expansión de sección
   */
  const toggleSection = useCallback((sectionId) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });

    trackInteraction('section_toggle', {
      sectionId,
      action: expandedSections.has(sectionId) ? 'collapse' : 'expand'
    });
  }, [expandedSections, trackInteraction]);

  /**
   * ⚙️ Actualizar preferencias
   */
  const updatePreferences = useCallback((newPreferences) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }));
    trackInteraction('preferences_update', { preferences: newPreferences });
  }, [trackInteraction]);

  /**
   * 🎯 Verificar si una característica es accesible
   */
  const isFeatureAccessible = useCallback((feature) => {
    const config = levelConfigs[userLevel];
    
    if (!feature.complexity) return true;
    if (feature.complexity > config.maxComplexity) return false;
    if (feature.expertOnly && !config.showAdvanced) return false;
    if (feature.requiredLevel) {
      return getLevelOrder(userLevel) >= getLevelOrder(feature.requiredLevel);
    }
    
    return true;
  }, [userLevel]);

  /**
   * 📝 Obtener contenido filtrado por nivel
   */
  const getFilteredContent = useCallback((content) => {
    if (!content || !content.items) return content;

    const config = levelConfigs[userLevel];
    
    return {
      ...content,
      items: content.items.filter(item => {
        if (item.complexity && item.complexity > config.maxComplexity) return false;
        if (item.expertOnly && !config.showAdvanced) return false;
        return isFeatureAccessible(item);
      })
    };
  }, [userLevel, isFeatureAccessible]);

  /**
   * 🔄 Reiniciar estado adaptativo
   */
  const resetAdaptiveState = useCallback(() => {
    setAdaptiveState({
      interactions: 0,
      successfulActions: 0,
      timeSpent: 0,
      errorCount: 0,
      featureUsage: {},
      suggestedLevel: userLevel,
      confidence: 0.5,
      lastLevelChange: Date.now()
    });
    sessionStart.current = Date.now();
  }, [userLevel]);

  /**
   * 💾 Funciones de persistencia
   */
  const loadPersistedState = useCallback(() => {
    try {
      const saved = localStorage.getItem(`progressive_disclosure_${context}`);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.userLevel) setUserLevel(state.userLevel);
        if (state.preferences) setPreferences(state.preferences);
        if (state.expandedSections) {
          setExpandedSections(new Set(state.expandedSections));
        }
      }
    } catch (error) {
      console.warn('Error loading progressive disclosure state:', error);
    }
  }, [context]);

  const saveState = useCallback(() => {
    try {
      const state = {
        userLevel,
        preferences,
        expandedSections: Array.from(expandedSections),
        lastSaved: Date.now()
      };
      localStorage.setItem(`progressive_disclosure_${context}`, JSON.stringify(state));
    } catch (error) {
      console.warn('Error saving progressive disclosure state:', error);
    }
  }, [userLevel, preferences, expandedSections, context]);

  /**
   * 📊 Obtener estadísticas
   */
  const getStatistics = useCallback(() => {
    const config = levelConfigs[userLevel];
    const sessionDuration = Date.now() - sessionStart.current;
    
    return {
      userLevel,
      sessionDuration,
      totalInteractions: adaptiveState.interactions,
      successRate: adaptiveState.interactions > 0 
        ? adaptiveState.successfulActions / adaptiveState.interactions 
        : 0,
      errorRate: adaptiveState.interactions > 0 
        ? adaptiveState.errorCount / adaptiveState.interactions 
        : 0,
      mostUsedFeatures: getMostUsedFeatures(adaptiveState.featureUsage),
      currentConfig: config,
      suggestedLevel: adaptiveState.suggestedLevel,
      confidence: adaptiveState.confidence
    };
  }, [userLevel, adaptiveState]);

  return {
    // Estado principal
    userLevel,
    expandedSections,
    preferences,
    adaptiveState,
    
    // Configuración actual
    currentConfig: levelConfigs[userLevel],
    
    // Acciones
    changeLevel,
    toggleSection,
    updatePreferences,
    trackInteraction,
    resetAdaptiveState,
    
    // Utilidades
    isFeatureAccessible,
    getFilteredContent,
    getStatistics,
    
    // Estado derivado
    isAdaptiveModeActive: adaptiveMode,
    hasLevelSuggestion: adaptiveState.suggestedLevel !== userLevel && adaptiveState.confidence > 0.7,
    suggestedLevel: adaptiveState.suggestedLevel,
    suggestionConfidence: adaptiveState.confidence
  };
};

/**
 * 🎓 Hook para tutorial progresivo
 */
export const useProgressiveTutorial = (steps = [], options = {}) => {
  const {
    autoStart = false,
    skipCompleted = true,
    onComplete,
    onSkip
  } = options;

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isActive, setIsActive] = useState(autoStart);
  const [userProgress, setUserProgress] = useState({});

  // Filtrar pasos según el nivel del usuario
  const { userLevel, isFeatureAccessible } = useProgressiveDisclosure();
  
  const availableSteps = steps.filter(step => 
    !step.requiredLevel || isFeatureAccessible(step)
  );

  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < availableSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setCompletedSteps(prev => new Set([...prev, currentStep]));
    } else {
      completeTutorial();
    }
  }, [currentStep, availableSteps.length]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const completeTutorial = useCallback(() => {
    setIsActive(false);
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    if (onComplete) onComplete();
  }, [currentStep, onComplete]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    if (onSkip) onSkip();
  }, [onSkip]);

  return {
    // Estado
    currentStep,
    isActive,
    completedSteps,
    availableSteps,
    
    // Acciones
    startTutorial,
    nextStep,
    previousStep,
    skipStep,
    completeTutorial,
    skipTutorial,
    
    // Estado derivado
    currentStepData: availableSteps[currentStep],
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === availableSteps.length - 1,
    progress: availableSteps.length > 0 ? (currentStep + 1) / availableSteps.length : 0,
    completionRate: steps.length > 0 ? completedSteps.size / steps.length : 0
  };
};

/**
 * 🔧 Funciones auxiliares
 */
const calculateCompetencyScore = (metrics) => {
  const {
    successRate,
    errorRate,
    avgTimePerAction,
    featureUsage,
    timeSpent
  } = metrics;

  // Puntuación base por tasa de éxito
  let score = successRate * 100;

  // Penalizar errores
  score -= errorRate * 50;

  // Bonificar velocidad (si es razonable)
  if (avgTimePerAction < 5000 && avgTimePerAction > 500) { // Entre 0.5 y 5 segundos
    score += 10;
  }

  // Bonificar uso de características avanzadas
  const advancedFeatures = Object.keys(featureUsage).filter(feature =>
    feature.includes('advanced') || feature.includes('expert')
  );
  score += advancedFeatures.length * 5;

  // Bonificar tiempo de sesión (engagement)
  if (timeSpent > 300000) { // Más de 5 minutos
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
};

const determineSuggestedLevel = (competencyScore, currentLevel) => {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const currentIndex = levels.indexOf(currentLevel);

  if (competencyScore >= 80 && currentIndex < levels.length - 1) {
    return levels[currentIndex + 1];
  } else if (competencyScore <= 40 && currentIndex > 0) {
    return levels[currentIndex - 1];
  }

  return currentLevel;
};

const calculateConfidence = (competencyScore, interactions) => {
  // Más interacciones = mayor confianza
  const interactionFactor = Math.min(interactions / 20, 1);
  
  // Distancia del score de los umbrales
  const scoreFactor = competencyScore >= 80 || competencyScore <= 40 ? 1 : 0.5;

  return interactionFactor * scoreFactor;
};

const getLevelOrder = (level) => {
  const order = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  return order[level] || 1;
};

const getMostUsedFeatures = (featureUsage) => {
  return Object.entries(featureUsage)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([feature, count]) => ({ feature, count }));
};

export default useProgressiveDisclosure;