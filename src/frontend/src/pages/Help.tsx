/**
 * Help page with documentation and search.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Rocket,
  Edit,
  Calendar,
  FileText,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useHelpCategories,
  useHelpArticles,
  useHelpArticle,
  useHelpSearch,
  type HelpCategory,
  type HelpArticle,
} from '@/api/help';

// Icon mapping
const categoryIcons: Record<string, React.ReactNode> = {
  rocket: <Rocket className="h-6 w-6" />,
  edit: <Edit className="h-6 w-6" />,
  calendar: <Calendar className="h-6 w-6" />,
  'file-text': <FileText className="h-6 w-6" />,
  'help-circle': <HelpCircle className="h-6 w-6" />,
};

// Simple markdown renderer
function renderMarkdown(content: string): string {
  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4 text-sm"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    // Wrap consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\n)+/g, '<ul class="list-disc list-inside my-4 space-y-1">$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="mb-4">')
    // Wrap in paragraph
    .replace(/^(?!<[huplo])(.+)$/gm, '<p class="mb-4">$1</p>');
}

function CategoryCard({
  category,
  articleCount,
  onClick,
}: {
  category: HelpCategory;
  articleCount: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-6 rounded-lg border bg-card hover:bg-accent transition-colors text-left w-full"
    >
      <div className="p-3 rounded-lg bg-primary/10 text-primary">
        {categoryIcons[category.icon] || <HelpCircle className="h-6 w-6" />}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold mb-1">{t(`help.categories.${category.id.replace('-', '')}`) || category.title}</h3>
        <p className="text-sm text-muted-foreground">{category.description}</p>
        <p className="text-xs text-muted-foreground mt-2">{articleCount} articles</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

function ArticleCard({
  article,
  onClick,
}: {
  article: HelpArticle;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left w-full"
    >
      <div className="flex-1">
        <h4 className="font-medium mb-1">{article.title}</h4>
        <p className="text-sm text-muted-foreground">{article.summary}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

function ArticleView({
  articleId,
  onBack,
}: {
  articleId: string;
  onBack: () => void;
}) {
  const { data: article, isLoading } = useHelpArticle(articleId);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (!article) {
    return <div className="text-center py-8 text-muted-foreground">Article not found</div>;
  }

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
      />
    </div>
  );
}

export default function Help() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  const { data: categories = [] } = useHelpCategories();
  const { data: articles = [] } = useHelpArticles(selectedCategory || undefined);
  const { data: searchResults = [] } = useHelpSearch(searchQuery);

  // Count articles per category
  const { data: allArticles = [] } = useHelpArticles();
  const articleCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    allArticles.forEach((article) => {
      counts[article.category] = (counts[article.category] || 0) + 1;
    });
    return counts;
  }, [allArticles]);

  // Show search results if query is present
  const showSearchResults = searchQuery.length >= 2;
  const displayedArticles = showSearchResults ? searchResults : articles;

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedArticle(null);
    setSearchQuery('');
  };

  const handleArticleClick = (articleId: string) => {
    setSelectedArticle(articleId);
  };

  const handleBack = () => {
    if (selectedArticle) {
      setSelectedArticle(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t('help.title')}</h1>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('help.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      {selectedArticle ? (
        <ArticleView articleId={selectedArticle} onBack={handleBack} />
      ) : showSearchResults ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Search results ({searchResults.length})
            </h2>
            {searchQuery && (
              <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                Clear
              </Button>
            )}
          </div>
          {searchResults.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No results found for "{searchQuery}"
            </p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => handleArticleClick(article.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : selectedCategory ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={handleBack} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.all')} categories
          </Button>
          <div className="space-y-2">
            {displayedArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => handleArticleClick(article.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              articleCount={articleCountByCategory[category.id] || 0}
              onClick={() => handleCategoryClick(category.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
