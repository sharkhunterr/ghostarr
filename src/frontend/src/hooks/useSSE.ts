/**
 * Server-Sent Events hook for real-time progress updates.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ProgressEvent } from '../types';

interface UseSSEOptions {
  onEvent?: (event: ProgressEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface UseSSEReturn {
  connected: boolean;
  error: Error | null;
  disconnect: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function useSSE(
  generationId: string | null,
  options: UseSSEOptions = {}
): UseSSEReturn {
  const {
    onEvent,
    onError,
    onConnect,
    onDisconnect,
    reconnectAttempts = 3,
    reconnectDelay = 1000,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
      onDisconnect?.();
    }
  }, [onDisconnect]);

  const connect = useCallback(() => {
    if (!generationId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/progress/stream/${generationId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectCountRef.current = 0;
      onConnect?.();
    };

    eventSource.onerror = () => {
      const err = new Error('SSE connection error');
      setError(err);
      setConnected(false);
      onError?.(err);

      // Attempt reconnection
      if (reconnectCountRef.current < reconnectAttempts) {
        reconnectCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay * reconnectCountRef.current);
      } else {
        disconnect();
      }
    };

    // Listen to specific event types
    const eventTypes = [
      'step_start',
      'step_complete',
      'step_error',
      'generation_complete',
      'generation_cancelled',
    ];

    eventTypes.forEach((eventType) => {
      eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const progressEvent: ProgressEvent = {
            type: eventType as ProgressEvent['type'],
            ...data,
          };
          onEvent?.(progressEvent);

          // Auto-disconnect on completion or cancellation
          if (
            eventType === 'generation_complete' ||
            eventType === 'generation_cancelled'
          ) {
            disconnect();
          }
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      });
    });
  }, [
    generationId,
    onEvent,
    onError,
    onConnect,
    reconnectAttempts,
    reconnectDelay,
    disconnect,
  ]);

  // Connect when generationId changes
  useEffect(() => {
    if (generationId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [generationId, connect, disconnect]);

  return { connected, error, disconnect };
}
