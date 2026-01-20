"""Logging infrastructure with correlation ID support and database persistence."""

import asyncio
import logging
import queue
import sys
import threading
from contextvars import ContextVar
from datetime import datetime
from typing import Any
from uuid import uuid4

from app.config import settings

# Context variable for correlation ID
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> str | None:
    """Get current correlation ID."""
    return correlation_id_var.get()


def set_correlation_id(correlation_id: str | None = None) -> str:
    """Set correlation ID for current context."""
    cid = correlation_id or str(uuid4())
    correlation_id_var.set(cid)
    return cid


class CorrelationIdFilter(logging.Filter):
    """Add correlation ID to log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id() or "-"
        return True


class JsonFormatter(logging.Formatter):
    """JSON log formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        import json

        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "-"),
        }

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in (
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "exc_info",
                "exc_text",
                "thread",
                "threadName",
                "message",
                "correlation_id",
            ):
                log_entry[key] = value

        return json.dumps(log_entry)


def setup_logging() -> None:
    """Configure application logging."""
    global _db_handler

    log_level = getattr(logging, settings.app_log_level.upper(), logging.INFO)

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Use JSON formatter in production, simple format in development
    if settings.app_env == "production":
        console_handler.setFormatter(JsonFormatter())
    else:
        console_handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(correlation_id)s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )

    console_handler.addFilter(CorrelationIdFilter())
    root_logger.addHandler(console_handler)

    # Database handler (persists logs to SQLite)
    _db_handler = DatabaseLogHandler(level=log_level)
    _db_handler.addFilter(CorrelationIdFilter())
    root_logger.addHandler(_db_handler)

    # Set levels for noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.app_env == "development" else logging.WARNING
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name."""
    return logging.getLogger(name)


# Convenience function for logging with extra context
def log_with_context(
    logger: logging.Logger,
    level: int,
    message: str,
    **context: Any,
) -> None:
    """Log a message with additional context."""
    logger.log(level, message, extra=context)


# Database logging handler
class DatabaseLogHandler(logging.Handler):
    """Async handler that persists logs to the database using a background thread."""

    # Map Python log levels to our LogLevel enum values
    LEVEL_MAP = {
        logging.DEBUG: "debug",
        logging.INFO: "info",
        logging.WARNING: "warning",
        logging.ERROR: "error",
        logging.CRITICAL: "error",  # Map critical to error
    }

    def __init__(self, level: int = logging.INFO):
        super().__init__(level)
        self._queue: queue.Queue = queue.Queue()
        self._thread: threading.Thread | None = None
        self._running = False
        self._db_initialized = False

    def start(self) -> None:
        """Start the background thread for database writes."""
        if self._thread is not None and self._thread.is_alive():
            return

        self._running = True
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop the background thread."""
        self._running = False
        if self._thread is not None:
            self._queue.put(None)  # Signal to exit
            self._thread.join(timeout=5)

    def emit(self, record: logging.LogRecord) -> None:
        """Queue the log record for async database write."""
        # Skip logs from SQLAlchemy to avoid infinite loops
        if record.name.startswith("sqlalchemy"):
            return

        try:
            self._queue.put_nowait(record)
        except queue.Full:
            pass  # Drop log if queue is full

    def _worker(self) -> None:
        """Background worker that writes logs to the database."""
        # Create a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            while self._running:
                try:
                    record = self._queue.get(timeout=1)
                    if record is None:  # Shutdown signal
                        break

                    loop.run_until_complete(self._write_log(record))
                except queue.Empty:
                    continue
                except Exception:
                    pass  # Silently ignore errors to avoid recursive logging
        finally:
            loop.close()

    async def _write_log(self, record: logging.LogRecord) -> None:
        """Write a log record to the database."""
        try:
            # Late import to avoid circular dependencies
            from app.database import AsyncSessionLocal
            from app.models.log import Log, LogLevel, LogSource

            level_str = self.LEVEL_MAP.get(record.levelno, "info")
            level = LogLevel(level_str)

            # Determine source based on logger name
            if "integration" in record.name.lower():
                source = LogSource.INTEGRATION
            else:
                source = LogSource.BACKEND

            # Extract service name from logger (e.g., "app.integrations.tautulli" -> "tautulli")
            service = None
            parts = record.name.split(".")
            if len(parts) >= 3 and parts[1] == "integrations":
                service = parts[2]
            elif len(parts) >= 3 and parts[1] == "services":
                service = parts[2]

            correlation_id = getattr(record, "correlation_id", None)
            if correlation_id == "-":
                correlation_id = None

            async with AsyncSessionLocal() as session:
                log = Log(
                    level=level,
                    source=source,
                    service=service,
                    message=record.getMessage()[:2000],  # Limit message length
                    correlation_id=correlation_id,
                )
                session.add(log)
                await session.commit()

        except Exception:
            pass  # Silently fail to avoid recursive logging


# Global database handler instance
_db_handler: DatabaseLogHandler | None = None


def get_db_handler() -> DatabaseLogHandler | None:
    """Get the global database handler instance."""
    return _db_handler


def start_db_logging() -> None:
    """Start the database logging handler."""
    global _db_handler
    if _db_handler is not None:
        _db_handler.start()


def stop_db_logging() -> None:
    """Stop the database logging handler."""
    global _db_handler
    if _db_handler is not None:
        _db_handler.stop()
