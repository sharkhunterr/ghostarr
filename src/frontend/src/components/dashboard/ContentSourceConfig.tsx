/**
 * Content source configuration component.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import type { ContentSourceConfig as ContentSourceConfigType, TautulliConfig, TunarrConfig } from '@/types';

interface ContentSourceConfigProps {
  title: string;
  description: string;
  config: ContentSourceConfigType | TautulliConfig | TunarrConfig;
  onChange: (config: ContentSourceConfigType | TautulliConfig | TunarrConfig) => void;
  showFeatured?: boolean;
  showChannels?: boolean;
}

export function ContentSourceConfig({
  title,
  description,
  config,
  onChange,
  showFeatured,
  showChannels,
}: ContentSourceConfigProps) {
  const { t } = useTranslation();

  const updateConfig = <K extends keyof typeof config>(
    key: K,
    value: (typeof config)[K]
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <Card className={!config.enabled ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig('enabled', checked)}
          />
        </div>
      </CardHeader>
      {config.enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Days */}
            <div className="space-y-2">
              <Label htmlFor={`${title}-days`}>
                {t('dashboard.config.days')}
              </Label>
              <Input
                id={`${title}-days`}
                type="number"
                min={1}
                max={30}
                value={config.days}
                onChange={(e) =>
                  updateConfig('days', parseInt(e.target.value) || 7)
                }
              />
            </div>

            {/* Max items */}
            <div className="space-y-2">
              <Label htmlFor={`${title}-maxItems`}>
                {t('dashboard.config.maxItems')}
              </Label>
              <Input
                id={`${title}-maxItems`}
                type="number"
                min={1}
                max={50}
                value={config.max_items}
                onChange={(e) =>
                  updateConfig('max_items', parseInt(e.target.value) || 10)
                }
              />
            </div>
          </div>

          {/* Featured item (Tautulli) */}
          {showFeatured && 'featured_item' in config && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${title}-featured`}
                checked={(config as TautulliConfig).featured_item}
                onCheckedChange={(checked) =>
                  updateConfig('featured_item' as keyof typeof config, checked as boolean)
                }
              />
              <Label htmlFor={`${title}-featured`} className="text-sm">
                {t('dashboard.config.featuredItem')}
              </Label>
            </div>
          )}

          {/* Channels (Tunarr) */}
          {showChannels && 'channels' in config && (
            <div className="space-y-2">
              <Label>{t('dashboard.config.channels')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.config.channelsHelp')}
              </p>
              {/* Channel selection would go here - simplified for now */}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
