/**
 * Template preview modal with viewport toggles.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Monitor,
  Tablet,
  Smartphone,
  X,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTemplatePreview } from '@/api/templates';
import { cn } from '@/lib/utils';

type Viewport = 'mobile' | 'tablet' | 'desktop';

interface TemplatePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  templateName?: string;
}

const viewportWidths: Record<Viewport, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1200,
};

export function TemplatePreview({
  open,
  onOpenChange,
  templateId,
  templateName,
}: TemplatePreviewProps) {
  const { t } = useTranslation();
  const [viewport, setViewport] = useState<Viewport>('desktop');

  const { data, isLoading, error } = useTemplatePreview(
    templateId || '',
    viewport,
    open && !!templateId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between">
          <DialogTitle className="flex-1">
            {templateName || t('templates.preview.title')}
          </DialogTitle>

          <div className="flex items-center gap-4">
            {/* Viewport toggles */}
            <ToggleGroup
              type="single"
              value={viewport}
              onValueChange={(value: Viewport) => value && setViewport(value)}
            >
              <ToggleGroupItem value="mobile" aria-label={t('templates.preview.mobile')}>
                <Smartphone className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="tablet" aria-label={t('templates.preview.tablet')}>
                <Tablet className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="desktop" aria-label={t('templates.preview.desktop')}>
                <Monitor className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Preview content */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4 flex justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive">
              {t('errors.generic')}
            </div>
          ) : data?.html ? (
            <div
              className={cn(
                'bg-white shadow-lg transition-all duration-300 rounded overflow-hidden',
                'min-h-[600px]'
              )}
              style={{ width: viewportWidths[viewport], maxWidth: '100%' }}
            >
              <iframe
                srcDoc={data.html}
                className="w-full h-full min-h-[600px] border-0"
                title="Template Preview"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('templates.preview.noContent')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
