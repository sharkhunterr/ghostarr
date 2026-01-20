/**
 * History filters component.
 */

import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useTemplates } from '@/api/templates';
import type { GenerationType, GenerationStatus } from '@/types';
import type { HistoryFilters as Filters } from '@/api/history';

interface HistoryFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function HistoryFilters({ filters, onChange }: HistoryFiltersProps) {
  const { t } = useTranslation();
  const { data: templates } = useTemplates();

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    onChange({});
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            {t('common.filter')}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{t('history.filters.title')}</h4>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-auto py-1 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('history.filters.clear')}
                </Button>
              )}
            </div>

            {/* Type filter */}
            <div className="space-y-2">
              <Label className="text-sm">{t('history.filters.type')}</Label>
              <Select
                value={filters.type || ''}
                onValueChange={(value: GenerationType | '') =>
                  updateFilter('type', value as GenerationType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.all')}</SelectItem>
                  <SelectItem value="manual">
                    {t('history.types.manual')}
                  </SelectItem>
                  <SelectItem value="automatic">
                    {t('history.types.automatic')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-2">
              <Label className="text-sm">{t('history.filters.status')}</Label>
              <Select
                value={filters.status || ''}
                onValueChange={(value: GenerationStatus | '') =>
                  updateFilter('status', value as GenerationStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.all')}</SelectItem>
                  <SelectItem value="success">
                    {t('history.status.success')}
                  </SelectItem>
                  <SelectItem value="failed">
                    {t('history.status.failed')}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {t('history.status.cancelled')}
                  </SelectItem>
                  <SelectItem value="running">
                    {t('history.status.running')}
                  </SelectItem>
                  <SelectItem value="pending">
                    {t('history.status.pending')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template filter */}
            <div className="space-y-2">
              <Label className="text-sm">{t('history.filters.template')}</Label>
              <Select
                value={filters.template_id || ''}
                onValueChange={(value) => updateFilter('template_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.all')}</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-sm">{t('history.filters.startDate')}</Label>
                <Input
                  type="date"
                  value={filters.start_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    updateFilter(
                      'start_date',
                      e.target.value ? `${e.target.value}T00:00:00` : undefined
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t('history.filters.endDate')}</Label>
                <Input
                  type="date"
                  value={filters.end_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    updateFilter(
                      'end_date',
                      e.target.value ? `${e.target.value}T23:59:59` : undefined
                    )
                  }
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.type && (
            <Badge variant="secondary" className="gap-1">
              {t(`history.types.${filters.type}`)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter('type', undefined)}
              />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              {t(`history.status.${filters.status}`)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter('status', undefined)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
