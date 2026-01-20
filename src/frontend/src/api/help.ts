/**
 * Help API hooks.
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
}

// Query keys
export const helpKeys = {
  all: ['help'] as const,
  categories: () => [...helpKeys.all, 'categories'] as const,
  articles: (category?: string) => [...helpKeys.all, 'articles', category] as const,
  article: (id: string) => [...helpKeys.all, 'article', id] as const,
  search: (query: string) => [...helpKeys.all, 'search', query] as const,
};

export function useHelpCategories() {
  return useQuery({
    queryKey: helpKeys.categories(),
    queryFn: async (): Promise<HelpCategory[]> => {
      const response = await apiClient.get<HelpCategory[]>('/help/categories');
      return response.data;
    },
  });
}

export function useHelpArticles(category?: string) {
  return useQuery({
    queryKey: helpKeys.articles(category),
    queryFn: async (): Promise<HelpArticle[]> => {
      const url = category ? `/help/articles?category=${category}` : '/help/articles';
      const response = await apiClient.get<HelpArticle[]>(url);
      return response.data;
    },
  });
}

export function useHelpArticle(id: string) {
  return useQuery({
    queryKey: helpKeys.article(id),
    queryFn: async (): Promise<HelpArticle> => {
      const response = await apiClient.get<HelpArticle>(`/help/articles/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useHelpSearch(query: string) {
  return useQuery({
    queryKey: helpKeys.search(query),
    queryFn: async (): Promise<HelpArticle[]> => {
      const response = await apiClient.get<HelpArticle[]>(`/help/search?q=${encodeURIComponent(query)}`);
      return response.data;
    },
    enabled: query.length >= 2,
  });
}
