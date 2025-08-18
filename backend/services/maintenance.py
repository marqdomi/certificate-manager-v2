

"""
Maintenance utilities for background housekeeping tasks.

Currently provides a function used by the Celery task
`maintenance.mark_stale_running_scans` to reset devices whose
scan status has been stuck in "running" for too long.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os

from db.base import SessionLocal
from db.models import Device


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def mark_stale_running_scans(stale_minutes: int | None = None) -> int:
    """
    Find `Device` rows whose `last_scan_status` is "running" and whose
    `last_scan_timestamp` is older than the configured threshold, and mark
    them as `error` with an explanatory suffix.

    Parameters
    ----------
    stale_minutes : Optional[int]
        Number of minutes after which a RUNNING scan is considered stale.
        If not provided, tries env `MAINT_STALE_MINUTES` (default: 10).

    Returns
    -------
    int
        Number of devices reset.
    """
    if stale_minutes is None:
        try:
            stale_minutes = int(os.getenv("MAINT_STALE_MINUTES", "10"))
        except ValueError:
            stale_minutes = 10

    cutoff = _now_utc() - timedelta(minutes=stale_minutes)

    session = SessionLocal()
    try:
        stuck_devices = (
            session.query(Device)
            .filter(Device.last_scan_status == "running",
                    Device.last_scan_timestamp < cutoff)
            .all()
        )

        if not stuck_devices:
            # Nothing to do
            return 0

        now = _now_utc()
        for dev in stuck_devices:
            # Preserve any previous message but annotate clearly
            suffix = f" [auto-reset: stale RUNNING >{stale_minutes}m]"
            dev.last_scan_status = "error"
            dev.last_scan_message = ((dev.last_scan_message or "") + suffix).strip()
            dev.last_scan_timestamp = now

        session.commit()
        return len(stuck_devices)
    finally:
        session.close()


# Optional: convenience alias used by Celery task registration if it imports this
# symbol directly. The Celery worker can do, e.g.:
#   from services.maintenance import mark_stale_running_scans as _impl
#   @celery_app.task(name="maintenance.mark_stale_running_scans")
#   def task_mark_stale_running_scans():
#       return _impl()