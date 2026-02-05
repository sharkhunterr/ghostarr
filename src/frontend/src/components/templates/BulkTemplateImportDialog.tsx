/**
 * Bulk template import dialog.
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, FileJson, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useImportTemplatesBulk, type BulkTemplateExportData, type BulkTemplateImportResult } from '@/api/templates';

interface BulkTemplateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkTemplateImportDialog({ open, onOpenChange, onSuccess }: BulkTemplateImportDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTemplates = useImportTemplatesBulk();

  const [parsedData, setParsedData] = useState<BulkTemplateExportData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkTemplateImportResult | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setParsedData(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as BulkTemplateExportData;

        // Validate it has templates
        if (!parsed.templates || !Array.isArray(parsed.templates) || parsed.templates.length === 0) {
          setParseError(t('templates.bulk.errors.noTemplates'));
          return;
        }

        setParsedData(parsed);
      } catch {
        setParseError(t('templates.bulk.errors.parseError'));
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setIsImporting(true);
    try {
      const result = await importTemplates.mutateAsync(parsedData);
      setImportResult(result);

      if (result.count > 0) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to import templates:', error);
      setImportResult({
        imported: [],
        skipped: [],
        errors: [String(error)],
        count: 0,
        templates: [],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedData(null);
    setParseError(null);
    setFileName(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('templates.bulk.importTitle')}</DialogTitle>
          <DialogDescription>
            {t('templates.bulk.importDescription')}
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
              id="bulk-template-input"
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

          {/* Preview */}
          {parsedData && !importResult && (
            <>
              {/* File info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {parsedData.version && <Badge variant="outline">v{parsedData.version}</Badge>}
                {parsedData.exportedAt && (
                  <span>{new Date(parsedData.exportedAt).toLocaleDateString()}</span>
                )}
                <Badge>{parsedData.templates.length} {t('templates.bulk.templates')}</Badge>
              </div>

              {/* Template list preview */}
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-1">
                  {parsedData.templates.map((template, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{template.name}</span>
                      {template.labels && template.labels.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {template.labels.length} labels
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Import results */}
          {importResult && (
            <div className="space-y-3">
              <div className="font-medium">{t('templates.bulk.results.title')}</div>

              {importResult.count > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{t('templates.bulk.results.imported', { count: importResult.count })}</span>
                </div>
              )}

              {importResult.skipped.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t('templates.bulk.results.skipped')}:</span>
                  <ul className="list-disc list-inside mt-1">
                    {importResult.skipped.slice(0, 5).map((name, i) => (
                      <li key={i} className="truncate">{name}</li>
                    ))}
                    {importResult.skipped.length > 5 && (
                      <li>...{importResult.skipped.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">{t('templates.bulk.results.errors')}</div>
                    <ul className="text-xs list-disc list-inside">
                      {importResult.errors.slice(0, 3).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {importResult.errors.length > 3 && (
                        <li>...{importResult.errors.length - 3} more</li>
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
            {importResult ? t('common.close') : t('common.cancel')}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={isImporting || !parsedData}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {t('templates.bulk.import')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
