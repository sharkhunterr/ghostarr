/**
 * Hook for managing newsletter generation progress.
 * Combines SSE connection with progress store.
 */

import { useCallback, useMemo } from 'react';
import { useSSE } from './useSSE';
import { useProgressStore } from '../stores/progressStore';
import { useGenerateNewsletter, useCancelGeneration } from '../api/newsletters';
import type { GenerationConfig, ProgressEvent } from '../types';
import { useNotificationStore } from '../stores/notificationStore';

interface UseProgressOptions {
  onComplete?: (ghostPostUrl?: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export function useProgress(options: UseProgressOptions = {}) {
  const { onComplete, onError, onCancel } = options;

  const generateMutation = useGenerateNewsletter();
  const cancelMutation = useCancelGeneration();
  const { addNotification } = useNotificationStore();

  const {
    activeGenerationId,
    generations,
    startGeneration,
    updateProgress,
    cancelGeneration: cancelGenerationInStore,
    clearGeneration,
  } = useProgressStore();

  // Handle SSE events
  const handleSSEEvent = useCallback(
    (event: ProgressEvent) => {
      updateProgress(event);

      if (event.type === 'generation_complete') {
        const ghostPostUrl = event.data?.ghost_post_url as string | undefined;
        onComplete?.(ghostPostUrl);
        addNotification({
          type: 'success',
          title: 'Generation complete',
          message: ghostPostUrl
            ? 'Newsletter published successfully'
            : 'Newsletter generated successfully',
        });
      } else if (event.type === 'generation_cancelled') {
        onCancel?.();
        addNotification({
          type: 'info',
          title: 'Generation cancelled',
          message: 'Newsletter generation was cancelled',
        });
      } else if (event.type === 'step_error') {
        const errorMsg = event.data?.error as string | undefined;
        if (errorMsg) {
          onError?.(errorMsg);
        }
      }
    },
    [updateProgress, onComplete, onCancel, onError, addNotification]
  );

  const handleSSEError = useCallback(
    (error: Error) => {
      console.error('SSE error:', error);
      addNotification({
        type: 'error',
        title: 'Connection error',
        message: 'Lost connection to progress stream',
      });
    },
    [addNotification]
  );

  // Connect to SSE when there's an active generation
  const { connected, disconnect } = useSSE(activeGenerationId, {
    onEvent: handleSSEEvent,
    onError: handleSSEError,
  });

  // Start a new generation
  const generate = useCallback(
    async (config: GenerationConfig) => {
      try {
        const result = await generateMutation.mutateAsync(config);
        startGeneration(result.id);
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Generation failed';
        onError?.(message);
        addNotification({
          type: 'error',
          title: 'Generation failed',
          message,
        });
        throw error;
      }
    },
    [generateMutation, startGeneration, onError, addNotification]
  );

  // Cancel the active generation
  const cancel = useCallback(async () => {
    if (!activeGenerationId) return;

    try {
      await cancelMutation.mutateAsync(activeGenerationId);
      cancelGenerationInStore(activeGenerationId);
      disconnect();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to cancel';
      addNotification({
        type: 'error',
        title: 'Cancel failed',
        message,
      });
    }
  }, [
    activeGenerationId,
    cancelMutation,
    cancelGenerationInStore,
    disconnect,
    addNotification,
  ]);

  // Clear the current generation from the store
  const clear = useCallback(() => {
    if (activeGenerationId) {
      clearGeneration(activeGenerationId);
    }
  }, [activeGenerationId, clearGeneration]);

  // Get the current generation progress
  const currentProgress = useMemo(() => {
    if (!activeGenerationId) return null;
    return generations[activeGenerationId] || null;
  }, [activeGenerationId, generations]);

  return {
    // State
    generationId: activeGenerationId,
    progress: currentProgress,
    isGenerating: !!activeGenerationId && !currentProgress?.isComplete,
    isComplete: currentProgress?.isComplete || false,
    isCancelled: currentProgress?.isCancelled || false,
    connected,

    // Mutation states
    isStarting: generateMutation.isPending,
    isCancelling: cancelMutation.isPending,

    // Actions
    generate,
    cancel,
    clear,
  };
}
