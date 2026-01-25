/**
 * Template card component for displaying template info.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  Edit,
  Trash2,
  Star,
  MoreVertical,
  FileText,
  Loader2,
  Settings2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTemplatePreview } from '@/api/templates';
import type { Template } from '@/types';

/**
 * Calculate contrasting text color (black or white) based on background color.
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface TemplateCardProps {
  template: Template;
  onPreview: (template: Template) => void;
  onEdit: (template: Template) => void;
  onConfigurePreset: (template: Template) => void;
  onDelete: (template: Template) => void;
  onSetDefault: (template: Template) => void;
}

export function TemplateCard({
  template,
  onPreview,
  onEdit,
  onConfigurePreset,
  onDelete,
  onSetDefault,
}: TemplateCardProps) {
  const { t } = useTranslation();

  // Fetch template preview HTML for thumbnail
  const { data: previewData, isLoading: isLoadingPreview } = useTemplatePreview(
    template.id,
    'desktop',
    true
  );

  // Track container dimensions for dynamic scaling
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate scale to fit iframe in container
  const iframeConfig = useMemo(() => {
    const iframeWidth = 1200;
    const iframeHeight = 900;

    if (containerSize.width === 0) {
      return { scale: 0.25, width: iframeWidth, height: iframeHeight };
    }

    // Scale to fill container width
    const scale = containerSize.width / iframeWidth;

    return { scale, width: iframeWidth, height: iframeHeight };
  }, [containerSize.width]);

  // Create a data URL for the iframe srcdoc
  const thumbnailHtml = useMemo(() => {
    if (!previewData?.html) return null;
    // Wrap HTML to ensure proper rendering in scaled iframe
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>${previewData.html}</body>
      </html>
    `;
  }, [previewData?.html]);

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
      {/* Preview thumbnail area */}
      <div
        ref={containerRef}
        className="relative h-48 bg-muted cursor-pointer overflow-hidden"
        onClick={() => onPreview(template)}
      >
        {isLoadingPreview ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-muted-foreground/50 animate-spin" />
          </div>
        ) : thumbnailHtml ? (
          <div className="absolute inset-0 overflow-hidden">
            {/* Scaled iframe showing template preview - fills container width */}
            <iframe
              srcDoc={thumbnailHtml}
              className="pointer-events-none border-0 absolute top-0 left-0"
              style={{
                width: `${iframeConfig.width}px`,
                height: `${iframeConfig.height}px`,
                transform: `scale(${iframeConfig.scale})`,
                transformOrigin: 'top left',
              }}
              title={`${template.name} preview`}
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
          <Button variant="secondary" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            {t('templates.actions.preview')}
          </Button>
        </div>

        {/* Default badge */}
        {template.is_default && (
          <Badge className="absolute top-2 right-2 bg-primary z-10">
            <Star className="h-3 w-3 mr-1" />
            {t('templates.default')}
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{template.name}</h3>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {template.description}
              </p>
            )}

            {/* Labels */}
            {template.labels && template.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {template.labels.slice(0, 3).map((label) => (
                  <Badge
                    key={label.id}
                    className="text-xs"
                    style={{
                      backgroundColor: label.color,
                      color: getContrastColor(label.color),
                    }}
                  >
                    {label.name}
                  </Badge>
                ))}
                {template.labels.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.labels.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(template)}>
                <Eye className="h-4 w-4 mr-2" />
                {t('templates.actions.preview')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="h-4 w-4 mr-2" />
                {t('templates.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConfigurePreset(template)}>
                <Settings2 className="h-4 w-4 mr-2" />
                {t('templates.actions.configurePreset')}
              </DropdownMenuItem>
              {!template.is_default && (
                <DropdownMenuItem onClick={() => onSetDefault(template)}>
                  <Star className="h-4 w-4 mr-2" />
                  {t('templates.actions.setDefault')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(template)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('templates.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
