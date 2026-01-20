/**
 * Template grid component with upload button.
 */

import { useTranslation } from 'react-i18next';
import { Plus, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateCard } from './TemplateCard';
import type { Template } from '@/types';

interface TemplateGridProps {
  templates: Template[];
  isLoading?: boolean;
  onUpload: () => void;
  onPreview: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onSetDefault: (template: Template) => void;
}

export function TemplateGrid({
  templates,
  isLoading,
  onUpload,
  onPreview,
  onEdit,
  onDelete,
  onSetDefault,
}: TemplateGridProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('templates.empty')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('templates.emptyDescription')}
        </p>
        <Button onClick={onUpload}>
          <Plus className="h-4 w-4 mr-2" />
          {t('templates.upload')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Upload card */}
      <button
        onClick={onUpload}
        className="border-2 border-dashed rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-8 w-8" />
        <span className="font-medium">{t('templates.upload')}</span>
      </button>

      {/* Template cards */}
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onPreview={onPreview}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetDefault={onSetDefault}
        />
      ))}
    </div>
  );
}
