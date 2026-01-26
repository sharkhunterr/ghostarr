/**
 * Scheduled Generation page - for managing automatic newsletter schedules.
 */

import { AutomaticGeneration } from '@/components/dashboard';
import { HelpPanel } from '@/components/help';

export default function ScheduledGeneration() {
  return (
    <>
      <AutomaticGeneration />
      <HelpPanel category="scheduling" />
    </>
  );
}
