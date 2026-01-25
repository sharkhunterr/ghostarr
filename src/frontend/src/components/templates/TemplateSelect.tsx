/**
 * Template select component with labels display.
 */

import { useTranslation } from 'react-i18next';
import { Star, Settings2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTemplates } from '@/api/templates';
import type { Template } from '@/types';

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

interface TemplateSelectProps {
  value: string;
  onValueChange: (templateId: string, template: Template | undefined) => void;
  disabled?: boolean;
  id?: string;
}

export function TemplateSelect({
  value,
  onValueChange,
  disabled,
  id,
}: TemplateSelectProps) {
  const { t } = useTranslation();
  const { data: templates, isLoading } = useTemplates();

  const handleChange = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    onValueChange(templateId, template);
  };

  const selectedTemplate = templates?.find((t) => t.id === value);
  const hasPreset = selectedTemplate?.preset_config && Object.keys(selectedTemplate.preset_config).length > 0;

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={t('dashboard.config.selectTemplate')}>
          {selectedTemplate && (
            <div className="flex items-center gap-2">
              <span className="truncate">{selectedTemplate.name}</span>
              {selectedTemplate.is_default && (
                <Star className="h-3 w-3 text-primary shrink-0" />
              )}
              {hasPreset && (
                <Settings2 className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              {selectedTemplate.labels && selectedTemplate.labels.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {selectedTemplate.labels.slice(0, 2).map((label) => (
                    <Badge
                      key={label.id}
                      className="text-[10px] px-1 py-0 h-4"
                      style={{
                        backgroundColor: label.color,
                        color: getContrastColor(label.color),
                      }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                  {selectedTemplate.labels.length > 2 && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      +{selectedTemplate.labels.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {templates?.map((template) => {
          const templateHasPreset = template.preset_config && Object.keys(template.preset_config).length > 0;
          return (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex items-center gap-2">
                <span>{template.name}</span>
                {template.is_default && (
                  <Star className="h-3 w-3 text-primary shrink-0" />
                )}
                {templateHasPreset && (
                  <Settings2 className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                {template.labels && template.labels.length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {template.labels.slice(0, 2).map((label) => (
                      <Badge
                        key={label.id}
                        className="text-[10px] px-1 py-0 h-4"
                        style={{
                          backgroundColor: label.color,
                          color: getContrastColor(label.color),
                        }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                    {template.labels.length > 2 && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        +{template.labels.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
