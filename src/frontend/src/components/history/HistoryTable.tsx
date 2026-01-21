/**
 * History table component.
 */

import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Ban,
  ExternalLink,
  RefreshCw,
  Trash2,
  MoreVertical,
  Eye,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { History, GenerationStatus } from '@/types';

interface HistoryTableProps {
  entries: History[];
  isLoading?: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewDetails: (entry: History) => void;
  onRegenerate: (entry: History) => void;
  onDelete: (entry: History) => void;
  onDeleteGhostPost: (entry: History) => void;
}

function getStatusIcon(status: GenerationStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusVariant(
  status: GenerationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'running':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryTable({
  entries,
  isLoading,
  selectedIds,
  onSelectionChange,
  onViewDetails,
  onRegenerate,
  onDelete,
  onDeleteGhostPost,
}: HistoryTableProps) {
  const { t } = useTranslation();

  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const someSelected = entries.some((e) => selectedIds.has(e.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(entries.map((e) => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto opacity-50 mb-4" />
        <p>{t('history.empty')}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={toggleAll}
                aria-label={t('history.bulk.selectAll')}
              />
            </TableHead>
            <TableHead>{t('history.columns.date')}</TableHead>
            <TableHead>{t('history.columns.type')}</TableHead>
            <TableHead>{t('history.columns.status')}</TableHead>
            <TableHead className="text-right">
              {t('history.columns.items')}
            </TableHead>
            <TableHead className="text-right">
              {t('history.columns.duration')}
            </TableHead>
            <TableHead className="w-[100px]">
              {t('history.columns.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className={selectedIds.has(entry.id) ? 'bg-muted/50' : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(entry.id)}
                  onCheckedChange={() => toggleOne(entry.id)}
                  aria-label={t('history.bulk.selectRow')}
                />
              </TableCell>
              <TableCell className="font-medium">
                {formatDate(entry.created_at)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {t(`history.types.${entry.type}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusIcon(entry.status)}
                  <Badge variant={getStatusVariant(entry.status)}>
                    {t(`history.status.${entry.status}`)}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {entry.items_count || '-'}
              </TableCell>
              <TableCell className="text-right">
                {formatDuration(entry.duration_seconds)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewDetails(entry)}>
                      <Eye className="h-4 w-4 mr-2" />
                      {t('history.actions.viewDetails')}
                    </DropdownMenuItem>

                    {entry.ghost_post_url && (
                      <DropdownMenuItem asChild>
                        <a
                          href={entry.ghost_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {t('history.actions.viewOnGhost')}
                        </a>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem onClick={() => onRegenerate(entry)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('history.actions.regenerate')}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {entry.ghost_post_id && (
                      <DropdownMenuItem
                        onClick={() => onDeleteGhostPost(entry)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('history.actions.deleteFromGhost')}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={() => onDelete(entry)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
