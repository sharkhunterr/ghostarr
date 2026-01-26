/**
 * Main application layout with sidebar (icons + text) and top navbar.
 * Responsive design with collapsible sidebar on mobile.
 */

import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wand2,
  CalendarClock,
  History,
  FileText,
  Settings,
  HelpCircle,
  Menu,
  Ghost,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProgressCard } from '@/components/dashboard/ProgressCard';
import { ThemeToggle, LanguageSelector } from '@/components/common';
import { useProgressStore } from '@/stores/progressStore';
import { useCancelGeneration } from '@/api/newsletters';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/manual', label: 'nav.manual', icon: Wand2 },
  { path: '/scheduled', label: 'nav.scheduled', icon: CalendarClock },
  { path: '/history', label: 'nav.history', icon: History },
  { path: '/templates', label: 'nav.templates', icon: FileText },
  { path: '/settings', label: 'nav.settings', icon: Settings },
  { path: '/help', label: 'nav.help', icon: HelpCircle },
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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

  // Get current page title
  const getCurrentPageTitle = () => {
    const currentNav = navItems.find((item) => item.path === location.pathname);
    return currentNav ? t(currentNav.label) : '';
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop: fixed with icons + text, Mobile: overlay */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-56 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out',
          // Mobile: slide in/out
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible
          'lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Link to="/manual" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Ghost className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">Ghostarr</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:pl-56 w-full">
        {/* Top Navigation Bar - Mobile only shows menu, Desktop shows page title */}
        <header className="sticky top-0 z-30 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex h-full items-center justify-between px-4">
            {/* Left side - Mobile menu + Page title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>

              {/* Page title */}
              <h1 className="text-lg font-semibold">{getCurrentPageTitle()}</h1>
            </div>

            {/* Right side - Theme & Language */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LanguageSelector />
            </div>
          </div>
        </header>

        {/* Page content - Full width */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Persistent Progress Card (bottom-right) */}
      {showProgressCard && location.pathname !== '/manual' && (
        <div className="fixed bottom-2 left-2 right-2 sm:left-auto sm:bottom-4 sm:right-4 z-50 sm:w-96 transition-all duration-300 ease-out">
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
