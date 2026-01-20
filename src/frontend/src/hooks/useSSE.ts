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
  // Track if we intentionally closed (generation complete/cancelled)
  const intentionalCloseRef = useRef(false);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
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

  // Store callbacks in refs to avoid dependency issues
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;
  onConnectRef.current = onConnect;

  useEffect(() => {
    if (!generationId) {
      disconnect();
      return;
    }

    intentionalCloseRef.current = false;
    reconnectCountRef.current = 0;

    const connect = () => {
      // Don't reconnect if intentionally closed
      if (intentionalCloseRef.current) return;

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
        onConnectRef.current?.();
      };

      eventSource.onerror = () => {
        // Don't reconnect if we closed intentionally
        if (intentionalCloseRef.current) return;

        const err = new Error('SSE connection error');
        setError(err);
        setConnected(false);
        onErrorRef.current?.(err);

        // Attempt reconnection with limit
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectCountRef.current);
        }
      };

      // Listen to specific event types
      const eventTypes = [
        'generation_started',
        'step_start',
        'step_complete',
        'step_skipped',
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
            onEventRef.current?.(progressEvent);

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
    };

    connect();

    return () => {
      disconnect();
    };
  }, [generationId, reconnectAttempts, reconnectDelay, disconnect]);

  return { connected, error, disconnect };
}
