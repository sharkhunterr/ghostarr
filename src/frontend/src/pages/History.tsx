/**
 * History page for viewing generation history.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
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
import {
  useHistory,
  useDeleteHistory,
  useRegenerateHistory,
  useDeleteGhostPost,
  useExportHistory,
  downloadBlob,
  type HistoryFilters as Filters,
} from '@/api/history';
import type { History as HistoryType } from '@/types';

type ConfirmAction = 'delete' | 'regenerate' | 'deleteGhostPost' | null;

export default function History() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Filters>({});
  const [selectedEntry, setSelectedEntry] = useState<HistoryType | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionTarget, setActionTarget] = useState<HistoryType | null>(null);

  const { data: entries, isLoading, error } = useHistory(filters);
  const deleteHistory = useDeleteHistory();
  const regenerateHistory = useRegenerateHistory();
  const deleteGhostPost = useDeleteGhostPost();
  const exportHistory = useExportHistory();

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

  const executeAction = async () => {
    if (!actionTarget) return;

    try {
      switch (confirmAction) {
        case 'delete':
          await deleteHistory.mutateAsync(actionTarget.id);
          break;
        case 'regenerate':
          await regenerateHistory.mutateAsync(actionTarget.id);
          break;
        case 'deleteGhostPost':
          await deleteGhostPost.mutateAsync(actionTarget.id);
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
      default:
        return { title: '', description: '' };
    }
  };

  const confirmContent = getConfirmContent();
  const isActionLoading =
    deleteHistory.isPending ||
    regenerateHistory.isPending ||
    deleteGhostPost.isPending;

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        {t('errors.generic')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t('history.subtitle')}</p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={exportHistory.isPending}>
              <Download className="h-4 w-4 mr-2" />
              {t('common.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('json')}>
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <HistoryFilters filters={filters} onChange={setFilters} />

      {/* Table - Full width */}
      <div className="w-full overflow-x-auto">
        <HistoryTable
          entries={entries || []}
          isLoading={isLoading}
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
    </div>
  );
}
