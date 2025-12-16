// frontend/src/hooks/useWebSocketNotifications.js
// WebSocket hook for real-time notifications

import { useState, useEffect, useCallback, useRef } from 'react';
import { authProvider } from '../pages/LoginPage';

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RETRIES = 5;

/**
 * Custom hook for WebSocket notifications
 * Connects to /ws/notifications with JWT authentication
 */
export function useWebSocketNotifications(onNotification) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const retriesRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  const getWsUrl = useCallback(() => {
    const token = authProvider.getToken?.();
    if (!token) return null;

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;

    // Check for runtime config (production)
    if (window.APP_CONFIG?.API_URL) {
      try {
        const apiUrl = new URL(window.APP_CONFIG.API_URL);
        wsHost = apiUrl.host;
      } catch {
        // ignore
      }
    } else {
      // Development mode - use localhost:8000 instead of 5173
      const isDev = window.location.port === '5173';
      if (isDev) {
        wsHost = 'localhost:8000';
      }
    }

    return `${protocol}//${wsHost}/api/v1/ws/notifications?token=${token}`;
  }, []);

  const connect = useCallback(() => {
    const url = getWsUrl();
    if (!url) {
      setError('No authentication token available');
      return;
    }

    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to notifications');
        setConnected(true);
        setError(null);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'notification') {
            onNotification?.(data.payload);
          } else if (data.type === 'connected') {
            console.log('[WS] Server acknowledged connection:', data.user_id);
          } else if (data.type === 'ping') {
            // Respond to server ping
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[WS] Error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not intentional close
        if (event.code !== 1000 && retriesRef.current < WS_MAX_RETRIES) {
          retriesRef.current++;
          console.log(`[WS] Reconnecting in ${WS_RECONNECT_DELAY}ms (attempt ${retriesRef.current}/${WS_MAX_RETRIES})`);
          reconnectTimeoutRef.current = setTimeout(connect, WS_RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[WS] Failed to connect:', err);
      setError(err.message);
    }
  }, [getWsUrl, onNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Reconnect when token changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'cm_token') {
        disconnect();
        if (e.newValue) {
          setTimeout(connect, 500);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);

  return {
    connected,
    error,
    connect,
    disconnect,
    sendMessage,
  };
}

export default useWebSocketNotifications;
