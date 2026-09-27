import type { BookServerConfig } from '@/types';

/** Fallback for configs saved before book servers existed. */
export const DEFAULT_BOOK_SERVER: BookServerConfig = {
  enabled: false,
  days: 7,
  max_items: -1,
  book_library_ids: [],
  audiobook_library_ids: [],
};
