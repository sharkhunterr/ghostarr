/**
 * Scheduled Generation page - for managing automatic newsletter schedules.
 */

import { useTranslation } from 'react-i18next';
import { AutomaticGeneration } from '@/components/dashboard';

export default function ScheduledGeneration() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Page description */}
      <p className="text-muted-foreground text-sm">
        {t('scheduledGeneration.subtitle')}
      </p>

      {/* Automatic Generation / Schedules */}
      <AutomaticGeneration />
    </div>
  );
}
