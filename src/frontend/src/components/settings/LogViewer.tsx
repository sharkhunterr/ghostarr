/**
 * Log viewer component for displaying system logs.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Download,
  Filter,
  Info,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLogs, usePurgeLogs, useExportLogs, type LogFilters } from '@/api/logs';
import type { Log, LogLevel, LogSource } from '@/types';

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warning', 'error'];
const LOG_SOURCES: LogSource[] = ['backend', 'frontend', 'integration'];

const levelIcons: Record<LogLevel, React.ReactNode> = {
  debug: <Bug className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
};

const levelColors: Record<LogLevel, string> = {
  debug: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function LogViewer() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LogFilters>({
    page: 1,
    page_size: 50,
  });
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [purgeDays, setPurgeDays] = useState(30);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  const { data, isLoading, refetch } = useLogs(filters);
  const purgeMutation = usePurgeLogs();
  const exportMutation = useExportLogs();

  const hasActiveFilters =
    filters.level || filters.source || filters.service || filters.search;

  const handleFilterChange = (key: keyof LogFilters, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1, // Reset to first page on filter change
    }));
  };

  const handleClearFilters = () => {
    setFilters({ page: 1, page_size: 50 });
  };

  const handlePurge = async () => {
    try {
      await purgeMutation.mutateAsync(purgeDays);
      setShowPurgeDialog(false);
    } catch (error) {
      console.error('Failed to purge logs:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await exportMutation.mutateAsync({
        format,
        filters: {
          level: filters.level,
          source: filters.source,
          service: filters.service,
        },
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Filters popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {t('common.filter')}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                    !
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <h4 className="font-medium">{t('history.filters.title')}</h4>

                {/* Level filter */}
                <div className="space-y-2">
                  <Label>{t('settings.logs.level')}</Label>
                  <Select
                    value={filters.level || ''}
                    onValueChange={(v) => handleFilterChange('level', v as LogLevel)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('common.all')}</SelectItem>
                      {LOG_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {t(`settings.logs.levels.${level}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source filter */}
                <div className="space-y-2">
                  <Label>{t('settings.logs.source')}</Label>
                  <Select
                    value={filters.source || ''}
                    onValueChange={(v) => handleFilterChange('source', v as LogSource)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('common.all')}</SelectItem>
                      {LOG_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service filter */}
                <div className="space-y-2">
                  <Label>{t('settings.logs.service')}</Label>
                  <Input
                    placeholder={t('settings.logs.service')}
                    value={filters.service || ''}
                    onChange={(e) => handleFilterChange('service', e.target.value)}
                  />
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <Label>{t('common.search')}</Label>
                  <Input
                    placeholder={t('common.search')}
                    value={filters.search || ''}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} className="w-full">
                    <X className="h-4 w-4 mr-2" />
                    {t('history.filters.clear')}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exportMutation.isPending}>
                <Download className="h-4 w-4 mr-2" />
                {t('common.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Purge button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPurgeDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('settings.logs.purge')}
          </Button>
        </div>
      </div>

      {/* Logs table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">{t('settings.logs.timestamp')}</TableHead>
              <TableHead className="w-[100px]">{t('settings.logs.level')}</TableHead>
              <TableHead className="w-[120px]">{t('settings.logs.source')}</TableHead>
              <TableHead className="w-[120px]">{t('settings.logs.service')}</TableHead>
              <TableHead>{t('settings.logs.message')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('notifications.empty')}
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="font-mono text-xs">
                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge className={levelColors[log.level]}>
                      <span className="mr-1">{levelIcons[log.level]}</span>
                      {t(`settings.logs.levels.${log.level}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.source}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.service || '-'}
                  </TableCell>
                  <TableCell className="max-w-md truncate" title={log.message}>
                    {log.message}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('common.all')}: {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
              disabled={filters.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {filters.page} / {data.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
              disabled={filters.page === data.total_pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Purge confirmation dialog */}
      <Dialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.logs.purge')}</DialogTitle>
            <DialogDescription>
              {t('settings.logs.purge')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delete logs older than (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={purgeDays}
                onChange={(e) => setPurgeDays(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurgeDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log detail modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('settings.logs.detail.title')}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 overflow-y-auto">
              {/* Timestamp and Level */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">
                  {format(new Date(selectedLog.created_at), 'yyyy-MM-dd HH:mm:ss.SSS')}
                </span>
                <Badge className={levelColors[selectedLog.level]}>
                  <span className="mr-1">{levelIcons[selectedLog.level]}</span>
                  {t(`settings.logs.levels.${selectedLog.level}`)}
                </Badge>
              </div>

              {/* Source and Service */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('settings.logs.source')}</Label>
                  <p className="mt-1">
                    <Badge variant="outline">{selectedLog.source}</Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('settings.logs.service')}</Label>
                  <p className="mt-1">{selectedLog.service || '-'}</p>
                </div>
              </div>

              {/* Message */}
              <div>
                <Label className="text-muted-foreground">{t('settings.logs.message')}</Label>
                <div className="mt-1 p-3 rounded-md bg-muted font-mono text-sm whitespace-pre-wrap break-words">
                  {selectedLog.message}
                </div>
              </div>

              {/* Correlation ID */}
              {selectedLog.correlation_id && (
                <div>
                  <Label className="text-muted-foreground">{t('settings.logs.detail.correlationId')}</Label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.correlation_id}</p>
                </div>
              )}

              {/* Context */}
              {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">{t('settings.logs.detail.context')}</Label>
                  <pre className="mt-1 p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
