/**
 * History page for viewing generation history.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, X } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HistoryFilters,
  HistoryTable,
  ProgressModal,
} from '@/components/history';
import { HelpPanel } from '@/components/help';
import {
  useHistory,
  useDeleteHistory,
  useRegenerateHistory,
  useDeleteGhostPost,
  useBulkDeleteHistory,
  useBulkDeleteHistoryWithGhost,
  useExportHistory,
  downloadBlob,
  type HistoryFilters as Filters,
} from '@/api/history';
import type { History as HistoryType } from '@/types';

type ConfirmAction = 'delete' | 'regenerate' | 'deleteGhostPost' | 'bulkDelete' | 'bulkDeleteWithGhost' | null;

export default function History() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Filters>({});
  const [selectedEntry, setSelectedEntry] = useState<HistoryType | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionTarget, setActionTarget] = useState<HistoryType | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: entries, isLoading, error } = useHistory(filters);
  const deleteHistory = useDeleteHistory();
  const regenerateHistory = useRegenerateHistory();
  const deleteGhostPost = useDeleteGhostPost();
  const bulkDeleteHistory = useBulkDeleteHistory();
  const bulkDeleteHistoryWithGhost = useBulkDeleteHistoryWithGhost();
  const exportHistory = useExportHistory();

  // Count how many selected entries have Ghost posts
  const selectedWithGhost = entries?.filter(
    (e) => selectedIds.has(e.id) && e.ghost_post_id
  ).length || 0;

  const handleViewDetails = (entry: HistoryType) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  };

  const handleRegenerate = (entry: HistoryType) => {
    setActionTarget(entry);
    setConfirmAction('regenerate');
  };

  const handleDelete = (entry: HistoryType) => {
    setActionTarget(entry);
    setConfirmAction('delete');
  };

  const handleDeleteGhostPost = (entry: HistoryType) => {
    setActionTarget(entry);
    setConfirmAction('deleteGhostPost');
  };

  const handleBulkDelete = () => {
    setConfirmAction('bulkDelete');
  };

  const handleBulkDeleteWithGhost = () => {
    setConfirmAction('bulkDeleteWithGhost');
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const executeAction = async () => {
    try {
      switch (confirmAction) {
        case 'delete':
          if (actionTarget) {
            await deleteHistory.mutateAsync(actionTarget.id);
          }
          break;
        case 'regenerate':
          if (actionTarget) {
            await regenerateHistory.mutateAsync(actionTarget.id);
          }
          break;
        case 'deleteGhostPost':
          if (actionTarget) {
            await deleteGhostPost.mutateAsync(actionTarget.id);
          }
          break;
        case 'bulkDelete':
          await bulkDeleteHistory.mutateAsync(Array.from(selectedIds));
          clearSelection();
          break;
        case 'bulkDeleteWithGhost':
          await bulkDeleteHistoryWithGhost.mutateAsync(Array.from(selectedIds));
          clearSelection();
          break;
      }
    } catch (error) {
      console.error('Action failed:', error);
    }

    setConfirmAction(null);
    setActionTarget(null);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await exportHistory.mutateAsync({ format, filters });
      const filename = `history_export_${new Date().toISOString().split('T')[0]}.${format}`;
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getConfirmContent = () => {
    switch (confirmAction) {
      case 'delete':
        return {
          title: t('history.deleteConfirm.title'),
          description: t('history.deleteConfirm.message'),
        };
      case 'regenerate':
        return {
          title: t('history.regenerateConfirm.title'),
          description: t('history.regenerateConfirm.message'),
        };
      case 'deleteGhostPost':
        return {
          title: t('history.deleteGhostPostConfirm.title'),
          description: t('history.deleteGhostPostConfirm.message'),
        };
      case 'bulkDelete':
        return {
          title: t('history.bulk.deleteConfirm.title'),
          description: t('history.bulk.deleteConfirm.message', { count: selectedIds.size }),
        };
      case 'bulkDeleteWithGhost':
        return {
          title: t('history.bulk.deleteWithGhostConfirm.title'),
          description: t('history.bulk.deleteWithGhostConfirm.message', {
            count: selectedIds.size,
            ghostCount: selectedWithGhost,
          }),
        };
      default:
        return { title: '', description: '' };
    }
  };

  const confirmContent = getConfirmContent();
  const isActionLoading =
    deleteHistory.isPending ||
    regenerateHistory.isPending ||
    deleteGhostPost.isPending ||
    bulkDeleteHistory.isPending ||
    bulkDeleteHistoryWithGhost.isPending;

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        {t('errors.generic')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <HistoryFilters filters={filters} onChange={setFilters} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={exportHistory.isPending}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.export')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleExport('json')}>
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {t('history.bulk.selected', { count: selectedIds.size })}
          </span>
          <div className="hidden sm:block flex-1" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
            >
              <X className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('history.bulk.clearSelection')}</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('history.bulk.deleteHistory')}</span>
            </Button>
            {selectedWithGhost > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteWithGhost}
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('history.bulk.deleteWithGhost')}</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table - Full width */}
      <div className="w-full overflow-x-auto">
        <HistoryTable
          entries={entries || []}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onViewDetails={handleViewDetails}
          onRegenerate={handleRegenerate}
          onDelete={handleDelete}
          onDeleteGhostPost={handleDeleteGhostPost}
        />
      </div>

      {/* Progress modal */}
      <ProgressModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        history={selectedEntry}
      />

      {/* Confirmation dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className={
                confirmAction === 'regenerate'
                  ? ''
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {isActionLoading ? t('common.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Help Panel */}
      <HelpPanel category="history" />
    </div>
  );
}
