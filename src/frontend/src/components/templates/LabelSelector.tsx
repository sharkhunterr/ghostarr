/**
 * Label Selector component for assigning labels to templates.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Tag, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLabels, useAssignLabelsToTemplate } from '@/api/labels';
import { LabelManager } from './LabelManager';
import type { Label } from '@/types';

/**
 * Calculate contrasting text color (black or white) based on background color.
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface LabelSelectorProps {
  templateId: string;
  selectedLabels: Label[];
  onLabelsChange?: (labels: Label[]) => void;
}

export function LabelSelector({
  templateId,
  selectedLabels,
  onLabelsChange,
}: LabelSelectorProps) {
  const { t } = useTranslation();
  const { data: allLabels, isLoading } = useLabels();
  const assignLabels = useAssignLabelsToTemplate();
  const [managerOpen, setManagerOpen] = useState(false);

  const selectedIds = new Set(selectedLabels.map((l) => l.id));

  const toggleLabel = async (label: Label) => {
    const newSelectedIds = new Set(selectedIds);

    if (selectedIds.has(label.id)) {
      newSelectedIds.delete(label.id);
    } else {
      newSelectedIds.add(label.id);
    }

    try {
      const result = await assignLabels.mutateAsync({
        templateId,
        labelIds: Array.from(newSelectedIds),
      });

      if (onLabelsChange) {
        onLabelsChange(result.labels);
      }
    } catch (error) {
      console.error('Failed to assign labels:', error);
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Tag className="h-3.5 w-3.5 mr-1" />
            {t('labels.selector.button')}
            {selectedLabels.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {selectedLabels.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-medium">
                {t('labels.selector.title')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setManagerOpen(true)}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>

            <ScrollArea className="h-[200px]">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-4 text-sm">
                  {t('common.loading')}
                </div>
              ) : allLabels && allLabels.length > 0 ? (
                <div className="space-y-1">
                  {allLabels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                      onClick={() => toggleLabel(label)}
                      disabled={assignLabels.isPending}
                    >
                      <Badge
                        style={{
                          backgroundColor: label.color,
                          color: getContrastColor(label.color),
                        }}
                      >
                        {label.name}
                      </Badge>
                      {selectedIds.has(label.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4 text-sm">
                  <p>{t('labels.selector.empty')}</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1"
                    onClick={() => setManagerOpen(true)}
                  >
                    {t('labels.selector.createFirst')}
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      <LabelManager open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
