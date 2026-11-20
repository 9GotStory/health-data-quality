import { QueryClient } from '@tanstack/react-query';

/**
 * Default QueryClient tuned for Google Apps Script Web App limits:
 * avoids aggressive window-focus refetches and excessive retries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
