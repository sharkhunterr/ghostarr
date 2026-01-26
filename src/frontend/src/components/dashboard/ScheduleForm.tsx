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
import type { Schedule, GenerationConfig, DeletionConfig, PublicationMode, ScheduleType, Template } from '@/types';

interface ScheduleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule | null;
  defaultScheduleType?: ScheduleType;
  onSuccess?: () => void;
}

const defaultDeletionConfig: DeletionConfig = {
  retention_days: 30,
  delete_from_ghost: false,
};

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
  defaultScheduleType = 'generation',
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
  const [scheduleType, setScheduleType] = useState<ScheduleType>(defaultScheduleType);
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [deletionConfig, setDeletionConfig] = useState<DeletionConfig>(defaultDeletionConfig);

  // Reset form when opening/schedule changes
  useEffect(() => {
    if (open) {
      if (schedule) {
        setName(schedule.name);
        setCronExpression(schedule.cron_expression);
        setTimezone(schedule.timezone);
        setIsActive(schedule.is_active);
        setScheduleType(schedule.schedule_type || 'generation');
        if (schedule.generation_config) {
          setConfig(schedule.generation_config);
        }
        if (schedule.deletion_config) {
          setDeletionConfig(schedule.deletion_config);
        }
      } else {
        setName('');
        setCronExpression('0 8 * * 1');
        setTimezone('Europe/Paris');
        setIsActive(true);
        setScheduleType(defaultScheduleType);
        const defaultTemplate = templates?.find((t) => t.is_default);
        setConfig({
          ...defaultConfig,
          template_id: defaultTemplate?.id || '',
        });
        setDeletionConfig(defaultDeletionConfig);
      }
    }
  }, [open, schedule, templates, defaultScheduleType]);

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
      const baseData = {
        name,
        cron_expression: cronExpression,
        timezone,
        is_active: isActive,
      };

      if (isEditing && schedule) {
        const data: ScheduleUpdateData = {
          ...baseData,
          ...(scheduleType === 'generation'
            ? {
                template_id: config.template_id,
                generation_config: config,
              }
            : {
                deletion_config: deletionConfig,
              }),
        };
        await updateSchedule.mutateAsync({
          scheduleId: schedule.id,
          data,
        });
      } else {
        const data: ScheduleCreateData = {
          ...baseData,
          schedule_type: scheduleType,
          ...(scheduleType === 'generation'
            ? {
                template_id: config.template_id,
                generation_config: config,
              }
            : {
                deletion_config: deletionConfig,
              }),
        };
        await createSchedule.mutateAsync(data);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const isValid =
    name.trim() !== '' &&
    (scheduleType === 'generation'
      ? config.template_id !== ''
      : deletionConfig.retention_days > 0);
  const isLoading = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? scheduleType === 'generation'
                  ? t('schedule.form.editTitle')
                  : t('schedule.form.editDeletionTitle')
                : scheduleType === 'generation'
                ? t('schedule.form.createTitle')
                : t('schedule.form.createDeletionTitle')}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? scheduleType === 'generation'
                  ? t('schedule.form.editDescription')
                  : t('schedule.form.editDeletionDescription')
                : scheduleType === 'generation'
                ? t('schedule.form.createDescription')
                : t('schedule.form.createDeletionDescription')}
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

            {/* Generation Config - only for generation schedules */}
            {scheduleType === 'generation' && (
              <>
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
                  <TabsList className="w-full flex overflow-x-auto">
                    <TabsTrigger value="media" className="flex-1 text-xs sm:text-sm min-w-0">
                      {t('dashboard.tabs.media')}
                    </TabsTrigger>
                    <TabsTrigger value="tvPrograms" className="flex-1 text-xs sm:text-sm min-w-0">
                      {t('dashboard.tabs.tvPrograms')}
                    </TabsTrigger>
                    <TabsTrigger value="maintenance" className="flex-1 text-xs sm:text-sm min-w-0">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
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

                <Separator />

                {/* Skip if empty option */}
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
              </>
            )}

            {/* Deletion Config - only for deletion schedules */}
            {scheduleType === 'deletion' && (
              <div className="space-y-4">
                <h4 className="font-medium">{t('schedule.form.deletionConfig')}</h4>

                {/* Retention days */}
                <div className="space-y-2">
                  <Label htmlFor="retention-days">
                    {t('schedule.deletion.retentionDays')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('schedule.deletion.retentionDaysHelp')}
                  </p>
                  <Input
                    id="retention-days"
                    type="number"
                    min={1}
                    max={365}
                    value={deletionConfig.retention_days}
                    onChange={(e) =>
                      setDeletionConfig({
                        ...deletionConfig,
                        retention_days: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-32"
                  />
                </div>

                {/* Delete from Ghost */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="font-medium">
                      {t('schedule.deletion.deleteFromGhost')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('schedule.deletion.deleteFromGhostHelp')}
                    </p>
                  </div>
                  <Switch
                    checked={deletionConfig.delete_from_ghost}
                    onCheckedChange={(checked) =>
                      setDeletionConfig({
                        ...deletionConfig,
                        delete_from_ghost: checked,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.cancel')}</span>
            </Button>
            <Button type="submit" disabled={!isValid || isLoading} className="w-full sm:w-auto">
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{isLoading ? t('common.loading') : t('common.save')}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
