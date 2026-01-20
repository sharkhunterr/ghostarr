/**
 * Templates page for managing newsletter templates.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  TemplateGrid,
  TemplatePreview,
  TemplateUploadDialog,
  TemplateEditDialog,
} from '@/components/templates';
import { useTemplates, useDeleteTemplate, useUpdateTemplate } from '@/api/templates';
import type { Template } from '@/types';

export default function Templates() {
  const { t } = useTranslation();
  const { data: templates, isLoading, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const updateTemplate = useUpdateTemplate();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
  };

  const handleEdit = (template: Template) => {
    setEditTemplate(template);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteTemplate.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleSetDefault = async (template: Template) => {
    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: { is_default: true },
      });
    } catch (error) {
      console.error('Failed to set default template:', error);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-destructive">
          {t('errors.generic')}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            {t('templates.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('templates.subtitle')}
          </p>
        </div>
      </div>

      {/* Grid */}
      <TemplateGrid
        templates={templates || []}
        isLoading={isLoading}
        onUpload={() => setUploadOpen(true)}
        onPreview={handlePreview}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
        onSetDefault={handleSetDefault}
      />

      {/* Upload dialog */}
      <TemplateUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />

      {/* Preview dialog */}
      <TemplatePreview
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        templateId={previewTemplate?.id || null}
        templateName={previewTemplate?.name}
      />

      {/* Edit dialog */}
      <TemplateEditDialog
        open={!!editTemplate}
        onOpenChange={(open) => !open && setEditTemplate(null)}
        template={editTemplate}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('templates.deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('templates.deleteConfirm.message')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplate.isPending
                ? t('common.loading')
                : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
