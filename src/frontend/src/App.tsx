import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { Layout } from "@/components/layout";

// Pages
import Settings from "@/pages/Settings";
import Dashboard from "@/pages/Dashboard";
import Templates from "@/pages/Templates";
import History from "@/pages/History";
import Help from "@/pages/Help";

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { i18n } = useTranslation();
  const { language, getEffectiveTheme } = usePreferencesStore();

  // Apply language on mount and change
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  // Apply theme class on mount and change
  useEffect(() => {
    const theme = getEffectiveTheme();
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [getEffectiveTheme]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
