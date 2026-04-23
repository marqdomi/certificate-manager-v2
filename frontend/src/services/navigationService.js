/**
 * 🧭 Navigation Service - CMT v2.5
 * Servicio central para gestión de navegación, contextos y rutas
 */

/**
 * 🎯 Configuración de contextos de navegación
 */
export const NAVIGATION_CONTEXTS = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'DashboardIcon',
    path: '/dashboard',
    parentContext: null,
    allowedChildren: ['certificates', 'devices', 'security', 'analytics'],
    defaultFilters: {},
    breadcrumbLabel: 'Inicio'
  },
  
  certificates: {
    id: 'certificates',
    label: 'Certificados',
    icon: 'CertificateIcon',
    path: '/certificates',
    parentContext: 'dashboard',
    allowedChildren: ['certificate_detail', 'certificate_chain'],
    defaultFilters: { status: 'all', type: 'all' },
    breadcrumbLabel: 'Certificados'
  },
  
  certificate_detail: {
    id: 'certificate_detail',
    label: 'Detalle del Certificado',
    icon: 'DescriptionIcon',
    path: '/certificates/:id',
    parentContext: 'certificates',
    allowedChildren: ['certificate_chain', 'certificate_devices'],
    requiresEntity: true,
    breadcrumbLabel: (entity) => entity?.common_name || entity?.subject || 'Certificado'
  },
  
  certificate_chain: {
    id: 'certificate_chain',
    label: 'Cadena de Certificación',
    icon: 'AccountTreeIcon',
    path: '/certificates/:id/chain',
    parentContext: 'certificate_detail',
    allowedChildren: [],
    requiresEntity: true,
    breadcrumbLabel: 'Cadena'
  },
  
  certificate_devices: {
    id: 'certificate_devices',
    label: 'Dispositivos del Certificado',
    icon: 'DevicesIcon',
    path: '/certificates/:id/devices',
    parentContext: 'certificate_detail',
    allowedChildren: ['device_detail'],
    requiresEntity: true,
    breadcrumbLabel: 'Dispositivos'
  },
  
  devices: {
    id: 'devices',
    label: 'Dispositivos',
    icon: 'ComputerIcon',
    path: '/devices',
    parentContext: 'dashboard',
    allowedChildren: ['device_detail', 'device_certificates'],
    defaultFilters: { status: 'all', type: 'all' },
    breadcrumbLabel: 'Dispositivos'
  },
  
  device_detail: {
    id: 'device_detail',
    label: 'Detalle del Dispositivo',
    icon: 'InfoIcon',
    path: '/devices/:id',
    parentContext: 'devices',
    allowedChildren: ['device_certificates', 'device_security'],
    requiresEntity: true,
    breadcrumbLabel: (entity) => entity?.hostname || entity?.ip_address || 'Dispositivo'
  },
  
  device_certificates: {
    id: 'device_certificates',
    label: 'Certificados del Dispositivo',
    icon: 'SecurityIcon',
    path: '/devices/:id/certificates',
    parentContext: 'device_detail',
    allowedChildren: ['certificate_detail'],
    requiresEntity: true,
    breadcrumbLabel: 'Certificados'
  },
  
  device_security: {
    id: 'device_security',
    label: 'Seguridad del Dispositivo',
    icon: 'ShieldIcon',
    path: '/devices/:id/security',
    parentContext: 'device_detail',
    allowedChildren: [],
    requiresEntity: true,
    breadcrumbLabel: 'Seguridad'
  },
  
  security: {
    id: 'security',
    label: 'Centro de Seguridad',
    icon: 'SecurityIcon',
    path: '/security',
    parentContext: 'dashboard',
    allowedChildren: ['security_vulnerabilities', 'security_compliance'],
    defaultFilters: { severity: 'all', status: 'all' },
    breadcrumbLabel: 'Seguridad'
  },
  
  security_vulnerabilities: {
    id: 'security_vulnerabilities',
    label: 'Vulnerabilidades',
    icon: 'WarningIcon',
    path: '/security/vulnerabilities',
    parentContext: 'security',
    allowedChildren: ['vulnerability_detail'],
    breadcrumbLabel: 'Vulnerabilidades'
  },
  
  security_compliance: {
    id: 'security_compliance',
    label: 'Cumplimiento',
    icon: 'CheckCircleIcon',
    path: '/security/compliance',
    parentContext: 'security',
    allowedChildren: ['compliance_detail'],
    breadcrumbLabel: 'Cumplimiento'
  },
  
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    icon: 'AnalyticsIcon',
    path: '/analytics',
    parentContext: 'dashboard',
    allowedChildren: ['analytics_reports', 'analytics_trends'],
    defaultFilters: { period: '30d', metric: 'all' },
    breadcrumbLabel: 'Analytics'
  },
  
  analytics_reports: {
    id: 'analytics_reports',
    label: 'Reportes',
    icon: 'AssessmentIcon',
    path: '/analytics/reports',
    parentContext: 'analytics',
    allowedChildren: ['report_detail'],
    breadcrumbLabel: 'Reportes'
  },
  
  analytics_trends: {
    id: 'analytics_trends',
    label: 'Tendencias',
    icon: 'TrendingUpIcon',
    path: '/analytics/trends',
    parentContext: 'analytics',
    allowedChildren: [],
    breadcrumbLabel: 'Tendencias'
  }
};

/**
 * 🔗 Configuración de relaciones entre entidades
 */
export const ENTITY_RELATIONSHIPS = {
  certificate: {
    devices: {
      type: 'many-to-many',
      relationship: 'installed_on',
      description: 'Dispositivos donde está instalado',
      navigateTo: 'certificate_devices'
    },
    
    chain: {
      type: 'one-to-many',
      relationship: 'certificate_chain',
      description: 'Cadena de certificación',
      navigateTo: 'certificate_chain'
    },
    
    same_issuer: {
      type: 'many-to-many',
      relationship: 'same_issuer',
      description: 'Otros certificados del mismo emisor',
      navigateTo: 'certificates'
    },
    
    renewal_history: {
      type: 'one-to-many',
      relationship: 'renewal_chain',
      description: 'Historial de renovaciones',
      navigateTo: 'certificate_detail'
    }
  },
  
  device: {
    certificates: {
      type: 'many-to-many',
      relationship: 'has_installed',
      description: 'Certificados instalados',
      navigateTo: 'device_certificates'
    },
    
    security: {
      type: 'one-to-one',
      relationship: 'security_profile',
      description: 'Perfil de seguridad',
      navigateTo: 'device_security'
    },
    
    same_location: {
      type: 'many-to-many',
      relationship: 'same_location',
      description: 'Dispositivos en la misma ubicación',
      navigateTo: 'devices'
    },
    
    same_type: {
      type: 'many-to-many',
      relationship: 'same_type',
      description: 'Dispositivos del mismo tipo',
      navigateTo: 'devices'
    }
  },
  
  vulnerability: {
    affected_devices: {
      type: 'one-to-many',
      relationship: 'affects',
      description: 'Dispositivos afectados',
      navigateTo: 'devices'
    },
    
    affected_certificates: {
      type: 'one-to-many',
      relationship: 'affects',
      description: 'Certificados afectados',
      navigateTo: 'certificates'
    }
  }
};

/**
 * 🎯 Plantillas de acciones contextuales
 */
export const CONTEXTUAL_ACTIONS = {
  dashboard: [
    { id: 'refresh', label: 'Actualizar', icon: 'RefreshIcon', primary: false },
    { id: 'export', label: 'Exportar', icon: 'GetAppIcon', primary: false },
    { id: 'settings', label: 'Configuración', icon: 'SettingsIcon', primary: false }
  ],
  
  certificates: [
    { id: 'add', label: 'Añadir Certificado', icon: 'AddIcon', primary: true },
    { id: 'import', label: 'Importar', icon: 'CloudUploadIcon', primary: false },
    { id: 'export', label: 'Exportar Listado', icon: 'GetAppIcon', primary: false },
    { id: 'bulk_renew', label: 'Renovación Masiva', icon: 'AutorenewIcon', primary: false },
    { id: 'scan', label: 'Escanear Red', icon: 'SearchIcon', primary: false }
  ],
  
  certificate_detail: [
    { id: 'edit', label: 'Editar', icon: 'EditIcon', primary: false },
    { id: 'renew', label: 'Renovar', icon: 'AutorenewIcon', primary: true },
    { id: 'revoke', label: 'Revocar', icon: 'BlockIcon', primary: false, danger: true },
    { id: 'download', label: 'Descargar', icon: 'GetAppIcon', primary: false },
    { id: 'validate', label: 'Validar', icon: 'CheckCircleIcon', primary: false },
    { id: 'share', label: 'Compartir', icon: 'ShareIcon', primary: false }
  ],
  
  devices: [
    { id: 'add', label: 'Añadir Dispositivo', icon: 'AddIcon', primary: true },
    { id: 'scan', label: 'Escanear Red', icon: 'SearchIcon', primary: false },
    { id: 'export', label: 'Exportar Listado', icon: 'GetAppIcon', primary: false },
    { id: 'bulk_scan', label: 'Escaneo Masivo', icon: 'FindInPageIcon', primary: false }
  ],
  
  device_detail: [
    { id: 'edit', label: 'Editar', icon: 'EditIcon', primary: false },
    { id: 'connect', label: 'Conectar', icon: 'LinkIcon', primary: true },
    { id: 'scan', label: 'Escanear', icon: 'SearchIcon', primary: false },
    { id: 'backup', label: 'Backup Config', icon: 'BackupIcon', primary: false },
    { id: 'sync', label: 'Sincronizar', icon: 'SyncIcon', primary: false }
  ],
  
  security: [
    { id: 'scan', label: 'Escaneo de Seguridad', icon: 'SecurityIcon', primary: true },
    { id: 'generate_report', label: 'Generar Reporte', icon: 'AssessmentIcon', primary: false },
    { id: 'export', label: 'Exportar Análisis', icon: 'GetAppIcon', primary: false },
    { id: 'configure_alerts', label: 'Configurar Alertas', icon: 'NotificationsIcon', primary: false }
  ],
  
  analytics: [
    { id: 'generate', label: 'Generar Reporte', icon: 'AssessmentIcon', primary: true },
    { id: 'schedule', label: 'Programar', icon: 'ScheduleIcon', primary: false },
    { id: 'export', label: 'Exportar Datos', icon: 'GetAppIcon', primary: false },
    { id: 'configure', label: 'Configurar Métricas', icon: 'TuneIcon', primary: false }
  ]
};

/**
 * 🔧 Clase NavigationService
 */
export class NavigationService {
  constructor() {
    this.contexts = NAVIGATION_CONTEXTS;
    this.relationships = ENTITY_RELATIONSHIPS;
    this.actions = CONTEXTUAL_ACTIONS;
    this.navigationListeners = [];
    this.contextCache = new Map();
  }

  /**
   * 🧭 Métodos de navegación
   */
  getContext(contextId) {
    if (this.contextCache.has(contextId)) {
      return this.contextCache.get(contextId);
    }
    
    const context = this.contexts[contextId];
    if (context) {
      this.contextCache.set(contextId, context);
    }
    return context;
  }

  validateNavigation(fromContext, toContext, entity = null) {
    const from = this.getContext(fromContext);
    const to = this.getContext(toContext);
    
    if (!from || !to) {
      return { valid: false, reason: 'Contexto no encontrado' };
    }
    
    // Verificar si la navegación está permitida
    const isAllowedChild = from.allowedChildren?.includes(toContext);
    const isParent = to.id === from.parentContext;
    const isSibling = from.parentContext && to.parentContext === from.parentContext;
    
    if (!isAllowedChild && !isParent && !isSibling) {
      return { valid: false, reason: 'Navegación no permitida desde este contexto' };
    }
    
    // Verificar si el contexto requiere entidad
    if (to.requiresEntity && !entity) {
      return { valid: false, reason: 'Este contexto requiere una entidad específica' };
    }
    
    return { valid: true };
  }

  buildBreadcrumbs(navigationStack) {
    return navigationStack.map(nav => {
      const context = this.getContext(nav.context);
      if (!context) return null;
      
      let label = context.breadcrumbLabel;
      if (typeof label === 'function' && nav.entity) {
        label = label(nav.entity);
      }
      
      return {
        context: nav.context,
        label,
        entity: nav.entity,
        clickable: true
      };
    }).filter(Boolean);
  }

  generatePath(contextId, entity = null, filters = {}) {
    const context = this.getContext(contextId);
    if (!context) return '/';
    
    let path = context.path;
    
    // Reemplazar parámetros de entidad
    if (entity && entity.id) {
      path = path.replace(':id', entity.id);
    }
    
    // Agregar query parameters para filtros
    if (Object.keys(filters).length > 0) {
      const queryParams = new URLSearchParams(filters).toString();
      path += `?${queryParams}`;
    }
    
    return path;
  }

  /**
   * 🔗 Métodos de relaciones
   */
  getEntityRelationships(entityType) {
    return this.relationships[entityType] || {};
  }

  findRelatedEntities(entity, allData = {}) {
    const entityType = entity.type;
    const relationships = this.getEntityRelationships(entityType);
    const relatedEntities = [];
    
    Object.entries(relationships).forEach(([relationKey, config]) => {
      const related = this.extractRelatedEntities(entity, relationKey, config, allData);
      if (related.length > 0) {
        relatedEntities.push({
          relationshipType: relationKey,
          config,
          entities: related
        });
      }
    });
    
    return relatedEntities;
  }

  extractRelatedEntities(entity, relationKey, config, allData) {
    const { relationship } = config;
    
    switch (relationship) {
      case 'installed_on':
        return allData.devices?.filter(device => 
          device.certificates?.includes(entity.id)
        ) || [];
        
      case 'has_installed':
        return allData.certificates?.filter(cert => 
          entity.certificates?.includes(cert.id)
        ) || [];
        
      case 'same_issuer':
        return allData.certificates?.filter(cert => 
          cert.id !== entity.id && cert.issuer === entity.issuer
        ) || [];
        
      case 'same_location':
        return allData.devices?.filter(device => 
          device.id !== entity.id && device.location === entity.location
        ) || [];
        
      case 'same_type':
        return allData.devices?.filter(device => 
          device.id !== entity.id && device.type === entity.type
        ) || [];
        
      case 'affects':
        if (entity.type === 'vulnerability') {
          const affected = [];
          if (entity.affected_devices) {
            affected.push(...(allData.devices?.filter(device => 
              entity.affected_devices.includes(device.id)
            ) || []));
          }
          if (entity.affected_certificates) {
            affected.push(...(allData.certificates?.filter(cert => 
              entity.affected_certificates.includes(cert.id)
            ) || []));
          }
          return affected;
        }
        return [];
        
      default:
        return [];
    }
  }

  /**
   * ⚡ Métodos de acciones contextuales
   */
  getContextualActions(contextId, entity = null) {
    const baseActions = this.actions[contextId] || [];
    const entitySpecificActions = this.getEntitySpecificActions(entity);
    
    return [...baseActions, ...entitySpecificActions];
  }

  getEntitySpecificActions(entity) {
    if (!entity) return [];
    
    const actions = [];
    
    switch (entity.type) {
      case 'certificate':
        if (entity.status === 'expiring') {
          actions.push({
            id: 'urgent_renew',
            label: 'Renovar Urgente',
            icon: 'PriorityHighIcon',
            primary: true,
            urgent: true
          });
        }
        
        if (entity.status === 'expired') {
          actions.push({
            id: 'replace',
            label: 'Reemplazar',
            icon: 'SwapHorizIcon',
            primary: true,
            warning: true
          });
        }
        
        if (entity.private_key_available) {
          actions.push({
            id: 'export_pfx',
            label: 'Exportar PFX',
            icon: 'VpnKeyIcon',
            primary: false
          });
        }
        break;
        
      case 'device':
        if (entity.status === 'offline') {
          actions.push({
            id: 'reconnect',
            label: 'Reconectar',
            icon: 'WifiIcon',
            primary: true,
            urgent: true
          });
        }
        
        if (entity.status === 'error') {
          actions.push({
            id: 'troubleshoot',
            label: 'Diagnosticar',
            icon: 'BugReportIcon',
            primary: true,
            warning: true
          });
        }
        
        if (entity.certificates_count > 0) {
          actions.push({
            id: 'view_certificates',
            label: 'Ver Certificados',
            icon: 'SecurityIcon',
            primary: false
          });
        }
        break;
        
      case 'vulnerability':
        actions.push({
          id: 'remediate',
          label: 'Remediar',
          icon: 'HealthAndSafetyIcon',
          primary: true
        });
        
        if (entity.severity === 'critical') {
          actions.push({
            id: 'emergency_patch',
            label: 'Patch Emergencia',
            icon: 'EmergencyIcon',
            primary: true,
            danger: true
          });
        }
        break;
    }
    
    return actions;
  }

  /**
   * 🔄 Métodos de utilidad
   */
  getParentContext(contextId) {
    const context = this.getContext(contextId);
    return context?.parentContext ? this.getContext(context.parentContext) : null;
  }

  getChildContexts(contextId) {
    const context = this.getContext(contextId);
    if (!context?.allowedChildren) return [];
    
    return context.allowedChildren.map(childId => this.getContext(childId)).filter(Boolean);
  }

  isValidTransition(fromContextId, toContextId) {
    const validation = this.validateNavigation(fromContextId, toContextId);
    return validation.valid;
  }

  getContextHierarchy(contextId) {
    const hierarchy = [];
    let currentContext = this.getContext(contextId);
    
    while (currentContext) {
      hierarchy.unshift(currentContext);
      currentContext = currentContext.parentContext ? this.getContext(currentContext.parentContext) : null;
    }
    
    return hierarchy;
  }

  /**
   * 📡 Métodos de eventos
   */
  addNavigationListener(listener) {
    this.navigationListeners.push(listener);
    return () => {
      const index = this.navigationListeners.indexOf(listener);
      if (index > -1) {
        this.navigationListeners.splice(index, 1);
      }
    };
  }

  emitNavigationEvent(eventType, data) {
    this.navigationListeners.forEach(listener => {
      try {
        listener(eventType, data);
      } catch (error) {
        console.error('Error in navigation listener:', error);
      }
    });
  }

  /**
   * 💾 Métodos de persistencia
   */
  clearCache() {
    this.contextCache.clear();
  }

  exportConfiguration() {
    return {
      contexts: this.contexts,
      relationships: this.relationships,
      actions: this.actions,
      timestamp: new Date().toISOString()
    };
  }

  importConfiguration(config) {
    if (config.contexts) this.contexts = { ...this.contexts, ...config.contexts };
    if (config.relationships) this.relationships = { ...this.relationships, ...config.relationships };
    if (config.actions) this.actions = { ...this.actions, ...config.actions };
    this.clearCache();
  }
}

// Instancia singleton
export const navigationService = new NavigationService();
export default navigationService;