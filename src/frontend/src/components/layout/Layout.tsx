/**
 * Main application layout with sidebar and persistent progress card.
 */

import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  History,
  FileText,
  Settings,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProgressCard } from '@/components/dashboard/ProgressCard';
import { ThemeToggle, LanguageSelector } from '@/components/common';
import { useProgressStore } from '@/stores/progressStore';
import { useCancelGeneration } from '@/api/newsletters';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'nav.dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { path: '/history', label: 'nav.history', icon: <History className="h-5 w-5" /> },
  { path: '/templates', label: 'nav.templates', icon: <FileText className="h-5 w-5" /> },
  { path: '/settings', label: 'nav.settings', icon: <Settings className="h-5 w-5" /> },
  { path: '/help', label: 'nav.help', icon: <HelpCircle className="h-5 w-5" /> },
];

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const cancelMutation = useCancelGeneration();
  const {
    activeGenerationId,
    generations,
    cancelGeneration,
    clearGeneration,
  } = useProgressStore();

  const currentProgress = activeGenerationId
    ? generations[activeGenerationId]
    : null;

  const showProgressCard =
    currentProgress &&
    (!currentProgress.isComplete || currentProgress.ghostPostUrl);

  const handleCancel = async () => {
    if (!activeGenerationId) return;

    try {
      await cancelMutation.mutateAsync(activeGenerationId);
      cancelGeneration(activeGenerationId);
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  };

  const handleClear = () => {
    if (activeGenerationId) {
      clearGeneration(activeGenerationId);
    }
  };

  const handleViewHistory = () => {
    navigate('/history');
    handleClear();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 transform bg-card border-r transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">G</span>
          </div>
          <span className="text-xl font-bold">Ghostarr</span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {item.icon}
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section with toggles */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center justify-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>

      {/* Persistent Progress Card (bottom-right) */}
      {showProgressCard && location.pathname !== '/dashboard' && (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <ProgressCard
            progress={currentProgress}
            onCancel={handleCancel}
            onClear={handleClear}
            onViewHistory={handleViewHistory}
            isCancelling={cancelMutation.isPending}
            compact
          />
        </div>
      )}
    </div>
  );
}
