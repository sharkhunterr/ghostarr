/**
 * Logs API hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type { Log, LogLevel, LogSource, PaginatedResponse } from '@/types';

// Query keys
export const logKeys = {
  all: ['logs'] as const,
  lists: () => [...logKeys.all, 'list'] as const,
  list: (filters: LogFilters) => [...logKeys.lists(), filters] as const,
  stats: (days: number) => [...logKeys.all, 'stats', days] as const,
};

export interface LogFilters {
  level?: LogLevel;
  source?: LogSource;
  service?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface LogStats {
  total: number;
  by_level: Record<string, number>;
  by_source: Record<string, number>;
  by_service: Record<string, number>;
}

export function useLogs(filters: LogFilters = {}) {
  return useQuery({
    queryKey: logKeys.list(filters),
    queryFn: async (): Promise<PaginatedResponse<Log>> => {
      const params = new URLSearchParams();

      if (filters.level) params.append('level', filters.level);
      if (filters.source) params.append('source', filters.source);
      if (filters.service) params.append('service', filters.service);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.search) params.append('search', filters.search);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.page_size) params.append('page_size', filters.page_size.toString());

      const response = await apiClient.get<PaginatedResponse<Log>>(
        `/logs?${params.toString()}`
      );
      return response.data;
    },
  });
}

export function useLogStats(days: number = 7) {
  return useQuery({
    queryKey: logKeys.stats(days),
    queryFn: async (): Promise<LogStats> => {
      const response = await apiClient.get<LogStats>(`/logs/stats?days=${days}`);
      return response.data;
    },
  });
}

export function usePurgeLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number) => {
      const response = await apiClient.delete<{ deleted: number; cutoff_date: string }>(
        `/logs/purge?days=${days}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logKeys.all });
    },
  });
}

export function useExportLogs() {
  return useMutation({
    mutationFn: async ({
      format,
      filters,
    }: {
      format: 'json' | 'csv';
      filters?: Omit<LogFilters, 'page' | 'page_size'>;
    }) => {
      const params = new URLSearchParams();
      params.append('format', format);

      if (filters?.level) params.append('level', filters.level);
      if (filters?.source) params.append('source', filters.source);
      if (filters?.service) params.append('service', filters.service);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);

      const response = await apiClient.get(`/logs/export?${params.toString()}`, {
        responseType: 'blob',
      });

      // Download the file
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
