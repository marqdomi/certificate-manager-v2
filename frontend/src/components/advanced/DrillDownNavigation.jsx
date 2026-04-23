/**
 * 🧭 Drill-down Navigation System
 * CMT v2.5 - Sistema de navegación contextual y exploración de datos jerárquicos
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Badge,
  Avatar,
  Divider,
  Paper,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  NavigateNext,
  Dashboard,
  Security,
  Devices,
  Certificate,
  Timeline,
  AccountTree,
  Visibility,
  Launch,
  FilterList,
  Search,
  ExpandMore,
  ExpandLess,
  ArrowBack,
  ArrowForward,
  Home,
  BookmarkBorder,
  Bookmark,
  History,
  Share,
  Download,
  Settings,
  Info,
  Warning,
  Error,
  CheckCircle,
  Router,
  Storage,
  VpnKey,
  Group,
  Person,
  Business,
  LocationOn,
  Schedule,
  TrendingUp,
  Analytics
} from '@mui/icons-material';

/**
 * 🗺️ Configuración de navegación jerárquica
 */
const NAVIGATION_HIERARCHY = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard Principal',
    icon: Dashboard,
    level: 0,
    children: ['certificates', 'devices', 'security', 'analytics'],
    actions: ['export', 'filter', 'refresh']
  },
  certificates: {
    id: 'certificates',
    label: 'Certificados SSL/TLS',
    icon: Certificate,
    level: 1,
    parent: 'dashboard',
    children: ['certificate_detail'],
    actions: ['add', 'renew', 'export', 'filter'],
    filters: ['status', 'expiry', 'issuer', 'device']
  },
  certificate_detail: {
    id: 'certificate_detail',
    label: 'Detalle de Certificado',
    icon: VpnKey,
    level: 2,
    parent: 'certificates',
    children: ['certificate_chain', 'certificate_usage'],
    actions: ['renew', 'revoke', 'download', 'share']
  },
  certificate_chain: {
    id: 'certificate_chain',
    label: 'Cadena de Certificados',
    icon: AccountTree,
    level: 3,
    parent: 'certificate_detail',
    actions: ['validate', 'export']
  },
  certificate_usage: {
    id: 'certificate_usage',
    label: 'Uso del Certificado',
    icon: Analytics,
    level: 3,
    parent: 'certificate_detail',
    actions: ['analyze', 'report']
  },
  devices: {
    id: 'devices',
    label: 'Dispositivos F5',
    icon: Devices,
    level: 1,
    parent: 'dashboard',
    children: ['device_detail'],
    actions: ['add', 'scan', 'export', 'filter'],
    filters: ['status', 'type', 'location', 'version']
  },
  device_detail: {
    id: 'device_detail',
    label: 'Detalle de Dispositivo',
    icon: Router,
    level: 2,
    parent: 'devices',
    children: ['device_certificates', 'device_config', 'device_monitoring'],
    actions: ['connect', 'scan', 'backup', 'settings']
  },
  device_certificates: {
    id: 'device_certificates',
    label: 'Certificados del Dispositivo',
    icon: Certificate,
    level: 3,
    parent: 'device_detail',
    actions: ['install', 'remove', 'export']
  },
  device_config: {
    id: 'device_config',
    label: 'Configuración del Dispositivo',
    icon: Settings,
    level: 3,
    parent: 'device_detail',
    actions: ['backup', 'restore', 'compare']
  },
  device_monitoring: {
    id: 'device_monitoring',
    label: 'Monitoreo del Dispositivo',
    icon: Timeline,
    level: 3,
    parent: 'device_detail',
    actions: ['alerts', 'metrics', 'logs']
  },
  security: {
    id: 'security',
    label: 'Análisis de Seguridad',
    icon: Security,
    level: 1,
    parent: 'dashboard',
    children: ['security_score', 'vulnerabilities', 'compliance'],
    actions: ['scan', 'report', 'export']
  },
  security_score: {
    id: 'security_score',
    label: 'Puntuación de Seguridad',
    icon: TrendingUp,
    level: 2,
    parent: 'security',
    actions: ['improve', 'report', 'history']
  },
  vulnerabilities: {
    id: 'vulnerabilities',
    label: 'Vulnerabilidades',
    icon: Warning,
    level: 2,
    parent: 'security',
    children: ['vulnerability_detail'],
    actions: ['remediate', 'prioritize', 'export']
  },
  vulnerability_detail: {
    id: 'vulnerability_detail',
    label: 'Detalle de Vulnerabilidad',
    icon: Error,
    level: 3,
    parent: 'vulnerabilities',
    actions: ['remediate', 'postpone', 'acknowledge']
  },
  analytics: {
    id: 'analytics',
    label: 'Análisis y Reportes',
    icon: Analytics,
    level: 1,
    parent: 'dashboard',
    children: ['trends', 'reports', 'predictions'],
    actions: ['generate', 'schedule', 'export']
  }
};

/**
 * 🎯 Tipos de entidades y sus relaciones
 */
const ENTITY_RELATIONSHIPS = {
  certificate: {
    relatedTo: ['device', 'issuer', 'domain'],
    sharedProperties: ['validity_period', 'key_size', 'signature_algorithm'],
    dependencies: ['issuer_certificate', 'root_ca']
  },
  device: {
    relatedTo: ['certificate', 'location', 'owner'],
    sharedProperties: ['ip_address', 'hostname', 'version'],
    dependencies: ['network_segment', 'management_group']
  },
  issuer: {
    relatedTo: ['certificate', 'ca_hierarchy'],
    sharedProperties: ['trust_level', 'validation_type'],
    dependencies: ['root_ca', 'intermediate_ca']
  },
  domain: {
    relatedTo: ['certificate', 'organization'],
    sharedProperties: ['domain_validation', 'ownership'],
    dependencies: ['dns_records', 'organization']
  }
};

/**
 * 🧭 Drill-down Navigation Component
 */
const DrillDownNavigation = ({ 
  initialContext = 'dashboard',
  data = {},
  onNavigate,
  onEntitySelect,
  onActionExecute 
}) => {
  // Estados principales
  const [navigationStack, setNavigationStack] = useState([
    { context: initialContext, entity: null, filters: {}, timestamp: Date.now() }
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [relatedEntities, setRelatedEntities] = useState([]);
  const [contextualActions, setContextualActions] = useState([]);
  const [breadcrumbsExpanded, setBreadcrumbsExpanded] = useState(false);

  // Estado actual
  const currentNavigation = navigationStack[navigationStack.length - 1];
  const currentContext = NAVIGATION_HIERARCHY[currentNavigation.context];
  const canGoBack = navigationStack.length > 1;

  /**
   * 🔄 Cargar datos de navegación
   */
  useEffect(() => {
    loadBookmarks();
    loadNavigationHistory();
    updateContextualData();
  }, [currentNavigation]);

  const loadBookmarks = () => {
    try {
      const saved = localStorage.getItem('cmt_navigation_bookmarks');
      if (saved) {
        setBookmarks(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  };

  const loadNavigationHistory = () => {
    try {
      const saved = localStorage.getItem('cmt_navigation_history');
      if (saved) {
        setNavigationHistory(JSON.parse(saved).slice(0, 50)); // Limitar a 50 entradas
      }
    } catch (error) {
      console.error('Error loading navigation history:', error);
    }
  };

  /**
   * 🔍 Actualizar datos contextuales
   */
  const updateContextualData = useCallback(() => {
    // Actualizar entidades relacionadas
    if (currentNavigation.entity) {
      const entityType = currentNavigation.entity.type;
      const relationships = ENTITY_RELATIONSHIPS[entityType];
      
      if (relationships) {
        const related = findRelatedEntities(currentNavigation.entity, relationships);
        setRelatedEntities(related);
      }
    }

    // Actualizar acciones contextuales
    const actions = getContextualActions(currentContext, currentNavigation.entity);
    setContextualActions(actions);
  }, [currentNavigation, currentContext]);

  /**
   * 🧭 Navegar a nuevo contexto
   */
  const navigateTo = useCallback((contextId, entity = null, filters = {}) => {
    const newNavigation = {
      context: contextId,
      entity,
      filters,
      timestamp: Date.now()
    };

    // Agregar al stack de navegación
    const newStack = [...navigationStack, newNavigation];
    setNavigationStack(newStack);

    // Agregar al historial
    const newHistory = [newNavigation, ...navigationHistory].slice(0, 50);
    setNavigationHistory(newHistory);
    localStorage.setItem('cmt_navigation_history', JSON.stringify(newHistory));

    // Callback externo
    if (onNavigate) {
      onNavigate(contextId, entity, filters);
    }

    console.log(`🧭 Navigation: ${contextId}`, { entity, filters });
  }, [navigationStack, navigationHistory, onNavigate]);

  /**
   * ⬅️ Navegar hacia atrás
   */
  const navigateBack = useCallback(() => {
    if (canGoBack) {
      const newStack = navigationStack.slice(0, -1);
      setNavigationStack(newStack);
    }
  }, [navigationStack, canGoBack]);

  /**
   * 🏠 Ir a inicio
   */
  const navigateHome = useCallback(() => {
    setNavigationStack([{
      context: 'dashboard',
      entity: null,
      filters: {},
      timestamp: Date.now()
    }]);
  }, []);

  /**
   * 🔍 Encontrar entidades relacionadas
   */
  const findRelatedEntities = (entity, relationships) => {
    const related = [];

    relationships.relatedTo?.forEach(relationType => {
      // Simulación de búsqueda de entidades relacionadas
      const relatedItems = data[relationType]?.filter(item => 
        isEntityRelated(entity, item, relationType)
      ) || [];

      if (relatedItems.length > 0) {
        related.push({
          type: relationType,
          label: getRelationshipLabel(relationType),
          items: relatedItems.slice(0, 10), // Limitar a 10 elementos
          count: relatedItems.length
        });
      }
    });

    return related;
  };

  /**
   * 🔗 Verificar si entidades están relacionadas
   */
  const isEntityRelated = (entity1, entity2, relationType) => {
    switch (relationType) {
      case 'device':
        return entity1.device_id === entity2.id;
      case 'certificate':
        return entity1.certificate_id === entity2.id || entity1.id === entity2.device_id;
      case 'issuer':
        return entity1.issuer === entity2.name;
      case 'domain':
        return entity1.common_name?.includes(entity2.domain);
      default:
        return false;
    }
  };

  /**
   * 📝 Obtener etiqueta de relación
   */
  const getRelationshipLabel = (relationType) => {
    const labels = {
      device: 'Dispositivos',
      certificate: 'Certificados',
      issuer: 'Emisores',
      domain: 'Dominios',
      location: 'Ubicaciones',
      owner: 'Propietarios'
    };
    return labels[relationType] || relationType;
  };

  /**
   * ⚡ Obtener acciones contextuales
   */
  const getContextualActions = (context, entity) => {
    const baseActions = context?.actions || [];
    const entitySpecificActions = getEntitySpecificActions(entity);
    
    return [...baseActions, ...entitySpecificActions].map(action => ({
      id: action,
      label: getActionLabel(action),
      icon: getActionIcon(action),
      enabled: isActionEnabled(action, context, entity),
      primary: isPrimaryAction(action, context)
    }));
  };

  /**
   * 🎯 Obtener acciones específicas de entidad
   */
  const getEntitySpecificActions = (entity) => {
    if (!entity) return [];
    
    const actions = [];
    
    if (entity.type === 'certificate') {
      if (entity.status === 'expiring') actions.push('renew');
      if (entity.status === 'expired') actions.push('replace');
      actions.push('validate', 'download');
    }
    
    if (entity.type === 'device') {
      if (entity.status === 'offline') actions.push('reconnect');
      actions.push('scan', 'backup');
    }
    
    return actions;
  };

  /**
   * 🏷️ Obtener etiqueta de acción
   */
  const getActionLabel = (action) => {
    const labels = {
      add: 'Agregar',
      edit: 'Editar',
      delete: 'Eliminar',
      renew: 'Renovar',
      validate: 'Validar',
      download: 'Descargar',
      export: 'Exportar',
      filter: 'Filtrar',
      scan: 'Escanear',
      backup: 'Respaldar',
      connect: 'Conectar',
      disconnect: 'Desconectar',
      install: 'Instalar',
      remove: 'Remover',
      share: 'Compartir'
    };
    return labels[action] || action;
  };

  /**
   * 🎨 Obtener icono de acción
   */
  const getActionIcon = (action) => {
    const icons = {
      add: '+',
      edit: '✏️',
      delete: '🗑️',
      renew: '🔄',
      validate: '✅',
      download: '⬇️',
      export: '📤',
      filter: '🔍',
      scan: '🔍',
      backup: '💾',
      connect: '🔗',
      share: '📤'
    };
    return icons[action] || '⚡';
  };

  /**
   * ✅ Verificar si acción está habilitada
   */
  const isActionEnabled = (action, context, entity) => {
    // Lógica para habilitar/deshabilitar acciones
    if (action === 'delete' && !entity) return false;
    if (action === 'renew' && entity?.type !== 'certificate') return false;
    if (action === 'scan' && entity?.status === 'offline') return false;
    
    return true;
  };

  /**
   * ⭐ Verificar si es acción primaria
   */
  const isPrimaryAction = (action, context) => {
    const primaryActions = {
      certificates: ['add', 'renew'],
      devices: ['add', 'scan'],
      security: ['scan', 'report']
    };
    
    return primaryActions[context?.id]?.includes(action) || false;
  };

  /**
   * 🔖 Gestión de marcadores
   */
  const toggleBookmark = useCallback((navigation = currentNavigation) => {
    const bookmarkId = `${navigation.context}_${navigation.entity?.id || 'root'}`;
    const existingIndex = bookmarks.findIndex(b => b.id === bookmarkId);
    
    let newBookmarks;
    if (existingIndex >= 0) {
      newBookmarks = bookmarks.filter((_, i) => i !== existingIndex);
    } else {
      const newBookmark = {
        id: bookmarkId,
        label: getBookmarkLabel(navigation),
        context: navigation.context,
        entity: navigation.entity,
        filters: navigation.filters,
        created_at: new Date().toISOString()
      };
      newBookmarks = [newBookmark, ...bookmarks].slice(0, 20); // Limitar a 20
    }
    
    setBookmarks(newBookmarks);
    localStorage.setItem('cmt_navigation_bookmarks', JSON.stringify(newBookmarks));
  }, [bookmarks, currentNavigation]);

  /**
   * 🏷️ Obtener etiqueta de marcador
   */
  const getBookmarkLabel = (navigation) => {
    const context = NAVIGATION_HIERARCHY[navigation.context];
    const entityName = navigation.entity?.name || navigation.entity?.common_name || '';
    return `${context.label}${entityName ? ` - ${entityName}` : ''}`;
  };

  /**
   * ⚡ Ejecutar acción
   */
  const executeAction = useCallback((actionId) => {
    if (onActionExecute) {
      onActionExecute(actionId, currentNavigation.context, currentNavigation.entity);
    }
    
    console.log(`⚡ Action executed: ${actionId}`, {
      context: currentNavigation.context,
      entity: currentNavigation.entity
    });
  }, [currentNavigation, onActionExecute]);

  /**
   * 🍞 Renderizar breadcrumbs
   */
  const renderBreadcrumbs = () => {
    const displayStack = breadcrumbsExpanded 
      ? navigationStack 
      : navigationStack.length > 3 
        ? [navigationStack[0], { collapsed: true }, ...navigationStack.slice(-2)]
        : navigationStack;

    return (
      <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Breadcrumbs 
          separator={<NavigateNext fontSize="small" />}
          sx={{ flexGrow: 1 }}
        >
          {displayStack.map((nav, index) => {
            if (nav.collapsed) {
              return (
                <Button
                  key="collapsed"
                  size="small"
                  onClick={() => setBreadcrumbsExpanded(true)}
                >
                  ...
                </Button>
              );
            }

            const context = NAVIGATION_HIERARCHY[nav.context];
            const IconComponent = context.icon;
            const isLast = index === displayStack.length - 1;
            const entityName = nav.entity?.name || nav.entity?.common_name;

            return (
              <Box key={index} display="flex" alignItems="center" gap={0.5}>
                {isLast ? (
                  <Typography 
                    variant="body2" 
                    fontWeight="bold"
                    display="flex"
                    alignItems="center"
                    gap={0.5}
                  >
                    <IconComponent fontSize="small" />
                    {context.label}
                    {entityName && (
                      <Chip 
                        label={entityName} 
                        size="small" 
                        variant="outlined"
                      />
                    )}
                  </Typography>
                ) : (
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => {
                      const newStack = navigationStack.slice(0, index + 1);
                      setNavigationStack(newStack);
                    }}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5,
                      textDecoration: 'none'
                    }}
                  >
                    <IconComponent fontSize="small" />
                    {context.label}
                  </Link>
                )}
              </Box>
            );
          })}
        </Breadcrumbs>

        <Box display="flex" gap={1}>
          <Tooltip title="Ir a inicio">
            <IconButton size="small" onClick={navigateHome}>
              <Home />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={canGoBack ? "Volver" : "No se puede volver"}>
            <span>
              <IconButton 
                size="small" 
                onClick={navigateBack}
                disabled={!canGoBack}
              >
                <ArrowBack />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Agregar marcador">
            <IconButton 
              size="small" 
              onClick={() => toggleBookmark()}
              color={bookmarks.some(b => 
                b.context === currentNavigation.context && 
                b.entity?.id === currentNavigation.entity?.id
              ) ? 'primary' : 'default'}
            >
              {bookmarks.some(b => 
                b.context === currentNavigation.context && 
                b.entity?.id === currentNavigation.entity?.id
              ) ? <Bookmark /> : <BookmarkBorder />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Panel de navegación">
            <IconButton 
              size="small" 
              onClick={() => setSidebarOpen(true)}
            >
              <AccountTree />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  };

  /**
   * 🎯 Renderizar acciones contextuales
   */
  const renderContextualActions = () => {
    if (!contextualActions.length) return null;

    const primaryActions = contextualActions.filter(a => a.primary);
    const secondaryActions = contextualActions.filter(a => !a.primary);

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Acciones Disponibles
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {primaryActions.map(action => (
            <Button
              key={action.id}
              variant="contained"
              size="small"
              disabled={!action.enabled}
              onClick={() => executeAction(action.id)}
            >
              {action.icon} {action.label}
            </Button>
          ))}
          {secondaryActions.map(action => (
            <Button
              key={action.id}
              variant="outlined"
              size="small"
              disabled={!action.enabled}
              onClick={() => executeAction(action.id)}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </Stack>
      </Box>
    );
  };

  /**
   * 🔗 Renderizar entidades relacionadas
   */
  const renderRelatedEntities = () => {
    if (!relatedEntities.length) return null;

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔗 Entidades Relacionadas
          </Typography>
          
          {relatedEntities.map((relation, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle2">
                    {relation.label}
                  </Typography>
                  <Badge badgeContent={relation.count} color="primary">
                    <Chip size="small" label={relation.items.length} />
                  </Badge>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {relation.items.map((item, itemIndex) => (
                    <ListItemButton
                      key={itemIndex}
                      onClick={() => {
                        if (onEntitySelect) {
                          onEntitySelect(item, relation.type);
                        }
                        navigateTo(getContextForEntityType(relation.type), item);
                      }}
                    >
                      <ListItemIcon>
                        {getEntityIcon(relation.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name || item.common_name || item.hostname}
                        secondary={getEntitySecondaryText(item, relation.type)}
                      />
                      <Launch fontSize="small" />
                    </ListItemButton>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>
    );
  };

  /**
   * 🎨 Obtener icono de entidad
   */
  const getEntityIcon = (entityType) => {
    const icons = {
      certificate: <Certificate />,
      device: <Router />,
      issuer: <Business />,
      domain: <LocationOn />,
      location: <LocationOn />,
      owner: <Person />
    };
    return icons[entityType] || <Info />;
  };

  /**
   * 📝 Obtener texto secundario de entidad
   */
  const getEntitySecondaryText = (entity, entityType) => {
    switch (entityType) {
      case 'certificate':
        return `Expira: ${entity.expiry_date}`;
      case 'device':
        return `IP: ${entity.ip_address} | Estado: ${entity.status}`;
      case 'issuer':
        return `Confianza: ${entity.trust_level}`;
      default:
        return entity.description || '';
    }
  };

  /**
   * 🧭 Obtener contexto para tipo de entidad
   */
  const getContextForEntityType = (entityType) => {
    const contextMap = {
      certificate: 'certificate_detail',
      device: 'device_detail',
      issuer: 'issuer_detail',
      domain: 'domain_detail'
    };
    return contextMap[entityType] || 'dashboard';
  };

  /**
   * 📱 Renderizar sidebar de navegación
   */
  const renderNavigationSidebar = () => (
    <Drawer
      anchor="right"
      open={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      PaperProps={{ sx: { width: 400 } }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          🧭 Panel de Navegación
        </Typography>

        {/* Marcadores */}
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          🔖 Marcadores
        </Typography>
        <List dense>
          {bookmarks.map((bookmark, index) => (
            <ListItemButton
              key={index}
              onClick={() => {
                navigateTo(bookmark.context, bookmark.entity, bookmark.filters);
                setSidebarOpen(false);
              }}
            >
              <ListItemText
                primary={bookmark.label}
                secondary={new Date(bookmark.created_at).toLocaleDateString()}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(bookmark);
                }}
              >
                <Bookmark />
              </IconButton>
            </ListItemButton>
          ))}
          {bookmarks.length === 0 && (
            <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
              No hay marcadores guardados
            </Typography>
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Historial */}
        <Typography variant="subtitle2" gutterBottom>
          📚 Historial Reciente
        </Typography>
        <List dense>
          {navigationHistory.slice(0, 10).map((nav, index) => {
            const context = NAVIGATION_HIERARCHY[nav.context];
            return (
              <ListItemButton
                key={index}
                onClick={() => {
                  navigateTo(nav.context, nav.entity, nav.filters);
                  setSidebarOpen(false);
                }}
              >
                <ListItemIcon>
                  <context.icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={context.label}
                  secondary={new Date(nav.timestamp).toLocaleTimeString()}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );

  return (
    <Box>
      {/* 🍞 Breadcrumbs y navegación */}
      {renderBreadcrumbs()}
      
      {/* ⚡ Acciones contextuales */}
      {renderContextualActions()}
      
      {/* 🔗 Entidades relacionadas */}
      {renderRelatedEntities()}

      {/* 📱 Sidebar de navegación */}
      {renderNavigationSidebar()}
    </Box>
  );
};

export default DrillDownNavigation;