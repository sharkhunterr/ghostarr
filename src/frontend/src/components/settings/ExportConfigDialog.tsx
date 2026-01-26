/**
 * Export configuration dialog with selectable options.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Shield, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  usePreferences,
  useRetentionSettings,
  useDeletionLoggingSettings,
  useExportServices,
} from '@/api/settings';

interface ExportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportConfigDialog({ open, onOpenChange }: ExportConfigDialogProps) {
  const { t } = useTranslation();
  const [exportPreferences, setExportPreferences] = useState(true);
  const [exportRetention, setExportRetention] = useState(true);
  const [exportDeletionLogging, setExportDeletionLogging] = useState(true);
  const [exportServices, setExportServices] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { data: preferences } = usePreferences();
  const { data: retention } = useRetentionSettings();
  const { data: deletionLogging } = useDeletionLoggingSettings();
  const exportServicesMutation = useExportServices();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const config: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        version: '2.0',
      };

      if (exportPreferences && preferences) {
        config.preferences = preferences;
      }

      if (exportRetention && retention) {
        config.retention = retention;
      }

      if (exportDeletionLogging && deletionLogging) {
        config.deletionLogging = deletionLogging;
      }

      if (exportServices) {
        const services = await exportServicesMutation.mutateAsync();
        // Only include services that have configuration
        const configuredServices: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(services)) {
          if (value.url || value.api_key) {
            configuredServices[key] = value;
          }
        }
        if (Object.keys(configuredServices).length > 0) {
          config.services = configuredServices;
        }
      }

      // Download the file
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghostarr-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to export config:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const nothingSelected = !exportPreferences && !exportRetention && !exportDeletionLogging && !exportServices;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.export.title')}</DialogTitle>
          <DialogDescription>
            {t('settings.export.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preferences */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-preferences"
              checked={exportPreferences}
              onCheckedChange={(checked) => setExportPreferences(checked === true)}
            />
            <Label htmlFor="export-preferences" className="flex-1 cursor-pointer">
              <div className="font-medium">{t('settings.export.options.preferences')}</div>
              <div className="text-sm text-muted-foreground">
                {t('settings.export.options.preferencesDesc')}
              </div>
            </Label>
          </div>

          {/* Retention */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-retention"
              checked={exportRetention}
              onCheckedChange={(checked) => setExportRetention(checked === true)}
            />
            <Label htmlFor="export-retention" className="flex-1 cursor-pointer">
              <div className="font-medium">{t('settings.export.options.retention')}</div>
              <div className="text-sm text-muted-foreground">
                {t('settings.export.options.retentionDesc')}
              </div>
            </Label>
          </div>

          {/* Deletion Logging */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-deletion-logging"
              checked={exportDeletionLogging}
              onCheckedChange={(checked) => setExportDeletionLogging(checked === true)}
            />
            <Label htmlFor="export-deletion-logging" className="flex-1 cursor-pointer">
              <div className="font-medium">{t('settings.export.options.deletionLogging')}</div>
              <div className="text-sm text-muted-foreground">
                {t('settings.export.options.deletionLoggingDesc')}
              </div>
            </Label>
          </div>

          {/* Services */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-services"
              checked={exportServices}
              onCheckedChange={(checked) => setExportServices(checked === true)}
            />
            <Label htmlFor="export-services" className="flex-1 cursor-pointer">
              <div className="font-medium flex items-center gap-2">
                {t('settings.export.options.services')}
                <Shield className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="text-sm text-muted-foreground">
                {t('settings.export.options.servicesDesc')}
              </div>
            </Label>
          </div>

          {/* Warning for services export */}
          {exportServices && (
            <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('settings.export.servicesWarning')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isExporting || nothingSelected}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t('settings.general.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
