/**
 * CRON expression input with simple mode toggle and preview.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useValidateCron } from '@/api/schedules';
import { cn } from '@/lib/utils';

type Frequency = 'daily' | 'weekly' | 'monthly';
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface CronInputProps {
  value: string;
  onChange: (value: string) => void;
  timezone?: string;
  showPreview?: boolean;
  error?: string;
}

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function CronInput({
  value,
  onChange,
  timezone: _timezone = 'Europe/Paris',
  showPreview = true,
  error,
}: CronInputProps) {
  const { t } = useTranslation();
  const [isSimpleMode, setIsSimpleMode] = useState(true);
  const [simpleConfig, setSimpleConfig] = useState<{
    frequency: Frequency;
    hour: number;
    minute: number;
    weekday: Weekday;
    dayOfMonth: number;
  }>({
    frequency: 'weekly',
    hour: 8,
    minute: 0,
    weekday: 1,
    dayOfMonth: 1,
  });

  const validateCron = useValidateCron();

  // Parse CRON to simple mode if possible (only on initial mount)
  useEffect(() => {
    if (!value) return;

    const parts = value.split(' ');
    if (parts.length !== 5) return;

    const [minute, hour, dayOfMonth, , weekday] = parts;

    // Try to detect pattern
    if (weekday !== '*' && dayOfMonth === '*') {
      // Weekly
      setSimpleConfig({
        frequency: 'weekly',
        minute: parseInt(minute) || 0,
        hour: parseInt(hour) || 8,
        weekday: (parseInt(weekday) || 1) as Weekday,
        dayOfMonth: 1,
      });
      setIsSimpleMode(true);
    } else if (dayOfMonth !== '*' && weekday === '*') {
      // Monthly
      setSimpleConfig({
        frequency: 'monthly',
        minute: parseInt(minute) || 0,
        hour: parseInt(hour) || 8,
        weekday: 1,
        dayOfMonth: parseInt(dayOfMonth) || 1,
      });
      setIsSimpleMode(true);
    } else if (dayOfMonth === '*' && weekday === '*') {
      // Daily
      setSimpleConfig({
        frequency: 'daily',
        minute: parseInt(minute) || 0,
        hour: parseInt(hour) || 8,
        weekday: 1,
        dayOfMonth: 1,
      });
      setIsSimpleMode(true);
    } else {
      // Complex pattern, switch to advanced
      setIsSimpleMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate CRON from simple config
  const simpleToCron = useMemo(() => {
    const { frequency, hour, minute, weekday, dayOfMonth } = simpleConfig;

    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${weekday}`;
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth} * *`;
    }
  }, [simpleConfig]);

  // Update parent when simple config changes
  useEffect(() => {
    if (isSimpleMode) {
      onChange(simpleToCron);
    }
  }, [simpleToCron, isSimpleMode, onChange]);

  // Validate and get preview
  useEffect(() => {
    if (value && showPreview) {
      validateCron.mutate(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, showPreview]);

  const updateSimpleConfig = <K extends keyof typeof simpleConfig>(
    key: K,
    val: (typeof simpleConfig)[K]
  ) => {
    setSimpleConfig((prev) => ({ ...prev, [key]: val }));
  };

  const toggleMode = () => {
    if (isSimpleMode) {
      // Switching to advanced - keep current CRON
      setIsSimpleMode(false);
    } else {
      // Switching to simple - try to parse or use default
      setIsSimpleMode(true);
      onChange(simpleToCron);
    }
  };

  // Generate time options
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];
  const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('schedule.form.cron')}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          className="text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          {isSimpleMode
            ? t('schedule.form.advancedMode')
            : t('schedule.form.simpleMode')}
        </Button>
      </div>

      {isSimpleMode ? (
        <div className="space-y-4">
          {/* Frequency */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {t('schedule.form.frequency')}
            </Label>
            <Select
              value={simpleConfig.frequency}
              onValueChange={(val: Frequency) =>
                updateSimpleConfig('frequency', val)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">
                  {t('schedule.frequencies.daily')}
                </SelectItem>
                <SelectItem value="weekly">
                  {t('schedule.frequencies.weekly')}
                </SelectItem>
                <SelectItem value="monthly">
                  {t('schedule.frequencies.monthly')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weekday (for weekly) */}
          {simpleConfig.frequency === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {t('schedule.form.weekday')}
              </Label>
              <Select
                value={String(simpleConfig.weekday)}
                onValueChange={(val) =>
                  updateSimpleConfig('weekday', parseInt(val) as Weekday)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_NAMES.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {t(`schedule.weekdays.${day}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of month (for monthly) */}
          {simpleConfig.frequency === 'monthly' && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {t('schedule.form.dayOfMonth')}
              </Label>
              <Select
                value={String(simpleConfig.dayOfMonth)}
                onValueChange={(val) =>
                  updateSimpleConfig('dayOfMonth', parseInt(val))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Time */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {t('schedule.form.time')}
            </Label>
            <div className="flex gap-2">
              <Select
                value={String(simpleConfig.hour)}
                onValueChange={(val) =>
                  updateSimpleConfig('hour', parseInt(val))
                }
              >
                <SelectTrigger className="w-20 sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, '0')}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex items-center text-muted-foreground">:</span>
              <Select
                value={String(simpleConfig.minute)}
                onValueChange={(val) =>
                  updateSimpleConfig('minute', parseInt(val))
                }
              >
                <SelectTrigger className="w-20 sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minuteOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {String(m).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0 8 * * 1"
            className={cn(error && 'border-destructive')}
          />
          <p className="text-xs text-muted-foreground">
            {t('schedule.form.cronHelp')}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Preview next runs */}
      {showPreview && validateCron.data && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            {t('schedule.form.nextRuns')}
          </div>
          {validateCron.data.description && (
            <p className="text-sm text-muted-foreground">
              {validateCron.data.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {validateCron.data.next_runs.slice(0, 5).map((run, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(run).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {validateCron.isError && (
        <p className="text-xs text-destructive">
          {t('errors.validation')}: {(validateCron.error as Error)?.message}
        </p>
      )}
    </div>
  );
}
