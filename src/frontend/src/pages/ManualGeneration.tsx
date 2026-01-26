/**
 * Manual Generation page - for generating newsletters on demand.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ManualGeneration as ManualGenerationForm,
  ProgressCard,
  PreviewModal,
} from '@/components/dashboard';
import { HelpPanel } from '@/components/help';
import { useProgress } from '@/hooks/useProgress';
import { usePreviewNewsletter } from '@/api/newsletters';
import type { GenerationConfig, PreviewResponse } from '@/types';

export default function ManualGeneration() {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const previewMutation = usePreviewNewsletter();

  const {
    progress,
    isGenerating,
    isStarting,
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
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Manual Generation Form */}
        <ManualGenerationForm
          onGenerate={handleGenerate}
          onPreview={handlePreview}
          isGenerating={isGenerating || isStarting}
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
            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="text-muted-foreground">
                <p className="font-medium">{t('manualGeneration.noActiveGeneration')}</p>
                <p className="text-sm mt-1">
                  {t('manualGeneration.noActiveGenerationHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        html={previewData?.html || null}
        title={previewData?.title || null}
        itemsCount={previewData?.items_count || 0}
      />

      {/* Help Panel */}
      <HelpPanel category="manual-generation" />
    </div>
  );
}
