/**
 * Import configuration dialog with preview and selectable options (full backup restore).
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, Shield, AlertTriangle, FileJson, CheckCircle, XCircle, FileText, Calendar, Tag } from 'lucide-react';
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
import {
  useRestoreBackup,
  type BackupData,
  type RestoreResult,
} from '@/api/settings';

interface ImportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportConfigDialog({ open, onOpenChange, onSuccess }: ImportConfigDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedConfig, setParsedConfig] = useState<BackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [importPreferences, setImportPreferences] = useState(true);
  const [importRetention, setImportRetention] = useState(true);
  const [importDeletionLogging, setImportDeletionLogging] = useState(true);
  const [importServices, setImportServices] = useState(true);
  const [importTemplates, setImportTemplates] = useState(true);
  const [importSchedules, setImportSchedules] = useState(true);
  const [importLabels, setImportLabels] = useState(true);

  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<RestoreResult | null>(null);

  const restoreBackup = useRestoreBackup();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setParsedConfig(null);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as BackupData;

        // Validate it's a Ghostarr backup
        if (!parsed.version && !parsed.preferences && !parsed.retention && !parsed.services && !parsed.templates) {
          setParseError(t('settings.import.errors.invalidFormat'));
          return;
        }

        setParsedConfig(parsed);

        // Auto-select available sections
        setImportPreferences(!!parsed.preferences);
        setImportRetention(!!parsed.retention);
        setImportDeletionLogging(!!parsed.deletionLogging);
        setImportServices(!!parsed.services && Object.keys(parsed.services).length > 0);
        setImportTemplates(!!parsed.templates && parsed.templates.length > 0);
        setImportSchedules(!!parsed.schedules && parsed.schedules.length > 0);
        setImportLabels(!!parsed.labels && parsed.labels.length > 0);
      } catch {
        setParseError(t('settings.import.errors.parseError'));
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedConfig) return;

    setIsImporting(true);
    setImportResults(null);

    try {
      // Build backup data to restore based on selections
      const dataToRestore: BackupData = {
        version: parsedConfig.version,
        exportedAt: parsedConfig.exportedAt,
      };

      if (importPreferences && parsedConfig.preferences) {
        dataToRestore.preferences = parsedConfig.preferences;
      }
      if (importRetention && parsedConfig.retention) {
        dataToRestore.retention = parsedConfig.retention;
      }
      if (importDeletionLogging && parsedConfig.deletionLogging) {
        dataToRestore.deletionLogging = parsedConfig.deletionLogging;
      }
      if (importServices && parsedConfig.services) {
        dataToRestore.services = parsedConfig.services;
      }
      if (importLabels && parsedConfig.labels) {
        dataToRestore.labels = parsedConfig.labels;
      }
      if (importTemplates && parsedConfig.templates) {
        dataToRestore.templates = parsedConfig.templates;
      }
      if (importSchedules && parsedConfig.schedules) {
        dataToRestore.schedules = parsedConfig.schedules;
      }

      const result = await restoreBackup.mutateAsync(dataToRestore);
      setImportResults(result);

      // Check if restore was successful
      if (result.errors.length === 0) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setImportResults({
        services_restored: 0,
        preferences_restored: false,
        retention_restored: false,
        deletion_logging_restored: false,
        templates_restored: 0,
        templates_skipped: 0,
        schedules_restored: 0,
        schedules_skipped: 0,
        labels_restored: 0,
        labels_skipped: 0,
        errors: [String(error)],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedConfig(null);
    setParseError(null);
    setFileName(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const hasAnySectionToImport = parsedConfig && (
    parsedConfig.preferences ||
    parsedConfig.retention ||
    parsedConfig.deletionLogging ||
    (parsedConfig.services && Object.keys(parsedConfig.services).length > 0) ||
    (parsedConfig.templates && parsedConfig.templates.length > 0) ||
    (parsedConfig.schedules && parsedConfig.schedules.length > 0) ||
    (parsedConfig.labels && parsedConfig.labels.length > 0)
  );

  const nothingSelected = !importPreferences && !importRetention && !importDeletionLogging &&
    !importServices && !importTemplates && !importSchedules && !importLabels;

  const getServiceCount = () => {
    if (!parsedConfig?.services) return 0;
    return Object.keys(parsedConfig.services).filter(
      key => parsedConfig.services![key].url || parsedConfig.services![key].api_key
    ).length;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.importTitle')}</DialogTitle>
          <DialogDescription>
            {t('settings.backup.importDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              id="config-file-input"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <FileJson className="h-4 w-4 mr-2" />
              {fileName || t('settings.import.selectFile')}
            </Button>
          </div>

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview and options */}
          {parsedConfig && !importResults && (
            <>
              {/* File info */}
              {parsedConfig.version && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">v{parsedConfig.version}</Badge>
                  {parsedConfig.exportedAt && (
                    <span>{new Date(parsedConfig.exportedAt).toLocaleDateString()}</span>
                  )}
                  {parsedConfig.type === 'full_backup' && (
                    <Badge>{t('settings.backup.fullBackup')}</Badge>
                  )}
                </div>
              )}

              {/* Settings Section */}
              {(parsedConfig.preferences || parsedConfig.retention || parsedConfig.deletionLogging || parsedConfig.services) && (
                <div className="text-sm font-medium text-muted-foreground mt-2">
                  {t('settings.backup.sections.settings')}
                </div>
              )}

              {/* Preferences */}
              {parsedConfig.preferences && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="import-preferences"
                    checked={importPreferences}
                    onCheckedChange={(checked) => setImportPreferences(checked === true)}
                  />
                  <Label htmlFor="import-preferences" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t('settings.import.options.preferences')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('settings.import.options.preferencesDesc')}
                    </div>
                  </Label>
                </div>
              )}

              {/* Retention */}
              {parsedConfig.retention && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="import-retention"
                    checked={importRetention}
                    onCheckedChange={(checked) => setImportRetention(checked === true)}
                  />
                  <Label htmlFor="import-retention" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t('settings.import.options.retention')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('settings.import.options.retentionDesc')}
                    </div>
                  </Label>
                </div>
              )}

              {/* Deletion Logging */}
              {parsedConfig.deletionLogging && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="import-deletion-logging"
                    checked={importDeletionLogging}
                    onCheckedChange={(checked) => setImportDeletionLogging(checked === true)}
                  />
                  <Label htmlFor="import-deletion-logging" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t('settings.import.options.deletionLogging')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('settings.import.options.deletionLoggingDesc')}
                    </div>
                  </Label>
                </div>
              )}

              {/* Services */}
              {parsedConfig.services && getServiceCount() > 0 && (
                <>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="import-services"
                      checked={importServices}
                      onCheckedChange={(checked) => setImportServices(checked === true)}
                    />
                    <Label htmlFor="import-services" className="flex-1 cursor-pointer">
                      <div className="font-medium flex items-center gap-2">
                        {t('settings.import.options.services')}
                        <Shield className="h-4 w-4 text-yellow-500" />
                        <Badge variant="secondary">{getServiceCount()}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('settings.import.options.servicesDesc')}
                      </div>
                    </Label>
                  </div>

                  {importServices && (
                    <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {t('settings.import.servicesWarning')}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* Data Section */}
              {(parsedConfig.templates || parsedConfig.schedules || parsedConfig.labels) && (
                <div className="text-sm font-medium text-muted-foreground mt-4 pt-4 border-t">
                  {t('settings.backup.sections.data')}
                </div>
              )}

              {/* Labels */}
              {parsedConfig.labels && parsedConfig.labels.length > 0 && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="import-labels"
                    checked={importLabels}
                    onCheckedChange={(checked) => setImportLabels(checked === true)}
                  />
                  <Label htmlFor="import-labels" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      {t('settings.backup.options.labels')}
                      <Badge variant="secondary">{parsedConfig.labels.length}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('settings.backup.options.labelsDesc')}
                    </div>
                  </Label>
                </div>
              )}

              {/* Templates */}
              {parsedConfig.templates && parsedConfig.templates.length > 0 && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="import-templates"
                    checked={importTemplates}
                    onCheckedChange={(checked) => setImportTemplates(checked === true)}
                  />
                  <Label htmlFor="import-templates" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t('settings.backup.options.templates')}
                      <Badge variant="secondary">{parsedConfig.templates.length}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('settings.backup.options.templatesDesc')}
                    </div>
                  </Label>
                </div>
              )}

              {/* Schedules */}
              {parsedConfig.schedules && parsedConfig.schedules.length > 0 && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="import-schedules"
                    checked={importSchedules}
                    onCheckedChange={(checked) => setImportSchedules(checked === true)}
                  />
                  <Label htmlFor="import-schedules" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {t('settings.backup.options.schedules')}
                      <Badge variant="secondary">{parsedConfig.schedules.length}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('settings.backup.options.schedulesDesc')}
                    </div>
                  </Label>
                </div>
              )}

              {/* No importable data */}
              {!hasAnySectionToImport && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('settings.import.errors.noData')}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Import results */}
          {importResults && (
            <div className="space-y-2">
              <div className="font-medium">{t('settings.backup.results.title')}</div>

              {importResults.preferences_restored && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{t('settings.import.options.preferences')}</span>
                </div>
              )}

              {importResults.retention_restored && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{t('settings.import.options.retention')}</span>
                </div>
              )}

              {importResults.deletion_logging_restored && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{t('settings.import.options.deletionLogging')}</span>
                </div>
              )}

              {importResults.services_restored > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    {t('settings.backup.results.services', { count: importResults.services_restored })}
                  </span>
                </div>
              )}

              {importResults.labels_restored > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    {t('settings.backup.results.labels', { count: importResults.labels_restored })}
                    {importResults.labels_skipped > 0 && (
                      <span className="text-muted-foreground">
                        {' '}({t('settings.backup.results.skipped', { count: importResults.labels_skipped })})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {importResults.templates_restored > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    {t('settings.backup.results.templates', { count: importResults.templates_restored })}
                    {importResults.templates_skipped > 0 && (
                      <span className="text-muted-foreground">
                        {' '}({t('settings.backup.results.skipped', { count: importResults.templates_skipped })})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {importResults.schedules_restored > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    {t('settings.backup.results.schedules', { count: importResults.schedules_restored })}
                    {importResults.schedules_skipped > 0 && (
                      <span className="text-muted-foreground">
                        {' '}({t('settings.backup.results.skipped', { count: importResults.schedules_skipped })})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {importResults.errors.length > 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">{t('settings.backup.results.errors')}</div>
                    <ul className="text-xs list-disc list-inside">
                      {importResults.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {importResults.errors.length > 5 && (
                        <li>...{t('settings.backup.results.moreErrors', { count: importResults.errors.length - 5 })}</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResults ? t('common.close') : t('common.cancel')}
          </Button>
          {!importResults && (
            <Button
              onClick={handleImport}
              disabled={isImporting || !parsedConfig || !hasAnySectionToImport || nothingSelected}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {t('settings.backup.restore')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
