/**
 * Schedule list component.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Play,
  Pause,
  Edit,
  Trash2,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  Calendar,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  useSchedules,
  useToggleSchedule,
  useDeleteSchedule,
  useExecuteSchedule,
} from '@/api/schedules';
import type { Schedule, RunStatus } from '@/types';

interface ScheduleListProps {
  onEdit?: (schedule: Schedule) => void;
}

function getStatusIcon(status: RunStatus | null) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'skipped':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return null;
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    // Past
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absMins < 60) return `${absMins}min ago`;
    if (absHours < 24) return `${absHours}h ago`;
    return `${absDays}d ago`;
  } else {
    // Future
    if (diffMins < 60) return `in ${diffMins}min`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  }
}

export function ScheduleList({ onEdit }: ScheduleListProps) {
  const { t } = useTranslation();
  const { data: schedules, isLoading, error } = useSchedules();
  const toggleSchedule = useToggleSchedule();
  const deleteSchedule = useDeleteSchedule();
  const executeSchedule = useExecuteSchedule();

  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  const handleToggle = async (schedule: Schedule) => {
    try {
      await toggleSchedule.mutateAsync(schedule.id);
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteSchedule.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleExecute = async (schedule: Schedule) => {
    try {
      await executeSchedule.mutateAsync(schedule.id);
    } catch (error) {
      console.error('Failed to execute schedule:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-destructive">
          {t('errors.generic')}
        </CardContent>
      </Card>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{t('schedule.empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {schedules.map((schedule) => (
          <Card
            key={schedule.id}
            className={!schedule.is_active ? 'opacity-60' : ''}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{schedule.name}</h4>
                    {!schedule.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        <Pause className="h-3 w-3 mr-1" />
                        {t('schedule.status.paused')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {schedule.cron_expression}
                    </span>

                    {schedule.next_run_at && schedule.is_active && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {t('schedule.nextRun')}:{' '}
                        {formatRelativeTime(schedule.next_run_at)}
                      </span>
                    )}

                    {schedule.last_run_at && (
                      <span className="flex items-center gap-1">
                        {getStatusIcon(schedule.last_run_status)}
                        {t('schedule.lastRun')}:{' '}
                        {formatRelativeTime(schedule.last_run_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.is_active}
                    onCheckedChange={() => handleToggle(schedule)}
                    disabled={toggleSchedule.isPending}
                    aria-label={t('schedule.actions.toggle')}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecute(schedule)}
                    disabled={executeSchedule.isPending}
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span className="sr-only">
                      {t('schedule.actions.executeNow')}
                    </span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(schedule)}>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExecute(schedule)}>
                        <Play className="h-4 w-4 mr-2" />
                        {t('schedule.actions.executeNow')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(schedule)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('schedule.deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('schedule.deleteConfirm.message', { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchedule.isPending ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
