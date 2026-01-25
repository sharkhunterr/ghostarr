export type UUID = string;

export interface Label {
  id: UUID;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: UUID;
  name: string;
  description: string | null;
  tags: string[];
  labels: Label[];
  file_path: string;
  preset_config: GenerationConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: UUID;
  name: string;
  is_active: boolean;
  cron_expression: string;
  timezone: string;
  template_id: UUID;
  template?: Template;
  generation_config: GenerationConfig;
  last_run_at: string | null;
  last_run_status: RunStatus | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RunStatus = "pending" | "success" | "failed" | "skipped";

export interface History {
  id: UUID;
  type: GenerationType;
  schedule_id: UUID | null;
  schedule?: Schedule;
  template_id: UUID;
  template?: Template;
  status: GenerationStatus;
  ghost_post_id: string | null;
  ghost_post_url: string | null;
  generation_config: GenerationConfig;
  progress_log: ProgressStep[];
  error_message: string | null;
  items_count: number;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type GenerationType = "manual" | "automatic";
export type GenerationStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface ProgressStep {
  step: string;
  status: ProgressStepStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  items_count?: number;
  message: string;
  error?: string;
}

export type ProgressStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface Log {
  id: UUID;
  level: LogLevel;
  source: LogSource;
  service: string | null;
  message: string;
  context: Record<string, unknown> | null;
  correlation_id: string | null;
  created_at: string;
}

export type LogLevel = "debug" | "info" | "warning" | "error";
export type LogSource = "backend" | "frontend" | "integration";

export interface UserPreference {
  id: UUID;
  user_id: string;
  theme: Theme;
  language: Language;
  timezone: string;
}

export type Theme = "light" | "dark" | "system";
export type Language = "fr" | "en" | "de" | "it" | "es";

export type PublicationMode = "draft" | "publish" | "email" | "email+publish";
export type MaintenanceType = "scheduled" | "outage" | "network" | "update" | "improvement" | "security";

export interface ContentSourceConfig {
  enabled: boolean;
  days: number;
  max_items: number;
}

export interface TautulliConfig extends ContentSourceConfig {
  featured_item: boolean;
}

export interface TunarrConfig extends ContentSourceConfig {
  channels: string[];
  display_format: "grid" | "list";
}

export interface StatisticsConfig {
  enabled: boolean;
  days: number;
  include_comparison: boolean;
}

export interface MaintenanceConfig {
  enabled: boolean;
  description: string;
  type: MaintenanceType;
  duration_value: number;
  duration_unit: "hours" | "days" | "weeks";
  start_datetime: string | null;
}

export interface GenerationConfig {
  template_id: UUID;
  title: string;
  publication_mode: PublicationMode;
  ghost_newsletter_id: string | null;
  tautulli: TautulliConfig;
  romm: ContentSourceConfig;
  komga: ContentSourceConfig;
  audiobookshelf: ContentSourceConfig;
  tunarr: TunarrConfig;
  statistics: StatisticsConfig;
  maintenance: MaintenanceConfig;
  max_total_items: number;
  skip_if_empty: boolean;
}
