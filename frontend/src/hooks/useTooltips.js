/**
 * 💡 useTooltips Hook - CMT v2.5
 * Hook personalizado para gestión avanzada de tooltips y ayuda contextual
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * 🎯 Hook principal para gestión de tooltips
 */
export const useTooltips = (config = {}) => {
  const {
    enableGlobalTooltips = true,
    defaultDelay = 500,
    maxConcurrentTooltips = 3,
    enableTooltipHistory = true,
    adaptivePositioning = true,
    enableAnalytics = false
  } = config;

  const [activeTooltips, setActiveTooltips] = useState(new Set());
  const [tooltipHistory, setTooltipHistory] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    enabled: enableGlobalTooltips,
    delay: defaultDelay,
    animations: true,
    richContent: true
  });

  const tooltipRefs = useRef(new Map());
  const analyticsData = useRef([]);

  /**
   * 📊 Analytics y tracking
   */
  const trackTooltipEvent = useCallback((eventType, tooltipId, data = {}) => {
    if (!enableAnalytics) return;

    const event = {
      type: eventType,
      tooltipId,
      timestamp: Date.now(),
      data,
      sessionId: getSessionId()
    };

    analyticsData.current.push(event);
    
    // Mantener solo los últimos 100 eventos
    if (analyticsData.current.length > 100) {
      analyticsData.current = analyticsData.current.slice(-100);
    }
  }, [enableAnalytics]);

  /**
   * 🔧 Gestión de tooltips activos
   */
  const registerTooltip = useCallback((tooltipId, ref) => {
    tooltipRefs.current.set(tooltipId, ref);
    
    return () => {
      tooltipRefs.current.delete(tooltipId);
      setActiveTooltips(prev => {
        const newSet = new Set(prev);
        newSet.delete(tooltipId);
        return newSet;
      });
    };
  }, []);

  const showTooltip = useCallback((tooltipId, options = {}) => {
    if (!globalSettings.enabled) return false;

    // Verificar límite de tooltips concurrentes
    if (activeTooltips.size >= maxConcurrentTooltips) {
      // Cerrar el tooltip más antiguo
      const oldest = Array.from(activeTooltips)[0];
      hideTooltip(oldest);
    }

    setActiveTooltips(prev => new Set([...prev, tooltipId]));
    
    // Agregar al historial
    if (enableTooltipHistory) {
      setTooltipHistory(prev => [
        { id: tooltipId, timestamp: Date.now(), ...options },
        ...prev.slice(0, 19) // Mantener últimos 20
      ]);
    }

    trackTooltipEvent('show', tooltipId, options);
    return true;
  }, [globalSettings.enabled, activeTooltips.size, maxConcurrentTooltips, enableTooltipHistory, trackTooltipEvent]);

  const hideTooltip = useCallback((tooltipId) => {
    setActiveTooltips(prev => {
      const newSet = new Set(prev);
      newSet.delete(tooltipId);
      return newSet;
    });

    trackTooltipEvent('hide', tooltipId);
  }, [trackTooltipEvent]);

  const hideAllTooltips = useCallback(() => {
    setActiveTooltips(new Set());
    trackTooltipEvent('hide_all', 'global');
  }, [trackTooltipEvent]);

  /**
   * 🎨 Posicionamiento adaptativo
   */
  const getOptimalPosition = useCallback((targetElement, tooltipElement, preferredPosition = 'top') => {
    if (!adaptivePositioning || !targetElement || !tooltipElement) {
      return preferredPosition;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const positions = ['top', 'bottom', 'left', 'right'];
    const availableSpace = {
      top: targetRect.top,
      bottom: viewportHeight - targetRect.bottom,
      left: targetRect.left,
      right: viewportWidth - targetRect.right
    };

    // Verificar si la posición preferida tiene suficiente espacio
    const requiredSpace = {
      top: tooltipRect.height + 10,
      bottom: tooltipRect.height + 10,
      left: tooltipRect.width + 10,
      right: tooltipRect.width + 10
    };

    if (availableSpace[preferredPosition] >= requiredSpace[preferredPosition]) {
      return preferredPosition;
    }

    // Encontrar la mejor posición alternativa
    return positions.reduce((best, position) => {
      const available = availableSpace[position];
      const required = requiredSpace[position];
      const score = available >= required ? available : available / required;
      
      return score > best.score ? { position, score } : best;
    }, { position: preferredPosition, score: 0 }).position;
  }, [adaptivePositioning]);

  /**
   * 📱 Detección de dispositivo y adaptación
   */
  const deviceInfo = useMemo(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(navigator.userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    return {
      isMobile,
      isTablet,
      isTouchDevice,
      isDesktop: !isMobile && !isTablet,
      hasHover: window.matchMedia('(hover: hover)').matches
    };
  }, []);

  const getDeviceOptimizedConfig = useCallback(() => {
    if (deviceInfo.isMobile) {
      return {
        delay: 0, // Sin delay en móvil
        trigger: 'click', // Click en lugar de hover
        placement: 'top', // Preferir top para evitar teclado virtual
        interactive: true,
        hideOnClick: true
      };
    }

    if (deviceInfo.isTablet) {
      return {
        delay: 200,
        trigger: 'click',
        placement: 'top',
        interactive: true
      };
    }

    return {
      delay: globalSettings.delay,
      trigger: 'hover',
      placement: 'top',
      interactive: false
    };
  }, [deviceInfo, globalSettings.delay]);

  /**
   * 🎯 Tooltips contextuales basados en datos
   */
  const generateContextualTooltip = useCallback((context, data) => {
    const templates = {
      certificate: {
        title: data?.common_name || 'Certificado SSL/TLS',
        description: `Emisor: ${data?.issuer || 'Desconocido'}\nVencimiento: ${data?.expiration_date ? new Date(data.expiration_date).toLocaleDateString() : 'No especificado'}`,
        type: data?.status === 'expired' ? 'error' : data?.status === 'expiring' ? 'warning' : 'success',
        shortcuts: ['Ctrl+D para detalles', 'Ctrl+R para renovar'],
        actions: [
          { label: 'Ver Detalles', primary: true },
          { label: 'Renovar', primary: false, disabled: data?.status === 'valid' }
        ]
      },

      device: {
        title: data?.hostname || data?.ip_address || 'Dispositivo',
        description: `Tipo: ${data?.type || 'Desconocido'}\nEstado: ${data?.status || 'Desconocido'}\nÚltima conexión: ${data?.last_seen ? new Date(data.last_seen).toLocaleString() : 'Nunca'}`,
        type: data?.status === 'offline' ? 'error' : data?.status === 'warning' ? 'warning' : 'success',
        shortcuts: ['Ctrl+C para conectar', 'Ctrl+S para escanear'],
        metrics: {
          uptime: data?.uptime || 0,
          certificates: data?.certificates?.length || 0,
          last_scan: data?.last_scan
        }
      },

      vulnerability: {
        title: data?.title || 'Vulnerabilidad de Seguridad',
        description: data?.description || 'Sin descripción disponible',
        type: data?.severity === 'critical' ? 'error' : data?.severity === 'high' ? 'warning' : 'info',
        severity: data?.severity,
        cvss_score: data?.cvss_score,
        affected_count: data?.affected_devices?.length || 0
      },

      filter: {
        title: `Filtro: ${data?.name || 'Sin nombre'}`,
        description: `Criterio: ${data?.criteria || 'No especificado'}\nResultados: ${data?.resultCount || 0}`,
        type: 'info',
        shortcuts: ['Enter para aplicar', 'Esc para cancelar']
      },

      export: {
        title: 'Exportación de Datos',
        description: `Formato: ${data?.format || 'No especificado'}\nRegistros: ${data?.recordCount || 0}\nTamaño estimado: ${formatBytes(data?.estimatedSize || 0)}`,
        type: 'info',
        progress: data?.progress
      }
    };

    return templates[context] || {
      title: 'Información',
      description: 'Datos no disponibles',
      type: 'info'
    };
  }, []);

  /**
   * 🔍 Búsqueda en historial de tooltips
   */
  const searchTooltipHistory = useCallback((query) => {
    if (!query.trim()) return tooltipHistory;

    return tooltipHistory.filter(item => 
      item.id.toLowerCase().includes(query.toLowerCase()) ||
      (item.title && item.title.toLowerCase().includes(query.toLowerCase()))
    );
  }, [tooltipHistory]);

  const getMostUsedTooltips = useCallback(() => {
    const usage = analyticsData.current.reduce((acc, event) => {
      if (event.type === 'show') {
        acc[event.tooltipId] = (acc[event.tooltipId] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(usage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tooltipId, count]) => ({ tooltipId, count }));
  }, []);

  /**
   * ⚙️ Configuración y preferencias
   */
  const updateGlobalSettings = useCallback((newSettings) => {
    setGlobalSettings(prev => ({ ...prev, ...newSettings }));
    
    // Guardar en localStorage
    try {
      localStorage.setItem('cmt_tooltip_settings', JSON.stringify({ ...globalSettings, ...newSettings }));
    } catch (error) {
      console.warn('No se pudieron guardar las configuraciones de tooltips:', error);
    }
  }, [globalSettings]);

  const resetTooltipHistory = useCallback(() => {
    setTooltipHistory([]);
    analyticsData.current = [];
  }, []);

  /**
   * 🚀 Inicialización y efectos
   */
  useEffect(() => {
    // Cargar configuraciones guardadas
    try {
      const saved = localStorage.getItem('cmt_tooltip_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setGlobalSettings(prev => ({ ...prev, ...settings }));
      }
    } catch (error) {
      console.warn('No se pudieron cargar las configuraciones de tooltips:', error);
    }
  }, []);

  // Limpiar tooltips al desmontar
  useEffect(() => {
    return () => {
      hideAllTooltips();
    };
  }, [hideAllTooltips]);

  /**
   * 🎯 API pública del hook
   */
  return {
    // Estado
    activeTooltips,
    tooltipHistory,
    globalSettings,
    deviceInfo,

    // Gestión de tooltips
    registerTooltip,
    showTooltip,
    hideTooltip,
    hideAllTooltips,

    // Posicionamiento
    getOptimalPosition,
    getDeviceOptimizedConfig,

    // Contenido contextual
    generateContextualTooltip,

    // Búsqueda e historial
    searchTooltipHistory,
    getMostUsedTooltips,
    resetTooltipHistory,

    // Configuración
    updateGlobalSettings,

    // Analytics
    getAnalyticsData: () => analyticsData.current,
    getTooltipStats: () => ({
      totalShown: analyticsData.current.filter(e => e.type === 'show').length,
      averageViewTime: calculateAverageViewTime(analyticsData.current),
      mostUsed: getMostUsedTooltips()
    })
  };
};

/**
 * 🎨 Hook para tooltips temáticos
 */
export const useThemedTooltips = (theme = 'default') => {
  const themeConfigs = {
    default: {
      backgroundColor: '#424242',
      color: '#ffffff',
      borderRadius: 4,
      fontSize: 12
    },
    
    modern: {
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      borderRadius: 12,
      fontSize: 13,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)'
    },
    
    colorful: {
      backgroundColor: '#6366f1',
      color: '#ffffff',
      borderRadius: 8,
      fontSize: 12,
      boxShadow: '0 10px 25px rgba(99,102,241,0.3)'
    },
    
    minimal: {
      backgroundColor: '#f8f9fa',
      color: '#212529',
      borderRadius: 2,
      fontSize: 11,
      border: '1px solid #dee2e6'
    }
  };

  return themeConfigs[theme] || themeConfigs.default;
};

/**
 * 🔄 Hook para tooltips adaptativos
 */
export const useAdaptiveTooltips = () => {
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getAdaptiveConfig = useCallback((baseConfig = {}) => {
    const { width, height } = viewportSize;
    
    // Configuración para pantallas pequeñas
    if (width < 768) {
      return {
        ...baseConfig,
        placement: 'top',
        maxWidth: width * 0.9,
        trigger: 'click',
        hideOnClick: true,
        offset: [0, 10]
      };
    }
    
    // Configuración para tablets
    if (width < 1024) {
      return {
        ...baseConfig,
        maxWidth: Math.min(400, width * 0.7),
        placement: 'auto',
        offset: [0, 8]
      };
    }
    
    // Configuración para desktop
    return {
      ...baseConfig,
      maxWidth: 350,
      placement: 'auto',
      offset: [0, 6]
    };
  }, [viewportSize]);

  return {
    viewportSize,
    getAdaptiveConfig,
    isMobile: viewportSize.width < 768,
    isTablet: viewportSize.width >= 768 && viewportSize.width < 1024,
    isDesktop: viewportSize.width >= 1024
  };
};

/**
 * 🔧 Funciones auxiliares
 */
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('tooltip_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('tooltip_session_id', sessionId);
  }
  return sessionId;
};

const calculateAverageViewTime = (events) => {
  const pairs = [];
  const showEvents = events.filter(e => e.type === 'show');
  const hideEvents = events.filter(e => e.type === 'hide');

  showEvents.forEach(show => {
    const correspondingHide = hideEvents.find(hide => 
      hide.tooltipId === show.tooltipId && hide.timestamp > show.timestamp
    );
    
    if (correspondingHide) {
      pairs.push(correspondingHide.timestamp - show.timestamp);
    }
  });

  return pairs.length > 0 ? pairs.reduce((sum, time) => sum + time, 0) / pairs.length : 0;
};

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default { useTooltips, useThemedTooltips, useAdaptiveTooltips };