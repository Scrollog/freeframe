"""Branding lookups usable by background workers without request context."""
import time

from ..models.instance_branding import DEFAULT_INSTANCE_ORG_NAME

_cached: tuple[float, str] | None = None

def resolve_org_name() -> str:
    global _cached
    now = time.monotonic()
    if _cached and now - _cached[0] < 60:
        return _cached[1]
    name = DEFAULT_INSTANCE_ORG_NAME
    try:
        from ..database import SessionLocal
        from ..models.instance_branding import InstanceBranding
        db = SessionLocal()
        try:
            row = db.query(InstanceBranding).first()
            if row and row.org_name:
                name = row.org_name
        finally:
            db.close()
    except Exception:
        pass
    _cached = (now, name)
    return name

def reset_org_name_cache() -> None:
    global _cached
    _cached = None
