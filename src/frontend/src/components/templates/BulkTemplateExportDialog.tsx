/**
 * Bulk template export dialog with selection.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, FileText } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTemplates, useExportTemplatesBulk } from '@/api/templates';

interface BulkTemplateExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkTemplateExportDialog({ open, onOpenChange }: BulkTemplateExportDialogProps) {
  const { t } = useTranslation();
  const { data: templates } = useTemplates();
  const exportTemplates = useExportTemplatesBulk();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const allSelected = useMemo(() => {
    if (!templates || templates.length === 0) return false;
    return templates.every((t) => selectedIds.has(t.id));
  }, [templates, selectedIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked && templates) {
      setSelectedIds(new Set(templates.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;

    setIsExporting(true);
    try {
      const data = await exportTemplates.mutateAsync(Array.from(selectedIds));

      // Download the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghostarr-templates-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onOpenChange(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to export templates:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('templates.bulk.exportTitle')}</DialogTitle>
          <DialogDescription>
            {t('templates.bulk.exportDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Select all */}
          <div className="flex items-center space-x-3 pb-2 border-b">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="flex-1 cursor-pointer font-medium">
              {t('templates.bulk.selectAll')}
              {templates && (
                <Badge variant="secondary" className="ml-2">
                  {selectedIds.size}/{templates.length}
                </Badge>
              )}
            </Label>
          </div>

          {/* Template list */}
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {templates?.map((template) => (
                <div key={template.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`template-${template.id}`}
                    checked={selectedIds.has(template.id)}
                    onCheckedChange={() => handleToggle(template.id)}
                  />
                  <Label
                    htmlFor={`template-${template.id}`}
                    className="flex-1 cursor-pointer flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{template.name}</span>
                    {template.is_default && (
                      <Badge variant="outline" className="text-xs">
                        {t('templates.default')}
                      </Badge>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedIds.size === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t('templates.bulk.export')} ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
