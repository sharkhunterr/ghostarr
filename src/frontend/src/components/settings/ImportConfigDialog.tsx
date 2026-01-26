/**
 * Import configuration dialog with preview and selectable options.
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, Shield, AlertTriangle, FileJson, CheckCircle, XCircle } from 'lucide-react';
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
  useUpdatePreferences,
  useUpdateRetentionSettings,
  useUpdateDeletionLoggingSettings,
  useImportServices,
  type ServiceExport,
} from '@/api/settings';
import type { PreferencesResponse, RetentionSettings, DeletionLoggingSettings } from '@/types';

interface ImportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedConfig {
  version?: string;
  exportedAt?: string;
  preferences?: PreferencesResponse;
  retention?: RetentionSettings;
  deletionLogging?: DeletionLoggingSettings;
  services?: Record<string, ServiceExport>;
}

export function ImportConfigDialog({ open, onOpenChange, onSuccess }: ImportConfigDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedConfig, setParsedConfig] = useState<ParsedConfig | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [importPreferences, setImportPreferences] = useState(true);
  const [importRetention, setImportRetention] = useState(true);
  const [importDeletionLogging, setImportDeletionLogging] = useState(true);
  const [importServices, setImportServices] = useState(true);

  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    preferences?: boolean;
    retention?: boolean;
    deletionLogging?: boolean;
    services?: { count: number; names: string[] };
  } | null>(null);

  const updatePreferences = useUpdatePreferences();
  const updateRetention = useUpdateRetentionSettings();
  const updateDeletionLogging = useUpdateDeletionLoggingSettings();
  const importServicesMutation = useImportServices();

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
        const parsed = JSON.parse(content) as ParsedConfig;

        // Validate it's a Ghostarr config
        if (!parsed.version && !parsed.preferences && !parsed.retention && !parsed.services) {
          setParseError(t('settings.import.errors.invalidFormat'));
          return;
        }

        setParsedConfig(parsed);

        // Auto-select available sections
        setImportPreferences(!!parsed.preferences);
        setImportRetention(!!parsed.retention);
        setImportDeletionLogging(!!parsed.deletionLogging);
        setImportServices(!!parsed.services && Object.keys(parsed.services).length > 0);
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
    const results: typeof importResults = {};

    try {
      // Import preferences
      if (importPreferences && parsedConfig.preferences) {
        try {
          await updatePreferences.mutateAsync(parsedConfig.preferences);
          results.preferences = true;
        } catch {
          results.preferences = false;
        }
      }

      // Import retention
      if (importRetention && parsedConfig.retention) {
        try {
          await updateRetention.mutateAsync(parsedConfig.retention);
          results.retention = true;
        } catch {
          results.retention = false;
        }
      }

      // Import deletion logging
      if (importDeletionLogging && parsedConfig.deletionLogging) {
        try {
          await updateDeletionLogging.mutateAsync(parsedConfig.deletionLogging);
          results.deletionLogging = true;
        } catch {
          results.deletionLogging = false;
        }
      }

      // Import services
      if (importServices && parsedConfig.services) {
        try {
          const result = await importServicesMutation.mutateAsync(parsedConfig.services);
          results.services = { count: result.count, names: result.imported };
        } catch {
          results.services = { count: 0, names: [] };
        }
      }

      setImportResults(results);

      // Check if all imports succeeded
      const allSucceeded =
        (results.preferences === undefined || results.preferences) &&
        (results.retention === undefined || results.retention) &&
        (results.deletionLogging === undefined || results.deletionLogging) &&
        (results.services === undefined || results.services.count > 0 || !parsedConfig.services);

      if (allSucceeded) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to import config:', error);
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
    (parsedConfig.services && Object.keys(parsedConfig.services).length > 0)
  );

  const nothingSelected = !importPreferences && !importRetention && !importDeletionLogging && !importServices;

  const getServiceCount = () => {
    if (!parsedConfig?.services) return 0;
    return Object.keys(parsedConfig.services).filter(
      key => parsedConfig.services![key].url || parsedConfig.services![key].api_key
    ).length;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.import.title')}</DialogTitle>
          <DialogDescription>
            {t('settings.import.description')}
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
              <div className="font-medium">{t('settings.import.results.title')}</div>

              {importResults.preferences !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {importResults.preferences ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{t('settings.import.options.preferences')}</span>
                </div>
              )}

              {importResults.retention !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {importResults.retention ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{t('settings.import.options.retention')}</span>
                </div>
              )}

              {importResults.deletionLogging !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {importResults.deletionLogging ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{t('settings.import.options.deletionLogging')}</span>
                </div>
              )}

              {importResults.services !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {importResults.services.count > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>
                    {t('settings.import.results.services', { count: importResults.services.count })}
                  </span>
                </div>
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
              {t('settings.general.import')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
