import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 🔄 useRetry Hook
 * Hook personalizado para manejo robusto de reintentos con backoff exponencial
 * Ideal para operaciones de red y llamadas a APIs
 */

// Configuración por defecto
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 segundo
  maxDelay: 30000,    // 30 segundos
  backoffFactor: 2,   // Exponencial x2
  retryCondition: (error) => {
    // Reintentar en errores de red, timeouts, y 5xx
    if (!error.response) return true; // Error de red
    const status = error.response?.status;
    return status >= 500 || status === 408 || status === 429; // Server errors, timeout, rate limit
  },
  onRetry: null,      // Callback en cada reintento
  onFailure: null,    // Callback en fallo final
  onSuccess: null     // Callback en éxito
};

export const useRetry = (config = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState({
    isLoading: false,
    isRetrying: false,
    error: null,
    retryCount: 0,
    totalAttempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null
  });

  const abortControllerRef = useRef(null);
  const timeoutRef = useRef(null);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * 📐 Calcular delay para próximo reintento (exponential backoff with jitter)
   */
  const calculateDelay = useCallback((retryCount) => {
    const exponentialDelay = finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, retryCount);
    const delayWithCap = Math.min(exponentialDelay, finalConfig.maxDelay);
    
    // Agregar jitter (±25%) para evitar thundering herd
    const jitter = delayWithCap * 0.25 * (Math.random() - 0.5);
    
    return Math.max(500, delayWithCap + jitter); // Mínimo 500ms
  }, [finalConfig]);

  /**
   * 🚀 Ejecutar operación con reintentos automáticos
   */
  const executeWithRetry = useCallback(async (operation, operationConfig = {}) => {
    const config = { ...finalConfig, ...operationConfig };
    
    // Crear nuevo AbortController para esta operación
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prevState => ({
      ...prevState,
      isLoading: true,
      isRetrying: false,
      error: null,
      retryCount: 0,
      totalAttempts: 0,
      lastAttemptAt: null,
      nextRetryAt: null
    }));

    let currentRetryCount = 0;
    let lastError = null;

    const attemptOperation = async () => {
      try {
        setState(prevState => ({
          ...prevState,
          totalAttempts: prevState.totalAttempts + 1,
          lastAttemptAt: new Date().toISOString(),
          isRetrying: currentRetryCount > 0
        }));

        // Ejecutar operación con signal de abort
        const result = await operation(abortControllerRef.current.signal);
        
        // Éxito - limpiar estado y ejecutar callback
        setState(prevState => ({
          ...prevState,
          isLoading: false,
          isRetrying: false,
          error: null,
          nextRetryAt: null
        }));

        if (config.onSuccess) {
          config.onSuccess(result, currentRetryCount);
        }

        return result;

      } catch (error) {
        // Verificar si fue cancelado
        if (error.name === 'AbortError') {
          throw error;
        }

        lastError = error;
        
        // Verificar si debemos reintentar
        const shouldRetry = currentRetryCount < config.maxRetries && 
                           config.retryCondition(error);

        if (!shouldRetry) {
          // No más reintentos - fallo final
          setState(prevState => ({
            ...prevState,
            isLoading: false,
            isRetrying: false,
            error: lastError,
            nextRetryAt: null
          }));

          if (config.onFailure) {
            config.onFailure(lastError, currentRetryCount);
          }

          throw lastError;
        }

        // Preparar siguiente reintento
        currentRetryCount++;
        const delay = calculateDelay(currentRetryCount - 1);
        const nextRetryAt = new Date(Date.now() + delay).toISOString();

        setState(prevState => ({
          ...prevState,
          retryCount: currentRetryCount,
          error: lastError,
          nextRetryAt
        }));

        if (config.onRetry) {
          config.onRetry(lastError, currentRetryCount, delay);
        }

        // Esperar antes del próximo intento
        await new Promise((resolve, reject) => {
          timeoutRef.current = setTimeout(() => {
            if (abortControllerRef.current?.signal.aborted) {
              reject(new Error('Operación cancelada'));
            } else {
              resolve();
            }
          }, delay);
        });

        // Llamada recursiva para el siguiente intento
        return attemptOperation();
      }
    };

    return attemptOperation();
  }, [finalConfig, calculateDelay]);

  /**
   * 🛑 Cancelar operación en curso
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setState(prevState => ({
      ...prevState,
      isLoading: false,
      isRetrying: false,
      nextRetryAt: null
    }));
  }, []);

  /**
   * 🔄 Reintentar manualmente
   */
  const retryNow = useCallback((operation, operationConfig = {}) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return executeWithRetry(operation, operationConfig);
  }, [executeWithRetry]);

  /**
   * 🧹 Reset del estado
   */
  const reset = useCallback(() => {
    cancel();
    setState({
      isLoading: false,
      isRetrying: false,
      error: null,
      retryCount: 0,
      totalAttempts: 0,
      lastAttemptAt: null,
      nextRetryAt: null
    });
  }, [cancel]);

  return {
    // Estado
    ...state,
    
    // Métodos
    executeWithRetry,
    cancel,
    retryNow,
    reset,
    
    // Utilidades
    hasError: Boolean(state.error),
    canRetry: state.retryCount < finalConfig.maxRetries,
    nextRetryIn: state.nextRetryAt ? 
      Math.max(0, new Date(state.nextRetryAt).getTime() - Date.now()) : null,
    
    // Configuración activa
    config: finalConfig
  };
};

/**
 * 🎯 Hook especializado para llamadas a API
 */
export const useApiRetry = (baseConfig = {}) => {
  const apiConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    backoffFactor: 2,
    retryCondition: (error) => {
      // Reintentar en errores de red y específicos de servidor
      if (!error.response) return true;
      const status = error.response.status;
      return [408, 429, 500, 502, 503, 504].includes(status);
    },
    ...baseConfig
  };

  return useRetry(apiConfig);
};

/**
 * 📡 Hook para operaciones de fetch con retry
 */
export const useFetchWithRetry = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  
  const {
    executeWithRetry,
    isLoading,
    isRetrying,
    error,
    retryCount,
    reset,
    retryNow
  } = useApiRetry(options.retryConfig);

  const fetchData = useCallback(async (customUrl = url, customOptions = {}) => {
    const fetchOptions = { ...options, ...customOptions };
    delete fetchOptions.retryConfig; // Remover configuración de retry
    
    const result = await executeWithRetry(async (signal) => {
      const response = await fetch(customUrl, {
        ...fetchOptions,
        signal
      });

      if (!response.ok) {
        const error = new Error(`HTTP Error: ${response.status}`);
        error.response = response;
        throw error;
      }

      const data = await response.json();
      setData(data);
      setLastFetchTime(new Date().toISOString());
      return data;
    });

    return result;
  }, [url, options, executeWithRetry]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  const retryFetch = useCallback(() => {
    return retryNow(async (signal) => {
      const response = await fetch(url, {
        ...options,
        signal
      });

      if (!response.ok) {
        const error = new Error(`HTTP Error: ${response.status}`);
        error.response = response;
        throw error;
      }

      const data = await response.json();
      setData(data);
      setLastFetchTime(new Date().toISOString());
      return data;
    });
  }, [url, options, retryNow]);

  return {
    data,
    lastFetchTime,
    isLoading,
    isRetrying,
    error,
    retryCount,
    fetchData,
    refetch,
    retryFetch,
    reset
  };
};

/**
 * 🔧 Utilidades de error para retry logic
 */
export const retryUtils = {
  /**
   * Determinar si un error es retryable
   */
  isRetryableError: (error) => {
    if (!error.response) return true; // Error de red
    const status = error.response.status;
    return status >= 500 || [408, 429].includes(status);
  },

  /**
   * Crear configuración de retry para diferentes escenarios
   */
  createRetryConfig: {
    // Para operaciones críticas
    critical: {
      maxRetries: 5,
      initialDelay: 500,
      maxDelay: 30000,
      backoffFactor: 2
    },
    
    // Para operaciones normales
    standard: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 15000,
      backoffFactor: 2
    },
    
    // Para operaciones rápidas
    fast: {
      maxRetries: 2,
      initialDelay: 500,
      maxDelay: 5000,
      backoffFactor: 1.5
    },
    
    // Para operaciones en background
    background: {
      maxRetries: 10,
      initialDelay: 2000,
      maxDelay: 60000,
      backoffFactor: 1.5
    }
  },

  /**
   * Formatear información de retry para UI
   */
  formatRetryInfo: (state) => {
    const { retryCount, totalAttempts, nextRetryAt, config } = state;
    
    return {
      attemptsText: `${retryCount}/${config.maxRetries}`,
      nextRetryText: nextRetryAt ? 
        `Siguiente intento en ${Math.ceil((new Date(nextRetryAt) - new Date()) / 1000)}s` : 
        null,
      progressPercentage: Math.round((retryCount / config.maxRetries) * 100)
    };
  }
};

export default {
  useRetry,
  useApiRetry,
  useFetchWithRetry,
  retryUtils
};