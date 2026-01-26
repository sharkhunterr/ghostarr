/**
 * Template edit dialog for metadata and preset configuration.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Loader2, Tag } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useUpdateTemplate } from '@/api/templates';
import { LabelSelector } from './LabelSelector';
import type { Template, GenerationConfig, Label as LabelType } from '@/types';

/**
 * Calculate contrasting text color (black or white) based on background color.
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface TemplateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSuccess?: () => void;
}

export function TemplateEditDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateEditDialogProps) {
  const { t } = useTranslation();
  const updateTemplate = useUpdateTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [currentLabels, setCurrentLabels] = useState<LabelType[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setTags(template.tags?.join(', ') || '');
      setCurrentLabels(template.labels || []);
      setIsDefault(template.is_default);
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!template || !name.trim()) return;

    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          is_default: isDefault,
        },
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  };

  const isValid = name.trim() !== '';
  const isLoading = updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('templates.editTitle')}</DialogTitle>
            <DialogDescription>
              {t('templates.editDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-template-name">
                {t('templates.form.name')}
              </Label>
              <Input
                id="edit-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('templates.form.namePlaceholder')}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-template-description">
                {t('templates.form.description')}
              </Label>
              <Textarea
                id="edit-template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('templates.form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Labels */}
            {template && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {t('labels.selector.title')}
                  </Label>
                  <LabelSelector
                    templateId={template.id}
                    selectedLabels={currentLabels}
                    onLabelsChange={setCurrentLabels}
                  />
                </div>
                {currentLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-md">
                    {currentLabels.map((label) => (
                      <Badge
                        key={label.id}
                        style={{
                          backgroundColor: label.color,
                          color: getContrastColor(label.color),
                        }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

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
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
