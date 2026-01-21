/**
 * Templates page for managing newsletter templates.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useTemplates, useDeleteTemplate, useUpdateTemplate, useScanTemplates } from '@/api/templates';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Template } from '@/types';

export default function Templates() {
  const { t } = useTranslation();
  const { data: templates, isLoading, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const updateTemplate = useUpdateTemplate();
  const scanTemplates = useScanTemplates();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const handleScan = async () => {
    try {
      const imported = await scanTemplates.mutateAsync();
      if (imported.length > 0) {
        addNotification({
          type: 'success',
          title: t('templates.scan.success'),
          message: t('templates.scan.imported', { count: imported.length }),
        });
      } else {
        addNotification({
          type: 'info',
          title: t('templates.scan.noNew'),
          message: t('templates.scan.noNewDescription'),
        });
      }
    } catch (error) {
      console.error('Failed to scan templates:', error);
      addNotification({
        type: 'error',
        title: t('errors.generic'),
        message: String(error),
      });
    }
  };

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
      <div className="text-center text-destructive py-8">
        {t('errors.generic')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with scan button */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {t('templates.subtitle')}
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={scanTemplates.isPending}
        >
          <FolderSearch className="h-4 w-4 mr-2" />
          {scanTemplates.isPending ? t('common.loading') : t('templates.scan.button')}
        </Button>
      </div>

      {/* Grid - Full width responsive */}
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
