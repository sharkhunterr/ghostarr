/**
 * Template upload dialog with drag-and-drop support.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  Loader2,
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
import { useCreateTemplate, useImportTemplate, TemplateExportData } from '@/api/templates';
import { cn } from '@/lib/utils';

interface TemplateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TemplateUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: TemplateUploadDialogProps) {
  const { t } = useTranslation();
  const createTemplate = useCreateTemplate();
  const importTemplate = useImportTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<TemplateExportData | null>(null);
  const [isJsonImport, setIsJsonImport] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);

      // Check if it's a JSON file (template export format)
      if (f.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content) as TemplateExportData;
            // Validate it has required fields
            if (parsed.html && typeof parsed.html === 'string') {
              setJsonData(parsed);
              setIsJsonImport(true);
              // Auto-fill from JSON data
              if (parsed.name) setName(parsed.name);
              if (parsed.description) setDescription(parsed.description);
              if (parsed.labels && parsed.labels.length > 0) {
                setTags(parsed.labels.join(', '));
              }
            } else {
              console.error('Invalid JSON template format: missing html field');
              setJsonData(null);
              setIsJsonImport(false);
            }
          } catch (err) {
            console.error('Failed to parse JSON file:', err);
            setJsonData(null);
            setIsJsonImport(false);
          }
        };
        reader.readAsText(f);
      } else {
        // HTML or ZIP file - standard upload
        setJsonData(null);
        setIsJsonImport(false);
        // Auto-fill name from filename if empty
        if (!name) {
          const fileName = f.name.replace(/\.(html|htm|zip)$/i, '');
          setName(fileName);
        }
      }
    }
  }, [name]);

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
    setIsJsonImport(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !name.trim()) return;

    try {
      if (isJsonImport && jsonData) {
        // Import from JSON format
        await importTemplate.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          html: jsonData.html,
          labels: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          preset_config: jsonData.preset_config || {},
        });
      } else {
        // Standard upload (HTML/ZIP)
        await createTemplate.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() || undefined,
          is_default: isDefault,
          file,
        });
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to upload template:', error);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const isValid = name.trim() !== '' && file !== null && (!isJsonImport || jsonData !== null);
  const isLoading = createTemplate.isPending || importTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('templates.upload')}</DialogTitle>
            <DialogDescription>
              {t('templates.uploadDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dropzone */}
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
                  <FileText className="h-8 w-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {t('templates.upload')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
