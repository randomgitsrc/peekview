"""UTC datetime formatting and parsing helpers.

Single source of truth for the wire format of timestamps: naive values are
treated as UTC and rendered with a ``Z`` suffix; parsing accepts both ``Z``
and ``+00:00`` (CPython 3.10's ``fromisoformat`` rejects ``Z``).
"""

from datetime import datetime, timezone


def utc_iso_z(value: datetime | None) -> str | None:
    """Render ``value`` as an ISO 8601 UTC string ending in ``Z``."""
    if value is None:
        return None
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return aware.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    """Parse an ISO 8601 string, accepting a ``Z`` UTC designator."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
