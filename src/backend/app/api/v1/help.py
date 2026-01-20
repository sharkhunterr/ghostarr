"""Help API endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


class HelpArticle(BaseModel):
    """Help article schema."""

    id: str
    category: str
    title: str
    summary: str
    content: str
    keywords: list[str]


class HelpCategory(BaseModel):
    """Help category schema."""

    id: str
    title: str
    description: str
    icon: str


# Help content
CATEGORIES: list[HelpCategory] = [
    HelpCategory(
        id="getting-started",
        title="Getting Started",
        description="Learn the basics of Ghostarr",
        icon="rocket",
    ),
    HelpCategory(
        id="manual-generation",
        title="Manual Generation",
        description="Generate newsletters manually",
        icon="edit",
    ),
    HelpCategory(
        id="scheduling",
        title="Scheduling",
        description="Set up automatic newsletter generation",
        icon="calendar",
    ),
    HelpCategory(
        id="templates",
        title="Templates",
        description="Create and manage newsletter templates",
        icon="file-text",
    ),
    HelpCategory(
        id="troubleshooting",
        title="Troubleshooting",
        description="Common issues and solutions",
        icon="help-circle",
    ),
]

ARTICLES: list[HelpArticle] = [
    # Getting Started
    HelpArticle(
        id="what-is-ghostarr",
        category="getting-started",
        title="What is Ghostarr?",
        summary="Introduction to Ghostarr and its features",
        content="""
# What is Ghostarr?

Ghostarr is a newsletter generator designed for media server administrators. It automatically collects information about recently added content from your media servers and publishes beautiful newsletters to your Ghost blog.

## Key Features

- **Multi-source support**: Collect content from Tautulli, ROMM, Komga, Audiobookshelf, and Tunarr
- **TMDB enrichment**: Automatically fetch movie and TV show metadata
- **Ghost integration**: Publish directly to your Ghost blog
- **Scheduling**: Set up automatic weekly newsletters
- **Templates**: Customize the look of your newsletters
- **Multi-language**: Interface available in French, English, German, Italian, and Spanish

## Getting Started

1. Configure your external services in Settings
2. Upload or use the default newsletter template
3. Generate your first newsletter from the Dashboard
        """,
        keywords=["introduction", "features", "overview", "ghostarr"],
    ),
    HelpArticle(
        id="configuring-services",
        category="getting-started",
        title="Configuring External Services",
        summary="How to connect Ghostarr to your services",
        content="""
# Configuring External Services

Before generating newsletters, you need to configure the external services Ghostarr will connect to.

## Required Services

### Tautulli
Tautulli monitors your Plex server and provides statistics about what's being watched.
- **URL**: Your Tautulli instance URL (e.g., http://localhost:8181)
- **API Key**: Found in Settings > Web Interface > API Key

### Ghost
Ghost is where your newsletters will be published.
- **URL**: Your Ghost instance URL (e.g., https://your-blog.com)
- **API Key**: Create a Custom Integration in Ghost Admin > Settings > Integrations

## Optional Services

### TMDB
Provides rich metadata for movies and TV shows.
- **API Key**: Register at themoviedb.org to get a free API key

### ROMM, Komga, Audiobookshelf
Connect these services if you want to include games, comics, or audiobooks in your newsletter.

## Testing Connections

After entering your credentials, click "Test" to verify each connection before saving.
        """,
        keywords=["services", "configuration", "tautulli", "ghost", "tmdb", "api key"],
    ),
    # Manual Generation
    HelpArticle(
        id="generating-newsletter",
        category="manual-generation",
        title="Generating a Newsletter",
        summary="Step-by-step guide to manual generation",
        content="""
# Generating a Newsletter

Follow these steps to create a newsletter manually.

## Step 1: Select a Template

Choose the template that will be used to render your newsletter. The default template works great for most use cases.

## Step 2: Configure Content Sources

Enable the content sources you want to include:

- **Movies & TV Shows**: Recent additions from Tautulli
- **Video Games**: From ROMM
- **Comics**: From Komga
- **Audiobooks**: From Audiobookshelf
- **TV Schedule**: From Tunarr

For each source, you can configure:
- **Period**: How many days back to look for new content
- **Max items**: Limit the number of items

## Step 3: Optional Extras

- **Statistics**: Include viewing statistics from Tautulli
- **Maintenance notice**: Add a message about planned downtime

## Step 4: Publication Mode

Choose how to publish:
- **Draft**: Create a draft in Ghost
- **Publish**: Publish immediately
- **Email**: Send as email newsletter
- **Email + Publish**: Both publish and send email

## Step 5: Generate

Click "Generate" to start the process. Progress will be shown in real-time.
        """,
        keywords=["generate", "newsletter", "manual", "content sources", "publication"],
    ),
    HelpArticle(
        id="preview-newsletter",
        category="manual-generation",
        title="Previewing Before Publishing",
        summary="How to preview your newsletter",
        content="""
# Previewing Your Newsletter

Before publishing, you can preview exactly how your newsletter will look.

## Preview Feature

Click the "Preview" button to generate a preview of your newsletter with the current configuration.

The preview will show:
- The rendered HTML template
- All content from your selected sources
- Statistics (if enabled)
- Maintenance notices (if enabled)

## Viewport Options

Switch between different viewport sizes to see how your newsletter will look on:
- Mobile devices
- Tablets
- Desktop

## Making Adjustments

If the preview doesn't look right:
1. Close the preview
2. Adjust your configuration
3. Preview again

Note: Preview uses the same data as generation, so the final result will be identical.
        """,
        keywords=["preview", "template", "viewport", "mobile", "desktop"],
    ),
    # Scheduling
    HelpArticle(
        id="creating-schedule",
        category="scheduling",
        title="Creating a Schedule",
        summary="Set up automatic newsletter generation",
        content="""
# Creating a Schedule

Automate your newsletter generation by creating schedules.

## Simple Mode

For most users, simple mode provides an easy way to schedule:

1. Choose a **frequency**: Daily, Weekly, or Monthly
2. Select the **time** to generate
3. For weekly: choose the **day of the week**
4. For monthly: choose the **day of the month**

Example: Generate every Monday at 8:00 AM

## Advanced Mode (CRON)

For more complex schedules, use CRON expressions:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
```

### Common Examples

- `0 8 * * 1` - Every Monday at 8:00 AM
- `0 9 * * *` - Every day at 9:00 AM
- `0 8 1 * *` - First day of each month at 8:00 AM
- `0 8 * * 1,5` - Monday and Friday at 8:00 AM

## Next Runs Preview

After creating or editing a schedule, you'll see when the next 5 runs will occur.
        """,
        keywords=["schedule", "cron", "automatic", "weekly", "daily", "monthly"],
    ),
    HelpArticle(
        id="managing-schedules",
        category="scheduling",
        title="Managing Schedules",
        summary="Edit, pause, and delete schedules",
        content="""
# Managing Schedules

## Viewing Schedules

All your schedules are displayed in the Dashboard under "Automatic Generation".

Each schedule card shows:
- Schedule name
- Next run time
- Last run status
- Whether the schedule is active

## Actions

### Toggle Active/Inactive
Click the toggle to pause or resume a schedule without deleting it.

### Execute Now
Run the schedule immediately without waiting for the next scheduled time.

### Edit
Modify the schedule name, timing, or generation configuration.

### Delete
Remove the schedule permanently.

## Schedule History

Past schedule executions are recorded in the History page with "Automatic" type.
        """,
        keywords=["manage", "edit", "delete", "pause", "toggle", "execute"],
    ),
    # Templates
    HelpArticle(
        id="uploading-templates",
        category="templates",
        title="Uploading Templates",
        summary="Add custom templates to Ghostarr",
        content="""
# Uploading Templates

Create custom templates to personalize your newsletters.

## Supported Formats

- **HTML files** (.html, .htm): Single file templates
- **ZIP archives**: Templates with multiple files (CSS, images)

## Template Structure

Templates use Jinja2 syntax. Available variables:

### Content Variables
- `movies`: List of recent movies
- `shows`: List of recent TV shows
- `games`: List of recent games (ROMM)
- `comics`: List of recent comics (Komga)
- `audiobooks`: List of recent audiobooks
- `schedule`: TV programming (Tunarr)

### Meta Variables
- `title`: Newsletter title
- `date`: Current date
- `statistics`: Viewing statistics (if enabled)
- `maintenance`: Maintenance notice (if enabled)

### Example

```html
<h1>{{ title }}</h1>

{% if movies %}
<h2>New Movies</h2>
{% for movie in movies %}
  <div>{{ movie.title }} ({{ movie.year }})</div>
{% endfor %}
{% endif %}
```
        """,
        keywords=["upload", "template", "jinja2", "html", "zip", "customize"],
    ),
    HelpArticle(
        id="template-presets",
        category="templates",
        title="Template Presets",
        summary="Configure default settings for templates",
        content="""
# Template Presets

Save time by configuring default settings for each template.

## What are Presets?

Presets are pre-configured generation settings saved with a template. When you select a template, its preset settings are automatically applied.

## Configuring Presets

1. Go to the Templates page
2. Click "Edit" on a template
3. Configure the default settings:
   - Content sources and their periods
   - Maximum items
   - Statistics options
   - Title format

4. Save the template

## Using Presets

When creating a manual generation or schedule:
1. Select a template
2. The preset settings are loaded automatically
3. Modify any settings as needed
4. Generate

## Benefits

- Consistency across newsletters
- Less configuration each time
- Different presets for different use cases
        """,
        keywords=["preset", "default", "configuration", "automatic", "settings"],
    ),
    # Troubleshooting
    HelpArticle(
        id="connection-issues",
        category="troubleshooting",
        title="Connection Issues",
        summary="Troubleshoot service connection problems",
        content="""
# Connection Issues

Having trouble connecting to a service? Try these solutions.

## Common Problems

### "Connection refused"
- Verify the service is running
- Check the URL is correct (include http:// or https://)
- Ensure Ghostarr can reach the service (no firewall blocking)

### "Unauthorized" (401)
- Double-check your API key
- Regenerate the API key in the service
- Ensure you're using the correct API key type

### "Not Found" (404)
- Verify the URL is correct
- Some services need a specific path (e.g., /api/v1)
- Check the service version is compatible

### Timeout
- The service may be slow to respond
- Check network connectivity
- Try increasing timeout (if configurable)

## Testing Connections

Use the "Test" button in Settings to diagnose issues:
- Green: Connection successful
- Red: Connection failed (check the error message)

## Logs

Check Settings > Logs for detailed error messages and stack traces.
        """,
        keywords=["connection", "error", "timeout", "unauthorized", "troubleshoot"],
    ),
    HelpArticle(
        id="generation-errors",
        category="troubleshooting",
        title="Generation Errors",
        summary="Fix common generation problems",
        content="""
# Generation Errors

## Common Errors

### "No content found"
This happens when:
- The period is too short (no new content in that time)
- All content sources are disabled
- Services returned empty results

**Solution**: Increase the period or check your services.

### "Template rendering failed"
The template has a syntax error:
- Check Jinja2 syntax
- Verify all variables are used correctly
- Look for unclosed tags

**Solution**: Fix the template or use the default template.

### "Ghost publication failed"
Publishing to Ghost failed:
- Check Ghost credentials
- Verify the Ghost API key has write permissions
- Ensure Ghost is accessible

**Solution**: Re-configure Ghost in Settings.

## Checking Progress

If generation fails:
1. Go to History
2. Find the failed generation
3. Click to view details
4. Check which step failed and the error message

## Cancelling

If generation is stuck:
1. Click "Cancel" in the progress card
2. The current operation will be aborted
3. No post will be created in Ghost
        """,
        keywords=["error", "failed", "generation", "template", "ghost", "content"],
    ),
]


@router.get("/categories", response_model=list[HelpCategory])
async def get_categories():
    """Get all help categories."""
    return CATEGORIES


@router.get("/articles", response_model=list[HelpArticle])
async def get_articles(
    category: Annotated[str | None, Query()] = None,
):
    """Get help articles, optionally filtered by category."""
    if category:
        return [a for a in ARTICLES if a.category == category]
    return ARTICLES


@router.get("/articles/{article_id}", response_model=HelpArticle)
async def get_article(article_id: str):
    """Get a specific help article."""
    article = next((a for a in ARTICLES if a.id == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.get("/search", response_model=list[HelpArticle])
async def search_help(
    q: Annotated[str, Query(min_length=2)],
):
    """Search help articles by title, summary, content, or keywords."""
    query = q.lower()
    results = []

    for article in ARTICLES:
        # Search in title, summary, content, and keywords
        if (
            query in article.title.lower()
            or query in article.summary.lower()
            or query in article.content.lower()
            or any(query in kw.lower() for kw in article.keywords)
        ):
            results.append(article)

    return results
