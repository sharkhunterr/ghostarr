"""Image compositor for burning badges onto poster images with Pillow."""

import io
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.core.logging import get_logger

logger = get_logger(__name__)

# Target poster size
POSTER_WIDTH = 300
POSTER_HEIGHT = 420

# Badge styling
BADGE_FONT_SIZE = 22
BADGE_PADDING_H = 10
BADGE_PADDING_V = 5
BADGE_RADIUS = 8
BADGE_MARGIN = 8

# Rating colors by score
RATING_COLORS = {
    "excellent": (16, 185, 129),   # green  >= 8.0
    "good": (59, 130, 246),        # blue   >= 7.0
    "average": (245, 158, 11),     # amber  >= 6.0
    "poor": (239, 68, 68),         # red    < 6.0
}

BADGE_BG_DARK = (0, 0, 0, 160)       # semi-transparent black
BADGE_BG_PURPLE = (139, 92, 246, 230)  # purple for episode count


def _get_rating_color(rating: float) -> tuple[int, int, int]:
    if rating >= 8.0:
        return RATING_COLORS["excellent"]
    elif rating >= 7.0:
        return RATING_COLORS["good"]
    elif rating >= 6.0:
        return RATING_COLORS["average"]
    return RATING_COLORS["poor"]


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Get a font, falling back to default if no TTF available."""
    font_paths = [
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    fill: tuple[int, ...],
    radius: int = BADGE_RADIUS,
) -> None:
    """Draw a rounded rectangle."""
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def _draw_badge(
    draw: ImageDraw.ImageDraw,
    text: str,
    x: int,
    y: int,
    font: Any,
    bg_color: tuple[int, ...] = BADGE_BG_DARK,
    text_color: tuple[int, ...] = (255, 255, 255, 255),
    anchor: str = "lt",  # "lt" = left-top, "rt" = right-top
) -> tuple[int, int]:
    """Draw a badge with text and return its (width, height)."""
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    bw = tw + BADGE_PADDING_H * 2
    bh = th + BADGE_PADDING_V * 2

    if anchor == "rt":
        x = x - bw

    _draw_rounded_rect(draw, (x, y, x + bw, y + bh), fill=bg_color)
    # Center text vertically by compensating for font bbox offset
    text_x = x + BADGE_PADDING_H - bbox[0]
    text_y = y + (bh - th) // 2 - bbox[1]
    draw.text((text_x, text_y), text, font=font, fill=text_color)
    return bw, bh


def _draw_gradient_overlay(img: Image.Image, height: int = 100) -> None:
    """Draw a gradient overlay at the bottom of the image."""
    overlay = Image.new("RGBA", (img.width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for i in range(height):
        alpha = int(200 * (i / height))
        draw.line([(0, i), (img.width, i)], fill=(0, 0, 0, alpha))
    img.paste(overlay, (0, img.height - height), overlay)


def _draw_title_on_image(
    draw: ImageDraw.ImageDraw,
    title: str,
    img_width: int,
    img_height: int,
    font: Any,
) -> None:
    """Draw title text at the bottom of the image over the gradient."""
    max_width = img_width - BADGE_MARGIN * 2
    # Truncate title if too long
    while font.getbbox(title)[2] - font.getbbox(title)[0] > max_width and len(title) > 3:
        title = title[:-4] + "..."

    draw.text(
        (BADGE_MARGIN, img_height - BADGE_MARGIN - 24),
        title,
        font=font,
        fill=(255, 255, 255, 255),
    )


def composite_poster(
    image_bytes: bytes | None,
    title: str,
    badges_top_right: list[dict] | None = None,
    badges_top_left: list[dict] | None = None,
    badges_bottom: list[dict] | None = None,
    placeholder_emoji: str = "🎬",
    placeholder_color: tuple[int, int, int] = (100, 100, 100),
) -> bytes:
    """Compose a poster image with badges and title burned in.

    Args:
        image_bytes: Raw poster image bytes, or None for placeholder
        title: Title to display at the bottom
        badges_top_right: List of badge dicts with 'text' and optional 'color' (rgb tuple)
        badges_top_left: List of badge dicts with 'text' and optional 'color' (rgb tuple)
        badges_bottom: List of badge dicts with 'text' and optional 'color' (rgb tuple)
        placeholder_emoji: Emoji for placeholder when no image
        placeholder_color: Background color for placeholder

    Returns:
        Composited image as JPEG bytes
    """
    font = _get_font(BADGE_FONT_SIZE)
    title_font = _get_font(18)

    # Load or create placeholder image
    if image_bytes:
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            # Resize + crop to exact poster size (preserves aspect ratio, crops center)
            img = ImageOps.fit(img, (POSTER_WIDTH, POSTER_HEIGHT), Image.Resampling.LANCZOS)
        except Exception:
            img = _create_placeholder(placeholder_color, placeholder_emoji)
    else:
        img = _create_placeholder(placeholder_color, placeholder_emoji)

    # Draw gradient overlay at bottom for title readability
    _draw_gradient_overlay(img, height=120)

    draw = ImageDraw.Draw(img)

    # Draw top-right badges (e.g., rating)
    y_offset = BADGE_MARGIN
    for badge in (badges_top_right or []):
        color = badge.get("color", BADGE_BG_DARK)
        if isinstance(color, tuple) and len(color) == 3:
            color = (*color, 230)
        bw, bh = _draw_badge(
            draw, badge["text"],
            POSTER_WIDTH - BADGE_MARGIN, y_offset,
            font, bg_color=color, anchor="rt",
        )
        y_offset += bh + 4

    # Draw top-left badges (e.g., episode count)
    y_offset = BADGE_MARGIN
    for badge in (badges_top_left or []):
        color = badge.get("color", BADGE_BG_DARK)
        if isinstance(color, tuple) and len(color) == 3:
            color = (*color, 230)
        bw, bh = _draw_badge(
            draw, badge["text"],
            BADGE_MARGIN, y_offset,
            font, bg_color=color, anchor="lt",
        )
        y_offset += bh + 4

    # Draw title
    _draw_title_on_image(draw, title, POSTER_WIDTH, POSTER_HEIGHT, title_font)

    # Draw bottom badges (above title, e.g., year, duration)
    if badges_bottom:
        x_offset = BADGE_MARGIN
        badge_y = POSTER_HEIGHT - BADGE_MARGIN - 50
        small_font = _get_font(16)
        for badge in badges_bottom:
            color = badge.get("color", BADGE_BG_DARK)
            if isinstance(color, tuple) and len(color) == 3:
                color = (*color, 200)
            bw, bh = _draw_badge(
                draw, badge["text"],
                x_offset, badge_y,
                small_font, bg_color=color, anchor="lt",
            )
            x_offset += bw + 4

    # Convert to RGB (JPEG doesn't support alpha) and return bytes
    output = img.convert("RGB")
    buffer = io.BytesIO()
    output.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def _create_placeholder(
    color: tuple[int, int, int],
    emoji: str,
) -> Image.Image:
    """Create a placeholder poster image."""
    img = Image.new("RGBA", (POSTER_WIDTH, POSTER_HEIGHT), (*color, 255))
    draw = ImageDraw.Draw(img)

    # Draw emoji in center
    emoji_font = _get_font(64)
    try:
        bbox = emoji_font.getbbox(emoji)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text(
            ((POSTER_WIDTH - tw) // 2, (POSTER_HEIGHT - th) // 2 - 20),
            emoji,
            font=emoji_font,
            fill=(255, 255, 255, 180),
        )
    except Exception:
        # Emoji rendering may fail, just skip
        pass

    return img
