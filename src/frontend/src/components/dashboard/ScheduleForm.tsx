/**
 * Schedule form component for creating/editing schedules.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X } from 'lucide-react';
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
import { CronInput } from './CronInput';
import { ContentSourceConfig } from './ContentSourceConfig';
import { MaintenanceConfig } from './MaintenanceConfig';
import { StatisticsConfig } from './StatisticsConfig';
import { TemplateSelect } from '@/components/templates';
import { useTemplates } from '@/api/templates';
import {
  useCreateSchedule,
  useUpdateSchedule,
  type ScheduleCreateData,
  type ScheduleUpdateData,
} from '@/api/schedules';
import type { Schedule, GenerationConfig, PublicationMode, Template } from '@/types';

interface ScheduleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule | null;
  onSuccess?: () => void;
}

const defaultConfig: GenerationConfig = {
  template_id: '',
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

export function ScheduleForm({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: ScheduleFormProps) {
  const { t } = useTranslation();
  const { data: templates, isLoading: isLoadingTemplates } = useTemplates();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  const isEditing = !!schedule;

  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 8 * * 1');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [isActive, setIsActive] = useState(true);
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);

  // Reset form when opening/schedule changes
  useEffect(() => {
    if (open) {
      if (schedule) {
        setName(schedule.name);
        setCronExpression(schedule.cron_expression);
        setTimezone(schedule.timezone);
        setIsActive(schedule.is_active);
        setConfig(schedule.generation_config);
      } else {
        setName('');
        setCronExpression('0 8 * * 1');
        setTimezone('Europe/Paris');
        setIsActive(true);
        const defaultTemplate = templates?.find((t) => t.is_default);
        setConfig({
          ...defaultConfig,
          template_id: defaultTemplate?.id || '',
        });
      }
    }
  }, [open, schedule, templates]);

  const handleTemplateChange = useCallback(
    (templateId: string, template: Template | undefined) => {
      setConfig((prev) => ({
        ...prev,
        template_id: templateId,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && schedule) {
        const data: ScheduleUpdateData = {
          name,
          cron_expression: cronExpression,
          timezone,
          is_active: isActive,
          template_id: config.template_id,
          generation_config: config,
        };
        await updateSchedule.mutateAsync({
          scheduleId: schedule.id,
          data,
        });
      } else {
        const data: ScheduleCreateData = {
          name,
          cron_expression: cronExpression,
          timezone,
          is_active: isActive,
          template_id: config.template_id,
          generation_config: config,
        };
        await createSchedule.mutateAsync(data);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const isValid = name.trim() !== '' && config.template_id !== '';
  const isLoading = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t('schedule.form.editTitle')
                : t('schedule.form.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? t('schedule.form.editDescription')
                : t('schedule.form.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-name">
                  {t('schedule.form.name')}
                </Label>
                <Input
                  id="schedule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('schedule.form.namePlaceholder')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('schedule.form.active')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('schedule.form.activeHelp')}
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            <Separator />

            {/* CRON Schedule */}
            <CronInput
              value={cronExpression}
              onChange={setCronExpression}
              timezone={timezone}
              showPreview
            />

            {/* Timezone */}
            <div className="space-y-2">
              <Label>{t('schedule.form.timezone')}</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Generation Config */}
            <div className="space-y-4">
              <h4 className="font-medium">{t('schedule.form.generationConfig')}</h4>

              {/* Template */}
              <div className="space-y-2">
                <Label htmlFor="schedule-template">{t('dashboard.config.template')}</Label>
                <TemplateSelect
                  id="schedule-template"
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

            {/* Content sources */}
            <Tabs defaultValue="media" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="media">
                  {t('dashboard.tabs.media')}
                </TabsTrigger>
                <TabsTrigger value="extras">
                  {t('dashboard.tabs.extras')}
                </TabsTrigger>
                <TabsTrigger value="statistics">
                  {t('dashboard.tabs.statistics')}
                </TabsTrigger>
                <TabsTrigger value="maintenance">
                  {t('dashboard.tabs.maintenance')}
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

              <TabsContent value="maintenance" className="pt-4">
                <MaintenanceConfig
                  config={config.maintenance}
                  onChange={(value) => updateConfig('maintenance', value)}
                />
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Advanced options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
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

              <div className="flex items-center justify-between">
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
