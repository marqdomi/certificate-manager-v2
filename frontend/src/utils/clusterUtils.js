// frontend/src/utils/clusterUtils.js

/**
 * Utilidades para manejo de clusters siguiendo las mejores prácticas
 * de agrupación y visualización de infraestructura distribuida
 */

/**
 * Agrupa dispositivos por cluster_key y organiza por prioridad
 * @param {Array} devices - Lista de dispositivos
 * @returns {Object} Estructura organizada de clusters
 */
export const groupDevicesByClusters = (devices = []) => {
  if (!Array.isArray(devices)) return { clusters: {}, standalone: [], all: [] };

  const clusters = {};
  const standalone = [];
  
  devices.forEach(device => {
    const clusterKey = device.cluster_key?.trim();
    const clusterLabel = device.cluster_label?.trim();
    
    if (!clusterKey) {
      // Dispositivo standalone
      standalone.push({
        ...device,
        clusterType: 'standalone',
        isClusterPrimary: false,
        cluster_label: null,
        clusterMembers: [device]
      });
    } else {
      // Dispositivo en cluster
      if (!clusters[clusterKey]) {
        clusters[clusterKey] = {
          key: clusterKey,
          label: clusterLabel || clusterKey,
          primary: null,
          members: [],
          allDevices: []
        };
      }
      
      clusters[clusterKey].allDevices.push(device);
      
      // Determinar si es primario basado en is_primary_preferred y ha_state
      const isPrimary = device.is_primary_preferred && 
                       device.ha_state?.toLowerCase() === 'active';
      
      if (isPrimary) {
        clusters[clusterKey].primary = device;
      } else {
        clusters[clusterKey].members.push(device);
      }
    }
  });

  // Procesar clusters para asegurar que siempre haya un "primary"
  Object.keys(clusters).forEach(key => {
    const cluster = clusters[key];
    
    // Si no hay primary definido, usar el primer ACTIVE o el primero disponible
    if (!cluster.primary && cluster.allDevices.length > 0) {
      const activeDevice = cluster.allDevices.find(d => 
        d.ha_state?.toLowerCase() === 'active'
      );
      
      cluster.primary = activeDevice || cluster.allDevices[0];
      
      // Remover el primary de members si estaba ahí
      cluster.members = cluster.members.filter(d => d.id !== cluster.primary.id);
    }

    // Agregar metadata al primary
    if (cluster.primary) {
      cluster.primary = {
        ...cluster.primary,
        clusterType: 'primary',
        isClusterPrimary: true,
        clusterMembers: cluster.allDevices,
        clusterKey: key,
        cluster_label: cluster.label
      };
    }

    // Agregar metadata a los members
    cluster.members = cluster.members.map(member => ({
      ...member,
      clusterType: 'member',
      isClusterPrimary: false,
      clusterMembers: cluster.allDevices,
      clusterKey: key,
      cluster_label: cluster.label
    }));
  });

  return {
    clusters,
    standalone,
    all: devices
  };
};

/**
 * Obtiene la vista condensada (solo primarios y standalone)
 * @param {Array} devices - Lista de dispositivos
 * @returns {Array} Lista filtrada para vista condensada
 */
export const getCondensedView = (devices = []) => {
  const { clusters, standalone } = groupDevicesByClusters(devices);
  
  const condensedDevices = [...standalone];
  
  // Agregar solo los primarios de cada cluster
  Object.values(clusters).forEach(cluster => {
    if (cluster.primary) {
      condensedDevices.push(cluster.primary);
    }
  });

  return condensedDevices.sort((a, b) => {
    // Ordenar por hostname
    return (a.hostname || '').localeCompare(b.hostname || '');
  });
};

/**
 * Obtiene la vista expandida con todos los dispositivos organizados
 * @param {Array} devices - Lista de dispositivos  
 * @param {Object} expandedClusters - Estado de clusters expandidos
 * @returns {Array} Lista organizada para vista expandida
 */
export const getExpandedView = (devices = [], expandedClusters = {}) => {
  const { clusters, standalone } = groupDevicesByClusters(devices);
  
  const expandedDevices = [...standalone];

  // Procesar clusters
  Object.values(clusters).forEach(cluster => {
    if (cluster.primary) {
      // Siempre agregar el primary
      expandedDevices.push({
        ...cluster.primary,
        hasExpandableMembers: cluster.members.length > 0,
        isExpanded: expandedClusters[cluster.key] || false
      });

      // Si está expandido, agregar los members
      if (expandedClusters[cluster.key] && cluster.members.length > 0) {
        cluster.members.forEach(member => {
          expandedDevices.push({
            ...member,
            isClusterMember: true,
            clusterParent: cluster.primary.id
          });
        });
      }
    }
  });

  return expandedDevices.sort((a, b) => {
    // Ordenar manteniendo la jerarquía de clusters
    if (a.clusterKey && b.clusterKey && a.clusterKey === b.clusterKey) {
      // Mismo cluster: primary primero, luego members
      if (a.isClusterPrimary && !b.isClusterPrimary) return -1;
      if (!a.isClusterPrimary && b.isClusterPrimary) return 1;
    }
    
    return (a.hostname || '').localeCompare(b.hostname || '');
  });
};

/**
 * Filtra dispositivos según criterios de cluster
 * @param {Array} devices - Lista de dispositivos
 * @param {Object} filters - Filtros aplicados
 * @returns {Array} Lista filtrada
 */
export const filterDevicesByCluster = (devices = [], filters = {}) => {
  const {
    showOnlyPrimaries = false,
    showOnlyClusters = false,
    showOnlyStandalone = false,
    searchTerm = ''
  } = filters;

  let filteredDevices = [...devices];

  // Aplicar filtros de cluster
  if (showOnlyPrimaries) {
    filteredDevices = filteredDevices.filter(device => 
      !device.cluster_key || device.is_primary_preferred
    );
  }

  if (showOnlyClusters) {
    filteredDevices = filteredDevices.filter(device => 
      device.cluster_key && device.cluster_key.trim()
    );
  }

  if (showOnlyStandalone) {
    filteredDevices = filteredDevices.filter(device => 
      !device.cluster_key || !device.cluster_key.trim()
    );
  }

  // Aplicar filtro de búsqueda
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredDevices = filteredDevices.filter(device =>
      (device.hostname || '').toLowerCase().includes(term) ||
      (device.ip_address || '').toLowerCase().includes(term) ||
      (device.cluster_key || '').toLowerCase().includes(term) ||
      (device.site || '').toLowerCase().includes(term)
    );
  }

  return filteredDevices;
};

/**
 * Obtiene estadísticas de clusters
 * @param {Array} devices - Lista de dispositivos
 * @returns {Object} Estadísticas
 */
export const getClusterStats = (devices = []) => {
  const { clusters, standalone } = groupDevicesByClusters(devices);
  
  const clusterCount = Object.keys(clusters).length;
  const standaloneCount = standalone.length;
  const totalDevices = devices.length;
  const clusteredDevices = totalDevices - standaloneCount;
  
  // Estadísticas de HA
  const haStats = {
    active: devices.filter(d => d.ha_state?.toLowerCase() === 'active').length,
    standby: devices.filter(d => d.ha_state?.toLowerCase() === 'standby').length,
    offline: devices.filter(d => d.ha_state?.toLowerCase() === 'offline').length,
    unknown: devices.filter(d => !d.ha_state).length
  };

  return {
    totalDevices,
    clusterCount,
    clusteredDevices,
    standaloneCount,
    primaryDevices: Object.values(clusters).filter(c => c.primary).length,
    haStats,
    clusterSizes: Object.values(clusters).map(c => c.allDevices.length)
  };
};

/**
 * Valida la integridad de un cluster
 * @param {Object} cluster - Datos del cluster
 * @returns {Object} Resultado de validación
 */
export const validateCluster = (cluster) => {
  const issues = [];
  const warnings = [];

  if (!cluster.primary) {
    issues.push('No primary device identified');
  }

  if (cluster.allDevices.length < 2) {
    warnings.push('Single device cluster');
  }

  const activeDevices = cluster.allDevices.filter(d => 
    d.ha_state?.toLowerCase() === 'active'
  );

  if (activeDevices.length === 0) {
    issues.push('No active devices in cluster');
  } else if (activeDevices.length > 1) {
    issues.push('Multiple active devices detected (split-brain?)');
  }

  const syncedDevices = cluster.allDevices.filter(d =>
    d.sync_status?.toLowerCase().includes('sync')
  );

  if (syncedDevices.length < cluster.allDevices.length) {
    warnings.push('Some devices may be out of sync');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    health: issues.length === 0 ? (warnings.length === 0 ? 'healthy' : 'warning') : 'error'
  };
};

/**
 * Obtiene el siguiente dispositivo primario recomendado para un cluster
 * @param {Array} clusterDevices - Dispositivos del cluster
 * @returns {Object|null} Dispositivo recomendado
 */
export const getRecommendedPrimary = (clusterDevices = []) => {
  if (clusterDevices.length === 0) return null;

  // Prioridad: ACTIVE > STANDBY > Otros
  const activeDevices = clusterDevices.filter(d => 
    d.ha_state?.toLowerCase() === 'active'
  );
  
  if (activeDevices.length === 1) {
    return activeDevices[0];
  }

  const standbyDevices = clusterDevices.filter(d => 
    d.ha_state?.toLowerCase() === 'standby'
  );

  if (standbyDevices.length > 0) {
    return standbyDevices[0];
  }

  // Fallback al primer dispositivo disponible
  return clusterDevices[0];
};

export default {
  groupDevicesByClusters,
  getCondensedView,
  getExpandedView,
  filterDevicesByCluster,
  getClusterStats,
  validateCluster,
  getRecommendedPrimary
};
