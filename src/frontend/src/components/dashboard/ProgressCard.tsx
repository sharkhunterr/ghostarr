/**
 * Progress card component for displaying newsletter generation progress.
 * Enhanced with expandable step details, elapsed time, and estimated completion.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  SkipForward,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  X,
  Trash2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GenerationProgress } from '@/stores/progressStore';
import type { ProgressStepStatus } from '@/types';

interface ProgressCardProps {
  progress: GenerationProgress | null;
  onCancel?: () => void;
  onClear?: () => void;
  onViewHistory?: () => void;
  isCancelling?: boolean;
  compact?: boolean;
}

const stepIcons: Record<ProgressStepStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  skipped: <SkipForward className="h-4 w-4 text-muted-foreground" />,
};

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function useElapsedTime(startedAt: string | null, isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || !isActive) {
      return;
    }

    const startTime = new Date(startedAt).getTime();

    const interval = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, isActive]);

  return elapsed;
}

export function ProgressCard({
  progress,
  onCancel,
  onClear,
  onViewHistory,
  isCancelling,
  compact = false,
}: ProgressCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!compact);

  const isActive = progress
    ? !progress.isComplete && !progress.isCancelled && !progress.error
    : false;
  const hasError = progress?.error !== null && progress?.error !== undefined;

  const elapsedTime = useElapsedTime(progress?.startedAt || null, isActive);

  // Calculate estimated time remaining based on progress
  const estimatedRemaining =
    progress && progress.progress > 0 && isActive
      ? (elapsedTime / progress.progress) * (100 - progress.progress)
      : null;

  if (!progress) {
    return null;
  }

  const completedSteps = progress.steps.filter(
    (s) => s.status === 'success' || s.status === 'skipped'
  ).length;
  const totalSteps = progress.steps.length;

  // Determine card styling based on state
  const cardClassName = compact
    ? `shadow-xl border-2 ${
        isActive
          ? 'border-primary/50 ring-2 ring-primary/20 animate-pulse-subtle'
          : hasError
            ? 'border-destructive/50'
            : progress.isComplete
              ? 'border-green-500/50'
              : 'border-border'
      }`
    : '';

  return (
    <Card className={cardClassName}>
      {/* Mini progress bar always visible at top when compact */}
      {compact && (
        <div className="h-1 bg-muted overflow-hidden rounded-t-lg">
          <div
            className={`h-full transition-all duration-300 ${
              hasError
                ? 'bg-destructive'
                : progress.isComplete
                  ? 'bg-green-500'
                  : 'bg-primary'
            }`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              {t('dashboard.generation.progress')}
              {/* Show percentage prominently when compact */}
              {compact && (
                <span className={`text-sm font-bold tabular-nums ${
                  hasError ? 'text-destructive' : progress.isComplete ? 'text-green-500' : 'text-primary'
                }`}>
                  {progress.progress}%
                </span>
              )}
              {compact && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-auto"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
              {progress.isComplete && !hasError && (
                <Badge variant="success">{t('dashboard.status.complete')}</Badge>
              )}
              {progress.isCancelled && (
                <Badge variant="secondary">
                  {t('dashboard.status.cancelled')}
                </Badge>
              )}
              {hasError && !progress.isCancelled && (
                <Badge variant="destructive">{t('dashboard.status.failed')}</Badge>
              )}
              {isActive && (
                <Badge variant="default">{t('dashboard.status.running')}</Badge>
              )}

              {/* Elapsed time */}
              {(isActive || progress.isComplete) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(elapsedTime)}
                </span>
              )}

              {/* Step counter */}
              <span className="text-xs text-muted-foreground sm:ml-auto">
                {completedSteps}/{totalSteps} {t('progress.step')}
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-1 self-end sm:self-auto shrink-0">
            {isActive && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isCancelling}
                className="px-2"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {!compact && <span className="ml-2">{t('dashboard.actions.cancel')}</span>}
              </Button>
            )}
            {!isActive && onViewHistory && (
              <Button variant="outline" size="sm" onClick={onViewHistory} className="px-2">
                <History className="h-4 w-4" />
                {!compact && <span className="ml-2">{t('nav.history')}</span>}
              </Button>
            )}
            {!isActive && onClear && (
              <Button variant="ghost" size="sm" onClick={onClear} className="px-2">
                <Trash2 className="h-4 w-4" />
                {!compact && <span className="ml-2">{t('dashboard.actions.clear')}</span>}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.currentStep
                  ? progress.steps.find((s) => s.step === progress.currentStep)
                      ?.message
                  : t('dashboard.generation.preparing')}
              </span>
              <span className="font-medium">{progress.progress}%</span>
            </div>
            <Progress value={progress.progress} className="h-2" />
            {/* Estimated time remaining */}
            {estimatedRemaining !== null && estimatedRemaining > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {t('progress.elapsed')}: {formatDuration(elapsedTime)} &bull;{' '}
                {t('progress.remaining')}: ~{formatDuration(estimatedRemaining)}
              </p>
            )}
          </div>

          {/* Steps list */}
          <div className="space-y-1">
            {progress.steps.map((step) => (
              <div
                key={step.step}
                className={`flex items-center gap-3 text-sm py-1.5 px-2 rounded ${
                  step.status === 'running' ? 'bg-primary/5' : ''
                }`}
              >
                {stepIcons[step.status]}
                <span
                  className={`flex-1 ${
                    step.status === 'running'
                      ? 'font-medium'
                      : step.status === 'pending'
                        ? 'text-muted-foreground'
                        : ''
                  }`}
                >
                  {step.message}
                </span>
                <div className="flex items-center gap-2">
                  {step.items_count !== undefined && step.items_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {step.items_count}
                    </Badge>
                  )}
                  {step.duration_ms !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {(step.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {step.error && (
                  <span className="text-xs text-destructive truncate max-w-[150px]">
                    {step.error}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Result link */}
          {progress.isComplete && progress.ghostPostUrl && (
            <div className="pt-3 border-t">
              <a
                href={progress.ghostPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t('dashboard.generation.viewPost')}
              </a>
            </div>
          )}

          {/* Error message */}
          {hasError && (
            <div className="pt-3 border-t">
              <p className="text-sm text-destructive">{progress.error}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
