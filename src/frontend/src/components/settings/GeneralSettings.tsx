/**
 * General settings component for timezone and data retention.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Trash2, Save, Download, Upload, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  usePreferences,
  useUpdatePreferences,
  useRetentionSettings,
  useUpdateRetentionSettings,
  useDeletionLoggingSettings,
  useUpdateDeletionLoggingSettings,
} from '@/api/settings';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { ExportConfigDialog } from './ExportConfigDialog';
import { ImportConfigDialog } from './ImportConfigDialog';

// Common timezones grouped by region
const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST)' },
  { value: 'America/Denver', label: 'America/Denver (MST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'America/Toronto', label: 'America/Toronto (EST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
];

export function GeneralSettings() {
  const { t } = useTranslation();
  const { timezone: storeTimezone, setTimezone: setStoreTimezone } = usePreferencesStore();

  // API hooks
  const { data: preferences, isLoading: prefsLoading } = usePreferences();
  const { data: retention, isLoading: retentionLoading } = useRetentionSettings();
  const { data: deletionLogging, isLoading: deletionLoggingLoading } = useDeletionLoggingSettings();
  const updatePrefs = useUpdatePreferences();
  const updateRetention = useUpdateRetentionSettings();
  const updateDeletionLogging = useUpdateDeletionLoggingSettings();

  // Local state
  const [timezone, setTimezone] = useState(storeTimezone || 'UTC');
  const [historyDays, setHistoryDays] = useState(90);
  const [logsDays, setLogsDays] = useState(30);
  const [logDeletions, setLogDeletions] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Sync with API data
  useEffect(() => {
    if (preferences?.timezone) {
      setTimezone(preferences.timezone);
    }
  }, [preferences]);

  useEffect(() => {
    if (retention) {
      setHistoryDays(retention.history_days);
      setLogsDays(retention.logs_days);
    }
  }, [retention]);

  useEffect(() => {
    if (deletionLogging) {
      setLogDeletions(deletionLogging.log_deletions);
    }
  }, [deletionLogging]);

  const handleSaveTimezone = async () => {
    try {
      await updatePrefs.mutateAsync({ timezone });
      setStoreTimezone(timezone);
    } catch (error) {
      console.error('Failed to save timezone:', error);
    }
  };

  const handleSaveRetention = async () => {
    try {
      await updateRetention.mutateAsync({
        history_days: historyDays,
        logs_days: logsDays,
      });
    } catch (error) {
      console.error('Failed to save retention settings:', error);
    }
  };

  const handleToggleDeletionLogging = async (checked: boolean) => {
    setLogDeletions(checked);
    try {
      await updateDeletionLogging.mutateAsync({
        log_deletions: checked,
      });
    } catch (error) {
      console.error('Failed to save deletion logging settings:', error);
      setLogDeletions(!checked); // Revert on error
    }
  };

  const handleImportSuccess = () => {
    // Refresh local state from API after successful import
    if (preferences?.timezone) {
      setTimezone(preferences.timezone);
      setStoreTimezone(preferences.timezone);
    }
  };

  if (prefsLoading || retentionLoading || deletionLoggingLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timezone */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('settings.general.timezone')}</h2>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Label htmlFor="timezone" className="sr-only">
              {t('settings.general.timezone')}
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder={t('settings.general.timezone')} />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSaveTimezone}
            disabled={updatePrefs.isPending || timezone === preferences?.timezone}
          >
            <Save className="h-4 w-4 mr-2" />
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Data Retention */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('settings.general.retention.title')}</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="historyDays">{t('settings.general.retention.history')}</Label>
              <Input
                id="historyDays"
                type="number"
                min={7}
                max={365}
                value={historyDays}
                onChange={(e) => setHistoryDays(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="logsDays">{t('settings.general.retention.logs')}</Label>
              <Input
                id="logsDays"
                type="number"
                min={7}
                max={365}
                value={logsDays}
                onChange={(e) => setLogsDays(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
          <Button
            onClick={handleSaveRetention}
            disabled={
              updateRetention.isPending ||
              (historyDays === retention?.history_days && logsDays === retention?.logs_days)
            }
          >
            <Save className="h-4 w-4 mr-2" />
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Deletion Logging */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('settings.general.deletionLogging.title')}</h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="log-deletions">{t('settings.general.deletionLogging.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.general.deletionLogging.help')}
            </p>
          </div>
          <Switch
            id="log-deletions"
            checked={logDeletions}
            onCheckedChange={handleToggleDeletionLogging}
            disabled={updateDeletionLogging.isPending}
          />
        </div>
      </div>

      {/* Import/Export */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          {t('settings.general.export')} / {t('settings.general.import')}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t('settings.general.exportImportHelp')}
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            {t('settings.general.export')}
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('settings.general.import')}
          </Button>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportConfigDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      {/* Import Dialog */}
      <ImportConfigDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
