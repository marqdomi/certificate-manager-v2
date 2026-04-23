/**
 * 🛡️ ROBUST DATA VALIDATION SYSTEM - CMT v2.5
 * Sistema completo de validación y sanitización de datos
 * Enterprise-grade validation with comprehensive error handling
 */

/**
 * 🔧 UTILITY FUNCTIONS FOR DATA VALIDATION
 */

// IP Address Validation (IPv4 & IPv6)
export const isValidIP = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  
  // IPv4 validation with proper range checking
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ip.match(ipv4Regex);
  
  if (ipv4Match) {
    return ipv4Match.slice(1).every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 validation (simplified but robust)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(ip);
};

// Enhanced URL Validation
export const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    // Check for valid protocols
    const validProtocols = ['http:', 'https:', 'ftp:', 'ftps:'];
    return validProtocols.includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// Date Validation with multiple formats
export const isValidDate = (date, allowFuture = true) => {
  let dateObj;
  
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date * 1000); // Assume Unix timestamp
  } else {
    return false;
  }
  
  if (isNaN(dateObj.getTime())) return false;
  
  // Check for reasonable date ranges (not before 1970, not too far in future)
  const now = new Date();
  const minDate = new Date('1970-01-01');
  const maxDate = new Date(now.getFullYear() + 10, 11, 31); // 10 years in future
  
  if (dateObj < minDate) return false;
  if (!allowFuture && dateObj > now) return false;
  if (dateObj > maxDate) return false;
  
  return true;
};

// Email Validation
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Port Number Validation
export const isValidPort = (port) => {
  const num = parseInt(port, 10);
  return !isNaN(num) && num >= 1 && num <= 65535;
};

// Domain/Hostname Validation
export const isValidDomain = (domain) => {
  if (!domain || typeof domain !== 'string') return false;
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
};

// Certificate Serial Number Validation
export const isValidCertSerial = (serial) => {
  if (!serial || typeof serial !== 'string') return false;
  const serialRegex = /^[0-9A-Fa-f:]+$/;
  return serialRegex.test(serial) && serial.length >= 8 && serial.length <= 40;
};

/**
 * 🧹 SANITIZATION FUNCTIONS
 */

// HTML/Script Sanitization
export const sanitizeHtml = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// SQL Injection Prevention
export const sanitizeSql = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
};

// General String Sanitization
export const sanitizeString = (input, maxLength = 1000) => {
  if (!input) return '';
  
  let sanitized = String(input)
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, maxLength);
    
  return sanitizeHtml(sanitized);
};

// Number Sanitization with bounds
export const sanitizeNumber = (input, min = -Infinity, max = Infinity) => {
  const num = parseFloat(input);
  if (isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
};

/**
 * 📋 ARRAY VALIDATION WITH LIMITS
 */
export const validateArray = (array, options = {}) => {
  const {
    maxLength = 1000,
    minLength = 0,
    itemValidator = null,
    allowEmpty = true,
    uniqueItems = false,
    sanitizeItems = false
  } = options;
  
  const errors = [];
  
  // Check if it's an array
  if (!Array.isArray(array)) {
    errors.push({ field: 'array', message: 'El valor debe ser un array' });
    return { isValid: false, errors, data: [] };
  }
  
  // Check length constraints
  if (array.length < minLength) {
    errors.push({ field: 'array.length', message: `El array debe tener al menos ${minLength} elementos` });
  }
  
  if (array.length > maxLength) {
    errors.push({ field: 'array.length', message: `El array no puede tener más de ${maxLength} elementos` });
  }
  
  // Check if empty arrays are allowed
  if (array.length === 0 && !allowEmpty) {
    errors.push({ field: 'array.empty', message: 'El array no puede estar vacío' });
  }
  
  let processedArray = [...array];
  
  // Sanitize items if requested
  if (sanitizeItems) {
    processedArray = processedArray.map(item => 
      typeof item === 'string' ? sanitizeString(item) : item
    );
  }
  
  // Check for unique items
  if (uniqueItems) {
    const uniqueSet = new Set(processedArray.map(item => JSON.stringify(item)));
    if (uniqueSet.size !== processedArray.length) {
      errors.push({ field: 'array.unique', message: 'El array contiene elementos duplicados' });
    }
  }
  
  // Validate individual items
  if (itemValidator && typeof itemValidator === 'function') {
    processedArray.forEach((item, index) => {
      const validation = itemValidator(item, index);
      if (validation && !validation.isValid) {
        validation.errors.forEach(error => {
          errors.push({
            field: `array[${index}].${error.field}`,
            message: error.message
          });
        });
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: processedArray
  };
};

/**
 * 📊 DASHBOARD METRICS SCHEMA (Enhanced)
 */
export const DashboardMetricsSchema = {
  validate: (data) => {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
      errors.push({ field: 'root', message: 'Los datos de métricas deben ser un objeto' });
      return { isValid: false, errors, data: null };
    }
    
    const sanitizedData = {};
    
    // Certificate metrics validation
    if (data.certificates !== undefined) {
      const certMetrics = data.certificates;
      if (typeof certMetrics !== 'object') {
        errors.push({ field: 'certificates', message: 'Las métricas de certificados deben ser un objeto' });
      } else {
        sanitizedData.certificates = {
          total: sanitizeNumber(certMetrics.total, 0, 100000),
          active: sanitizeNumber(certMetrics.active, 0, 100000),
          expiring_soon: sanitizeNumber(certMetrics.expiring_soon, 0, 10000),
          expired: sanitizeNumber(certMetrics.expired, 0, 10000),
          revoked: sanitizeNumber(certMetrics.revoked, 0, 10000)
        };
        
        // Logical validation
        const { total, active, expiring_soon, expired, revoked } = sanitizedData.certificates;
        if (active + expired + revoked > total) {
          errors.push({ field: 'certificates.totals', message: 'La suma de certificados activos, expirados y revocados no puede exceder el total' });
        }
      }
    }
    
    // Device metrics validation
    if (data.devices !== undefined) {
      const deviceMetrics = data.devices;
      if (typeof deviceMetrics !== 'object') {
        errors.push({ field: 'devices', message: 'Las métricas de dispositivos deben ser un objeto' });
      } else {
        sanitizedData.devices = {
          total: sanitizeNumber(deviceMetrics.total, 0, 10000),
          online: sanitizeNumber(deviceMetrics.online, 0, 10000),
          offline: sanitizeNumber(deviceMetrics.offline, 0, 10000),
          syncing: sanitizeNumber(deviceMetrics.syncing, 0, 1000),
          error: sanitizeNumber(deviceMetrics.error, 0, 1000)
        };
        
        // Logical validation
        const { total, online, offline, syncing, error } = sanitizedData.devices;
        if (online + offline + syncing + error > total) {
          errors.push({ field: 'devices.totals', message: 'La suma de estados de dispositivos no puede exceder el total' });
        }
      }
    }
    
    // VIP metrics validation
    if (data.vips !== undefined) {
      const vipMetrics = data.vips;
      if (typeof vipMetrics !== 'object') {
        errors.push({ field: 'vips', message: 'Las métricas de VIPs deben ser un objeto' });
      } else {
        sanitizedData.vips = {
          total: sanitizeNumber(vipMetrics.total, 0, 50000),
          enabled: sanitizeNumber(vipMetrics.enabled, 0, 50000),
          disabled: sanitizeNumber(vipMetrics.disabled, 0, 50000),
          ssl_enabled: sanitizeNumber(vipMetrics.ssl_enabled, 0, 50000)
        };
      }
    }
    
    // System health validation
    if (data.system_health !== undefined) {
      const health = data.system_health;
      if (typeof health !== 'object') {
        errors.push({ field: 'system_health', message: 'Los datos de salud del sistema deben ser un objeto' });
      } else {
        sanitizedData.system_health = {
          cpu_usage: sanitizeNumber(health.cpu_usage, 0, 100),
          memory_usage: sanitizeNumber(health.memory_usage, 0, 100),
          disk_usage: sanitizeNumber(health.disk_usage, 0, 100),
          active_connections: sanitizeNumber(health.active_connections, 0, 1000000),
          last_backup: isValidDate(health.last_backup) ? new Date(health.last_backup) : null
        };
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedData
    };
  }
};

/**
 * 🔐 CERTIFICATE SCHEMA (Enhanced)
 */
export const CertificateSchema = {
  validate: (cert) => {
    const errors = [];
    
    if (!cert || typeof cert !== 'object') {
      errors.push({ field: 'root', message: 'El certificado debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }
    
    const sanitizedCert = {};
    
    // Serial Number
    if (cert.serial_number) {
      if (!isValidCertSerial(cert.serial_number)) {
        errors.push({ field: 'serial_number', message: 'Número de serie de certificado inválido' });
      } else {
        sanitizedCert.serial_number = sanitizeString(cert.serial_number, 50);
      }
    }
    
    // Subject and Issuer
    sanitizedCert.subject = sanitizeString(cert.subject, 500);
    sanitizedCert.issuer = sanitizeString(cert.issuer, 500);
    
    // Dates
    if (cert.not_before) {
      if (!isValidDate(cert.not_before)) {
        errors.push({ field: 'not_before', message: 'Fecha de inicio inválida' });
      } else {
        sanitizedCert.not_before = new Date(cert.not_before);
      }
    }
    
    if (cert.not_after) {
      if (!isValidDate(cert.not_after)) {
        errors.push({ field: 'not_after', message: 'Fecha de expiración inválida' });
      } else {
        sanitizedCert.not_after = new Date(cert.not_after);
      }
    }
    
    // Logical date validation
    if (sanitizedCert.not_before && sanitizedCert.not_after) {
      if (sanitizedCert.not_before >= sanitizedCert.not_after) {
        errors.push({ field: 'dates', message: 'La fecha de inicio debe ser anterior a la fecha de expiración' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedCert
    };
  }
};

/**
 * 🖥️ DEVICE SCHEMA (Enhanced)
 */
export const DeviceSchema = {
  validate: (device) => {
    const errors = [];
    
    if (!device || typeof device !== 'object') {
      errors.push({ field: 'root', message: 'El dispositivo debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }
    
    const sanitizedDevice = {};
    
    // Basic info
    sanitizedDevice.name = sanitizeString(device.name, 100);
    if (!sanitizedDevice.name) {
      errors.push({ field: 'name', message: 'El nombre del dispositivo es requerido' });
    }
    
    // IP Address
    if (device.ip_address) {
      if (!isValidIP(device.ip_address)) {
        errors.push({ field: 'ip_address', message: 'Dirección IP inválida' });
      } else {
        sanitizedDevice.ip_address = device.ip_address;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedDevice
    };
  }
};

/**
 * 🌐 VIP SCHEMA (Enhanced)
 */
export const VipSchema = {
  validate: (vip) => {
    const errors = [];
    
    if (!vip || typeof vip !== 'object') {
      errors.push({ field: 'root', message: 'El VIP debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }
    
    const sanitizedVip = {};
    
    // Name
    sanitizedVip.name = sanitizeString(vip.name, 100);
    if (!sanitizedVip.name) {
      errors.push({ field: 'name', message: 'El nombre del VIP es requerido' });
    }
    
    // IP Address
    if (!vip.ip_address || !isValidIP(vip.ip_address)) {
      errors.push({ field: 'ip_address', message: 'Dirección IP del VIP es requerida y debe ser válida' });
    } else {
      sanitizedVip.ip_address = vip.ip_address;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedVip
    };
  }
};

/**
 * ⚠️ ALERT SCHEMA (Enhanced)
 */
export const AlertSchema = {
  validate: (alert) => {
    const errors = [];
    
    if (!alert || typeof alert !== 'object') {
      errors.push({ field: 'root', message: 'La alerta debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }
    
    const sanitizedAlert = {};
    
    // Alert ID
    sanitizedAlert.id = sanitizeString(alert.id, 50);
    if (!sanitizedAlert.id) {
      errors.push({ field: 'id', message: 'ID de alerta es requerido' });
    }
    
    // Message
    sanitizedAlert.message = sanitizeString(alert.message, 500);
    if (!sanitizedAlert.message) {
      errors.push({ field: 'message', message: 'Mensaje de alerta es requerido' });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedAlert
    };
  }
};

/**
 * 🎯 COMPREHENSIVE DASHBOARD DATA VALIDATOR
 */
export const validateDashboardData = (data) => {
  const results = {
    isValid: true,
    errors: [],
    warnings: [],
    data: {},
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      validatedSections: []
    }
  };
  
  if (!data || typeof data !== 'object') {
    results.isValid = false;
    results.errors.push({ section: 'root', field: 'data', message: 'Los datos del dashboard deben ser un objeto' });
    return results;
  }
  
  // Validate metrics
  if (data.metrics) {
    const metricsValidation = DashboardMetricsSchema.validate(data.metrics);
    if (!metricsValidation.isValid) {
      results.isValid = false;
      results.errors.push(...metricsValidation.errors.map(e => ({ section: 'metrics', ...e })));
    } else {
      results.data.metrics = metricsValidation.data;
    }
    results.summary.validatedSections.push('metrics');
  }
  
  results.summary.totalErrors = results.errors.length;
  results.summary.totalWarnings = results.warnings.length;
  results.isValid = results.errors.length === 0;
  
  return results;
};

/**
 * 🎯 EXPORT ALL FUNCTIONS AND SCHEMAS
 */
export default {
  // Utility functions
  isValidIP,
  isValidUrl,
  isValidDate,
  isValidEmail,
  isValidPort,
  isValidDomain,
  isValidCertSerial,
  
  // Sanitization functions
  sanitizeHtml,
  sanitizeSql,
  sanitizeString,
  sanitizeNumber,
  
  // Array validation
  validateArray,
  
  // Schemas
  DashboardMetricsSchema,
  CertificateSchema,
  DeviceSchema,
  VipSchema,
  AlertSchema,
  
  // Main validator
  validateDashboardData
};