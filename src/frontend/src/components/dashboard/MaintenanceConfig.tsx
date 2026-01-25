/**
 * Maintenance notice configuration component.
 */

import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MaintenanceConfig as MaintenanceConfigType, MaintenanceType } from '@/types';

interface MaintenanceConfigProps {
  config: MaintenanceConfigType;
  onChange: (config: MaintenanceConfigType) => void;
}

const maintenanceTypes: MaintenanceType[] = [
  'scheduled',
  'outage',
  'network',
  'update',
  'improvement',
  'security',
];

export function MaintenanceConfig({ config, onChange }: MaintenanceConfigProps) {
  const { t } = useTranslation();

  const updateConfig = <K extends keyof MaintenanceConfigType>(
    key: K,
    value: MaintenanceConfigType[K]
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <Card className={!config.enabled ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {t('dashboard.maintenance.title')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('dashboard.maintenance.description')}
            </CardDescription>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig('enabled', checked)}
          />
        </div>
      </CardHeader>
      {config.enabled && (
        <CardContent className="space-y-4">
          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="maintenance-type">
              {t('dashboard.maintenance.type')}
            </Label>
            <Select
              value={config.type}
              onValueChange={(value: MaintenanceType) =>
                updateConfig('type', value)
              }
            >
              <SelectTrigger id="maintenance-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {maintenanceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`dashboard.maintenance.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="maintenance-description">
              {t('dashboard.maintenance.descriptionLabel')}
            </Label>
            <Textarea
              id="maintenance-description"
              value={config.description}
              onChange={(e) => updateConfig('description', e.target.value)}
              placeholder={t('dashboard.maintenance.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>{t('dashboard.maintenance.duration')}</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="number"
                min={1}
                value={config.duration_value}
                onChange={(e) =>
                  updateConfig('duration_value', parseInt(e.target.value) || 1)
                }
                className="w-full sm:w-24"
              />
              <Select
                value={config.duration_unit}
                onValueChange={(value: 'hours' | 'days' | 'weeks') =>
                  updateConfig('duration_unit', value)
                }
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">
                    {t('dashboard.maintenance.units.hours')}
                  </SelectItem>
                  <SelectItem value="days">
                    {t('dashboard.maintenance.units.days')}
                  </SelectItem>
                  <SelectItem value="weeks">
                    {t('dashboard.maintenance.units.weeks')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Start datetime */}
          <div className="space-y-2">
            <Label htmlFor="maintenance-start">
              {t('dashboard.maintenance.startTime')}
            </Label>
            <Input
              id="maintenance-start"
              type="datetime-local"
              value={config.start_datetime || ''}
              onChange={(e) =>
                updateConfig('start_datetime', e.target.value || null)
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.maintenance.startTimeHelp')}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
