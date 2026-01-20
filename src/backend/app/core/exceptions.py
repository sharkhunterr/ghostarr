"""Custom exceptions for the application."""

from typing import Any


class GhostarrException(Exception):
    """Base exception for Ghostarr."""

    def __init__(self, message: str, code: str = "error", details: dict[str, Any] | None = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


class IntegrationError(GhostarrException):
    """Error communicating with external service."""

    def __init__(self, service: str, message: str, details: dict[str, Any] | None = None):
        self.service = service
        super().__init__(
            message=f"{service}: {message}",
            code="integration_error",
            details={"service": service, **(details or {})},
        )


class TemplateError(GhostarrException):
    """Error in template rendering or validation."""

    def __init__(self, message: str, line: int | None = None, variable: str | None = None):
        details = {}
        if line is not None:
            details["line"] = line
        if variable is not None:
            details["variable"] = variable
        super().__init__(message=message, code="template_error", details=details)


class GenerationError(GhostarrException):
    """Error during newsletter generation."""

    def __init__(self, step: str, message: str, details: dict[str, Any] | None = None):
        self.step = step
        super().__init__(
            message=f"Generation failed at {step}: {message}",
            code="generation_error",
            details={"step": step, **(details or {})},
        )


class ValidationError(GhostarrException):
    """Validation error for user input."""

    def __init__(self, field: str, message: str):
        self.field = field
        super().__init__(
            message=f"Validation error on {field}: {message}",
            code="validation_error",
            details={"field": field},
        )


class NotFoundError(GhostarrException):
    """Resource not found."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found: {identifier}",
            code="not_found",
            details={"resource": resource, "identifier": identifier},
        )


class ConflictError(GhostarrException):
    """Resource conflict (e.g., template in use)."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message=message, code="conflict", details=details)


class GenerationCancelledException(GhostarrException):
    """Generation was cancelled by user."""

    def __init__(self, generation_id: str):
        self.generation_id = generation_id
        super().__init__(
            message="Generation cancelled by user",
            code="generation_cancelled",
            details={"generation_id": generation_id},
        )
