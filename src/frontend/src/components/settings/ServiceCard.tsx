import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceConfigResponse, ServiceTestResult } from "@/types";

interface ServiceCardProps {
  service: string;
  name: string;
  description: string;
  config: ServiceConfigResponse | undefined;
  testResult?: ServiceTestResult;
  isTesting: boolean;
  onSave: (url: string, apiKey: string, username?: string, password?: string) => void;
  onTest: () => void;
  isSaving: boolean;
}

const URL_PLACEHOLDERS: Record<string, string> = {
  tautulli: "http://192.168.1.x:8181",
  tmdb: "https://api.themoviedb.org",
  ghost: "https://votre-site.ghost.io",
  romm: "http://192.168.1.x:8080",
  komga: "http://192.168.1.x:25600",
  audiobookshelf: "http://192.168.1.x:13378",
  tunarr: "http://192.168.1.x:8000",
};

// Services that have URL help text (keys in translation file)
const SERVICES_WITH_URL_HELP = ["tautulli", "ghost"];

// Services that don't require URL configuration
const SERVICES_WITHOUT_URL = ["tmdb"];

// Services that support username/password authentication
const SERVICES_WITH_BASIC_AUTH = ["romm"];

export function ServiceCard({
  service,
  name,
  description,
  config,
  testResult,
  isTesting,
  onSave,
  onTest,
  isSaving,
}: ServiceCardProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(config?.url || "");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [username, setUsername] = useState(config?.username || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setHasChanges(true);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setHasChanges(true);
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setHasChanges(true);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    // For services without URL, pass empty string
    const urlToSave = SERVICES_WITHOUT_URL.includes(service) ? "" : url;
    if (SERVICES_WITH_BASIC_AUTH.includes(service)) {
      onSave(urlToSave, apiKey, username, password);
    } else {
      onSave(urlToSave, apiKey);
    }
    setHasChanges(false);
    setApiKey("");
    setPassword("");
  };

  const showUrlField = !SERVICES_WITHOUT_URL.includes(service);
  const showBasicAuthFields = SERVICES_WITH_BASIC_AUTH.includes(service);

  const getStatusIcon = () => {
    if (isTesting) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (testResult) {
      return testResult.success ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      );
    }
    if (config?.is_configured) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (isTesting) return t("common.loading");
    if (testResult) {
      return testResult.success
        ? `${t("settings.services.connected")} (${testResult.response_time_ms}ms)`
        : testResult.message;
    }
    if (config?.is_configured) return t("settings.services.connected");
    return t("settings.services.notConfigured");
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span
            className={cn(
              "text-xs",
              testResult?.success || config?.is_configured
                ? "text-green-500"
                : "text-muted-foreground"
            )}
          >
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {showUrlField && (
          <div>
            <label className="text-sm font-medium">
              {t("settings.services.url")}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={URL_PLACEHOLDERS[service] || "http://localhost:8080"}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {SERVICES_WITH_URL_HELP.includes(service) && (
              <p className="mt-1 text-xs text-muted-foreground">{t(`settings.services.urlHelp.${service}`)}</p>
            )}
          </div>
        )}

        {/* Username/Password fields for services with basic auth */}
        {showBasicAuthFields && (
          <>
            <div>
              <label className="text-sm font-medium">
                {t("settings.services.username")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder={config?.username || t("settings.services.usernamePlaceholder")}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {t("settings.services.password")}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder={config?.password_masked || "••••••••"}
                  className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {t("settings.services.basicAuthHelp")}
            </div>
          </>
        )}

        {/* API Key field - shown for all services, optional for services with basic auth */}
        <div>
          <label className="text-sm font-medium">
            {t("settings.services.apiKey")}
            {showBasicAuthFields && (
              <span className="ml-1 text-muted-foreground font-normal">
                ({t("common.optional")})
              </span>
            )}
          </label>
          <div className="relative mt-1">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={config?.api_key_masked || "••••••••"}
              className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium",
            hasChanges
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            t("common.save")
          )}
        </button>
        <button
          onClick={onTest}
          disabled={!config?.is_configured || isTesting}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border",
            config?.is_configured
              ? "hover:bg-accent"
              : "text-muted-foreground cursor-not-allowed"
          )}
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("settings.services.test")}
        </button>
      </div>
    </div>
  );
}
