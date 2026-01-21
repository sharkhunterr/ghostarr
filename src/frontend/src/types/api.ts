import type {
  GenerationConfig,
  GenerationStatus,
  GenerationType,
  History,
  Log,
  LogLevel,
  LogSource,
  Schedule,
  Template,
  Theme,
} from "./entities";

// Alias for consistency with backend
export type HistoryEntry = History;

// Pagination
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Error response
export interface ErrorResponse {
  detail: string;
  code: string;
  correlation_id?: string;
  timestamp: string;
}

// Health
export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

// Templates
export interface TemplateCreate {
  name: string;
  description?: string;
  tags?: string[];
  file_path: string;
  preset_config?: Partial<GenerationConfig>;
  is_default?: boolean;
}

export interface TemplateUpdate {
  name?: string;
  description?: string;
  tags?: string[];
  preset_config?: Partial<GenerationConfig>;
  is_default?: boolean;
}

// Schedules
export interface ScheduleCreate {
  name: string;
  cron_expression: string;
  timezone?: string;
  template_id: string;
  generation_config: GenerationConfig;
  is_active?: boolean;
}

export interface ScheduleUpdate {
  name?: string;
  cron_expression?: string;
  timezone?: string;
  template_id?: string;
  generation_config?: GenerationConfig;
  is_active?: boolean;
}

export interface ScheduleNextRuns {
  schedule_id: string;
  cron_expression: string;
  cron_description: string;
  next_runs: string[];
}

// History
export interface HistoryFilter {
  type?: GenerationType;
  status?: GenerationStatus;
  template_id?: string;
  schedule_id?: string;
  start_date?: string;
  end_date?: string;
}

export type HistoryExportFormat = "json" | "csv";

// Generation
export interface GenerationRequest {
  config: GenerationConfig;
}

export interface PreviewRequest {
  config: GenerationConfig;
}

export interface PreviewResponse {
  html: string;
  title: string;
  items_count: number;
}

// Settings - Services
export interface ServiceConfig {
  url?: string;
  api_key?: string;
  username?: string;
  password?: string;
}

export interface ServiceConfigResponse {
  url?: string;
  api_key_masked?: string;
  username?: string;
  password_masked?: string;
  is_configured: boolean;
}

export interface ServiceTestResult {
  service: string;
  success: boolean;
  message: string;
  response_time_ms?: number;
}

export interface AllServicesStatus {
  tautulli?: ServiceTestResult;
  tmdb?: ServiceTestResult;
  ghost?: ServiceTestResult;
  romm?: ServiceTestResult;
  komga?: ServiceTestResult;
  audiobookshelf?: ServiceTestResult;
  tunarr?: ServiceTestResult;
}

// Settings - Preferences
export interface PreferencesUpdate {
  theme?: Theme;
  language?: string;
  timezone?: string;
}

export interface PreferencesResponse {
  theme: Theme;
  language: string;
  timezone: string;
}

// Settings - Retention
export interface RetentionSettings {
  history_days: number;
  logs_days: number;
}

// Logs
export interface LogFilter {
  level?: LogLevel;
  source?: LogSource;
  service?: string;
  start_date?: string;
  end_date?: string;
}

// SSE Progress Events
export interface ProgressEvent {
  type: "generation_started" | "step_start" | "step_complete" | "step_skipped" | "step_error" | "generation_complete" | "generation_cancelled";
  step: string;
  progress: number;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}
