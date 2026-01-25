/**
 * Automatic generation section with schedule management.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScheduleList } from './ScheduleList';
import { ScheduleForm } from './ScheduleForm';
import type { Schedule } from '@/types';

export function AutomaticGeneration() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingSchedule(null);
    setIsFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingSchedule(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t('schedule.create')}</span>
        </Button>
      </div>

      {/* Schedule list */}
      <ScheduleList onEdit={handleEdit} />

      <ScheduleForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        schedule={editingSchedule}
      />
    </div>
  );
}
