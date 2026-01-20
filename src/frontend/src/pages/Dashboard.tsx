/**
 * Dashboard page - main page for manual newsletter generation.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ManualGeneration,
  ProgressCard,
  PreviewModal,
  AutomaticGeneration,
} from '@/components/dashboard';
import { useProgress } from '@/hooks/useProgress';
import { usePreviewNewsletter } from '@/api/newsletters';
import type { GenerationConfig, PreviewResponse } from '@/types';

export default function Dashboard() {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const previewMutation = usePreviewNewsletter();

  const {
    progress,
    isGenerating,
    isCancelling,
    generate,
    cancel,
    clear,
  } = useProgress({
    onComplete: (ghostPostUrl) => {
      console.log('Generation complete:', ghostPostUrl);
    },
    onError: (error) => {
      console.error('Generation error:', error);
    },
  });

  const handleGenerate = useCallback(
    async (config: GenerationConfig) => {
      try {
        await generate(config);
      } catch (error) {
        // Error is handled in useProgress
      }
    },
    [generate]
  );

  const handlePreview = useCallback(
    async (config: GenerationConfig) => {
      try {
        const result = await previewMutation.mutateAsync(config);
        setPreviewData(result);
        setPreviewOpen(true);
      } catch (error) {
        console.error('Preview failed:', error);
      }
    },
    [previewMutation]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Manual Generation Form */}
        <ManualGeneration
          onGenerate={handleGenerate}
          onPreview={handlePreview}
          isGenerating={isGenerating}
          isPreviewing={previewMutation.isPending}
        />

        {/* Progress Card */}
        <div className="space-y-4">
          {progress ? (
            <ProgressCard
              progress={progress}
              onCancel={cancel}
              onClear={clear}
              isCancelling={isCancelling}
            />
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
              <p>{t('dashboard.noActiveGeneration')}</p>
              <p className="text-sm mt-2">
                {t('dashboard.noActiveGenerationHint')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Automatic Generation / Schedules */}
      <AutomaticGeneration />

      {/* Preview Modal */}
      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        html={previewData?.html || null}
        title={previewData?.title || null}
        itemsCount={previewData?.items_count || 0}
      />
    </div>
  );
}
