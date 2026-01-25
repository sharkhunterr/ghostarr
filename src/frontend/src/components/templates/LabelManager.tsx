/**
 * Label Manager component for creating, editing, and deleting labels.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FormLabel } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel } from '@/api/labels';
import type { Label } from '@/types';

// Predefined color palette
const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#64748b', // slate
];

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

interface LabelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabelManager({ open, onOpenChange }: LabelManagerProps) {
  const { t } = useTranslation();
  const { data: labels, isLoading } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [deletingLabel, setDeletingLabel] = useState<Label | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const resetForm = () => {
    setName('');
    setColor('#6366f1');
    setEditingLabel(null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingLabel(null);
    setName('');
    setColor('#6366f1');
  };

  const handleEdit = (label: Label) => {
    setEditingLabel(label);
    setIsCreating(false);
    setName(label.name);
    setColor(label.color);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      if (editingLabel) {
        await updateLabel.mutateAsync({
          labelId: editingLabel.id,
          data: { name: name.trim(), color },
        });
      } else {
        await createLabel.mutateAsync({
          name: name.trim(),
          color,
        });
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save label:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingLabel) return;

    try {
      await deleteLabel.mutateAsync(deletingLabel.id);
      setDeletingLabel(null);
    } catch (error) {
      console.error('Failed to delete label:', error);
    }
  };

  const isFormActive = isCreating || editingLabel !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {t('labels.manager.title')}
            </DialogTitle>
            <DialogDescription>
              {t('labels.manager.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Label list */}
            <ScrollArea className="h-[200px] rounded-md border p-2">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-4">
                  {t('common.loading')}
                </div>
              ) : labels && labels.length > 0 ? (
                <div className="space-y-2">
                  {labels.map((label) => (
                    <div
                      key={label.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                    >
                      <Badge
                        style={{
                          backgroundColor: label.color,
                          color: getContrastColor(label.color),
                        }}
                      >
                        {label.name}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(label)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeletingLabel(label)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  {t('labels.manager.empty')}
                </div>
              )}
            </ScrollArea>

            {/* Create/Edit form */}
            {isFormActive ? (
              <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                <div className="space-y-2">
                  <FormLabel>{t('labels.form.name')}</FormLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('labels.form.namePlaceholder')}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>{t('labels.form.color')}</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full transition-transform ${
                          color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                        aria-label={c}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-8 p-0 border-0"
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#6366f1"
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('labels.form.preview')}:
                  </span>
                  <Badge
                    style={{
                      backgroundColor: color,
                      color: getContrastColor(color),
                    }}
                  >
                    {name || t('labels.form.namePlaceholder')}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={
                      !name.trim() ||
                      createLabel.isPending ||
                      updateLabel.isPending
                    }
                  >
                    {editingLabel ? t('common.save') : t('common.create')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('labels.manager.create')}
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingLabel}
        onOpenChange={(open) => !open && setDeletingLabel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('labels.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('labels.deleteConfirm.message', { name: deletingLabel?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLabel.isPending ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
