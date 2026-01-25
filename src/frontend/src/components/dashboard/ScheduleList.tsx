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
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useCancelGeneration } from '@/api/newsletters';
import { useProgressStore } from '@/stores/progressStore';
import { useSSE } from '@/hooks/useSSE';
import { ProgressCard } from './ProgressCard';
import type { Schedule, RunStatus, ProgressEvent } from '@/types';

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

function formatRelativeTime(dateStr: string | null, t: (key: string, params?: Record<string, unknown>) => string): string {
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

    if (absMins < 60) return t('common.time.minutesAgo', { count: absMins });
    if (absHours < 24) return t('common.time.hoursAgo', { count: absHours });
    return t('common.time.daysAgo', { count: absDays });
  } else {
    // Future
    if (diffMins < 60) return t('common.time.inMinutes', { count: diffMins });
    if (diffHours < 24) return t('common.time.inHours', { count: diffHours });
    return t('common.time.inDays', { count: diffDays });
  }
}

export function ScheduleList({ onEdit }: ScheduleListProps) {
  const { t } = useTranslation();
  const { data: schedules, isLoading, error } = useSchedules();
  const toggleSchedule = useToggleSchedule();
  const deleteSchedule = useDeleteSchedule();
  const executeSchedule = useExecuteSchedule();
  const cancelMutation = useCancelGeneration();

  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [executingScheduleId, setExecutingScheduleId] = useState<string | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);

  // Progress store for tracking generation
  const {
    activeGenerationId,
    generations,
    startGeneration,
    updateProgress,
    cancelGeneration: cancelGenerationInStore,
    clearGeneration,
  } = useProgressStore();

  // Get current generation progress
  const currentProgress = activeGenerationId ? generations[activeGenerationId] : null;
  const isGenerationActive = currentProgress && !currentProgress.isComplete && !currentProgress.isCancelled && !currentProgress.error;

  // Handle SSE events
  const handleSSEEvent = (event: ProgressEvent) => {
    updateProgress(event);

    if (event.type === 'generation_complete' || event.type === 'generation_cancelled') {
      // Keep modal open to show result
    }
  };

  // Connect to SSE when generation is active
  const { disconnect } = useSSE(
    isGenerationActive ? activeGenerationId : null,
    {
      onEvent: handleSSEEvent,
      onError: (error) => console.error('SSE error:', error),
    }
  );

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
      setExecutingScheduleId(schedule.id);
      const result = await executeSchedule.mutateAsync(schedule.id);

      // Start tracking progress
      startGeneration(result.generation_id);
      setProgressModalOpen(true);
    } catch (error) {
      console.error('Failed to execute schedule:', error);
    } finally {
      setExecutingScheduleId(null);
    }
  };

  const handleCancelGeneration = async () => {
    if (!activeGenerationId) return;

    try {
      await cancelMutation.mutateAsync(activeGenerationId);
      cancelGenerationInStore(activeGenerationId);
      disconnect();
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    }
  };

  const handleCloseProgressModal = () => {
    setProgressModalOpen(false);
    if (activeGenerationId) {
      clearGeneration(activeGenerationId);
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
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate text-sm sm:text-base">{schedule.name}</h4>
                    {!schedule.is_active && (
                      <Badge variant="secondary" className="text-xs px-1">
                        <Pause className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 mt-0.5 text-xs text-muted-foreground overflow-hidden">
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      <span className="hidden sm:inline">{schedule.cron_expression}</span>
                    </span>

                    {schedule.next_run_at && schedule.is_active && (
                      <span className="flex items-center gap-1 truncate">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {formatRelativeTime(schedule.next_run_at, t)}
                      </span>
                    )}

                    {schedule.last_run_at && (
                      <span className="hidden sm:flex items-center gap-1">
                        {getStatusIcon(schedule.last_run_status)}
                        {formatRelativeTime(schedule.last_run_at, t)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
                    disabled={executeSchedule.isPending || executingScheduleId === schedule.id}
                  >
                    {executingScheduleId === schedule.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
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

      {/* Progress modal */}
      <Dialog open={progressModalOpen} onOpenChange={setProgressModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('dashboard.generation.progress')}</DialogTitle>
          </DialogHeader>
          <ProgressCard
            progress={currentProgress}
            onCancel={isGenerationActive ? handleCancelGeneration : undefined}
            onClear={handleCloseProgressModal}
            isCancelling={cancelMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
