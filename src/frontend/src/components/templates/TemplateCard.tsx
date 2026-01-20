/**
 * Template card component for displaying template info.
 */

import { useTranslation } from 'react-i18next';
import {
  Eye,
  Edit,
  Trash2,
  Star,
  MoreVertical,
  FileText,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Template } from '@/types';

interface TemplateCardProps {
  template: Template;
  onPreview: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onSetDefault: (template: Template) => void;
}

export function TemplateCard({
  template,
  onPreview,
  onEdit,
  onDelete,
  onSetDefault,
}: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
      {/* Preview thumbnail area */}
      <div
        className="relative h-40 bg-muted flex items-center justify-center cursor-pointer"
        onClick={() => onPreview(template)}
      >
        <FileText className="h-16 w-16 text-muted-foreground/50" />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button variant="secondary" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            {t('templates.actions.preview')}
          </Button>
        </div>

        {/* Default badge */}
        {template.is_default && (
          <Badge
            className="absolute top-2 right-2 bg-primary"
          >
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

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.tags.length - 3}
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
