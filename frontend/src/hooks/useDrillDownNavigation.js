/**
 * 🧭 Custom Hook para Drill-down Navigation
 * CMT v2.5 - Lógica de navegación contextual y gestión de estados de navegación
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * 🎯 Hook principal para navegación drill-down
 */
export const useDrillDownNavigation = (initialContext = 'dashboard', config = {}) => {
  const [navigationStack, setNavigationStack] = useState([
    { context: initialContext, entity: null, filters: {}, timestamp: Date.now() }
  ]);
  const [bookmarks, setBookmarks] = useState([]);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [quickAccess, setQuickAccess] = useState([]);
  const [contextualData, setContextualData] = useState({});

  const {
    maxHistorySize = 50,
    maxBookmarks = 20,
    autoSaveState = true,
    enableAnalytics = true
  } = config;

  // Estado actual de navegación
  const currentNavigation = navigationStack[navigationStack.length - 1];
  const canGoBack = navigationStack.length > 1;
  const canGoForward = false; // Para futuras implementaciones

  /**
   * 🔄 Inicialización y carga de datos persistentes
   */
  useEffect(() => {
    loadPersistedState();
    if (enableAnalytics) {
      trackNavigationEvent('session_start', currentNavigation);
    }
  }, []);

  /**
   * 💾 Auto-guardado de estado
   */
  useEffect(() => {
    if (autoSaveState) {
      saveNavigationState();
    }
  }, [navigationStack, bookmarks, navigationHistory]);

  const loadPersistedState = () => {
    try {
      // Cargar marcadores
      const savedBookmarks = localStorage.getItem('cmt_navigation_bookmarks');
      if (savedBookmarks) {
        setBookmarks(JSON.parse(savedBookmarks));
      }

      // Cargar historial
      const savedHistory = localStorage.getItem('cmt_navigation_history');
      if (savedHistory) {
        setNavigationHistory(JSON.parse(savedHistory).slice(0, maxHistorySize));
      }

      // Cargar acceso rápido
      const savedQuickAccess = localStorage.getItem('cmt_quick_access');
      if (savedQuickAccess) {
        setQuickAccess(JSON.parse(savedQuickAccess));
      }
    } catch (error) {
      console.error('Error loading navigation state:', error);
    }
  };

  const saveNavigationState = () => {
    try {
      localStorage.setItem('cmt_navigation_bookmarks', JSON.stringify(bookmarks));
      localStorage.setItem('cmt_navigation_history', JSON.stringify(navigationHistory));
      localStorage.setItem('cmt_quick_access', JSON.stringify(quickAccess));
    } catch (error) {
      console.error('Error saving navigation state:', error);
    }
  };

  /**
   * 🧭 Funciones de navegación
   */
  const navigateTo = useCallback((contextId, entity = null, filters = {}, options = {}) => {
    const { replace = false, preserveState = false } = options;
    
    const newNavigation = {
      context: contextId,
      entity,
      filters,
      timestamp: Date.now(),
      metadata: {
        source: options.source || 'manual',
        referrer: currentNavigation.context
      }
    };

    let newStack;
    if (replace) {
      newStack = [...navigationStack.slice(0, -1), newNavigation];
    } else {
      newStack = [...navigationStack, newNavigation];
    }

    setNavigationStack(newStack);

    // Agregar al historial si no se está preservando el estado
    if (!preserveState) {
      addToHistory(newNavigation);
    }

    // Analytics
    if (enableAnalytics) {
      trackNavigationEvent('navigate', newNavigation);
    }

    return newNavigation;
  }, [navigationStack, currentNavigation, enableAnalytics]);

  const navigateBack = useCallback(() => {
    if (canGoBack) {
      const newStack = navigationStack.slice(0, -1);
      setNavigationStack(newStack);
      
      if (enableAnalytics) {
        trackNavigationEvent('navigate_back', newStack[newStack.length - 1]);
      }
    }
  }, [navigationStack, canGoBack, enableAnalytics]);

  const navigateToRoot = useCallback(() => {
    const rootNavigation = {
      context: 'dashboard',
      entity: null,
      filters: {},
      timestamp: Date.now()
    };
    
    setNavigationStack([rootNavigation]);
    
    if (enableAnalytics) {
      trackNavigationEvent('navigate_home', rootNavigation);
    }
  }, [enableAnalytics]);

  const replaceCurrentContext = useCallback((contextId, entity = null, filters = {}) => {
    return navigateTo(contextId, entity, filters, { replace: true });
  }, [navigateTo]);

  /**
   * 📚 Gestión de historial
   */
  const addToHistory = useCallback((navigation) => {
    // Evitar duplicados consecutivos
    const lastHistoryItem = navigationHistory[0];
    if (lastHistoryItem && 
        lastHistoryItem.context === navigation.context &&
        lastHistoryItem.entity?.id === navigation.entity?.id) {
      return;
    }

    const newHistory = [navigation, ...navigationHistory].slice(0, maxHistorySize);
    setNavigationHistory(newHistory);
  }, [navigationHistory, maxHistorySize]);

  const clearHistory = useCallback(() => {
    setNavigationHistory([]);
    localStorage.removeItem('cmt_navigation_history');
  }, []);

  const removeFromHistory = useCallback((index) => {
    const newHistory = navigationHistory.filter((_, i) => i !== index);
    setNavigationHistory(newHistory);
  }, [navigationHistory]);

  /**
   * 🔖 Gestión de marcadores
   */
  const addBookmark = useCallback((navigation = currentNavigation, customLabel = null) => {
    const bookmarkId = generateBookmarkId(navigation);
    
    // Verificar si ya existe
    if (bookmarks.some(b => b.id === bookmarkId)) {
      return false; // Ya existe
    }

    const newBookmark = {
      id: bookmarkId,
      label: customLabel || generateBookmarkLabel(navigation),
      context: navigation.context,
      entity: navigation.entity,
      filters: navigation.filters,
      created_at: new Date().toISOString(),
      access_count: 0
    };

    const newBookmarks = [newBookmark, ...bookmarks].slice(0, maxBookmarks);
    setBookmarks(newBookmarks);
    
    if (enableAnalytics) {
      trackNavigationEvent('bookmark_added', navigation);
    }
    
    return true;
  }, [currentNavigation, bookmarks, maxBookmarks, enableAnalytics]);

  const removeBookmark = useCallback((bookmarkId) => {
    const newBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(newBookmarks);
    
    if (enableAnalytics) {
      trackNavigationEvent('bookmark_removed', { bookmarkId });
    }
  }, [bookmarks, enableAnalytics]);

  const navigateToBookmark = useCallback((bookmark) => {
    // Incrementar contador de acceso
    const updatedBookmarks = bookmarks.map(b => 
      b.id === bookmark.id 
        ? { ...b, access_count: (b.access_count || 0) + 1, last_accessed: new Date().toISOString() }
        : b
    );
    setBookmarks(updatedBookmarks);

    // Navegar
    return navigateTo(bookmark.context, bookmark.entity, bookmark.filters, {
      source: 'bookmark'
    });
  }, [bookmarks, navigateTo]);

  const isBookmarked = useCallback((navigation = currentNavigation) => {
    const bookmarkId = generateBookmarkId(navigation);
    return bookmarks.some(b => b.id === bookmarkId);
  }, [bookmarks, currentNavigation]);

  /**
   * ⚡ Gestión de acceso rápido
   */
  const addToQuickAccess = useCallback((navigation = currentNavigation) => {
    const quickAccessId = generateBookmarkId(navigation);
    
    // Verificar si ya existe
    if (quickAccess.some(q => q.id === quickAccessId)) {
      return false;
    }

    const newQuickAccessItem = {
      id: quickAccessId,
      label: generateBookmarkLabel(navigation),
      context: navigation.context,
      entity: navigation.entity,
      filters: navigation.filters,
      created_at: new Date().toISOString(),
      priority: calculatePriority(navigation)
    };

    const newQuickAccess = [newQuickAccessItem, ...quickAccess]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Limitar a 10 elementos

    setQuickAccess(newQuickAccess);
    return true;
  }, [currentNavigation, quickAccess]);

  const removeFromQuickAccess = useCallback((quickAccessId) => {
    const newQuickAccess = quickAccess.filter(q => q.id !== quickAccessId);
    setQuickAccess(newQuickAccess);
  }, [quickAccess]);

  /**
   * 🔍 Búsqueda y filtrado
   */
  const searchHistory = useCallback((query) => {
    if (!query.trim()) return navigationHistory;
    
    const lowercaseQuery = query.toLowerCase();
    return navigationHistory.filter(nav => {
      const contextLabel = getContextLabel(nav.context).toLowerCase();
      const entityName = (nav.entity?.name || nav.entity?.common_name || '').toLowerCase();
      
      return contextLabel.includes(lowercaseQuery) || entityName.includes(lowercaseQuery);
    });
  }, [navigationHistory]);

  const searchBookmarks = useCallback((query) => {
    if (!query.trim()) return bookmarks;
    
    const lowercaseQuery = query.toLowerCase();
    return bookmarks.filter(bookmark => 
      bookmark.label.toLowerCase().includes(lowercaseQuery)
    );
  }, [bookmarks]);

  const filterHistoryByContext = useCallback((contextId) => {
    return navigationHistory.filter(nav => nav.context === contextId);
  }, [navigationHistory]);

  const filterHistoryByTimeRange = useCallback((startDate, endDate) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return navigationHistory.filter(nav => {
      const navTime = new Date(nav.timestamp).getTime();
      return navTime >= start && navTime <= end;
    });
  }, [navigationHistory]);

  /**
   * 📊 Estadísticas y analytics
   */
  const getNavigationStatistics = useMemo(() => {
    const stats = {
      totalNavigations: navigationHistory.length,
      uniqueContexts: new Set(navigationHistory.map(nav => nav.context)).size,
      mostVisitedContext: getMostVisitedContext(),
      averageSessionDepth: navigationStack.length,
      bookmarkCount: bookmarks.length,
      quickAccessCount: quickAccess.length,
      sessionDuration: Date.now() - (navigationHistory[navigationHistory.length - 1]?.timestamp || Date.now())
    };

    return stats;
  }, [navigationHistory, navigationStack, bookmarks, quickAccess]);

  const getMostVisitedContext = () => {
    const contextCounts = navigationHistory.reduce((acc, nav) => {
      acc[nav.context] = (acc[nav.context] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(contextCounts).reduce((most, [context, count]) => 
      count > (most?.count || 0) ? { context, count } : most, null
    );
  };

  const getContextUsageFrequency = useMemo(() => {
    const frequency = {};
    navigationHistory.forEach(nav => {
      frequency[nav.context] = (frequency[nav.context] || 0) + 1;
    });
    return frequency;
  }, [navigationHistory]);

  /**
   * 📈 Tracking de eventos
   */
  const trackNavigationEvent = useCallback((eventType, data) => {
    if (!enableAnalytics) return;

    const event = {
      type: eventType,
      timestamp: Date.now(),
      data,
      session_id: getSessionId(),
      user_agent: navigator.userAgent
    };

    // En producción, enviar a servicio de analytics
    console.log('📈 Navigation Analytics:', event);
    
    // Guardar eventos localmente para debugging
    const events = JSON.parse(localStorage.getItem('cmt_navigation_events') || '[]');
    events.push(event);
    localStorage.setItem('cmt_navigation_events', JSON.stringify(events.slice(-100)));
  }, [enableAnalytics]);

  /**
   * 🔧 Funciones auxiliares
   */
  const generateBookmarkId = (navigation) => {
    return `${navigation.context}_${navigation.entity?.id || 'root'}_${Object.keys(navigation.filters || {}).join('_')}`;
  };

  const generateBookmarkLabel = (navigation) => {
    const contextLabel = getContextLabel(navigation.context);
    const entityName = navigation.entity?.name || navigation.entity?.common_name;
    return `${contextLabel}${entityName ? ` - ${entityName}` : ''}`;
  };

  const getContextLabel = (contextId) => {
    const labels = {
      dashboard: 'Dashboard',
      certificates: 'Certificados',
      certificate_detail: 'Detalle Certificado',
      devices: 'Dispositivos',
      device_detail: 'Detalle Dispositivo',
      security: 'Seguridad',
      analytics: 'Analytics'
    };
    return labels[contextId] || contextId;
  };

  const calculatePriority = (navigation) => {
    // Calcular prioridad basada en frecuencia de uso, recency, etc.
    const contextFrequency = getContextUsageFrequency[navigation.context] || 0;
    const recencyBonus = Math.max(0, 100 - ((Date.now() - navigation.timestamp) / (1000 * 60 * 60 * 24))); // Bonus por recency
    const entityBonus = navigation.entity ? 20 : 0;
    
    return contextFrequency + recencyBonus + entityBonus;
  };

  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('cmt_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('cmt_session_id', sessionId);
    }
    return sessionId;
  };

  /**
   * 🎯 Funciones de contexto
   */
  const updateContextualData = useCallback((data) => {
    setContextualData(prev => ({ ...prev, ...data }));
  }, []);

  const getContextualActions = useCallback((context, entity) => {
    // Retornar acciones disponibles para el contexto y entidad actual
    const baseActions = getBaseActionsForContext(context);
    const entityActions = getEntitySpecificActions(entity);
    return [...baseActions, ...entityActions];
  }, []);

  const getBaseActionsForContext = (context) => {
    const actionMap = {
      dashboard: ['refresh', 'export', 'settings'],
      certificates: ['add', 'import', 'export', 'filter', 'refresh'],
      certificate_detail: ['edit', 'renew', 'revoke', 'download', 'share'],
      devices: ['add', 'scan', 'export', 'filter', 'refresh'],
      device_detail: ['edit', 'connect', 'scan', 'backup', 'settings'],
      security: ['scan', 'generate_report', 'export', 'settings'],
      analytics: ['generate', 'schedule', 'export', 'configure']
    };
    return actionMap[context] || [];
  };

  const getEntitySpecificActions = (entity) => {
    if (!entity) return [];
    
    switch (entity.type) {
      case 'certificate':
        const actions = ['validate', 'download'];
        if (entity.status === 'expiring') actions.push('renew');
        if (entity.status === 'expired') actions.push('replace');
        return actions;
      
      case 'device':
        const deviceActions = ['scan', 'backup'];
        if (entity.status === 'offline') deviceActions.push('reconnect');
        if (entity.status === 'error') deviceActions.push('troubleshoot');
        return deviceActions;
      
      default:
        return [];
    }
  };

  return {
    // Estado de navegación
    currentNavigation,
    navigationStack,
    canGoBack,
    canGoForward,
    
    // Funciones de navegación
    navigateTo,
    navigateBack,
    navigateToRoot,
    replaceCurrentContext,
    
    // Gestión de historial
    navigationHistory,
    addToHistory,
    clearHistory,
    removeFromHistory,
    searchHistory,
    filterHistoryByContext,
    filterHistoryByTimeRange,
    
    // Gestión de marcadores
    bookmarks,
    addBookmark,
    removeBookmark,
    navigateToBookmark,
    isBookmarked,
    searchBookmarks,
    
    // Acceso rápido
    quickAccess,
    addToQuickAccess,
    removeFromQuickAccess,
    
    // Datos contextuales
    contextualData,
    updateContextualData,
    getContextualActions,
    
    // Estadísticas
    navigationStatistics: getNavigationStatistics,
    contextUsageFrequency: getContextUsageFrequency,
    
    // Utilidades
    trackNavigationEvent
  };
};

/**
 * 🔗 Hook para relaciones entre entidades
 */
export const useEntityRelationships = (currentEntity, allData = {}) => {
  const [relatedEntities, setRelatedEntities] = useState([]);
  const [relationshipMap, setRelationshipMap] = useState({});
  const [loadingRelationships, setLoadingRelationships] = useState(false);

  useEffect(() => {
    if (currentEntity) {
      loadRelatedEntities();
    }
  }, [currentEntity]);

  const loadRelatedEntities = async () => {
    setLoadingRelationships(true);
    try {
      const relationships = await findEntityRelationships(currentEntity, allData);
      setRelatedEntities(relationships);
      
      const relationshipMap = buildRelationshipMap(relationships);
      setRelationshipMap(relationshipMap);
    } catch (error) {
      console.error('Error loading entity relationships:', error);
    } finally {
      setLoadingRelationships(false);
    }
  };

  const findEntityRelationships = async (entity, data) => {
    const relationships = [];
    
    // Implementar lógica de relaciones específica para CMT
    if (entity.type === 'certificate') {
      // Encontrar dispositivos que usan este certificado
      const relatedDevices = data.devices?.filter(device => 
        device.certificates?.includes(entity.id)
      ) || [];
      
      if (relatedDevices.length > 0) {
        relationships.push({
          type: 'devices',
          label: 'Dispositivos que usan este certificado',
          entities: relatedDevices,
          relationshipType: 'uses'
        });
      }
      
      // Encontrar certificados del mismo emisor
      const sameIssuerCerts = data.certificates?.filter(cert => 
        cert.id !== entity.id && cert.issuer === entity.issuer
      ) || [];
      
      if (sameIssuerCerts.length > 0) {
        relationships.push({
          type: 'certificates',
          label: 'Otros certificados del mismo emisor',
          entities: sameIssuerCerts,
          relationshipType: 'same_issuer'
        });
      }
    }
    
    if (entity.type === 'device') {
      // Encontrar certificados instalados en este dispositivo
      const installedCerts = data.certificates?.filter(cert => 
        entity.certificates?.includes(cert.id)
      ) || [];
      
      if (installedCerts.length > 0) {
        relationships.push({
          type: 'certificates',
          label: 'Certificados instalados',
          entities: installedCerts,
          relationshipType: 'installed_on'
        });
      }
      
      // Encontrar dispositivos en la misma ubicación
      const sameLocationDevices = data.devices?.filter(device => 
        device.id !== entity.id && device.location === entity.location
      ) || [];
      
      if (sameLocationDevices.length > 0) {
        relationships.push({
          type: 'devices',
          label: 'Dispositivos en la misma ubicación',
          entities: sameLocationDevices,
          relationshipType: 'same_location'
        });
      }
    }
    
    return relationships;
  };

  const buildRelationshipMap = (relationships) => {
    const map = {};
    relationships.forEach(rel => {
      rel.entities.forEach(entity => {
        if (!map[entity.id]) {
          map[entity.id] = [];
        }
        map[entity.id].push({
          type: rel.relationshipType,
          label: rel.label,
          sourceEntity: currentEntity
        });
      });
    });
    return map;
  };

  const getRelationshipStrength = (entityId) => {
    const relationships = relationshipMap[entityId] || [];
    return relationships.length;
  };

  const getRelationshipTypes = (entityId) => {
    const relationships = relationshipMap[entityId] || [];
    return relationships.map(rel => rel.type);
  };

  return {
    relatedEntities,
    relationshipMap,
    loadingRelationships,
    getRelationshipStrength,
    getRelationshipTypes,
    refreshRelationships: loadRelatedEntities
  };
};

export default { useDrillDownNavigation, useEntityRelationships };