// frontend/src/hooks/useUsageStateLoader.js
/**
 * Custom hook for lazy-loading real-time usage states of certificates.
 * Simplified version that works well with MUI DataGrid pagination.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getBatchUsageStates } from '../services/api';

// Max certificates to fetch in one batch
const MAX_BATCH_SIZE = 50;
// Debounce delay before fetching (ms)
const DEBOUNCE_MS = 150;

/**
 * Hook to manage lazy loading of certificate usage states.
 * @param {Array} certificates - Array of certificate objects from API
 * @returns {Object} - { usageStates, loadUsageForIds, getUsageState, refreshUsageForIds, isLoading }
 */
export function useUsageStateLoader(certificates) {
  // Map of cert_id -> usage_state (cached results)
  const [usageStates, setUsageStates] = useState({});
  // Set of cert_ids currently loading
  const [loadingIds, setLoadingIds] = useState(new Set());
  // Debounce timer ref
  const debounceRef = useRef(null);
  // Pending IDs to fetch (accumulated during debounce)
  const pendingIdsRef = useRef(new Set());

  // Initialize usage states from certificates (if they come with cache-based states)
  useEffect(() => {
    const initialStates = {};
    certificates.forEach(cert => {
      if (cert.usage_state && !usageStates[cert.id]) {
        initialStates[cert.id] = cert.usage_state;
      }
    });
    if (Object.keys(initialStates).length > 0) {
      setUsageStates(prev => ({ ...prev, ...initialStates }));
    }
  }, [certificates]);

  /**
   * Internal function to actually fetch usage states.
   */
  const doFetch = useCallback(async (certIds) => {
    if (certIds.length === 0) return;

    // Mark as loading
    setLoadingIds(prev => {
      const next = new Set(prev);
      certIds.forEach(id => next.add(id));
      return next;
    });

    try {
      // Batch into chunks if too many
      for (let i = 0; i < certIds.length; i += MAX_BATCH_SIZE) {
        const batch = certIds.slice(i, i + MAX_BATCH_SIZE);
        const result = await getBatchUsageStates(batch);

        // Update states with results
        setUsageStates(prev => ({
          ...prev,
          ...result.usage_states
        }));

        // Log errors for debugging
        if (result.errors && Object.keys(result.errors).length > 0) {
          console.warn('[useUsageStateLoader] Batch errors:', result.errors);
        }
      }
    } catch (error) {
      console.error('[useUsageStateLoader] Failed to fetch usage states:', error);
      // Mark failed IDs as 'error'
      setUsageStates(prev => {
        const errorStates = {};
        certIds.forEach(id => { errorStates[id] = 'error'; });
        return { ...prev, ...errorStates };
      });
    } finally {
      // Remove from loading set
      setLoadingIds(prev => {
        const next = new Set(prev);
        certIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, []);

  /**
   * Fetch usage states for a batch of certificate IDs (debounced).
   * Skips IDs that are already cached or currently loading.
   */
  const loadUsageForIds = useCallback((certIds) => {
    // Filter out already cached or loading IDs
    const idsToFetch = certIds.filter(
      id => !usageStates[id] && !loadingIds.has(id)
    );

    if (idsToFetch.length === 0) return;

    // Add to pending
    idsToFetch.forEach(id => pendingIdsRef.current.add(id));

    // Debounce the actual fetch
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const ids = Array.from(pendingIdsRef.current);
      pendingIdsRef.current.clear();
      if (ids.length > 0) {
        doFetch(ids);
      }
    }, DEBOUNCE_MS);
  }, [usageStates, loadingIds, doFetch]);

  /**
   * Load usage states for the current page of certificates.
   * Call this when pagination changes.
   */
  const loadUsageForPage = useCallback((pageRows) => {
    const ids = pageRows.map(row => row.id).filter(id => id != null);
    loadUsageForIds(ids);
  }, [loadUsageForIds]);

  /**
   * Get the usage state for a specific cert ID.
   * Returns: 'loading' | 'active' | 'profiles-no-vips' | 'no-profiles' | 'error' | undefined
   */
  const getUsageState = useCallback((certId) => {
    if (loadingIds.has(certId)) return 'loading';
    return usageStates[certId];
  }, [usageStates, loadingIds]);

  /**
   * Force refresh usage state for specific IDs (clear cache and refetch).
   */
  const refreshUsageForIds = useCallback((certIds) => {
    // Clear cached states for these IDs
    setUsageStates(prev => {
      const next = { ...prev };
      certIds.forEach(id => delete next[id]);
      return next;
    });
    // Trigger fetch immediately
    doFetch(certIds);
  }, [doFetch]);

  /**
   * Refresh all currently loaded usage states.
   */
  const refreshAll = useCallback(() => {
    const ids = Object.keys(usageStates).map(id => parseInt(id, 10));
    if (ids.length > 0) {
      refreshUsageForIds(ids);
    }
  }, [usageStates, refreshUsageForIds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    usageStates,
    loadUsageForIds,
    loadUsageForPage,
    getUsageState,
    refreshUsageForIds,
    refreshAll,
    isLoading: loadingIds.size > 0
  };
}

export default useUsageStateLoader;
