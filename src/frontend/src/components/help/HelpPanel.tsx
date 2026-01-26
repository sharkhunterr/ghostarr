/**
 * Contextual help panel component.
 * Displays a floating help button that opens a panel with page-specific help.
 * Uses translations for all content to support multiple languages.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle,
  X,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Help category mapping for each page
export type HelpCategory =
  | 'getting-started'
  | 'manual-generation'
  | 'scheduling'
  | 'templates'
  | 'troubleshooting'
  | 'settings'
  | 'history';

interface HelpPanelProps {
  /** The help category to display */
  category: HelpCategory;
  /** Additional CSS classes */
  className?: string;
}

// Article IDs for each category
const CATEGORY_ARTICLES: Record<HelpCategory, string[]> = {
  'getting-started': ['quickStart', 'requirements'],
  'manual-generation': ['configureSources', 'publicationModes', 'preview'],
  'scheduling': ['createSchedule', 'cronExpressions', 'manageSchedules'],
  'templates': ['uploadTemplate', 'customizeTemplate', 'presetConfig'],
  'troubleshooting': ['connectionIssues', 'generationErrors', 'commonProblems'],
  'settings': ['configureServices', 'apiKeys'],
  'history': ['viewHistory', 'manageHistory'],
};

// Simple markdown renderer
function renderMarkdown(content: string): string {
  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted p-3 rounded-lg overflow-x-auto my-3 text-xs"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    // Wrap consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\n)+/g, '<ul class="list-disc list-inside my-3 space-y-1">$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    // Wrap in paragraph
    .replace(/^(?!<[huplo])(.+)$/gm, '<p class="mb-3">$1</p>');
}

interface LocalArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
}

function ArticleListItem({
  article,
  onClick,
}: {
  article: LocalArticle;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left w-full group"
    >
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm mb-0.5 group-hover:text-primary transition-colors">
          {article.title}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {article.summary}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
    </button>
  );
}

function ArticleContent({
  article,
  onBack,
}: {
  article: LocalArticle;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 h-8 text-xs"
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        {t('common.back')}
      </Button>
      <ScrollArea className="h-[320px] pr-4">
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />
      </ScrollArea>
    </div>
  );
}

export function HelpPanel({ category, className }: HelpPanelProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Get translated articles for this category only (no mixing with other categories)
  const allArticles = useMemo(() => {
    const articleIds = CATEGORY_ARTICLES[category] || [];
    const categoryKey = category.replace(/-/g, '');

    return articleIds.map((id): LocalArticle => ({
      id,
      title: t(`help.articles.${categoryKey}.${id}.title`),
      summary: t(`help.articles.${categoryKey}.${id}.summary`),
      content: t(`help.articles.${categoryKey}.${id}.content`),
    })).filter(article =>
      // Filter out articles where translation key is returned (missing translation)
      !article.title.startsWith('help.articles.')
    );
  }, [category, t]);

  // Get selected article
  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return allArticles.find(a => a.id === selectedArticleId) || null;
  }, [selectedArticleId, allArticles]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedArticleId(null);
  };

  const handleArticleClick = (articleId: string) => {
    setSelectedArticleId(articleId);
  };

  const handleBack = () => {
    setSelectedArticleId(null);
  };

  return (
    <>
      {/* Floating Help Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-40',
          'bg-primary text-primary-foreground hover:bg-primary/90 border-0',
          className
        )}
        title={t('help.title')}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      {/* Help Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="fixed bottom-20 right-4 w-[380px] max-w-[calc(100vw-2rem)] bg-background border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">
                  {t(`help.contextual.${category.replace(/-/g, '')}Title`, t('help.title'))}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="h-8 w-8"
                  title={t('help.viewAll')}
                >
                  <a href="/help" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {selectedArticle ? (
                <ArticleContent article={selectedArticle} onBack={handleBack} />
              ) : (
                <div className="space-y-3">
                  {/* Quick intro */}
                  <p className="text-sm text-muted-foreground">
                    {t(`help.contextual.${category.replace(/-/g, '')}Intro`, t('help.contextual.defaultIntro'))}
                  </p>

                  {/* Articles list */}
                  {allArticles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('help.noArticles')}
                    </p>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-1">
                        {allArticles.map((article) => (
                          <ArticleListItem
                            key={article.id}
                            article={article}
                            onClick={() => handleArticleClick(article.id)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Link to full help */}
                  <div className="pt-2 border-t">
                    <a
                      href="/help"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {t('help.viewAllHelp')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default HelpPanel;
