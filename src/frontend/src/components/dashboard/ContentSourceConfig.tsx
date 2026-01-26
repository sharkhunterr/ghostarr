/**
 * Content source configuration component.
 */

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTunarrChannels } from '@/api/integrations';
import type { ContentSourceConfig as ContentSourceConfigType, TautulliConfig, TunarrConfig } from '@/types';

interface TunarrChannelSelectorProps {
  selectedChannels: string[];
  onChannelsChange: (channels: string[]) => void;
}

function TunarrChannelSelector({ selectedChannels, onChannelsChange }: TunarrChannelSelectorProps) {
  const { t } = useTranslation();
  const { data: channels, isLoading, error } = useTunarrChannels();

  const handleChannelToggle = (channelId: string, checked: boolean) => {
    if (checked) {
      onChannelsChange([...selectedChannels, channelId]);
    } else {
      onChannelsChange(selectedChannels.filter((id) => id !== channelId));
    }
  };

  const handleSelectAll = () => {
    if (channels) {
      onChannelsChange(channels.map((ch) => ch.id));
    }
  };

  const handleSelectNone = () => {
    onChannelsChange([]);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>{t('dashboard.config.channels')}</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error || !channels) {
    return (
      <div className="space-y-2">
        <Label>{t('dashboard.config.channels')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('dashboard.config.channelsNotConfigured')}
        </p>
      </div>
    );
  }

  // Group channels by group
  const groupedChannels = channels.reduce((acc, channel) => {
    const group = channel.group || t('common.other');
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(channel);
    return acc;
  }, {} as Record<string, typeof channels>);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t('dashboard.config.channels')}</Label>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-primary hover:underline"
          >
            {t('common.all')}
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            type="button"
            onClick={handleSelectNone}
            className="text-primary hover:underline"
          >
            {t('common.none')}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('dashboard.config.channelsHelp')} ({selectedChannels.length}/{channels.length})
      </p>
      <ScrollArea className="h-48 rounded-md border p-2">
        <div className="space-y-4">
          {Object.entries(groupedChannels).map(([group, groupChannels]) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {group}
              </p>
              <div className="space-y-1">
                {groupChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`channel-${channel.id}`}
                      checked={selectedChannels.includes(channel.id)}
                      onCheckedChange={(checked) =>
                        handleChannelToggle(channel.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`channel-${channel.id}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2"
                    >
                      {channel.icon_url && (
                        <img
                          src={channel.icon_url}
                          alt=""
                          className="h-4 w-4 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="text-muted-foreground text-xs min-w-[2rem]">
                        {channel.number}
                      </span>
                      {channel.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

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
                max={500}
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
            <TunarrChannelSelector
              selectedChannels={(config as TunarrConfig).channels}
              onChannelsChange={(channels) =>
                updateConfig('channels' as keyof typeof config, channels as never)
              }
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
