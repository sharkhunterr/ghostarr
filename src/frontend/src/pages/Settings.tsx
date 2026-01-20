import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ServiceCard, GeneralSettings, LogViewer } from "@/components/settings";
import {
  useServices,
  useUpdateService,
  useTestService,
} from "@/api/settings";
import type { ServiceTestResult } from "@/types";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    id: "tautulli",
    nameKey: "settings.services.tautulli.name",
    descKey: "settings.services.tautulli.description",
  },
  {
    id: "tmdb",
    nameKey: "settings.services.tmdb.name",
    descKey: "settings.services.tmdb.description",
  },
  {
    id: "ghost",
    nameKey: "settings.services.ghost.name",
    descKey: "settings.services.ghost.description",
  },
  {
    id: "romm",
    nameKey: "settings.services.romm.name",
    descKey: "settings.services.romm.description",
  },
  {
    id: "komga",
    nameKey: "settings.services.komga.name",
    descKey: "settings.services.komga.description",
  },
  {
    id: "audiobookshelf",
    nameKey: "settings.services.audiobookshelf.name",
    descKey: "settings.services.audiobookshelf.description",
  },
  {
    id: "tunarr",
    nameKey: "settings.services.tunarr.name",
    descKey: "settings.services.tunarr.description",
  },
];

type TabId = "general" | "services" | "logs";

export default function Settings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("services");
  const [testResults, setTestResults] = useState<Record<string, ServiceTestResult>>({});
  const [testingService, setTestingService] = useState<string | null>(null);

  const { data: services, isLoading } = useServices();
  const updateService = useUpdateService();
  const testService = useTestService();

  const handleSaveService = async (service: string, url: string, apiKey: string) => {
    await updateService.mutateAsync({
      service,
      config: { url, api_key: apiKey || undefined },
    });
  };

  const handleTestService = async (service: string) => {
    setTestingService(service);
    try {
      const result = await testService.mutateAsync(service);
      setTestResults((prev) => ({ ...prev, [service]: result }));
    } finally {
      setTestingService(null);
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: t("settings.tabs.general") },
    { id: "services", label: t("settings.tabs.services") },
    { id: "logs", label: t("settings.tabs.logs") },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs - Compact pill style */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "general" && <GeneralSettings />}

      {activeTab === "services" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {t("settings.services.title")}
          </p>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {SERVICES.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service.id}
                  name={t(service.nameKey)}
                  description={t(service.descKey)}
                  config={services?.[service.id]}
                  testResult={testResults[service.id]}
                  isTesting={testingService === service.id}
                  onSave={(url, apiKey) => handleSaveService(service.id, url, apiKey)}
                  onTest={() => handleTestService(service.id)}
                  isSaving={
                    updateService.isPending &&
                    updateService.variables?.service === service.id
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && <LogViewer />}
    </div>
  );
}
