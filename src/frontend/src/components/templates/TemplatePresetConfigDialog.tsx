/**
 * Dialog for configuring template preset generation parameters.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Loader2, Settings2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContentSourceConfig } from '@/components/dashboard/ContentSourceConfig';
import { MaintenanceConfig } from '@/components/dashboard/MaintenanceConfig';
import { StatisticsConfig } from '@/components/dashboard/StatisticsConfig';
import { useUpdateTemplate } from '@/api/templates';
import type { Template, GenerationConfig, PublicationMode } from '@/types';

interface TemplatePresetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSuccess?: () => void;
}

const defaultConfig: Omit<GenerationConfig, 'template_id'> = {
  title: 'Newsletter - Semaine {{date.week}}',
  publication_mode: 'draft',
  ghost_newsletter_id: null,
  tautulli: {
    enabled: true,
    days: 7,
    max_items: 10,
    featured_item: true,
  },
  romm: {
    enabled: false,
    days: 7,
    max_items: 5,
  },
  komga: {
    enabled: false,
    days: 7,
    max_items: 5,
  },
  audiobookshelf: {
    enabled: false,
    days: 7,
    max_items: 5,
  },
  tunarr: {
    enabled: false,
    days: 7,
    max_items: 10,
    channels: [],
    display_format: 'list',
  },
  statistics: {
    enabled: true,
    days: 7,
    include_comparison: true,
  },
  maintenance: {
    enabled: false,
    description: '',
    type: 'scheduled',
    duration_value: 1,
    duration_unit: 'hours',
    start_datetime: null,
  },
  max_total_items: 20,
  skip_if_empty: true,
};

export function TemplatePresetConfigDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplatePresetConfigDialogProps) {
  const { t } = useTranslation();
  const updateTemplate = useUpdateTemplate();

  const [config, setConfig] = useState<Omit<GenerationConfig, 'template_id'>>(defaultConfig);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Check if template has preset config
  const hasPresetConfig = template?.preset_config && Object.keys(template.preset_config).length > 0;

  // Reset form when template changes
  useEffect(() => {
    if (template && open) {
      if (hasPresetConfig) {
        // Load existing preset config
        setConfig({
          ...defaultConfig,
          ...template.preset_config,
        });
      } else {
        // Start with default config
        setConfig(defaultConfig);
      }
    }
  }, [template, open, hasPresetConfig]);

  const updateConfig = useCallback(
    <K extends keyof Omit<GenerationConfig, 'template_id'>>(
      key: K,
      value: Omit<GenerationConfig, 'template_id'>[K]
    ) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!template) return;

    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: {
          preset_config: config,
        },
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update template preset config:', error);
    }
  };

  const handleClearPreset = async () => {
    if (!template) return;

    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: {
          preset_config: {},
        },
      });

      setShowClearConfirm(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to clear template preset config:', error);
    }
  };

  const isLoading = updateTemplate.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                {t('templates.presetConfig.title')}
              </DialogTitle>
              <DialogDescription>
                {t('templates.presetConfig.description', { name: template?.name })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic settings */}
              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="preset-title">{t('dashboard.config.title')}</Label>
                  <Input
                    id="preset-title"
                    value={config.title}
                    onChange={(e) => updateConfig('title', e.target.value)}
                    placeholder="Newsletter - Semaine {{date.week}}"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.config.titleHelp')}
                  </p>
                </div>

                {/* Publication mode */}
                <div className="space-y-2">
                  <Label htmlFor="preset-publication_mode">
                    {t('dashboard.config.publicationMode')}
                  </Label>
                  <Select
                    value={config.publication_mode}
                    onValueChange={(value: PublicationMode) =>
                      updateConfig('publication_mode', value)
                    }
                  >
                    <SelectTrigger id="preset-publication_mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        {t('dashboard.config.modes.draft')}
                      </SelectItem>
                      <SelectItem value="publish">
                        {t('dashboard.config.modes.publish')}
                      </SelectItem>
                      <SelectItem value="email">
                        {t('dashboard.config.modes.email')}
                      </SelectItem>
                      <SelectItem value="email+publish">
                        {t('dashboard.config.modes.emailPublish')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Content sources tabs */}
              <Tabs defaultValue="media" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="media">
                    {t('dashboard.tabs.media')}
                  </TabsTrigger>
                  <TabsTrigger value="tvPrograms">
                    {t('dashboard.tabs.tvPrograms')}
                  </TabsTrigger>
                  <TabsTrigger value="maintenance">
                    {t('dashboard.tabs.maintenance')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="media" className="space-y-4 pt-4">
                  {/* Master switch for all media */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="font-medium">{t('dashboard.media.enableAll')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.media.enableAllHelp')}
                      </p>
                    </div>
                    <Switch
                      checked={
                        config.tautulli.enabled ||
                        config.romm.enabled ||
                        config.komga.enabled ||
                        config.audiobookshelf.enabled ||
                        config.statistics.enabled
                      }
                      onCheckedChange={(checked) => {
                        updateConfig('tautulli', { ...config.tautulli, enabled: checked });
                        updateConfig('romm', { ...config.romm, enabled: checked });
                        updateConfig('komga', { ...config.komga, enabled: checked });
                        updateConfig('audiobookshelf', { ...config.audiobookshelf, enabled: checked });
                        updateConfig('statistics', { ...config.statistics, enabled: checked });
                      }}
                    />
                  </div>

                  {/* Films & Series */}
                  <ContentSourceConfig
                    title={t('dashboard.sources.tautulli')}
                    description={t('dashboard.sources.tautulliDesc')}
                    config={config.tautulli}
                    onChange={(value) => updateConfig('tautulli', value)}
                    showFeatured
                  />

                  {/* Statistics */}
                  <StatisticsConfig
                    config={config.statistics}
                    onChange={(value) => updateConfig('statistics', value)}
                  />

                  {/* Video Games */}
                  <ContentSourceConfig
                    title={t('dashboard.sources.romm')}
                    description={t('dashboard.sources.rommDesc')}
                    config={config.romm}
                    onChange={(value) => updateConfig('romm', value)}
                  />

                  {/* Comics & Books */}
                  <ContentSourceConfig
                    title={t('dashboard.sources.komga')}
                    description={t('dashboard.sources.komgaDesc')}
                    config={config.komga}
                    onChange={(value) => updateConfig('komga', value)}
                  />

                  {/* Audiobooks */}
                  <ContentSourceConfig
                    title={t('dashboard.sources.audiobookshelf')}
                    description={t('dashboard.sources.audiobookshelfDesc')}
                    config={config.audiobookshelf}
                    onChange={(value) => updateConfig('audiobookshelf', value)}
                  />

                  {/* Max items - only for media */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label>{t('dashboard.config.maxItems')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.config.maxItemsHelp')}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={config.max_total_items}
                      onChange={(e) =>
                        updateConfig('max_total_items', parseInt(e.target.value) || 20)
                      }
                      className="w-20"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="tvPrograms" className="space-y-4 pt-4">
                  <ContentSourceConfig
                    title={t('dashboard.sources.tunarr')}
                    description={t('dashboard.sources.tunarrDesc')}
                    config={config.tunarr}
                    onChange={(value) => updateConfig('tunarr', value)}
                    showChannels
                  />
                </TabsContent>

                <TabsContent value="maintenance" className="pt-4">
                  <MaintenanceConfig
                    config={config.maintenance}
                    onChange={(value) => updateConfig('maintenance', value)}
                  />
                </TabsContent>
              </Tabs>

              {/* Skip if empty option */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label>{t('dashboard.config.skipEmpty')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.config.skipEmptyHelp')}
                  </p>
                </div>
                <Switch
                  checked={config.skip_if_empty}
                  onCheckedChange={(checked) => updateConfig('skip_if_empty', checked)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {hasPresetConfig && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-destructive hover:text-destructive mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('templates.presetConfig.clear')}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clear confirmation dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templates.presetConfig.clearConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('templates.presetConfig.clearConfirm.message')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPreset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('templates.presetConfig.clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
