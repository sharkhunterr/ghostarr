import { useQuery } from "@tanstack/react-query";
import apiClient from "./client";

export interface TunarrChannel {
  id: string;
  number: number;
  name: string;
  icon_url: string | null;
  group: string | null;
}

export interface GhostNewsletter {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

const TUNARR_CHANNELS_KEY = ["integrations", "tunarr", "channels"];
const GHOST_NEWSLETTERS_KEY = ["integrations", "ghost", "newsletters"];

export function useTunarrChannels(enabled: boolean = true) {
  return useQuery({
    queryKey: TUNARR_CHANNELS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<TunarrChannel[]>(
        "/integrations/tunarr/channels"
      );
      return data;
    },
    enabled,
    staleTime: 60 * 1000, // Cache for 1 minute (reduced for debugging)
    retry: 1, // Retry once on failure
  });
}

export function useGhostNewsletters() {
  return useQuery({
    queryKey: GHOST_NEWSLETTERS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<GhostNewsletter[]>(
        "/integrations/ghost/newsletters"
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
