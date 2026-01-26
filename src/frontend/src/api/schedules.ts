/**
 * Schedules API hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Schedule, GenerationConfig, DeletionConfig, ScheduleType } from '../types';

// Query keys
export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  detail: (id: string) => [...scheduleKeys.all, 'detail', id] as const,
  nextRuns: (id: string) => [...scheduleKeys.all, 'next-runs', id] as const,
};

// Types
export interface ScheduleCreateData {
  name: string;
  cron_expression: string;
  timezone?: string;
  schedule_type?: ScheduleType;
  template_id?: string;
  generation_config?: GenerationConfig;
  deletion_config?: DeletionConfig;
  is_active?: boolean;
}

export interface ScheduleUpdateData {
  name?: string;
  cron_expression?: string;
  timezone?: string;
  template_id?: string;
  generation_config?: GenerationConfig;
  deletion_config?: DeletionConfig;
  is_active?: boolean;
}

export interface ScheduleNextRuns {
  schedule_id: string;
  cron_expression: string;
  cron_description: string;
  next_runs: string[];
}

export interface CronValidation {
  valid: boolean;
  expression: string;
  description: string;
  next_runs: string[];
}

// List all schedules
export function useSchedules() {
  return useQuery({
    queryKey: scheduleKeys.lists(),
    queryFn: async (): Promise<Schedule[]> => {
      const response = await apiClient.get<Schedule[]>('/schedules');
      return response.data;
    },
  });
}

// Get schedule by ID
export function useSchedule(scheduleId: string, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.detail(scheduleId),
    queryFn: async (): Promise<Schedule> => {
      const response = await apiClient.get<Schedule>(
        `/schedules/${scheduleId}`
      );
      return response.data;
    },
    enabled: enabled && !!scheduleId,
  });
}

// Get next runs for a schedule
export function useScheduleNextRuns(
  scheduleId: string,
  count: number = 5,
  enabled = true
) {
  return useQuery({
    queryKey: scheduleKeys.nextRuns(scheduleId),
    queryFn: async (): Promise<ScheduleNextRuns> => {
      const response = await apiClient.get<ScheduleNextRuns>(
        `/schedules/${scheduleId}/next-runs`,
        { params: { count } }
      );
      return response.data;
    },
    enabled: enabled && !!scheduleId,
  });
}

// Create schedule
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleCreateData): Promise<Schedule> => {
      const response = await apiClient.post<Schedule>('/schedules', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

// Update schedule
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      data,
    }: {
      scheduleId: string;
      data: ScheduleUpdateData;
    }): Promise<Schedule> => {
      const response = await apiClient.put<Schedule>(
        `/schedules/${scheduleId}`,
        data
      );
      return response.data;
    },
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      queryClient.invalidateQueries({
        queryKey: scheduleKeys.detail(scheduleId),
      });
    },
  });
}

// Delete schedule
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      scheduleId: string
    ): Promise<{ status: string; schedule_id: string }> => {
      const response = await apiClient.delete<{
        status: string;
        schedule_id: string;
      }>(`/schedules/${scheduleId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

// Toggle schedule active state
export function useToggleSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string): Promise<Schedule> => {
      const response = await apiClient.patch<Schedule>(
        `/schedules/${scheduleId}/toggle`
      );
      return response.data;
    },
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      queryClient.invalidateQueries({
        queryKey: scheduleKeys.detail(scheduleId),
      });
    },
  });
}

// Execute schedule result type
export interface ExecuteScheduleResult {
  status: string;
  schedule_id: string;
  generation_id: string;
}

// Execute schedule immediately
export function useExecuteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string): Promise<ExecuteScheduleResult> => {
      const response = await apiClient.post<ExecuteScheduleResult>(
        `/schedules/${scheduleId}/execute`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

// Validate CRON expression
export function useValidateCron() {
  return useMutation({
    mutationFn: async (expression: string): Promise<CronValidation> => {
      const response = await apiClient.post<CronValidation>(
        '/schedules/validate-cron',
        null,
        { params: { expression } }
      );
      return response.data;
    },
  });
}
