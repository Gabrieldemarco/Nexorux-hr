import { createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import i18n from '../i18n';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export const I18nContext = createContext(i18n);
export const useI18n = () => useContext(I18nContext);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nContext.Provider value={i18n}>
          {children}
        </I18nContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
