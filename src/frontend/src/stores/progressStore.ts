/**
 * Progress store for tracking newsletter generation state.
 */

import { create } from 'zustand';
import type { ProgressEvent, ProgressStep, ProgressStepStatus } from '../types';

export interface GenerationProgress {
  id: string;
  progress: number;
  currentStep: string | null;
  steps: ProgressStep[];
  isComplete: boolean;
  isCancelled: boolean;
  error: string | null;
  ghostPostUrl: string | null;
  startedAt: string | null;
}

interface ProgressState {
  // Current active generation
  activeGenerationId: string | null;
  generations: Record<string, GenerationProgress>;

  // Actions
  startGeneration: (generationId: string, steps?: string[]) => void;
  updateProgress: (event: ProgressEvent) => void;
  completeGeneration: (generationId: string, ghostPostUrl?: string) => void;
  cancelGeneration: (generationId: string) => void;
  failGeneration: (generationId: string, error: string) => void;
  clearGeneration: (generationId: string) => void;
  clearAllGenerations: () => void;
  getGeneration: (generationId: string) => GenerationProgress | undefined;
}

// Default generation steps
const DEFAULT_STEPS = [
  'fetch_tautulli',
  'enrich_tmdb',
  'fetch_romm',
  'fetch_komga',
  'fetch_audiobookshelf',
  'fetch_tunarr',
  'fetch_statistics',
  'render_template',
  'publish_ghost',
];

// Step names for display
const STEP_NAMES: Record<string, string> = {
  fetch_tautulli: 'Fetching media from Tautulli',
  enrich_tmdb: 'Enriching with TMDB metadata',
  fetch_romm: 'Fetching games from ROMM',
  fetch_komga: 'Fetching books from Komga',
  fetch_audiobookshelf: 'Fetching audiobooks',
  fetch_tunarr: 'Fetching TV programming',
  fetch_statistics: 'Fetching statistics',
  render_template: 'Rendering template',
  publish_ghost: 'Publishing to Ghost',
};

function createInitialSteps(stepIds: string[]): ProgressStep[] {
  return stepIds.map((stepId) => ({
    step: stepId,
    status: 'pending' as ProgressStepStatus,
    message: STEP_NAMES[stepId] || stepId,
  }));
}

function updateStep(
  steps: ProgressStep[],
  stepId: string,
  update: Partial<ProgressStep>
): ProgressStep[] {
  return steps.map((step) =>
    step.step === stepId ? { ...step, ...update } : step
  );
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  activeGenerationId: null,
  generations: {},

  startGeneration: (generationId: string, steps?: string[]) => {
    const initialSteps = createInitialSteps(steps || DEFAULT_STEPS);

    set((state) => ({
      activeGenerationId: generationId,
      generations: {
        ...state.generations,
        [generationId]: {
          id: generationId,
          progress: 0,
          currentStep: null,
          steps: initialSteps,
          isComplete: false,
          isCancelled: false,
          error: null,
          ghostPostUrl: null,
          startedAt: new Date().toISOString(),
        },
      },
    }));
  },

  updateProgress: (event: ProgressEvent) => {
    const generationId = get().activeGenerationId;
    if (!generationId) return;

    const generation = get().generations[generationId];
    if (!generation) return;

    let updatedSteps = [...generation.steps];
    let currentStep = generation.currentStep;
    let error = generation.error;

    switch (event.type) {
      case 'generation_started': {
        // Initialize steps from the backend's enabled steps list
        const stepsData = event.data?.steps as Array<{ step: string; message: string }> | undefined;
        if (stepsData && Array.isArray(stepsData)) {
          updatedSteps = stepsData.map((s) => ({
            step: s.step,
            status: 'pending' as ProgressStepStatus,
            message: s.message,
          }));
        }
        break;
      }

      case 'step_start':
        updatedSteps = updateStep(updatedSteps, event.step, {
          status: 'running',
          message: event.message,
          started_at: event.timestamp,
        });
        currentStep = event.step;
        break;

      case 'step_complete':
        updatedSteps = updateStep(updatedSteps, event.step, {
          status: 'success',
          message: event.message,
          completed_at: event.timestamp,
          items_count: event.data?.items_count as number | undefined,
        });
        break;

      case 'step_skipped':
        updatedSteps = updateStep(updatedSteps, event.step, {
          status: 'skipped',
          message: event.message,
          completed_at: event.timestamp,
        });
        break;

      case 'step_error':
        updatedSteps = updateStep(updatedSteps, event.step, {
          status: 'failed',
          message: event.message,
          completed_at: event.timestamp,
          error: event.data?.error as string | undefined,
        });
        error = event.data?.error as string | null;
        break;

      case 'generation_complete':
        set((state) => ({
          generations: {
            ...state.generations,
            [generationId]: {
              ...state.generations[generationId],
              progress: 100,
              isComplete: true,
              ghostPostUrl: event.data?.ghost_post_url as string | undefined,
            },
          },
        }));
        return;

      case 'generation_cancelled':
        set((state) => ({
          generations: {
            ...state.generations,
            [generationId]: {
              ...state.generations[generationId],
              isCancelled: true,
            },
          },
        }));
        return;
    }

    set((state) => ({
      generations: {
        ...state.generations,
        [generationId]: {
          ...state.generations[generationId],
          progress: event.progress,
          currentStep,
          steps: updatedSteps,
          error,
        },
      },
    }));
  },

  completeGeneration: (generationId: string, ghostPostUrl?: string) => {
    set((state) => ({
      generations: {
        ...state.generations,
        [generationId]: {
          ...state.generations[generationId],
          progress: 100,
          isComplete: true,
          ghostPostUrl: ghostPostUrl || null,
        },
      },
    }));
  },

  cancelGeneration: (generationId: string) => {
    set((state) => ({
      generations: {
        ...state.generations,
        [generationId]: {
          ...state.generations[generationId],
          isCancelled: true,
        },
      },
    }));
  },

  failGeneration: (generationId: string, error: string) => {
    set((state) => ({
      generations: {
        ...state.generations,
        [generationId]: {
          ...state.generations[generationId],
          error,
        },
      },
    }));
  },

  clearGeneration: (generationId: string) => {
    set((state) => {
      const { [generationId]: _, ...rest } = state.generations;
      return {
        generations: rest,
        activeGenerationId:
          state.activeGenerationId === generationId
            ? null
            : state.activeGenerationId,
      };
    });
  },

  clearAllGenerations: () => {
    set({ generations: {}, activeGenerationId: null });
  },

  getGeneration: (generationId: string) => {
    return get().generations[generationId];
  },
}));
