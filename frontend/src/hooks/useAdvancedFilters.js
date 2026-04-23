/**
 * 🎣 useAdvancedFilters Hook
 * CMT v2.5 - Hook personalizado para gestión avanzada de filtros
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Hook para gestión avanzada de filtros con persistencia y aplicación automática
 */
export const useAdvancedFilters = (
  initialData = [],
  filterConfig = {},
  options = {}
) => {
  const {
    enablePersistence = true,
    storageKey = 'cmt_filters',
    debounceMs = 300,
    autoApply = true
  } = options;

  const [rawData] = useState(initialData);
  const [filters, setFilters] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Cargar filtros persistidos
  useEffect(() => {
    if (enablePersistence) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setFilters(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading persisted filters:', error);
      }
    }
  }, [enablePersistence, storageKey]);

  // Guardar filtros
  const saveFilters = useCallback((newFilters) => {
    if (enablePersistence) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newFilters));
      } catch (error) {
        console.error('Error saving filters:', error);
      }
    }
  }, [enablePersistence, storageKey]);

  // Aplicar filtros a los datos
  const applyFiltersToData = useCallback((data, activeFilters) => {
    if (!activeFilters || Object.keys(activeFilters).length === 0) {
      return data;
    }

    return data.filter(item => {
      return Object.entries(activeFilters).every(([key, filterValue]) => {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
          return true;
        }

        const config = filterConfig[key];
        if (!config) return true;

        const itemValue = item[key];

        switch (config.type) {
          case 'text':
            if (!itemValue) return false;
            const searchTerm = filterValue.toLowerCase();
            const itemText = String(itemValue).toLowerCase();
            
            switch (config.operator || 'contains') {
              case 'contains':
                return itemText.includes(searchTerm);
              case 'starts_with':
                return itemText.startsWith(searchTerm);
              case 'ends_with':
                return itemText.endsWith(searchTerm);
              case 'equals':
                return itemText === searchTerm;
              default:
                return itemText.includes(searchTerm);
            }

          case 'select':
            return filterValue === '' || itemValue === filterValue;

          case 'multiselect':
          case 'autocomplete':
            if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
            if (Array.isArray(itemValue)) {
              return filterValue.some(fv => itemValue.includes(fv));
            }
            return filterValue.includes(itemValue);

          case 'date_range':
            if (!filterValue.start && !filterValue.end) return true;
            const itemDate = new Date(itemValue);
            if (isNaN(itemDate.getTime())) return false;
            
            if (filterValue.start && itemDate < filterValue.start) return false;
            if (filterValue.end && itemDate > filterValue.end) return false;
            return true;

          case 'number_range':
            const numValue = Number(itemValue);
            if (isNaN(numValue)) return false;
            
            if (filterValue.min !== null && filterValue.min !== undefined && numValue < filterValue.min) return false;
            if (filterValue.max !== null && filterValue.max !== undefined && numValue > filterValue.max) return false;
            return true;

          case 'boolean':
            return itemValue === filterValue;

          default:
            return true;
        }
      });
    });
  }, [filterConfig]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    setIsLoading(true);
    const result = applyFiltersToData(rawData, filters);
    setIsLoading(false);
    return result;
  }, [rawData, filters, applyFiltersToData]);

  // Estadísticas de filtros
  const filterStats = useMemo(() => {
    const activeCount = Object.values(filters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
      }
      return value !== null && value !== undefined && value !== '';
    }).length;

    return {
      totalItems: rawData.length,
      filteredItems: filteredData.length,
      activeFilters: activeCount,
      reductionPercentage: rawData.length > 0 
        ? Math.round(((rawData.length - filteredData.length) / rawData.length) * 100)
        : 0
    };
  }, [rawData.length, filteredData.length, filters]);

  // Actualizar filtros
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    saveFilters(newFilters);
  }, [saveFilters]);

  // Limpiar filtros
  const clearFilters = useCallback(() => {
    setFilters({});
    saveFilters({});
  }, [saveFilters]);

  // Aplicar filtro individual
  const setFilter = useCallback((key, value) => {
    const newFilters = { ...filters, [key]: value };
    updateFilters(newFilters);
  }, [filters, updateFilters]);

  // Remover filtro individual
  const removeFilter = useCallback((key) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    updateFilters(newFilters);
  }, [filters, updateFilters]);

  // Exportar filtros actuales
  const exportFilters = useCallback(() => {
    return {
      filters: { ...filters },
      config: filterConfig,
      timestamp: new Date().toISOString(),
      stats: filterStats
    };
  }, [filters, filterConfig, filterStats]);

  // Importar filtros
  const importFilters = useCallback((exportedData) => {
    if (exportedData && exportedData.filters) {
      updateFilters(exportedData.filters);
      return true;
    }
    return false;
  }, [updateFilters]);

  return {
    // Estados
    filters,
    filteredData,
    isLoading,
    filterStats,
    
    // Acciones
    updateFilters,
    clearFilters,
    setFilter,
    removeFilter,
    
    // Utilidades
    exportFilters,
    importFilters,
    
    // Funciones auxiliares
    applyFiltersToData
  };
};

/**
 * Hook especializado para filtros de certificados
 */
export const useCertificateFilters = (certificates = []) => {
  return useAdvancedFilters(
    certificates,
    {
      search: { type: 'text', operator: 'contains' },
      status: { type: 'multiselect' },
      issuer: { type: 'autocomplete' },
      keySize: { type: 'select' },
      expirationDate: { type: 'date_range' },
      domains: { type: 'number_range' },
      isWildcard: { type: 'boolean' }
    },
    {
      storageKey: 'cmt_certificate_filters',
      debounceMs: 500
    }
  );
};

/**
 * Hook especializado para filtros de dispositivos
 */
export const useDeviceFilters = (devices = []) => {
  return useAdvancedFilters(
    devices,
    {
      search: { type: 'text', operator: 'contains' },
      status: { type: 'multiselect' },
      deviceType: { type: 'select' },
      version: { type: 'autocomplete' },
      lastSeen: { type: 'date_range' }
    },
    {
      storageKey: 'cmt_device_filters',
      debounceMs: 300
    }
  );
};

/**
 * Hook para gestión de presets de filtros
 */
export const useFilterPresets = (category = 'general') => {
  const [presets, setPresets] = useState([]);
  const storageKey = `cmt_filter_presets_${category}`;

  // Cargar presets al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setPresets(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading filter presets:', error);
    }
  }, [storageKey]);

  // Guardar presets
  const savePresets = useCallback((newPresets) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPresets));
      setPresets(newPresets);
    } catch (error) {
      console.error('Error saving filter presets:', error);
    }
  }, [storageKey]);

  // Agregar preset
  const addPreset = useCallback((name, filters, description = '') => {
    const newPreset = {
      id: Date.now(),
      name,
      description,
      filters: { ...filters },
      createdAt: new Date().toISOString(),
      category
    };
    
    const newPresets = [...presets, newPreset];
    savePresets(newPresets);
    return newPreset;
  }, [presets, savePresets, category]);

  // Remover preset
  const removePreset = useCallback((id) => {
    const newPresets = presets.filter(p => p.id !== id);
    savePresets(newPresets);
  }, [presets, savePresets]);

  // Actualizar preset
  const updatePreset = useCallback((id, updates) => {
    const newPresets = presets.map(p => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    savePresets(newPresets);
  }, [presets, savePresets]);

  return {
    presets,
    addPreset,
    removePreset,
    updatePreset
  };
};

export default useAdvancedFilters;