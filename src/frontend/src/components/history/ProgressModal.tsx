/**
 * Progress modal for viewing generation step details.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { History, ProgressStep, ProgressStepStatus, GenerationConfig } from '@/types';

interface ProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: History | null;
}

function getStepIcon(status: ProgressStepStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'running':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'skipped':
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function ConfigSection({ config, t }: { config: GenerationConfig; t: (key: string) => string }) {
  const enabledSources = [];
  if (config.tautulli?.enabled) enabledSources.push('Tautulli');
  if (config.romm?.enabled) enabledSources.push('Romm');
  if (config.komga?.enabled) enabledSources.push('Komga');
  if (config.audiobookshelf?.enabled) enabledSources.push('Audiobookshelf');
  if (config.tunarr?.enabled) enabledSources.push('Tunarr');

  return (
    <div className="space-y-2 text-sm">
      {/* Publication mode */}
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('history.config.publicationMode')}</span>
        <Badge variant="outline">{config.publication_mode}</Badge>
      </div>

      {/* Enabled sources */}
      {enabledSources.length > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('history.config.sources')}</span>
          <span>{enabledSources.join(', ')}</span>
        </div>
      )}

      {/* Tautulli details */}
      {config.tautulli?.enabled && (
        <div className="pl-4 space-y-1 border-l-2 border-muted">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tautulli - {t('history.config.days')}</span>
            <span>{config.tautulli.days}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tautulli - {t('history.config.maxItems')}</span>
            <span>{config.tautulli.max_items === -1 ? t('common.unlimited') : config.tautulli.max_items}</span>
          </div>
          {config.tautulli.featured_item && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('history.config.featuredItem')}</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      {config.statistics?.enabled && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('history.config.statistics')}</span>
          <span>
            {config.statistics.days} {t('history.config.days')}
            {config.statistics.include_comparison && ` + ${t('history.config.comparison')}`}
          </span>
        </div>
      )}

      {/* Maintenance */}
      {config.maintenance?.enabled && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('history.config.maintenance')}</span>
          <Badge variant="secondary">{config.maintenance.type}</Badge>
        </div>
      )}

      {/* Max items */}
      {config.max_total_items !== -1 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('history.config.maxTotalItems')}</span>
          <span>{config.max_total_items}</span>
        </div>
      )}
    </div>
  );
}

export function ProgressModal({
  open,
  onOpenChange,
  history,
}: ProgressModalProps) {
  const { t } = useTranslation();
  const [configOpen, setConfigOpen] = useState(false);

  if (!history) return null;

  const steps = history.progress_log || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>{t('history.progressModal.title')}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Summary */}
        <div className="flex items-center gap-4 py-2">
          <Badge
            variant={
              history.status === 'success'
                ? 'default'
                : history.status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
          >
            {t(`history.status.${history.status}`)}
          </Badge>
          {history.items_count > 0 && (
            <span className="text-sm text-muted-foreground">
              {history.items_count} {t('dashboard.items')}
            </span>
          )}
          {history.duration_seconds && (
            <span className="text-sm text-muted-foreground">
              {formatDuration(history.duration_seconds * 1000)}
            </span>
          )}
        </div>

        {history.error_message && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {history.error_message}
          </div>
        )}

        {/* Generation config collapsible */}
        {history.generation_config && (
          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between px-2"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span>{t('history.config.title')}</span>
                </div>
                {configOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 py-2">
              <ConfigSection config={history.generation_config} t={t} />
            </CollapsibleContent>
          </Collapsible>
        )}

        <Separator />

        {/* Steps timeline */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="space-y-1">
            {steps.map((step, index) => (
              <div
                key={index}
                className={cn(
                  'relative pl-8 py-2',
                  index < steps.length - 1 && 'border-l-2 ml-2.5 border-muted'
                )}
              >
                {/* Step icon */}
                <div className="absolute left-0 top-2 bg-background">
                  {getStepIcon(step.status)}
                </div>

                {/* Step content */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {t(`progress.steps.${step.step}`, step.step)}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {step.items_count !== undefined && step.items_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {step.items_count} {t('dashboard.items')}
                        </Badge>
                      )}
                      {step.duration_ms !== undefined && (
                        <span>{formatDuration(step.duration_ms)}</span>
                      )}
                    </div>
                  </div>

                  {step.message && (
                    <p className="text-sm text-muted-foreground">
                      {step.message}
                    </p>
                  )}

                  {step.error && (
                    <p className="text-sm text-destructive">{step.error}</p>
                  )}
                </div>
              </div>
            ))}

            {steps.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                {t('history.progressModal.noSteps')}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
