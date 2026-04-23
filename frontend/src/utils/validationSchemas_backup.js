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
    
    // Key Algorithm and Size
    if (cert.key_algorithm) {
      const validAlgorithms = ['RSA', 'ECDSA', 'DSA', 'Ed25519'];
      if (!validAlgorithms.includes(cert.key_algorithm)) {
        errors.push({ field: 'key_algorithm', message: 'Algoritmo de clave no válido' });
      } else {
        sanitizedCert.key_algorithm = cert.key_algorithm;
      }
    }
    
    if (cert.key_size) {
      const keySize = sanitizeNumber(cert.key_size, 512, 8192);
      if (keySize < 2048 && cert.key_algorithm === 'RSA') {
        errors.push({ field: 'key_size', message: 'Tamaño de clave RSA debe ser al menos 2048 bits' });
      }
      sanitizedCert.key_size = keySize;
    }
    
    // Subject Alternative Names
    if (cert.san && Array.isArray(cert.san)) {
      const sanValidation = validateArray(cert.san, {
        maxLength: 100,
        itemValidator: (san) => {
          if (!isValidDomain(san) && !isValidIP(san)) {
            return { isValid: false, errors: [{ field: 'san', message: 'SAN inválido' }] };
          }
          return { isValid: true, errors: [] };
        },
        sanitizeItems: true,
        uniqueItems: true
      });
      
      if (!sanValidation.isValid) {
        errors.push(...sanValidation.errors);
      } else {
        sanitizedCert.san = sanValidation.data;
      }
    }
    
    // Signature Algorithm
    if (cert.signature_algorithm) {
      const validSigAlgs = ['SHA256withRSA', 'SHA384withRSA', 'SHA512withRSA', 'SHA256withECDSA'];
      if (!validSigAlgs.includes(cert.signature_algorithm)) {
        errors.push({ field: 'signature_algorithm', message: 'Algoritmo de firma no válido' });
      } else {
        sanitizedCert.signature_algorithm = cert.signature_algorithm;
      }
    }
    
    // Extensions
    if (cert.extensions && typeof cert.extensions === 'object') {
      sanitizedCert.extensions = {};
      Object.keys(cert.extensions).forEach(key => {
        if (typeof cert.extensions[key] === 'boolean') {
          sanitizedCert.extensions[sanitizeString(key, 50)] = cert.extensions[key];
        }
      });
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
    
    // Hostname
    if (device.hostname) {
      if (!isValidDomain(device.hostname)) {
        errors.push({ field: 'hostname', message: 'Hostname inválido' });
      } else {
        sanitizedDevice.hostname = sanitizeString(device.hostname, 253);
      }
    }
    
    // Version
    sanitizedDevice.version = sanitizeString(device.version, 50);
    
    // Status
    const validStatuses = ['online', 'offline', 'syncing', 'error', 'maintenance'];
    if (device.status && !validStatuses.includes(device.status)) {
      errors.push({ field: 'status', message: 'Estado de dispositivo inválido' });
    } else {
      sanitizedDevice.status = device.status || 'offline';
    }
    
    // Last seen
    if (device.last_seen) {
      if (!isValidDate(device.last_seen, false)) { // Don't allow future dates
        errors.push({ field: 'last_seen', message: 'Fecha de última conexión inválida' });
      } else {
        sanitizedDevice.last_seen = new Date(device.last_seen);
      }
    }
    
    // Credentials (sensitive data handling)
    if (device.credentials && typeof device.credentials === 'object') {
      sanitizedDevice.credentials = {
        username: sanitizeString(device.credentials.username, 100),
        // Note: Password should be encrypted, we just validate structure
        has_password: Boolean(device.credentials.password),
        auth_type: validStatuses.includes(device.credentials.auth_type) ? 
                   device.credentials.auth_type : 'password'
      };
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
    
    // Port
    if (vip.port) {
      if (!isValidPort(vip.port)) {
        errors.push({ field: 'port', message: 'Puerto inválido' });
      } else {
        sanitizedVip.port = parseInt(vip.port, 10);
      }
    }
    
    // Protocol
    const validProtocols = ['HTTP', 'HTTPS', 'TCP', 'UDP'];
    if (vip.protocol && !validProtocols.includes(vip.protocol.toUpperCase())) {
      errors.push({ field: 'protocol', message: 'Protocolo inválido' });
    } else {
      sanitizedVip.protocol = vip.protocol ? vip.protocol.toUpperCase() : 'HTTP';
    }
    
    // SSL Profile
    if (vip.ssl_profile) {
      sanitizedVip.ssl_profile = sanitizeString(vip.ssl_profile, 100);
    }
    
    // Pool Members
    if (vip.pool_members && Array.isArray(vip.pool_members)) {
      const poolValidation = validateArray(vip.pool_members, {
        maxLength: 50,
        itemValidator: (member) => {
          const memberErrors = [];
          if (!member.ip_address || !isValidIP(member.ip_address)) {
            memberErrors.push({ field: 'ip_address', message: 'IP del pool member inválida' });
          }
          if (member.port && !isValidPort(member.port)) {
            memberErrors.push({ field: 'port', message: 'Puerto del pool member inválido' });
          }
          return { isValid: memberErrors.length === 0, errors: memberErrors };
        }
      });
      
      if (!poolValidation.isValid) {
        errors.push(...poolValidation.errors);
      } else {
        sanitizedVip.pool_members = poolValidation.data;
      }
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
    
    // Severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!alert.severity || !validSeverities.includes(alert.severity.toLowerCase())) {
      errors.push({ field: 'severity', message: 'Severidad de alerta inválida' });
    } else {
      sanitizedAlert.severity = alert.severity.toLowerCase();
    }
    
    // Message
    sanitizedAlert.message = sanitizeString(alert.message, 500);
    if (!sanitizedAlert.message) {
      errors.push({ field: 'message', message: 'Mensaje de alerta es requerido' });
    }
    
    // Type
    const validTypes = ['certificate', 'device', 'system', 'security', 'performance'];
    if (alert.type && !validTypes.includes(alert.type.toLowerCase())) {
      errors.push({ field: 'type', message: 'Tipo de alerta inválido' });
    } else {
      sanitizedAlert.type = alert.type ? alert.type.toLowerCase() : 'system';
    }
    
    // Timestamp
    if (alert.timestamp) {
      if (!isValidDate(alert.timestamp, false)) {
        errors.push({ field: 'timestamp', message: 'Timestamp de alerta inválido' });
      } else {
        sanitizedAlert.timestamp = new Date(alert.timestamp);
      }
    } else {
      sanitizedAlert.timestamp = new Date();
    }
    
    // Related Entity
    if (alert.related_entity) {
      sanitizedAlert.related_entity = {
        type: sanitizeString(alert.related_entity.type, 50),
        id: sanitizeString(alert.related_entity.id, 100),
        name: sanitizeString(alert.related_entity.name, 200)
      };
    }
    
    // Acknowledgment
    if (alert.acknowledged !== undefined) {
      sanitizedAlert.acknowledged = Boolean(alert.acknowledged);
      if (alert.acknowledged_by) {
        sanitizedAlert.acknowledged_by = sanitizeString(alert.acknowledged_by, 100);
      }
      if (alert.acknowledged_at) {
        if (isValidDate(alert.acknowledged_at, false)) {
          sanitizedAlert.acknowledged_at = new Date(alert.acknowledged_at);
        }
      }
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
  
  // Validate certificates array
  if (data.certificates && Array.isArray(data.certificates)) {
    const certificatesValidation = validateArray(data.certificates, {
      maxLength: 10000,
      itemValidator: CertificateSchema.validate,
      allowEmpty: true
    });
    
    if (!certificatesValidation.isValid) {
      results.errors.push(...certificatesValidation.errors.map(e => ({ section: 'certificates', ...e })));
    } else {
      results.data.certificates = certificatesValidation.data;
    }
    results.summary.validatedSections.push('certificates');
  }
  
  // Validate devices array
  if (data.devices && Array.isArray(data.devices)) {
    const devicesValidation = validateArray(data.devices, {
      maxLength: 1000,
      itemValidator: DeviceSchema.validate,
      allowEmpty: true
    });
    
    if (!devicesValidation.isValid) {
      results.errors.push(...devicesValidation.errors.map(e => ({ section: 'devices', ...e })));
    } else {
      results.data.devices = devicesValidation.data;
    }
    results.summary.validatedSections.push('devices');
  }
  
  // Validate VIPs array
  if (data.vips && Array.isArray(data.vips)) {
    const vipsValidation = validateArray(data.vips, {
      maxLength: 5000,
      itemValidator: VipSchema.validate,
      allowEmpty: true
    });
    
    if (!vipsValidation.isValid) {
      results.errors.push(...vipsValidation.errors.map(e => ({ section: 'vips', ...e })));
    } else {
      results.data.vips = vipsValidation.data;
    }
    results.summary.validatedSections.push('vips');
  }
  
  // Validate alerts array
  if (data.alerts && Array.isArray(data.alerts)) {
    const alertsValidation = validateArray(data.alerts, {
      maxLength: 1000,
      itemValidator: AlertSchema.validate,
      allowEmpty: true
    });
    
    if (!alertsValidation.isValid) {
      results.errors.push(...alertsValidation.errors.map(e => ({ section: 'alerts', ...e })));
    } else {
      results.data.alerts = alertsValidation.data;
    }
    results.summary.validatedSections.push('alerts');
  }
  
  // Performance warnings for large datasets
  if (data.certificates && data.certificates.length > 5000) {
    results.warnings.push({ section: 'certificates', message: 'Gran cantidad de certificados puede afectar el rendimiento' });
  }
  
  if (data.vips && data.vips.length > 2000) {
    results.warnings.push({ section: 'vips', message: 'Gran cantidad de VIPs puede afectar el rendimiento' });
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
        }
        if (typeof active !== 'number' || active < 0) {
          errors.push({ field: 'certificates.active', message: 'Certificados activos debe ser un número positivo' });
        }
        if (typeof expiring_soon !== 'number' || expiring_soon < 0) {
          errors.push({ field: 'certificates.expiring_soon', message: 'Certificados por expirar debe ser un número positivo' });
        }
        if (typeof expired !== 'number' || expired < 0) {
          errors.push({ field: 'certificates.expired', message: 'Certificados expirados debe ser un número positivo' });
        }
        
        // Validar consistencia
        if (typeof total === 'number' && typeof active === 'number' && 
            typeof expiring_soon === 'number' && typeof expired === 'number') {
          if (active + expiring_soon + expired > total) {
            errors.push({ field: 'certificates', message: 'La suma de certificados no puede exceder el total' });
          }
        }
      }
    }

    // Validar métricas de dispositivos
    if (data.devices !== undefined) {
      if (typeof data.devices !== 'object') {
        errors.push({ field: 'devices', message: 'Las métricas de dispositivos deben ser un objeto' });
      } else {
        const { total, online, offline, unknown } = data.devices;
        
        if (typeof total !== 'number' || total < 0) {
          errors.push({ field: 'devices.total', message: 'Total de dispositivos debe ser un número positivo' });
        }
        if (typeof online !== 'number' || online < 0) {
          errors.push({ field: 'devices.online', message: 'Dispositivos online debe ser un número positivo' });
        }
        if (typeof offline !== 'number' || offline < 0) {
          errors.push({ field: 'devices.offline', message: 'Dispositivos offline debe ser un número positivo' });
        }
        if (typeof unknown !== 'number' || unknown < 0) {
          errors.push({ field: 'devices.unknown', message: 'Dispositivos desconocidos debe ser un número positivo' });
        }
      }
    }

    // Validar métricas de VIPs
    if (data.vips !== undefined) {
      if (typeof data.vips !== 'object') {
        errors.push({ field: 'vips', message: 'Las métricas de VIPs deben ser un objeto' });
      } else {
        const { total, secured, unsecured } = data.vips;
        
        if (typeof total !== 'number' || total < 0) {
          errors.push({ field: 'vips.total', message: 'Total de VIPs debe ser un número positivo' });
        }
        if (typeof secured !== 'number' || secured < 0) {
          errors.push({ field: 'vips.secured', message: 'VIPs seguros debe ser un número positivo' });
        }
        if (typeof unsecured !== 'number' || unsecured < 0) {
          errors.push({ field: 'vips.unsecured', message: 'VIPs no seguros debe ser un número positivo' });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : null
    };
  },

  sanitize: (data) => {
    if (!data || typeof data !== 'object') return {};
    
    return {
      certificates: data.certificates ? {
        total: Math.max(0, parseInt(data.certificates.total) || 0),
        active: Math.max(0, parseInt(data.certificates.active) || 0),
        expiring_soon: Math.max(0, parseInt(data.certificates.expiring_soon) || 0),
        expired: Math.max(0, parseInt(data.certificates.expired) || 0)
      } : undefined,
      
      devices: data.devices ? {
        total: Math.max(0, parseInt(data.devices.total) || 0),
        online: Math.max(0, parseInt(data.devices.online) || 0),
        offline: Math.max(0, parseInt(data.devices.offline) || 0),
        unknown: Math.max(0, parseInt(data.devices.unknown) || 0)
      } : undefined,
      
      vips: data.vips ? {
        total: Math.max(0, parseInt(data.vips.total) || 0),
        secured: Math.max(0, parseInt(data.vips.secured) || 0),
        unsecured: Math.max(0, parseInt(data.vips.unsecured) || 0)
      } : undefined,
      
      ssl_profiles: data.ssl_profiles ? {
        total: Math.max(0, parseInt(data.ssl_profiles.total) || 0)
      } : undefined
    };
  }
};

/**
 * 📜 Certificate Schema
 */
export const CertificateSchema = {
  validate: (certificate) => {
    const errors = [];
    
    if (!certificate || typeof certificate !== 'object') {
      errors.push({ field: 'root', message: 'El certificado debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }

    // Validar campos requeridos
    if (!certificate.id) {
      errors.push({ field: 'id', message: 'ID del certificado es requerido' });
    }

    if (!certificate.name || typeof certificate.name !== 'string') {
      errors.push({ field: 'name', message: 'Nombre del certificado es requerido y debe ser texto' });
    }

    if (!certificate.status || typeof certificate.status !== 'string') {
      errors.push({ field: 'status', message: 'Estado del certificado es requerido' });
    } else if (!['active', 'expired', 'expiring_soon', 'revoked'].includes(certificate.status)) {
      errors.push({ field: 'status', message: 'Estado del certificado no válido' });
    }

    // Validar fechas
    if (certificate.expiry_date) {
      const expiryDate = new Date(certificate.expiry_date);
      if (!isValidDate(expiryDate)) {
        errors.push({ field: 'expiry_date', message: 'Fecha de expiración no válida' });
      }
    }

    if (certificate.issue_date) {
      const issueDate = new Date(certificate.issue_date);
      if (!isValidDate(issueDate)) {
        errors.push({ field: 'issue_date', message: 'Fecha de emisión no válida' });
      }
    }

    // Validar dominio
    if (certificate.domain && typeof certificate.domain === 'string') {
      const domainRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(certificate.domain) && certificate.domain !== '*') {
        errors.push({ field: 'domain', message: 'Formato de dominio no válido' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? certificate : null
    };
  }
};

/**
 * 🔧 Device Schema
 */
export const DeviceSchema = {
  validate: (device) => {
    const errors = [];
    
    if (!device || typeof device !== 'object') {
      errors.push({ field: 'root', message: 'El dispositivo debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }

    // Validar campos requeridos
    if (!device.id) {
      errors.push({ field: 'id', message: 'ID del dispositivo es requerido' });
    }

    if (!device.name || typeof device.name !== 'string') {
      errors.push({ field: 'name', message: 'Nombre del dispositivo es requerido' });
    }

    if (!device.ip_address || typeof device.ip_address !== 'string') {
      errors.push({ field: 'ip_address', message: 'Dirección IP es requerida' });
    } else if (!isValidIP(device.ip_address)) {
      errors.push({ field: 'ip_address', message: 'Formato de IP no válido' });
    }

    if (!device.status || typeof device.status !== 'string') {
      errors.push({ field: 'status', message: 'Estado del dispositivo es requerido' });
    } else if (!['online', 'offline', 'unknown'].includes(device.status)) {
      errors.push({ field: 'status', message: 'Estado del dispositivo no válido' });
    }

    // Validar tipo de dispositivo
    if (device.device_type && !['f5_bigip', 'f5_ltm', 'f5_asm', 'nginx', 'apache'].includes(device.device_type)) {
      errors.push({ field: 'device_type', message: 'Tipo de dispositivo no válido' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? device : null
    };
  }
};

/**
 * 📊 VIP Schema
 */
export const VipSchema = {
  validate: (vip) => {
    const errors = [];
    
    if (!vip || typeof vip !== 'object') {
      errors.push({ field: 'root', message: 'El VIP debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }

    // Validar campos requeridos
    if (!vip.id) {
      errors.push({ field: 'id', message: 'ID del VIP es requerido' });
    }

    if (!vip.name || typeof vip.name !== 'string') {
      errors.push({ field: 'name', message: 'Nombre del VIP es requerido' });
    }

    if (!vip.ip_address || typeof vip.ip_address !== 'string') {
      errors.push({ field: 'ip_address', message: 'Dirección IP del VIP es requerida' });
    } else if (!isValidIP(vip.ip_address)) {
      errors.push({ field: 'ip_address', message: 'Formato de IP del VIP no válido' });
    }

    if (vip.port !== undefined) {
      const port = parseInt(vip.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push({ field: 'port', message: 'Puerto debe estar entre 1 y 65535' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? vip : null
    };
  }
};

/**
 * 🚨 Alert Schema
 */
export const AlertSchema = {
  validate: (alert) => {
    const errors = [];
    
    if (!alert || typeof alert !== 'object') {
      errors.push({ field: 'root', message: 'La alerta debe ser un objeto' });
      return { isValid: false, errors, data: null };
    }

    // Validar campos requeridos
    if (!alert.id) {
      errors.push({ field: 'id', message: 'ID de la alerta es requerido' });
    }

    if (!alert.title || typeof alert.title !== 'string') {
      errors.push({ field: 'title', message: 'Título de la alerta es requerido' });
    }

    if (!alert.severity || typeof alert.severity !== 'string') {
      errors.push({ field: 'severity', message: 'Severidad de la alerta es requerida' });
    } else if (!['low', 'medium', 'high', 'critical'].includes(alert.severity)) {
      errors.push({ field: 'severity', message: 'Severidad de alerta no válida' });
    }

    if (!alert.type || typeof alert.type !== 'string') {
      errors.push({ field: 'type', message: 'Tipo de alerta es requerido' });
    } else if (!['certificate', 'device', 'system', 'security'].includes(alert.type)) {
      errors.push({ field: 'type', message: 'Tipo de alerta no válido' });
    }

    // Validar timestamp
    if (alert.timestamp) {
      const timestamp = new Date(alert.timestamp);
      if (!isValidDate(timestamp)) {
        errors.push({ field: 'timestamp', message: 'Timestamp de alerta no válido' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? alert : null
    };
  }
};

/**
 * 🛠️ Utility Function: Validate Array with Schema
 */
export const validateArray = (array, schema, maxItems = 1000) => {
  if (!Array.isArray(array)) {
    return {
      isValid: false,
      errors: [{ field: 'root', message: 'Los datos deben ser un array' }],
      data: null
    };
  }

  if (array.length > maxItems) {
    return {
      isValid: false,
      errors: [{ field: 'root', message: `El array no puede tener más de ${maxItems} elementos` }],
      data: null
    };
  }

  const errors = [];
  const validData = [];

  array.forEach((item, index) => {
    const validation = schema.validate(item);
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        errors.push({
          ...error,
          field: `[${index}].${error.field}`,
          index
        });
      });
    } else {
      validData.push(validation.data);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? validData : null,
    validItems: validData.length,
    totalItems: array.length
  };
};

/**
 * 🔍 Main Validation Function
 */
export const validateDashboardData = (data) => {
  const results = {
    metrics: null,
    certificates: null,
    devices: null,
    vips: null,
    alerts: null,
    isValid: true,
    errors: []
  };

  // Validar métricas
  if (data.metrics) {
    results.metrics = DashboardMetricsSchema.validate(data.metrics);
    if (!results.metrics.isValid) {
      results.isValid = false;
      results.errors.push(...results.metrics.errors);
    }
  }

  // Validar certificados
  if (data.certificates) {
    results.certificates = validateArray(data.certificates, CertificateSchema, 500);
    if (!results.certificates.isValid) {
      results.isValid = false;
      results.errors.push(...results.certificates.errors);
    }
  }

  // Validar dispositivos
  if (data.devices) {
    results.devices = validateArray(data.devices, DeviceSchema, 200);
    if (!results.devices.isValid) {
      results.isValid = false;
      results.errors.push(...results.devices.errors);
    }
  }

  // Validar VIPs
  if (data.vips) {
    results.vips = validateArray(data.vips, VipSchema, 1000);
    if (!results.vips.isValid) {
      results.isValid = false;
      results.errors.push(...results.vips.errors);
    }
  }

  // Validar alertas
  if (data.alerts) {
    results.alerts = validateArray(data.alerts, AlertSchema, 100);
    if (!results.alerts.isValid) {
      results.isValid = false;
      results.errors.push(...results.alerts.errors);
    }
  }

  return results;
};

export default {
  DashboardMetricsSchema,
  CertificateSchema,
  DeviceSchema,
  VipSchema,
  AlertSchema,
  validateArray,
  validateDashboardData
};