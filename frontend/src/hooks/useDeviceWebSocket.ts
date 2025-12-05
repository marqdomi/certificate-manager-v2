// frontend/src/hooks/useDeviceWebSocket.ts
/**
 * Custom hook for real-time device updates via WebSocket.
 * 
 * Connects to the backend WebSocket endpoint and provides
 * live updates for device changes without manual refresh.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// WebSocket event types
export type DeviceEventType = 
  | 'connected'
  | 'device_added'
  | 'device_updated'
  | 'device_deleted'
  | 'scan_started'
  | 'scan_completed'
  | 'facts_updated'
  | 'cache_updated'
  | 'bulk_scan_started'
  | 'bulk_scan_completed';

export interface DeviceWebSocketMessage {
  type: DeviceEventType;
  device_id?: number;
  device_ids?: number[];
  data?: Record<string, unknown>;
  message?: string;
  timestamp?: number;
}

interface UseDeviceWebSocketOptions {
  onMessage?: (message: DeviceWebSocketMessage) => void;
  onDeviceAdded?: (deviceId: number, data: Record<string, unknown>) => void;
  onDeviceUpdated?: (deviceId: number, data: Record<string, unknown>) => void;
  onDeviceDeleted?: (deviceId: number) => void;
  onScanStarted?: (deviceId: number) => void;
  onScanCompleted?: (deviceId: number, data: Record<string, unknown>) => void;
  onBulkUpdate?: (deviceIds: number[], eventType: string) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

interface UseDeviceWebSocketReturn {
  isConnected: boolean;
  lastMessage: DeviceWebSocketMessage | null;
  connectionError: string | null;
}

export function useDeviceWebSocket(options: UseDeviceWebSocketOptions = {}): UseDeviceWebSocketReturn {
  const {
    onMessage,
    onDeviceAdded,
    onDeviceUpdated,
    onDeviceDeleted,
    onScanStarted,
    onScanCompleted,
    onBulkUpdate,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<DeviceWebSocketMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In development, connect directly to backend port
    const isDev = window.location.port === '5173';
    const host = isDev ? 'localhost:8000' : window.location.host;
    return `${protocol}//${host}/api/v1/ws/devices`;
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getWebSocketUrl();
    console.log('[WebSocket] Connecting to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setConnectionError(null);
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        // Handle pong responses
        if (event.data === 'pong' || event.data === 'ping') {
          if (event.data === 'ping') {
            ws.send('pong');
          }
          return;
        }

        try {
          const message: DeviceWebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type);
          setLastMessage(message);

          // Call general message handler
          onMessage?.(message);

          // Call specific handlers based on event type
          switch (message.type) {
            case 'device_added':
              if (message.device_id) {
                onDeviceAdded?.(message.device_id, message.data || {});
              }
              break;
            case 'device_updated':
            case 'facts_updated':
            case 'cache_updated':
              if (message.device_id) {
                onDeviceUpdated?.(message.device_id, message.data || {});
              }
              break;
            case 'device_deleted':
              if (message.device_id) {
                onDeviceDeleted?.(message.device_id);
              }
              break;
            case 'scan_started':
              if (message.device_id) {
                onScanStarted?.(message.device_id);
              }
              break;
            case 'scan_completed':
              if (message.device_id) {
                onScanCompleted?.(message.device_id, message.data || {});
              }
              break;
            case 'bulk_scan_started':
            case 'bulk_scan_completed':
              if (message.device_ids) {
                onBulkUpdate?.(message.device_ids, message.type);
              }
              break;
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setConnectionError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto reconnect
        if (autoReconnect && mountedRef.current) {
          console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [
    getWebSocketUrl,
    autoReconnect,
    reconnectInterval,
    onMessage,
    onDeviceAdded,
    onDeviceUpdated,
    onDeviceDeleted,
    onScanStarted,
    onScanCompleted,
    onBulkUpdate,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastMessage,
    connectionError,
  };
}

export default useDeviceWebSocket;
