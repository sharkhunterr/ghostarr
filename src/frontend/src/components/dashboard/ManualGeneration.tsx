/**
 * Manual generation form component.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Eye, Settings2, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { ContentSourceConfig } from './ContentSourceConfig';
import { MaintenanceConfig } from './MaintenanceConfig';
import { StatisticsConfig } from './StatisticsConfig';
import { TemplateSelect } from '@/components/templates';
import { useTemplates } from '@/api/templates';
import type { GenerationConfig, PublicationMode, Template } from '@/types';

interface ManualGenerationProps {
  onGenerate: (config: GenerationConfig) => void;
  onPreview: (config: GenerationConfig) => void;
  isGenerating?: boolean;
  isPreviewing?: boolean;
}

const defaultConfig: GenerationConfig = {
  template_id: '',
  title: 'Newsletter - Semaine {{date.week}}',
  publication_mode: 'draft',
  ghost_newsletter_id: null,
  tautulli: {
    enabled: true,
    days: 120,
    max_items: 10,
    featured_item: true,
  },
  romm: {
    enabled: true,
    days: 120,
    max_items: 5,
  },
  komga: {
    enabled: true,
    days: 120,
    max_items: 5,
  },
  audiobookshelf: {
    enabled: true,
    days: 120,
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

export function ManualGeneration({
  onGenerate,
  onPreview,
  isGenerating,
  isPreviewing,
}: ManualGenerationProps) {
  const { t } = useTranslation();
  const { data: templates, isLoading: isLoadingTemplates } = useTemplates();

  const [config, setConfig] = useState<GenerationConfig>(() => {
    const defaultTemplate = templates?.find((t) => t.is_default);
    return {
      ...defaultConfig,
      template_id: defaultTemplate?.id || '',
    };
  });

  // Update template_id when templates finish loading (if not already set)
  useEffect(() => {
    if (templates && templates.length > 0 && !config.template_id) {
      const defaultTemplate = templates.find((t) => t.is_default) || templates[0];
      if (defaultTemplate) {
        setConfig((prev) => ({
          ...prev,
          template_id: defaultTemplate.id,
        }));
      }
    }
  }, [templates, config.template_id]);

  // Handle template selection with preset config loading
  const handleTemplateChange = useCallback(
    (templateId: string, template: Template | undefined) => {
      setConfig((prev) => ({
        ...prev,
        template_id: templateId,
        // Apply template preset config if available
        ...(template?.preset_config || {}),
      }));
    },
    []
  );

  const updateConfig = useCallback(
    <K extends keyof GenerationConfig>(key: K, value: GenerationConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleGenerate = () => {
    if (!config.template_id) return;
    onGenerate(config);
  };

  const handlePreview = () => {
    if (!config.template_id) return;
    onPreview(config);
  };

  const isValid = config.template_id !== '';

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Settings2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          {t('dashboard.manualGeneration.title')}
        </CardTitle>
        <CardDescription className="hidden sm:block">
          {t('dashboard.manualGeneration.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {/* Basic settings */}
        <div className="space-y-4">
          {/* Template selection */}
          <div className="space-y-2">
            <Label htmlFor="template">{t('dashboard.config.template')}</Label>
            <TemplateSelect
              id="template"
              value={config.template_id}
              onValueChange={handleTemplateChange}
              disabled={isLoadingTemplates}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('dashboard.config.title')}</Label>
            <Input
              id="title"
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
            <Label htmlFor="publication_mode">
              {t('dashboard.config.publicationMode')}
            </Label>
            <Select
              value={config.publication_mode}
              onValueChange={(value: PublicationMode) =>
                updateConfig('publication_mode', value)
              }
            >
              <SelectTrigger id="publication_mode">
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
            <TabsTrigger value="extras">
              {t('dashboard.tabs.extras')}
            </TabsTrigger>
            <TabsTrigger value="statistics">
              {t('dashboard.tabs.statistics')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="media" className="space-y-4 pt-4">
            <ContentSourceConfig
              title={t('dashboard.sources.tautulli')}
              description={t('dashboard.sources.tautulliDesc')}
              config={config.tautulli}
              onChange={(value) => updateConfig('tautulli', value)}
              showFeatured
            />
          </TabsContent>

          <TabsContent value="extras" className="space-y-4 pt-4">
            <ContentSourceConfig
              title={t('dashboard.sources.romm')}
              description={t('dashboard.sources.rommDesc')}
              config={config.romm}
              onChange={(value) => updateConfig('romm', value)}
            />
            <ContentSourceConfig
              title={t('dashboard.sources.komga')}
              description={t('dashboard.sources.komgaDesc')}
              config={config.komga}
              onChange={(value) => updateConfig('komga', value)}
            />
            <ContentSourceConfig
              title={t('dashboard.sources.audiobookshelf')}
              description={t('dashboard.sources.audiobookshelfDesc')}
              config={config.audiobookshelf}
              onChange={(value) => updateConfig('audiobookshelf', value)}
            />
            <ContentSourceConfig
              title={t('dashboard.sources.tunarr')}
              description={t('dashboard.sources.tunarrDesc')}
              config={config.tunarr}
              onChange={(value) => updateConfig('tunarr', value)}
              showChannels
            />
          </TabsContent>

          <TabsContent value="statistics" className="pt-4">
            <StatisticsConfig
              config={config.statistics}
              onChange={(value) => updateConfig('statistics', value)}
            />
          </TabsContent>
        </Tabs>

        {/* Content options - applies to media/extras/statistics */}
        <div className="space-y-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5 flex-1">
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

        <Separator />

        {/* Maintenance section - separate from content */}
        <MaintenanceConfig
          config={config.maintenance}
          onChange={(value) => updateConfig('maintenance', value)}
        />

        <Separator />

        {/* Actions */}
        <div className="flex gap-2 sm:gap-3">
          <Button
            onClick={handleGenerate}
            disabled={!isValid || isGenerating}
            className="flex-1"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">
              {isGenerating
                ? t('dashboard.actions.generating')
                : t('dashboard.actions.generate')}
            </span>
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!isValid || isPreviewing}
          >
            <Eye className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">
              {isPreviewing
                ? t('dashboard.actions.previewing')
                : t('dashboard.actions.preview')}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
