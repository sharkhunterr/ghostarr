import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "./client";
import type {
  ServiceConfig,
  ServiceConfigResponse,
  ServiceTestResult,
  AllServicesStatus,
  PreferencesUpdate,
  PreferencesResponse,
  RetentionSettings,
  DeletionLoggingSettings,
} from "@/types";

const SERVICES_KEY = ["services"];
const PREFERENCES_KEY = ["preferences"];
const RETENTION_KEY = ["retention"];
const DELETION_LOGGING_KEY = ["deletion-logging"];

// Services
export function useServices() {
  return useQuery({
    queryKey: SERVICES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, ServiceConfigResponse>>(
        "/settings/services"
      );
      return data;
    },
  });
}

export function useServiceConfig(service: string) {
  return useQuery({
    queryKey: [...SERVICES_KEY, service],
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceConfigResponse>(
        `/settings/services/${service}`
      );
      return data;
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      service,
      config,
    }: {
      service: string;
      config: ServiceConfig;
    }) => {
      const { data } = await apiClient.put<ServiceConfigResponse>(
        `/settings/services/${service}`,
        config
      );
      return data;
    },
    onSuccess: (_, { service }) => {
      queryClient.invalidateQueries({ queryKey: SERVICES_KEY });
      queryClient.invalidateQueries({ queryKey: [...SERVICES_KEY, service] });
    },
  });
}

export function useTestService() {
  return useMutation({
    mutationFn: async (service: string) => {
      const { data } = await apiClient.post<ServiceTestResult>(
        `/settings/services/${service}/test`
      );
      return data;
    },
  });
}

export function useTestAllServices() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<AllServicesStatus>(
        "/settings/services/test-all"
      );
      return data;
    },
  });
}

// Preferences
export function usePreferences() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<PreferencesResponse>(
        "/settings/preferences"
      );
      return data;
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: PreferencesUpdate) => {
      const { data } = await apiClient.put<PreferencesResponse>(
        "/settings/preferences",
        update
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
    },
  });
}

// Retention
export function useRetentionSettings() {
  return useQuery({
    queryKey: RETENTION_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<RetentionSettings>(
        "/settings/retention"
      );
      return data;
    },
  });
}

export function useUpdateRetentionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: RetentionSettings) => {
      const { data } = await apiClient.put<RetentionSettings>(
        "/settings/retention",
        settings
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RETENTION_KEY });
    },
  });
}

// Deletion Logging
export function useDeletionLoggingSettings() {
  return useQuery({
    queryKey: DELETION_LOGGING_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<DeletionLoggingSettings>(
        "/settings/deletion-logging"
      );
      return data;
    },
  });
}

export function useUpdateDeletionLoggingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: DeletionLoggingSettings) => {
      const { data } = await apiClient.put<DeletionLoggingSettings>(
        "/settings/deletion-logging",
        settings
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DELETION_LOGGING_KEY });
    },
  });
}

// Export services with decrypted credentials
export interface ServiceExport {
  url: string;
  api_key: string | null;
  username?: string;
  password?: string | null;
}

export function useExportServices() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<Record<string, ServiceExport>>(
        "/settings/services/export"
      );
      return data;
    },
  });
}

// Import services
export function useImportServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (services: Record<string, ServiceExport>) => {
      const { data } = await apiClient.put<{ imported: string[]; count: number }>(
        "/settings/services/import",
        services
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_KEY });
    },
  });
}

// Backup options
export interface BackupOptions {
  include_services: boolean;
  include_preferences: boolean;
  include_retention: boolean;
  include_deletion_logging: boolean;
  include_templates: boolean;
  include_schedules: boolean;
  include_labels: boolean;
}

// Backup data structure
export interface BackupData {
  version: string;
  exportedAt: string;
  type?: string;
  services?: Record<string, ServiceExport>;
  preferences?: PreferencesResponse;
  retention?: RetentionSettings;
  deletionLogging?: DeletionLoggingSettings;
  templates?: Array<{
    name: string;
    description?: string | null;
    html: string;
    labels: string[];
    preset_config: Record<string, unknown>;
    is_default?: boolean;
  }>;
  schedules?: Array<{
    name: string;
    schedule_type: string;
    cron_expression: string;
    timezone: string;
    is_active: boolean;
    template_name?: string;
    generation_config?: Record<string, unknown> | null;
    deletion_config?: Record<string, unknown> | null;
  }>;
  labels?: Array<{
    name: string;
    color: string;
  }>;
}

// Restore result
export interface RestoreResult {
  services_restored: number;
  preferences_restored: boolean;
  retention_restored: boolean;
  deletion_logging_restored: boolean;
  templates_restored: number;
  templates_skipped: number;
  schedules_restored: number;
  schedules_skipped: number;
  labels_restored: number;
  labels_skipped: number;
  errors: string[];
}

// Create backup
export function useCreateBackup() {
  return useMutation({
    mutationFn: async (options: BackupOptions) => {
      const { data } = await apiClient.post<BackupData>(
        "/settings/backup",
        options
      );
      return data;
    },
  });
}

// Restore backup
export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (backupData: BackupData) => {
      const { data } = await apiClient.post<RestoreResult>(
        "/settings/restore",
        backupData
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: SERVICES_KEY });
      queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
      queryClient.invalidateQueries({ queryKey: RETENTION_KEY });
      queryClient.invalidateQueries({ queryKey: DELETION_LOGGING_KEY });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });
}
