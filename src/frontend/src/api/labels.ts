/**
 * Labels API hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { templateKeys } from './templates';
import type { Label, Template } from '../types';

// Query keys
export const labelKeys = {
  all: ['labels'] as const,
  lists: () => [...labelKeys.all, 'list'] as const,
  detail: (id: string) => [...labelKeys.all, 'detail', id] as const,
};

// Types
export interface LabelCreate {
  name: string;
  color: string;
}

export interface LabelUpdate {
  name?: string;
  color?: string;
}

export interface TemplateLabelAssignment {
  label_ids: string[];
}

// List all labels
export function useLabels() {
  return useQuery({
    queryKey: labelKeys.lists(),
    queryFn: async (): Promise<Label[]> => {
      const response = await apiClient.get<Label[]>('/labels');
      return response.data;
    },
  });
}

// Get label by ID
export function useLabel(labelId: string, enabled = true) {
  return useQuery({
    queryKey: labelKeys.detail(labelId),
    queryFn: async (): Promise<Label> => {
      const response = await apiClient.get<Label>(`/labels/${labelId}`);
      return response.data;
    },
    enabled: enabled && !!labelId,
  });
}

// Create label
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabelCreate): Promise<Label> => {
      const response = await apiClient.post<Label>('/labels', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all });
    },
  });
}

// Update label
export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      labelId,
      data,
    }: {
      labelId: string;
      data: LabelUpdate;
    }): Promise<Label> => {
      const response = await apiClient.put<Label>(`/labels/${labelId}`, data);
      return response.data;
    },
    onSuccess: (_, { labelId }) => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all });
      queryClient.invalidateQueries({ queryKey: labelKeys.detail(labelId) });
      // Also refresh templates since they display labels
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

// Delete label
export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      labelId: string
    ): Promise<{ status: string; label_id: string }> => {
      const response = await apiClient.delete<{
        status: string;
        label_id: string;
      }>(`/labels/${labelId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all });
      // Also refresh templates since they display labels
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

// Assign labels to a template
export function useAssignLabelsToTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      labelIds,
    }: {
      templateId: string;
      labelIds: string[];
    }): Promise<Template> => {
      const response = await apiClient.post<Template>(
        `/labels/templates/${templateId}/labels`,
        { label_ids: labelIds }
      );
      return response.data;
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({
        queryKey: templateKeys.detail(templateId),
      });
    },
  });
}

// Get labels for a template
export function useTemplateLabels(templateId: string, enabled = true) {
  return useQuery({
    queryKey: [...templateKeys.detail(templateId), 'labels'] as const,
    queryFn: async (): Promise<Label[]> => {
      const response = await apiClient.get<Label[]>(
        `/labels/templates/${templateId}/labels`
      );
      return response.data;
    },
    enabled: enabled && !!templateId,
  });
}
