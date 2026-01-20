/**
 * Newsletter generation API hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type {
  GenerationConfig,
  GenerationRequest,
  PreviewRequest,
  PreviewResponse,
  HistoryEntry,
  GenerationStatus,
} from '../types';

// Query keys
export const newsletterKeys = {
  all: ['newsletters'] as const,
  status: (id: string) => [...newsletterKeys.all, 'status', id] as const,
};

// Types
export interface GenerationStatusResponse {
  generation_id: string;
  status: GenerationStatus;
  is_active: boolean;
  progress_log: Array<{
    step: string;
    status: string;
    message: string;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    items_count?: number;
    error?: string;
  }>;
}

// Generate newsletter
export function useGenerateNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: GenerationConfig): Promise<HistoryEntry> => {
      const request: GenerationRequest = { config };
      const response = await apiClient.post<HistoryEntry>(
        '/newsletters/generate',
        request
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

// Preview newsletter
export function usePreviewNewsletter() {
  return useMutation({
    mutationFn: async (config: GenerationConfig): Promise<PreviewResponse> => {
      const request: PreviewRequest = { config };
      const response = await apiClient.post<PreviewResponse>(
        '/newsletters/preview',
        request
      );
      return response.data;
    },
  });
}

// Cancel generation
export function useCancelGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      generationId: string
    ): Promise<{ status: string; generation_id: string }> => {
      const response = await apiClient.post<{
        status: string;
        generation_id: string;
      }>(`/newsletters/${generationId}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

// Get generation status
export function useGenerationStatus(generationId: string, enabled = true) {
  return useQuery({
    queryKey: newsletterKeys.status(generationId),
    queryFn: async (): Promise<GenerationStatusResponse> => {
      const response = await apiClient.get<GenerationStatusResponse>(
        `/newsletters/${generationId}/status`
      );
      return response.data;
    },
    enabled: enabled && !!generationId,
    refetchInterval: (data) => {
      // Stop polling when generation is complete
      if (data && !data.state.data?.is_active) {
        return false;
      }
      return 2000; // Poll every 2 seconds while active
    },
  });
}
