/**
 * Export configuration dialog with selectable options (full backup).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Shield, AlertTriangle, FileText, Calendar, Tag } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useCreateBackup, type BackupOptions } from '@/api/settings';
import { useTemplates } from '@/api/templates';
import { useSchedules } from '@/api/schedules';
import { useLabels } from '@/api/labels';

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
  const [exportTemplates, setExportTemplates] = useState(true);
  const [exportSchedules, setExportSchedules] = useState(true);
  const [exportLabels, setExportLabels] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { data: templates } = useTemplates();
  const { data: schedules } = useSchedules();
  const { data: labels } = useLabels();
  const createBackup = useCreateBackup();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const options: BackupOptions = {
        include_services: exportServices,
        include_preferences: exportPreferences,
        include_retention: exportRetention,
        include_deletion_logging: exportDeletionLogging,
        include_templates: exportTemplates,
        include_schedules: exportSchedules,
        include_labels: exportLabels,
      };

      const backupData = await createBackup.mutateAsync(options);

      // Download the file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghostarr-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to export config:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const nothingSelected = !exportPreferences && !exportRetention && !exportDeletionLogging &&
    !exportServices && !exportTemplates && !exportSchedules && !exportLabels;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.exportTitle')}</DialogTitle>
          <DialogDescription>
            {t('settings.backup.exportDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Settings Section */}
          <div className="text-sm font-medium text-muted-foreground mb-2">
            {t('settings.backup.sections.settings')}
          </div>

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

          {/* Data Section */}
          <div className="text-sm font-medium text-muted-foreground mb-2 mt-4 pt-4 border-t">
            {t('settings.backup.sections.data')}
          </div>

          {/* Templates */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-templates"
              checked={exportTemplates}
              onCheckedChange={(checked) => setExportTemplates(checked === true)}
            />
            <Label htmlFor="export-templates" className="flex-1 cursor-pointer">
              <div className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('settings.backup.options.templates')}
                {templates && <Badge variant="secondary">{templates.length}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('settings.backup.options.templatesDesc')}
              </div>
            </Label>
          </div>

          {/* Schedules */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-schedules"
              checked={exportSchedules}
              onCheckedChange={(checked) => setExportSchedules(checked === true)}
            />
            <Label htmlFor="export-schedules" className="flex-1 cursor-pointer">
              <div className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('settings.backup.options.schedules')}
                {schedules && <Badge variant="secondary">{schedules.length}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('settings.backup.options.schedulesDesc')}
              </div>
            </Label>
          </div>

          {/* Labels */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="export-labels"
              checked={exportLabels}
              onCheckedChange={(checked) => setExportLabels(checked === true)}
            />
            <Label htmlFor="export-labels" className="flex-1 cursor-pointer">
              <div className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                {t('settings.backup.options.labels')}
                {labels && <Badge variant="secondary">{labels.length}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('settings.backup.options.labelsDesc')}
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
            {t('settings.backup.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
