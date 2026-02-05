/**
 * Template upload dialog with drag-and-drop support.
 * Supports single template upload (HTML, ZIP, JSON) and bulk import from JSON.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileJson,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useCreateTemplate,
  useImportTemplate,
  useImportTemplatesBulk,
  TemplateExportData,
  BulkTemplateExportData,
  BulkTemplateImportResult,
} from '@/api/templates';
import { cn } from '@/lib/utils';

interface TemplateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportMode = 'none' | 'single' | 'bulk';

export function TemplateUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: TemplateUploadDialogProps) {
  const { t } = useTranslation();
  const createTemplate = useCreateTemplate();
  const importTemplate = useImportTemplate();
  const importTemplatesBulk = useImportTemplatesBulk();

  // Form state for single upload
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Import mode state
  const [importMode, setImportMode] = useState<ImportMode>('none');
  const [jsonData, setJsonData] = useState<TemplateExportData | null>(null);
  const [bulkData, setBulkData] = useState<BulkTemplateExportData | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<BulkTemplateImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setParseError(null);
      setBulkImportResult(null);

      // Check if it's a JSON file
      if (f.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);

            // Check if it's bulk format (has templates array)
            if (parsed.templates && Array.isArray(parsed.templates) && parsed.templates.length > 0) {
              // Validate bulk format
              const bulkExport = parsed as BulkTemplateExportData;
              setBulkData(bulkExport);
              setJsonData(null);
              setImportMode('bulk');
              // Clear single form fields
              setName('');
              setDescription('');
              setTags('');
            } else if (parsed.html && typeof parsed.html === 'string') {
              // Single template JSON format
              const singleExport = parsed as TemplateExportData;
              setJsonData(singleExport);
              setBulkData(null);
              setImportMode('single');
              // Auto-fill from JSON data
              if (singleExport.name) setName(singleExport.name);
              if (singleExport.description) setDescription(singleExport.description);
              if (singleExport.labels && singleExport.labels.length > 0) {
                setTags(singleExport.labels.join(', '));
              }
            } else {
              setParseError(t('templates.bulk.errors.invalidFormat'));
              setJsonData(null);
              setBulkData(null);
              setImportMode('none');
            }
          } catch {
            setParseError(t('templates.bulk.errors.parseError'));
            setJsonData(null);
            setBulkData(null);
            setImportMode('none');
          }
        };
        reader.readAsText(f);
      } else {
        // HTML or ZIP file - standard upload
        setJsonData(null);
        setBulkData(null);
        setImportMode('none');
        // Auto-fill name from filename if empty
        if (!name) {
          const fileName = f.name.replace(/\.(html|htm|zip)$/i, '');
          setName(fileName);
        }
      }
    }
  }, [name, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/html': ['.html', '.htm'],
      'application/zip': ['.zip'],
      'application/json': ['.json'],
    },
    maxFiles: 1,
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setTags('');
    setIsDefault(false);
    setFile(null);
    setJsonData(null);
    setBulkData(null);
    setImportMode('none');
    setBulkImportResult(null);
    setParseError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (importMode === 'bulk' && bulkData) {
        // Bulk import
        const result = await importTemplatesBulk.mutateAsync(bulkData);
        setBulkImportResult(result);
        if (result.count > 0) {
          onSuccess?.();
        }
      } else if (importMode === 'single' && jsonData) {
        // Import from single JSON format
        await importTemplate.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          html: jsonData.html,
          labels: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          preset_config: jsonData.preset_config || {},
        });
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      } else if (file && name.trim()) {
        // Standard upload (HTML/ZIP)
        await createTemplate.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() || undefined,
          is_default: isDefault,
          file,
        });
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to upload template:', error);
      if (importMode === 'bulk') {
        setBulkImportResult({
          imported: [],
          skipped: [],
          errors: [String(error)],
          count: 0,
          templates: [],
        });
      }
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const isValid = importMode === 'bulk'
    ? bulkData !== null && !bulkImportResult
    : name.trim() !== '' && file !== null && (importMode !== 'single' || jsonData !== null);

  const isLoading = createTemplate.isPending || importTemplate.isPending || importTemplatesBulk.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {importMode === 'bulk' ? t('templates.bulk.importTitle') : t('templates.upload')}
            </DialogTitle>
            <DialogDescription>
              {importMode === 'bulk'
                ? t('templates.bulk.importDescription')
                : t('templates.uploadDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dropzone */}
            {!bulkImportResult && (
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50',
                  file && 'border-green-500 bg-green-500/5'
                )}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    {importMode === 'bulk' ? (
                      <FileJson className="h-8 w-8 text-green-500" />
                    ) : (
                      <FileText className="h-8 w-8 text-green-500" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                        {importMode === 'bulk' && bulkData && (
                          <span className="ml-2">
                            • {bulkData.templates.length} {t('templates.bulk.templates')}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setJsonData(null);
                        setBulkData(null);
                        setImportMode('none');
                        setParseError(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {isDragActive
                        ? t('templates.dropHere')
                        : t('templates.dragOrClick')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('templates.acceptedFormats')}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Parse error */}
            {parseError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* Bulk import preview */}
            {importMode === 'bulk' && bulkData && !bulkImportResult && (
              <>
                {/* File info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {bulkData.version && <Badge variant="outline">v{bulkData.version}</Badge>}
                  {bulkData.exportedAt && (
                    <span>{new Date(bulkData.exportedAt).toLocaleDateString()}</span>
                  )}
                  <Badge>{bulkData.templates.length} {t('templates.bulk.templates')}</Badge>
                </div>

                {/* Template list preview */}
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  <div className="space-y-1">
                    {bulkData.templates.map((template, idx) => (
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

            {/* Bulk import results */}
            {bulkImportResult && (
              <div className="space-y-3">
                <div className="font-medium">{t('templates.bulk.results.title')}</div>

                {bulkImportResult.count > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{t('templates.bulk.results.imported', { count: bulkImportResult.count })}</span>
                  </div>
                )}

                {bulkImportResult.skipped.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{t('templates.bulk.results.skipped')}:</span>
                    <ul className="list-disc list-inside mt-1">
                      {bulkImportResult.skipped.slice(0, 5).map((name, i) => (
                        <li key={i} className="truncate">{name}</li>
                      ))}
                      {bulkImportResult.skipped.length > 5 && (
                        <li>...{bulkImportResult.skipped.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {bulkImportResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-1">{t('templates.bulk.results.errors')}</div>
                      <ul className="text-xs list-disc list-inside">
                        {bulkImportResult.errors.slice(0, 3).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {bulkImportResult.errors.length > 3 && (
                          <li>...{bulkImportResult.errors.length - 3} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Single template form fields (only show when not in bulk mode and not showing results) */}
            {importMode !== 'bulk' && !bulkImportResult && (
              <>
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="template-name">{t('templates.form.name')}</Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('templates.form.namePlaceholder')}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="template-description">
                    {t('templates.form.description')}
                  </Label>
                  <Textarea
                    id="template-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('templates.form.descriptionPlaceholder')}
                    rows={2}
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="template-tags">{t('templates.form.tags')}</Label>
                  <Input
                    id="template-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={t('templates.form.tagsPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('templates.form.tagsHelp')}
                  </p>
                </div>

                {/* Default toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('templates.form.setAsDefault')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('templates.form.setAsDefaultHelp')}
                    </p>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              {bulkImportResult ? t('common.close') : t('common.cancel')}
            </Button>
            {!bulkImportResult && (
              <Button type="submit" disabled={!isValid || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {importMode === 'bulk' ? t('templates.bulk.import') : t('templates.upload')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
