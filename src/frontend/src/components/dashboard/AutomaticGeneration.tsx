/**
 * Automatic generation section with schedule management.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CalendarClock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                {t('dashboard.automaticGeneration.title')}
              </CardTitle>
              <CardDescription>
                {t('dashboard.automaticGeneration.description')}
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('schedule.create')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScheduleList onEdit={handleEdit} />
        </CardContent>
      </Card>

      <ScheduleForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        schedule={editingSchedule}
      />
    </>
  );
}
