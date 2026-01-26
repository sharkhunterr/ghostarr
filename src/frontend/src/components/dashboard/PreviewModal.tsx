/**
 * Preview modal component for viewing newsletter before publishing.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string | null;
  title: string | null;
  itemsCount: number;
}

type Viewport = 'desktop' | 'tablet' | 'mobile';

const viewportConfig = {
  desktop: { width: '100%', icon: Monitor },
  tablet: { width: '768px', icon: Tablet },
  mobile: { width: '375px', icon: Smartphone },
};

export function PreviewModal({
  open,
  onOpenChange,
  html,
  title,
  itemsCount,
}: PreviewModalProps) {
  const { t } = useTranslation();
  const [viewport, setViewport] = useState<Viewport>('desktop');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">
                {title || t('dashboard.preview.title')}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <Badge variant="secondary">{itemsCount} {t('dashboard.items')}</Badge>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Viewport selector */}
              <div className="flex border rounded-md">
                {(Object.keys(viewportConfig) as Viewport[]).map((v) => {
                  const Icon = viewportConfig[v].icon;
                  return (
                    <Button
                      key={v}
                      variant={viewport === v ? 'default' : 'ghost'}
                      size="icon"
                      className="h-8 w-8 rounded-none first:rounded-l-md last:rounded-r-md"
                      onClick={() => setViewport(v)}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Preview iframe */}
        <div className="flex-1 bg-muted/50 rounded-lg overflow-hidden flex items-center justify-center p-4">
          <div
            className="bg-white shadow-lg overflow-auto transition-all duration-200"
            style={{
              width: viewportConfig[viewport].width,
              maxWidth: '100%',
              height: '100%',
            }}
          >
            {html ? (
              <iframe
                srcDoc={html}
                title="Newsletter Preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t('dashboard.preview.noContent')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
