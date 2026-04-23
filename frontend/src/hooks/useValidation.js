/**
 * 🎯 VALIDATION HOOKS - CMT v2.5
 * Custom hooks para integración fácil del sistema de validación
 * Facilita el uso de validaciones en componentes React
 */

import { useState, useCallback, useMemo } from 'react';
import validationSchemas from '../utils/validationSchemas';

/**
 * 🔍 Hook principal para validación de datos
 */
export const useValidation = (schema, options = {}) => {
  const [validationResult, setValidationResult] = useState({
    isValid: true,
    errors: [],
    warnings: [],
    data: null,
    lastValidated: null
  });

  const {
    autoValidate = false,
    showWarnings = true,
    debounceMs = 300
  } = options;

  const validate = useCallback((data) => {
    try {
      const result = schema.validate(data);
      const validationData = {
        ...result,
        lastValidated: new Date()
      };

      if (!showWarnings) {
        delete validationData.warnings;
      }

      setValidationResult(validationData);
      return validationData;
    } catch (error) {
      const errorResult = {
        isValid: false,
        errors: [{ field: 'validation', message: 'Error interno de validación' }],
        warnings: [],
        data: null,
        lastValidated: new Date()
      };
      setValidationResult(errorResult);
      return errorResult;
    }
  }, [schema, showWarnings]);

  const validateAsync = useCallback(async (data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = validate(data);
        resolve(result);
      }, debounceMs);
    });
  }, [validate, debounceMs]);

  const reset = useCallback(() => {
    setValidationResult({
      isValid: true,
      errors: [],
      warnings: [],
      data: null,
      lastValidated: null
    });
  }, []);

  return {
    ...validationResult,
    validate,
    validateAsync,
    reset,
    hasErrors: validationResult.errors.length > 0,
    hasWarnings: validationResult.warnings?.length > 0,
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings?.length || 0
  };
};

/**
 * 📊 Hook específico para validación del Dashboard
 */
export const useDashboardValidation = (options = {}) => {
  return useValidation(validationSchemas, {
    autoValidate: true,
    showWarnings: true,
    ...options
  });
};

/**
 * 🔐 Hook específico para validación de certificados
 */
export const useCertificateValidation = (options = {}) => {
  return useValidation(validationSchemas.CertificateSchema, {
    autoValidate: false,
    showWarnings: true,
    ...options
  });
};

/**
 * 🖥️ Hook específico para validación de dispositivos
 */
export const useDeviceValidation = (options = {}) => {
  return useValidation(validationSchemas.DeviceSchema, {
    autoValidate: false,
    showWarnings: false,
    ...options
  });
};

/**
 * 🌐 Hook específico para validación de VIPs
 */
export const useVipValidation = (options = {}) => {
  return useValidation(validationSchemas.VipSchema, {
    autoValidate: false,
    showWarnings: true,
    ...options
  });
};

/**
 * ⚠️ Hook específico para validación de alertas
 */
export const useAlertValidation = (options = {}) => {
  return useValidation(validationSchemas.AlertSchema, {
    autoValidate: true,
    showWarnings: false,
    ...options
  });
};

/**
 * 📋 Hook para validación de arrays con límites
 */
export const useArrayValidation = (itemValidator, arrayOptions = {}) => {
  const [validationState, setValidationState] = useState({
    isValid: true,
    errors: [],
    data: [],
    itemErrors: {},
    totalItems: 0,
    validItems: 0,
    invalidItems: 0
  });

  const validateArray = useCallback((array) => {
    if (!Array.isArray(array)) {
      const errorState = {
        isValid: false,
        errors: [{ field: 'array', message: 'El valor debe ser un array' }],
        data: [],
        itemErrors: {},
        totalItems: 0,
        validItems: 0,
        invalidItems: 0
      };
      setValidationState(errorState);
      return errorState;
    }

    const result = validationSchemas.validateArray(array, {
      itemValidator: itemValidator?.validate || itemValidator,
      ...arrayOptions
    });

    // Analizar errores por elemento
    const itemErrors = {};
    let validItems = 0;
    let invalidItems = 0;

    result.errors.forEach(error => {
      const match = error.field?.match(/^array\[(\d+)\]/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (!itemErrors[index]) {
          itemErrors[index] = [];
        }
        itemErrors[index].push(error);
        invalidItems++;
      }
    });

    validItems = array.length - invalidItems;

    const finalState = {
      ...result,
      itemErrors,
      totalItems: array.length,
      validItems,
      invalidItems
    };

    setValidationState(finalState);
    return finalState;
  }, [itemValidator, arrayOptions]);

  const getItemErrors = useCallback((index) => {
    return validationState.itemErrors[index] || [];
  }, [validationState.itemErrors]);

  const isItemValid = useCallback((index) => {
    return !validationState.itemErrors[index];
  }, [validationState.itemErrors]);

  return {
    ...validationState,
    validateArray,
    getItemErrors,
    isItemValid,
    validationProgress: validationState.totalItems > 0 
      ? (validationState.validItems / validationState.totalItems) * 100 
      : 100
  };
};

/**
 * 📈 Hook para validación en tiempo real con debounce
 */
export const useRealTimeValidation = (schema, data, debounceMs = 500) => {
  const [debouncedData, setDebouncedData] = useState(data);
  const validation = useValidation(schema, { autoValidate: true });

  // Debounce del data
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedData(data);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [data, debounceMs]);

  // Validar cuando cambie el data debounced
  useMemo(() => {
    if (debouncedData !== null && debouncedData !== undefined) {
      validation.validate(debouncedData);
    }
  }, [debouncedData, validation.validate]);

  return {
    ...validation,
    isValidating: debouncedData !== data,
    originalData: data,
    debouncedData
  };
};

/**
 * 🔄 Hook para validación con retry automático
 */
export const useValidationWithRetry = (schema, maxRetries = 3) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const validation = useValidation(schema);

  const validateWithRetry = useCallback(async (data) => {
    setIsRetrying(true);
    let lastResult = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        lastResult = validation.validate(data);
        if (lastResult.isValid) {
          setRetryCount(attempt);
          setIsRetrying(false);
          return lastResult;
        }
      } catch (error) {
        // Error en la validación, continuar con retry
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    setRetryCount(maxRetries);
    setIsRetrying(false);
    return lastResult;
  }, [validation, maxRetries]);

  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
    validation.reset();
  }, [validation]);

  return {
    ...validation,
    validateWithRetry,
    resetRetry,
    retryCount,
    isRetrying,
    maxRetries,
    hasReachedMaxRetries: retryCount >= maxRetries
  };
};

/**
 * 🎯 Hook para validación de formularios
 */
export const useFormValidation = (formSchema) => {
  const [fieldValidations, setFieldValidations] = useState({});
  const [formErrors, setFormErrors] = useState([]);
  const [isFormValid, setIsFormValid] = useState(false);

  const validateField = useCallback((fieldName, value) => {
    if (!formSchema[fieldName]) {
      return { isValid: true, errors: [] };
    }

    const result = formSchema[fieldName].validate(value);
    
    setFieldValidations(prev => ({
      ...prev,
      [fieldName]: result
    }));

    return result;
  }, [formSchema]);

  const validateForm = useCallback((formData) => {
    const newFieldValidations = {};
    const allErrors = [];

    Object.keys(formSchema).forEach(fieldName => {
      const fieldValue = formData[fieldName];
      const result = validateField(fieldName, fieldValue);
      newFieldValidations[fieldName] = result;
      
      if (!result.isValid) {
        allErrors.push(...result.errors.map(error => ({
          ...error,
          field: fieldName
        })));
      }
    });

    setFieldValidations(newFieldValidations);
    setFormErrors(allErrors);
    setIsFormValid(allErrors.length === 0);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldValidations: newFieldValidations
    };
  }, [formSchema, validateField]);

  const getFieldError = useCallback((fieldName) => {
    const fieldValidation = fieldValidations[fieldName];
    return fieldValidation && !fieldValidation.isValid 
      ? fieldValidation.errors[0]?.message 
      : null;
  }, [fieldValidations]);

  const isFieldValid = useCallback((fieldName) => {
    const fieldValidation = fieldValidations[fieldName];
    return !fieldValidation || fieldValidation.isValid;
  }, [fieldValidations]);

  const resetForm = useCallback(() => {
    setFieldValidations({});
    setFormErrors([]);
    setIsFormValid(false);
  }, []);

  return {
    validateField,
    validateForm,
    getFieldError,
    isFieldValid,
    resetForm,
    fieldValidations,
    formErrors,
    isFormValid,
    errorCount: formErrors.length
  };
};

/**
 * 🎯 Exportar todos los hooks
 */
export default {
  useValidation,
  useDashboardValidation,
  useCertificateValidation,
  useDeviceValidation,
  useVipValidation,
  useAlertValidation,
  useArrayValidation,
  useRealTimeValidation,
  useValidationWithRetry,
  useFormValidation
};