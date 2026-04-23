/**
 * 🎯 Hook personalizado para gestión de atajos de teclado - CMT v2.5
 * Sistema avanzado con analytics, persistencia y configuración dinámica
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 🚀 Hook principal para atajos de teclado
 */
export const useKeyboardShortcuts = (options = {}) => {
  const {
    context = 'global',
    enabled = true,
    onShortcutTriggered,
    analytics = true,
    debug = false
  } = options;

  const [shortcuts, setShortcuts] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const listenersRef = useRef(new Map());

  // Cargar configuración inicial
  useEffect(() => {
    loadShortcutsConfiguration();
  }, []);

  // Detectar conflictos automáticamente
  useEffect(() => {
    const detectedConflicts = detectShortcutConflicts(shortcuts);
    setConflicts(detectedConflicts);
  }, [shortcuts]);

  // Limpiar listeners al desmontar
  useEffect(() => {
    return () => {
      listenersRef.current.forEach((remove) => remove());
      listenersRef.current.clear();
    };
  }, []);

  /**
   * 📝 Registrar nuevo atajo
   */
  const registerShortcut = useCallback((shortcutConfig) => {
    const shortcut = {
      id: shortcutConfig.id || generateShortcutId(),
      label: shortcutConfig.label,
      description: shortcutConfig.description,
      keys: shortcutConfig.keys,
      action: shortcutConfig.action,
      actionParams: shortcutConfig.actionParams,
      context: shortcutConfig.context || context,
      category: shortcutConfig.category || 'custom',
      icon: shortcutConfig.icon,
      enabled: shortcutConfig.enabled !== false,
      priority: shortcutConfig.priority || 0,
      handler: shortcutConfig.handler,
      preventDefault: shortcutConfig.preventDefault !== false,
      stopPropagation: shortcutConfig.stopPropagation !== false,
      conditions: shortcutConfig.conditions || [],
      cooldown: shortcutConfig.cooldown || 0,
      lastTriggered: 0
    };

    setShortcuts(prev => {
      const filtered = prev.filter(s => s.id !== shortcut.id);
      return [...filtered, shortcut].sort((a, b) => b.priority - a.priority);
    });

    if (debug) {
      console.log('🎯 Registered shortcut:', shortcut);
    }

    return shortcut.id;
  }, [context, debug]);

  /**
   * 🗑️ Desregistrar atajo
   */
  const unregisterShortcut = useCallback((shortcutId) => {
    setShortcuts(prev => prev.filter(s => s.id !== shortcutId));
    
    // Remover listener si existe
    const removeListener = listenersRef.current.get(shortcutId);
    if (removeListener) {
      removeListener();
      listenersRef.current.delete(shortcutId);
    }

    if (debug) {
      console.log('🗑️ Unregistered shortcut:', shortcutId);
    }
  }, [debug]);

  /**
   * ⚡ Activar/desactivar atajo
   */
  const toggleShortcut = useCallback((shortcutId, enabled) => {
    setShortcuts(prev => prev.map(s => 
      s.id === shortcutId ? { ...s, enabled } : s
    ));
  }, []);

  /**
   * 🔄 Actualizar configuración de atajo
   */
  const updateShortcut = useCallback((shortcutId, updates) => {
    setShortcuts(prev => prev.map(s => 
      s.id === shortcutId ? { ...s, ...updates } : s
    ));
  }, []);

  /**
   * 🎤 Iniciar grabación de nuevas teclas
   */
  const startRecording = useCallback((shortcutId) => {
    setIsRecording(shortcutId);
    
    const handleKeyDown = (e) => {
      const keys = captureKeyCombo(e);
      if (keys.length > 0) {
        updateShortcut(shortcutId, { keys });
        setIsRecording(false);
        document.removeEventListener('keydown', handleKeyDown, true);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    
    // Auto-cancelar después de 10 segundos
    setTimeout(() => {
      if (isRecording === shortcutId) {
        setIsRecording(false);
        document.removeEventListener('keydown', handleKeyDown, true);
      }
    }, 10000);
  }, [isRecording, updateShortcut]);

  /**
   * 🎯 Ejecutar atajo manualmente
   */
  const triggerShortcut = useCallback((shortcutId) => {
    const shortcut = shortcuts.find(s => s.id === shortcutId);
    if (!shortcut || !shortcut.enabled) return false;

    return executeShortcut(shortcut);
  }, [shortcuts]);

  /**
   * 📊 Obtener estadísticas de uso
   */
  const getUsageStats = useCallback(() => {
    return {
      totalShortcuts: shortcuts.length,
      enabledShortcuts: shortcuts.filter(s => s.enabled).length,
      recentlyUsed: recentlyUsed.slice(0, 10),
      conflicts: conflicts.length,
      categories: getCategoryStats(shortcuts),
      contexts: getContextStats(shortcuts)
    };
  }, [shortcuts, recentlyUsed, conflicts]);

  /**
   * 💾 Exportar configuración
   */
  const exportConfiguration = useCallback(() => {
    const config = {
      shortcuts: shortcuts.map(s => ({
        ...s,
        handler: undefined // No serializar funciones
      })),
      recentlyUsed,
      timestamp: Date.now(),
      version: '2.5.0'
    };

    return JSON.stringify(config, null, 2);
  }, [shortcuts, recentlyUsed]);

  /**
   * 📥 Importar configuración
   */
  const importConfiguration = useCallback((configJson) => {
    try {
      const config = JSON.parse(configJson);
      
      if (config.shortcuts) {
        setShortcuts(config.shortcuts);
      }
      
      if (config.recentlyUsed) {
        setRecentlyUsed(config.recentlyUsed);
      }

      return true;
    } catch (error) {
      console.error('Error importing shortcuts configuration:', error);
      return false;
    }
  }, []);

  /**
   * 🔍 Buscar atajos
   */
  const searchShortcuts = useCallback((query) => {
    if (!query) return shortcuts;

    const lowerQuery = query.toLowerCase();
    return shortcuts.filter(shortcut => 
      shortcut.label.toLowerCase().includes(lowerQuery) ||
      shortcut.description?.toLowerCase().includes(lowerQuery) ||
      shortcut.category.toLowerCase().includes(lowerQuery) ||
      formatKeysForSearch(shortcut.keys).includes(lowerQuery)
    );
  }, [shortcuts]);

  // Funciones auxiliares internas
  const loadShortcutsConfiguration = () => {
    try {
      const saved = localStorage.getItem('cmt_keyboard_shortcuts_v2');
      if (saved) {
        const config = JSON.parse(saved);
        if (config.shortcuts) setShortcuts(config.shortcuts);
        if (config.recentlyUsed) setRecentlyUsed(config.recentlyUsed);
      }
    } catch (error) {
      console.warn('Error loading shortcuts configuration:', error);
    }
  };

  const executeShortcut = (shortcut) => {
    const now = Date.now();
    
    // Verificar cooldown
    if (shortcut.cooldown && (now - shortcut.lastTriggered) < shortcut.cooldown) {
      return false;
    }

    // Verificar condiciones
    if (shortcut.conditions.length > 0) {
      const conditionsMet = shortcut.conditions.every(condition => 
        evaluateCondition(condition)
      );
      if (!conditionsMet) return false;
    }

    // Actualizar último uso
    updateShortcut(shortcut.id, { lastTriggered: now });
    
    // Agregar a recientes
    addToRecentlyUsed(shortcut);

    // Ejecutar acción
    if (shortcut.handler) {
      shortcut.handler(shortcut);
    } else if (shortcut.action && onShortcutTriggered) {
      onShortcutTriggered(shortcut);
    }

    // Analytics
    if (analytics) {
      trackShortcutUsage(shortcut);
    }

    return true;
  };

  const addToRecentlyUsed = (shortcut) => {
    setRecentlyUsed(prev => {
      const filtered = prev.filter(s => s.id !== shortcut.id);
      return [{ ...shortcut, lastUsed: Date.now() }, ...filtered].slice(0, 20);
    });
  };

  const trackShortcutUsage = (shortcut) => {
    // Enviar datos de analytics (implementar según necesidades)
    if (debug) {
      console.log('📊 Shortcut used:', shortcut.label, shortcut.keys);
    }
  };

  return {
    // Estado
    shortcuts,
    isRecording,
    recentlyUsed,
    conflicts,
    enabled,

    // Acciones
    registerShortcut,
    unregisterShortcut,
    toggleShortcut,
    updateShortcut,
    startRecording,
    triggerShortcut,

    // Utilidades
    getUsageStats,
    exportConfiguration,
    importConfiguration,
    searchShortcuts,

    // Estado computado
    enabledShortcuts: shortcuts.filter(s => s.enabled),
    shortcutsByContext: groupBy(shortcuts, 'context'),
    shortcutsByCategory: groupBy(shortcuts, 'category')
  };
};

/**
 * 🎧 Hook para escuchar atajos específicos
 */
export const useShortcutListener = (shortcuts, options = {}) => {
  const {
    enabled = true,
    context = 'global',
    onTriggered,
    preventDefault = true,
    stopPropagation = true
  } = options;

  useEffect(() => {
    if (!enabled || !shortcuts.length) return;

    const handleKeyDown = (e) => {
      const pressedKeys = captureKeyCombo(e);
      
      const matchingShortcut = shortcuts.find(shortcut => {
        if (!shortcut.enabled) return false;
        if (shortcut.context !== 'global' && shortcut.context !== context) return false;
        return arraysEqual(shortcut.keys, pressedKeys);
      });

      if (matchingShortcut) {
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        
        if (onTriggered) {
          onTriggered(matchingShortcut, e);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [shortcuts, enabled, context, onTriggered, preventDefault, stopPropagation]);
};

/**
 * 🔍 Hook para detección de conflictos
 */
export const useShortcutConflicts = (shortcuts) => {
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    const detected = detectShortcutConflicts(shortcuts);
    setConflicts(detected);
  }, [shortcuts]);

  const resolveConflict = useCallback((conflictId, resolution) => {
    // Implementar resolución de conflictos
    console.log('Resolving conflict:', conflictId, resolution);
  }, []);

  return {
    conflicts,
    hasConflicts: conflicts.length > 0,
    resolveConflict
  };
};

/**
 * 📱 Hook para detección de dispositivo y adaptación
 */
export const useShortcutDeviceAdaptation = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasKeyboard: true,
    supportsKeyboardShortcuts: true
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTablet = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(userAgent);
      
      setDeviceInfo({
        isMobile: isMobile && !isTablet,
        isTablet,
        isDesktop: !isMobile,
        hasKeyboard: !isMobile || window.innerWidth > 768,
        supportsKeyboardShortcuts: !isMobile
      });
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    return () => window.removeEventListener('resize', updateDeviceInfo);
  }, []);

  const adaptShortcutsForDevice = useCallback((shortcuts) => {
    if (!deviceInfo.supportsKeyboardShortcuts) {
      return shortcuts.filter(s => s.touchAlternative);
    }

    if (deviceInfo.isMobile) {
      return shortcuts.filter(s => s.mobileCompatible !== false);
    }

    return shortcuts;
  }, [deviceInfo]);

  return {
    deviceInfo,
    adaptShortcutsForDevice,
    shouldShowKeyboardShortcuts: deviceInfo.supportsKeyboardShortcuts
  };
};

/**
 * 🔧 Funciones auxiliares
 */
const captureKeyCombo = (e) => {
  const keys = [];
  
  // Modificadores (orden importante)
  if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  
  // Tecla principal (excluir modificadores solos)
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    keys.push(e.key.toUpperCase());
  }
  
  return keys;
};

const detectShortcutConflicts = (shortcuts) => {
  const conflicts = [];
  const keyMap = new Map();

  shortcuts.forEach(shortcut => {
    if (!shortcut.enabled) return;
    
    const keyString = shortcut.keys.join('+');
    const contextKey = `${keyString}:${shortcut.context}`;
    
    if (keyMap.has(contextKey)) {
      const existing = keyMap.get(contextKey);
      conflicts.push({
        id: `conflict_${Date.now()}_${Math.random()}`,
        type: 'duplicate_keys',
        message: `Conflicto: "${formatKeysDisplay(shortcut.keys)}" está asignado a "${shortcut.label}" y "${existing.label}"`,
        shortcuts: [shortcut, existing],
        severity: 'high'
      });
    } else {
      keyMap.set(contextKey, shortcut);
    }
  });

  return conflicts;
};

const evaluateCondition = (condition) => {
  // Implementar evaluación de condiciones
  // Ejemplos: elemento activo, estado de la aplicación, etc.
  return true;
};

const generateShortcutId = () => {
  return `shortcut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const formatKeysDisplay = (keys) => {
  if (!Array.isArray(keys)) return '';
  return keys.join(' + ');
};

const formatKeysForSearch = (keys) => {
  return formatKeysDisplay(keys).toLowerCase();
};

const getCategoryStats = (shortcuts) => {
  return shortcuts.reduce((stats, shortcut) => {
    const category = shortcut.category || 'other';
    stats[category] = (stats[category] || 0) + 1;
    return stats;
  }, {});
};

const getContextStats = (shortcuts) => {
  return shortcuts.reduce((stats, shortcut) => {
    const context = shortcut.context || 'global';
    stats[context] = (stats[context] || 0) + 1;
    return stats;
  }, {});
};

const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key] || 'other';
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
    return groups;
  }, {});
};

const arraysEqual = (a, b) => {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
};

export default useKeyboardShortcuts;