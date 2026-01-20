/**
 * Templates API hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Template, TemplateUpdate } from '../types';

// Query keys
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
  default: () => [...templateKeys.all, 'default'] as const,
  preview: (id: string, viewport?: string) =>
    [...templateKeys.all, 'preview', id, viewport] as const,
};

// Types
export interface TemplateCreateData {
  name: string;
  description?: string;
  tags?: string;
  is_default?: boolean;
  file: File;
}

export interface TemplatePreviewResponse {
  html: string;
  viewport: string;
}

// List all templates
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.lists(),
    queryFn: async (): Promise<Template[]> => {
      const response = await apiClient.get<Template[]>('/templates');
      return response.data;
    },
  });
}

// Get template by ID
export function useTemplate(templateId: string, enabled = true) {
  return useQuery({
    queryKey: templateKeys.detail(templateId),
    queryFn: async (): Promise<Template> => {
      const response = await apiClient.get<Template>(
        `/templates/${templateId}`
      );
      return response.data;
    },
    enabled: enabled && !!templateId,
  });
}

// Get default template
export function useDefaultTemplate() {
  return useQuery({
    queryKey: templateKeys.default(),
    queryFn: async (): Promise<Template> => {
      const response = await apiClient.get<Template>('/templates/default');
      return response.data;
    },
  });
}

// Create template (multipart form upload)
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TemplateCreateData): Promise<Template> => {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.tags) {
        formData.append('tags', data.tags);
      }
      formData.append('is_default', String(data.is_default ?? false));
      formData.append('file', data.file);

      const response = await apiClient.post<Template>('/templates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

// Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      data,
    }: {
      templateId: string;
      data: TemplateUpdate;
    }): Promise<Template> => {
      const response = await apiClient.put<Template>(
        `/templates/${templateId}`,
        data
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

// Delete template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      templateId: string
    ): Promise<{ status: string; template_id: string }> => {
      const response = await apiClient.delete<{
        status: string;
        template_id: string;
      }>(`/templates/${templateId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

// Preview template
export function useTemplatePreview(
  templateId: string,
  viewport: string = 'desktop',
  enabled = true
) {
  return useQuery({
    queryKey: templateKeys.preview(templateId, viewport),
    queryFn: async (): Promise<TemplatePreviewResponse> => {
      const response = await apiClient.get<TemplatePreviewResponse>(
        `/templates/${templateId}/preview`,
        { params: { viewport } }
      );
      return response.data;
    },
    enabled: enabled && !!templateId,
  });
}
