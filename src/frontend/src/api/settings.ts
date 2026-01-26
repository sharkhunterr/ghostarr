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
