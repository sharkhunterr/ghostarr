/**
 * History API hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { History, GenerationType, GenerationStatus } from '../types';

// Query keys
export const historyKeys = {
  all: ['history'] as const,
  lists: () => [...historyKeys.all, 'list'] as const,
  list: (filters: HistoryFilters) => [...historyKeys.lists(), filters] as const,
  detail: (id: string) => [...historyKeys.all, 'detail', id] as const,
};

// Types
export interface HistoryFilters {
  type?: GenerationType;
  status?: GenerationStatus;
  template_id?: string;
  schedule_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export type ExportFormat = 'json' | 'csv';

// List history with filters
export function useHistory(filters: HistoryFilters = {}) {
  return useQuery({
    queryKey: historyKeys.list(filters),
    queryFn: async (): Promise<History[]> => {
      const params = new URLSearchParams();

      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.template_id) params.append('template_id', filters.template_id);
      if (filters.schedule_id) params.append('schedule_id', filters.schedule_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.page_size) params.append('page_size', String(filters.page_size));

      const response = await apiClient.get<History[]>('/history', { params });
      return response.data;
    },
  });
}

// Get history detail
export function useHistoryDetail(historyId: string, enabled = true) {
  return useQuery({
    queryKey: historyKeys.detail(historyId),
    queryFn: async (): Promise<History> => {
      const response = await apiClient.get<History>(`/history/${historyId}`);
      return response.data;
    },
    enabled: enabled && !!historyId,
  });
}

// Delete history entry
export function useDeleteHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      historyId: string
    ): Promise<{ status: string; history_id: string }> => {
      const response = await apiClient.delete<{
        status: string;
        history_id: string;
      }>(`/history/${historyId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

// Regenerate from history
export function useRegenerateHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (historyId: string): Promise<History> => {
      const response = await apiClient.post<History>(
        `/history/${historyId}/regenerate`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

// Delete Ghost post
export function useDeleteGhostPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      historyId: string
    ): Promise<{ status: string; history_id: string }> => {
      const response = await apiClient.delete<{
        status: string;
        history_id: string;
      }>(`/history/${historyId}/ghost-post`);
      return response.data;
    },
    onSuccess: (_, historyId) => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
      queryClient.invalidateQueries({ queryKey: historyKeys.detail(historyId) });
    },
  });
}

// Bulk delete history entries
export function useBulkDeleteHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      historyIds: string[]
    ): Promise<{ status: string; deleted_count: number }> => {
      const response = await apiClient.post<{
        status: string;
        deleted_count: number;
      }>('/history/bulk-delete', historyIds);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

// Bulk delete history entries with Ghost posts
export function useBulkDeleteHistoryWithGhost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      historyIds: string[]
    ): Promise<{
      status: string;
      deleted_count: number;
      ghost_deleted_count: number;
      errors: string[] | null;
    }> => {
      const response = await apiClient.post<{
        status: string;
        deleted_count: number;
        ghost_deleted_count: number;
        errors: string[] | null;
      }>('/history/bulk-delete-with-ghost', historyIds);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

// Export history
export function useExportHistory() {
  return useMutation({
    mutationFn: async ({
      format,
      filters,
    }: {
      format: ExportFormat;
      filters?: HistoryFilters;
    }): Promise<Blob> => {
      const params = new URLSearchParams();
      params.append('format', format);

      if (filters?.type) params.append('type', filters.type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);

      const response = await apiClient.get('/history/export', {
        params,
        responseType: 'blob',
      });
      return response.data;
    },
  });
}

// Helper to trigger download
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
