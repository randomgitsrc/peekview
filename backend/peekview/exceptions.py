"""Exception hierarchy for PeekView.

All exceptions inherit from PeekError and provide:
- status_code: HTTP status code for API responses
- error_code: Machine-readable error code for clients
- message: Human-readable description
"""


class PeekError(Exception):
    """Base exception for all PeekView errors.

    Attributes:
        status_code: HTTP status code (default 500)
        error_code: Machine-readable error code
    """

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str | None = None):
        self.message = message or "An unexpected error occurred"
        super().__init__(self.message)


class ValidationError(PeekError):
    """Parameter validation failed.

    Raised when request parameters fail validation (missing fields,
    invalid format, etc.).
    """

    status_code = 400
    error_code = "VALIDATION_ERROR"


class InvalidSlugError(PeekError):
    """Slug format is invalid.

    Raised when slug contains invalid characters or exceeds length limits.
    """

    status_code = 400
    error_code = "INVALID_SLUG"


class ForbiddenPathError(PeekError):
    """Local path access is forbidden.

    Raised when local_path points to a forbidden directory,
    contains path traversal, or is a symlink.
    """

    status_code = 403
    error_code = "FORBIDDEN_PATH"


class NotFoundError(PeekError):
    """Resource not found.

    Raised when entry, file, or other resource doesn't exist.
    """

    status_code = 404
    error_code = "NOT_FOUND"


class FileNotFoundError(PeekError):
    """Local file not found.

    Raised when local_path points to a non-existent file.
    """

    status_code = 404
    error_code = "FILE_NOT_FOUND"


class PayloadTooLargeError(PeekError):
    """Request payload exceeds size limits.

    Raised when file content, entry size, or other limits are exceeded.
    """

    status_code = 413
    error_code = "PAYLOAD_TOO_LARGE"

    def __init__(
        self,
        message: str | None = None,
        limit_type: str | None = None,
        max_bytes: int | None = None,
        actual_bytes: int | None = None,
    ):
        self.limit_type = limit_type
        self.max_bytes = max_bytes
        self.actual_bytes = actual_bytes
        super().__init__(message)


class ConflictError(PeekError):
    """Resource conflict.

    Raised when there's a conflict, such as duplicate slug.
    """

    status_code = 409
    error_code = "CONFLICT"


class AuthenticationError(PeekError):
    """Authentication required or failed.

    Raised when a user is not authenticated or credentials are invalid.
    """

    status_code = 401
    error_code = "NOT_AUTHENTICATED"


class RegistrationError(PeekError):
    """Registration failed.

    Raised when user registration fails (generic error to prevent enumeration).
    """

    status_code = 400
    error_code = "REGISTRATION_FAILED"


class InvalidCredentialsError(PeekError):
    """Invalid login credentials.

    Raised when username or password is incorrect (generic to prevent enumeration).
    """

    status_code = 401
    error_code = "INVALID_CREDENTIALS"


class CaptchaInvalidError(PeekError):
    """Captcha token failed verification.

    Raised when the captcha token is rejected by the captcha service.
    """

    status_code = 401
    error_code = "CAPTCHA_INVALID"


class CaptchaRequiredError(PeekError):
    """Captcha token is required but missing.

    Raised when captcha is enabled but no captcha_token was supplied.
    """

    status_code = 401
    error_code = "CAPTCHA_REQUIRED"


class CaptchaConfigError(PeekError):
    """Captcha service is misconfigured.

    Raised when captcha_enabled=true but site_key/secret_key/verify_url are missing.
    """

    status_code = 500
    error_code = "CAPTCHA_CONFIG_ERROR"


class ForbiddenError(PeekError):
    """Operation not permitted.

    Raised when a user attempts an action they don't have permission for.
    """

    status_code = 403
    error_code = "FORBIDDEN"


class StorageError(PeekError):
    """File storage operation failed.

    Raised when file read/write/delete operations fail.
    """

    status_code = 500
    error_code = "STORAGE_ERROR"


class DatabaseError(PeekError):
    """Database operation failed.

    Raised when database operations fail (not covered by other errors).
    """

    status_code = 500
    error_code = "DATABASE_ERROR"
