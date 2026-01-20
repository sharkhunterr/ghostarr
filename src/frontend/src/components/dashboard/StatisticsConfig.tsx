/**
 * Statistics configuration component.
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
import { Checkbox } from '@/components/ui/checkbox';
import type { StatisticsConfig as StatisticsConfigType } from '@/types';

interface StatisticsConfigProps {
  config: StatisticsConfigType;
  onChange: (config: StatisticsConfigType) => void;
}

export function StatisticsConfig({ config, onChange }: StatisticsConfigProps) {
  const { t } = useTranslation();

  const updateConfig = <K extends keyof StatisticsConfigType>(
    key: K,
    value: StatisticsConfigType[K]
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <Card className={!config.enabled ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {t('dashboard.statistics.title')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('dashboard.statistics.description')}
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
          {/* Days */}
          <div className="space-y-2">
            <Label htmlFor="stats-days">
              {t('dashboard.statistics.days')}
            </Label>
            <Input
              id="stats-days"
              type="number"
              min={1}
              max={30}
              value={config.days}
              onChange={(e) =>
                updateConfig('days', parseInt(e.target.value) || 7)
              }
              className="w-32"
            />
          </div>

          {/* Include comparison */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-comparison"
              checked={config.include_comparison}
              onCheckedChange={(checked) =>
                updateConfig('include_comparison', checked as boolean)
              }
            />
            <div>
              <Label htmlFor="include-comparison" className="text-sm">
                {t('dashboard.statistics.includeComparison')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.statistics.includeComparisonHelp')}
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
