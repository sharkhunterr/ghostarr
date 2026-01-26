/**
 * Automatic generation section with schedule management.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleList } from './ScheduleList';
import { ScheduleForm } from './ScheduleForm';
import type { Schedule, ScheduleType } from '@/types';

export function AutomaticGeneration() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [activeTab, setActiveTab] = useState<ScheduleType>('generation');

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScheduleType)}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="generation">
              {t('schedule.tabs.generation')}
            </TabsTrigger>
            <TabsTrigger value="deletion">
              {t('schedule.tabs.deletion')}
            </TabsTrigger>
          </TabsList>

          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">
              {activeTab === 'generation'
                ? t('schedule.create')
                : t('schedule.createDeletion')}
            </span>
          </Button>
        </div>

        <TabsContent value="generation" className="mt-4">
          <ScheduleList onEdit={handleEdit} scheduleType="generation" />
        </TabsContent>

        <TabsContent value="deletion" className="mt-4">
          <ScheduleList onEdit={handleEdit} scheduleType="deletion" />
        </TabsContent>
      </Tabs>

      <ScheduleForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        schedule={editingSchedule}
        defaultScheduleType={activeTab}
      />
    </div>
  );
}
