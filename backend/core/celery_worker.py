from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

from celery import Celery
from celery.schedules import crontab
from celery.exceptions import SoftTimeLimitExceeded
from . import celery_config

# --- Ensure project root is on sys.path so Celery can import our packages ---
# This file lives at backend/core/celery_worker.py; project root is two levels up (backend/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Optional: also include the parent of backend when running from unusual cwd
PARENT = PROJECT_ROOT.parent
if str(PARENT) not in sys.path:
    sys.path.append(str(PARENT))

# --- Celery app ---
# Use a stable, descriptive app name
celery_app = Celery("certificate_manager")
celery_app.config_from_object(celery_config)

# Autodiscover tasks inside the 'services' and 'api' packages (and subpackages)
# We look for modules named "tasks.py" within those packages.
celery_app.autodiscover_tasks(packages=["services", "api"], related_name="tasks")

# --- Explicit task import/registration (hotfix) ---
# Ensure tasks are registered even if autodiscovery misses modules in Docker
_scan_import_error = None
try:
    # Typical layout: /app/services/...
    from services.f5_service_logic import (
        scan_single_f5 as _scan_single_f5_func,
        trigger_scan_for_all_devices_task as _trigger_scan_all_func,
    )
except Exception as e1:
    _scan_import_error = e1
    try:
        # Alternate layout: /app/backend/services/...
        from backend.services.f5_service_logic import (
            scan_single_f5 as _scan_single_f5_func,
            trigger_scan_for_all_devices_task as _trigger_scan_all_func,
        )
    except Exception as e2:
        _scan_import_error = (e1, e2)
        _scan_single_f5_func = None
        _trigger_scan_all_func = None

# Register with explicit names used by the producer side
if _scan_single_f5_func is not None and "scan_single_f5" not in celery_app.tasks:
    celery_app.task(name="scan_single_f5")(_scan_single_f5_func)

if _trigger_scan_all_func is not None and "trigger_scan_for_all_devices_task" not in celery_app.tasks:
    celery_app.task(name="trigger_scan_for_all_devices_task")(_trigger_scan_all_func)

# Provide a lightweight healthcheck task to verify worker wiring
@celery_app.task(name="health.ping")
def ping() -> str:
    return "pong"

# --- Beat schedule ---
# NOTE: The key name previously claimed "every 5 minutes" but actually ran daily at 03:00.
# Keeping behavior the same, but correcting the label. Make this configurable later if needed.

celery_app.conf.beat_schedule = {
    "scan-all-devices-daily-03:00": {
        # If your task is registered with a custom name, keep that here;
        # otherwise prefer the dotted path. We retain the current name to avoid breaking changes.
        "task": "trigger_scan_for_all_devices_task",
        "schedule": crontab(hour=3, minute=0),
    },
    "maintenance-mark-stale-running-scans-5min": {
        "task": "maintenance.mark_stale_running_scans",
        "schedule": crontab(minute="*/5"),
    }
}


# Attempt to import and register cache refresh tasks (optional)
try:
    from services.cache_builder import (
        task_refresh_device_profiles as _cache_refresh_device,
        task_refresh_all_profiles as _cache_refresh_all,
    )
    if "cache.refresh_device_profiles" not in celery_app.tasks:
        celery_app.task(name="cache.refresh_device_profiles")(_cache_refresh_device)
    if "cache.refresh_all_profiles" not in celery_app.tasks:
        celery_app.task(name="cache.refresh_all_profiles")(_cache_refresh_all)
except Exception:
    # Cache builder not present; skip without failing startup
    pass

# Attempt to import and register device facts refresh tasks (explicit)
try:
    from services import f5_service_tasks as _facts_tasks  # wrappers over services.f5_facts
    # Register with stable names used by API
    if "devices.refresh_facts" not in celery_app.tasks:
        celery_app.task(name="devices.refresh_facts")(_facts_tasks.refresh_device_facts_task)
    if "devices.refresh_facts_all" not in celery_app.tasks:
        celery_app.task(name="devices.refresh_facts_all")(_facts_tasks.refresh_device_facts_all_task)
except Exception:
    # Facts task module may be absent in some builds; skip without failing startup
    pass

# --- Cache refresh task (explicit name expected by callers) ---
@celery_app.task(name="f5_cache.refresh_profiles_cache_task")
def refresh_profiles_cache_task(device_ids: list[int] | None = None,
                                full_resync: bool = False,
                                primaries_only: bool = False):
    """
    Refresh the local F5 profiles cache tables.

    Preferred delegate:
      - services.f5_cache_service.refresh_profiles_cache(device_ids, full_resync)

    Fallback (if the above module is not available):
      - services.cache_builder.task_refresh_device_profiles(device_id=...)
      - services.cache_builder.task_refresh_all_profiles(full_resync=...)
    """
    # Try the dedicated service first (if present)
    try:
        from services.f5_cache_service import refresh_profiles_cache as _refresh
        return _refresh(device_ids=device_ids, full_resync=full_resync)
    except ModuleNotFoundError:
        # Fallback path: call cache_builder helpers directly (synchronous)
        pass
    except Exception as e:
        # If the module exists but failed, surface that error
        raise

    # Fallback using cache_builder helpers that we attempt to import at module import time
    # (see the top of this file where we try to import from services.cache_builder)
    results: list[dict] = []
    # Prefer the explicitly imported helpers if available
    try:
        from services.cache_builder import (
            task_refresh_device_profiles as _cache_refresh_device,
            task_refresh_all_profiles as _cache_refresh_all,
        )
    except Exception:
        # As a secondary fallback, see if they were already imported at module level
        _cache_refresh_device = globals().get("_cache_refresh_device")
        _cache_refresh_all = globals().get("_cache_refresh_all")

    if device_ids:
        for did in device_ids:
            try:
                if _cache_refresh_device is None:
                    raise RuntimeError("cache_builder.task_refresh_device_profiles no disponible")
                # Some implementations accept either positional or keyword args; support both.
                try:
                    res = _cache_refresh_device(device_id=did, full_resync=full_resync)  # type: ignore[misc]
                except TypeError:
                    try:
                        res = _cache_refresh_device(did)  # type: ignore[misc]
                    except TypeError:
                        res = _cache_refresh_device(did, full_resync)  # type: ignore[misc]
                results.append({"device_id": did, "result": res, "status": "ok"})
            except Exception as e:
                results.append({"device_id": did, "error": str(e), "status": "error"})
        return {"status": "success", "mode": "fallback/cache_builder/device", "results": results}

    # No device_ids -> full refresh
    try:
        if _cache_refresh_all is None:
            raise RuntimeError("cache_builder.task_refresh_all_profiles no disponible")
        try:
            res_all = _cache_refresh_all(primaries_only=primaries_only)  # type: ignore[misc]
        except TypeError:
            res_all = _cache_refresh_all()  # type: ignore[misc]
        return {"status": "success", "mode": "fallback/cache_builder/all", "result": res_all}
    except Exception as e:
        # Nothing else we can do here
        raise RuntimeError(f"No se pudo refrescar el caché de perfiles (fallback): {e}")

# --- Helper: classify errors into short codes for UI chips ---
def _classify_scan_error(exc) -> tuple[str, str]:
    """
    Returns (code, short_text) where code is one of:
    AUTH, TIMEOUT, SSL, CONN, HTTP_4xx, HTTP_5xx, UNKNOWN
    """
    # Lazy imports to avoid hard deps at module import time
    text = f"{type(exc).__name__}: {exc}".strip()
    code = "UNKNOWN"
    short = "Error"
    try:
        from celery.exceptions import SoftTimeLimitExceeded as _SoftTLE
    except Exception:
        class _SoftTLE(Exception):  # type: ignore
            pass
    try:
        from requests import exceptions as _rex  # type: ignore
    except Exception:
        class _RexTimeout(Exception):  # type: ignore
            pass
        class _RexConnError(Exception):  # type: ignore
            pass
        class _RexSSLError(Exception):  # type: ignore
            pass
        class _RexHTTPError(Exception):  # type: ignore
            pass
        class Dummy:  # type: ignore
            Timeout = _RexTimeout
            ConnectTimeout = _RexTimeout
            ReadTimeout = _RexTimeout
            ConnectionError = _RexConnError
            SSLError = _RexSSLError
            HTTPError = _RexHTTPError
        _rex = Dummy()  # type: ignore
    # 1) Timeouts
    if isinstance(exc, _SoftTLE) or isinstance(exc, getattr(_rex, "Timeout", tuple())) or "timed out" in text.lower():
        return ("TIMEOUT", "Timeout")
    # 2) SSL errors
    if isinstance(exc, getattr(_rex, "SSLError", tuple())) or "ssl" in text.lower():
        return ("SSL", "SSL error")
    # 3) Connection errors / refused / DNS
    if isinstance(exc, getattr(_rex, "ConnectionError", tuple())) or "connection refused" in text.lower() or "failed to establish a new connection" in text.lower():
        return ("CONN", "Connection failed")
    # 4) HTTP / Auth classification by message sniffing (works for iControl errors)
    lowered = text.lower()
    # Explicit 401 / authorization
    if "401" in lowered or "authorization required" in lowered or "authentication failed" in lowered:
        return ("AUTH", "Auth failed")
    # Other common HTTP classes
    for n in ("403", "404", "409"):
        if n in lowered:
            return ("HTTP_4xx", f"HTTP {n}")
    for n in ("500", "502", "503", "504"):
        if n in lowered:
            return ("HTTP_5xx", f"HTTP {n}")
    # Fallback
    return (code, short)

# --- TAREAS SHIM SIEMPRE REGISTRADAS ---
# Registramos los nombres que el backend publica en la cola aunque el import
# de services falle al arranque. Importamos la implementación al ejecutar.

@celery_app.task(name="scan_single_f5", soft_time_limit=900, time_limit=1200)
def _scan_single_f5_task(device_id: int):
    # --- Helper to persist scan status early (so UI doesn't stay in 'pending') ---
    def _set_scan_status_early(dev_id: int, status: str, message: str | None = None):
        try:
            import importlib as _il
            SessionLocal = _il.import_module("db.base").SessionLocal
            Device = _il.import_module("db.models").Device
            _db = SessionLocal()
            try:
                try:
                    _dev = _db.get(Device, dev_id)
                except Exception:
                    _dev = _db.query(Device).get(dev_id)  # SQLAlchemy <2 compatibility
                if _dev is not None:
                    _dev.last_scan_status = status
                    _dev.last_scan_message = message
                    _dev.last_scan_timestamp = datetime.utcnow()
                    _db.commit()
            except Exception:
                _db.rollback()
            finally:
                _db.close()
        except Exception:
            # If we cannot persist early status, continue without failing the task
            pass

    # Mark device as 'running' as soon as the worker picks the job
    _set_scan_status_early(device_id, "running", None)

    # Importación tardía y tolerante para encontrar la función real de escaneo
    import importlib
    import inspect

    mod = importlib.import_module("services.f5_service_logic")

    # Candidatos en orden de preferencia
    candidates = [
        "scan_single_f5",            # nombre esperado v2.5 (device_id)
        "scan_device",               # alias genérico (device_id)
        "perform_scan",              # posible variante
        "_perform_scan",             # función interna observada; suele requerir device, username, password
    ]

    impl = None
    for name in candidates:
        if hasattr(mod, name) and inspect.isfunction(getattr(mod, name)):
            impl = getattr(mod, name)
            break

    if impl is None:
        available = [n for n, o in inspect.getmembers(mod) if inspect.isfunction(o)]
        raise ImportError(
            "No se encontró función de escaneo compatible en services.f5_service_logic. "
            f"Probé {candidates}. Funciones disponibles: {available}"
        )

    # Variables para registrar resultado en BD
    result = None
    status = "success"
    message = "OK"

    # Averiguamos la firma para decidir cómo llamar
    sig = inspect.signature(impl)
    params = list(sig.parameters.values())

    # Caso A: implementación acepta sólo device_id
    if len(params) == 1:
        try:
            result = impl(device_id)
            if isinstance(result, dict):
                status = result.get("status", "success") or "success"
                message = (result.get("message") or "")[:1000]
            else:
                message = (str(result) if result is not None else "")[:1000]
        except (SoftTimeLimitExceeded, Exception) as e:
            status = "error"
            ec, short = _classify_scan_error(e)
            original = f"{type(e).__name__}: {e}"
            message = f"[EC={ec}] {short} – {original}"[:1000]
            result = {"status": "error", "message": message}
        finally:
            # Intentamos actualizar el estado del device en BD
            try:
                import importlib as _il
                # Import de SessionLocal y Device en este layout
                SessionLocal = _il.import_module("db.base").SessionLocal
                Device = _il.import_module("db.models").Device
                db = SessionLocal()
                try:
                    try:
                        dev = db.get(Device, device_id)
                    except Exception:
                        dev = db.query(Device).get(device_id)  # SQLAlchemy <2
                    if dev is not None:
                        dev.last_scan_status = status
                        dev.last_scan_message = message
                        dev.last_scan_timestamp = datetime.utcnow()
                        db.commit()
                except Exception:
                    db.rollback()
                finally:
                    db.close()
            except Exception:
                # No impedimos el retorno del task si falló la escritura de estado
                pass
        return result

    # Caso B: implementación espera (device, username, password) y/o db
    # Preparamos los argumentos a partir de la BD
    # Intentamos importar SessionLocal y el modelo Device desde distintos layouts
    SessionLocal = None
    Device = None

    import_errors = []

    # Posibles ubicaciones de SessionLocal
    for path in (
        "db.base:SessionLocal",           # ruta real en este proyecto
        "services.database:SessionLocal",
        "database:SessionLocal",
        "core.database:SessionLocal",
        "db.database:SessionLocal",
    ):
        try:
            module_name, attr = path.split(":")
            m = importlib.import_module(module_name)
            SessionLocal = getattr(m, attr)
            break
        except Exception as e:
            import_errors.append((path, str(e)))

    # Posibles ubicaciones del modelo Device
    for path in (
        "db.models:Device",               # ruta real en este proyecto
        "services.models:Device",
        "services.models.device:Device",
        "models:Device",
        "app.models:Device",
        "backend.models:Device",
    ):
        try:
            module_name, attr = path.split(":")
            m = importlib.import_module(module_name)
            Device = getattr(m, attr)
            break
        except Exception as e:
            import_errors.append((path, str(e)))

    if SessionLocal is None or Device is None:
        raise ImportError(
            "No pude importar SessionLocal o Device para preparar la llamada a _perform_scan. "
            f"Errores: {import_errors}"
        )

    # Obtenemos el device y credenciales
    db = SessionLocal()
    try:
        # SQLAlchemy 1.4/2.0: session.get es preferible si está disponible
        try:
            device = db.get(Device, device_id)
        except Exception:
            device = db.query(Device).get(device_id)  # type: ignore[attr-defined]

        if device is None:
            raise ValueError(f"Device id {device_id} no encontrado")

        username = getattr(device, "username", None)
        password = None

        # Intentamos obtener y desencriptar la contraseña si existe
        encrypted = getattr(device, "encrypted_password", None)
        if encrypted:
            # Posibles utilidades de desencriptado
            decrypt_candidates = (
                "services.encryption_service:decrypt_password",  # ruta real del proyecto (si existiera)
                "services.encryption_service:decrypt_data",      # función real en este proyecto
                "encryption_service:decrypt_password",
                "services.crypto:decrypt_password",
                "services.security:decrypt_password",
                "crypto:decrypt_password",
                "security:decrypt_password",
            )
            for path in decrypt_candidates:
                try:
                    module_name, attr = path.split(":")
                    m = importlib.import_module(module_name)
                    dec = getattr(m, attr)
                    try:
                        password = dec(encrypted)
                        break
                    except Exception:
                        # Si falla, probamos el siguiente
                        pass
                except Exception:
                    pass

        # Como último recurso, tal vez el campo ya esté en texto plano
        if password is None:
            raw_pw = getattr(device, "password", None)
            password = raw_pw or encrypted

        if not username or not password:
            raise ValueError(
                "Credenciales incompletas para el dispositivo: se requiere username y password"
            )

        try:
            impl_sig = inspect.signature(impl)
            params_list = list(impl_sig.parameters.values())
            param_names = [p.name for p in params_list]

            # Mapeo de variables disponibles hacia posibles nombres de parámetros
            mapping = {
                "device": device,
                "username": username,
                # Aceptamos tanto "password" como variantes como "passwd"
                "password": password,
                "passwd": password,
                # Algunas implementaciones internas esperan una sesión/DB
                "db": db,
                "session": db,
                "db_session": db,
                "Session": db,
            }

            # Intento 1: llamada por kwargs (por nombre)
            kwargs = {}
            for name in param_names:
                if name in mapping:
                    kwargs[name] = mapping[name]
            result = impl(**kwargs)
        except TypeError:
            # Intento 2: construir args posicionales en el orden exacto de la firma
            args = []
            for p in params_list:
                # ignoramos *args/**kwargs
                if p.kind in (inspect._ParameterKind.VAR_POSITIONAL, inspect._ParameterKind.VAR_KEYWORD):
                    continue
                if p.name in mapping:
                    args.append(mapping[p.name])
                elif p.default is not inspect._empty:
                    args.append(p.default)
                else:
                    raise TypeError(f"No puedo mapear el parámetro requerido '{p.name}' para llamar a {impl.__name__}")
            result = impl(*args)

        # Normalizo el resultado a (status, message)
        if isinstance(result, dict):
            status = result.get("status", "success") or "success"
            message = (result.get("message") or "")[:1000]
        else:
            message = (str(result) if result is not None else "")[:1000]

    except (SoftTimeLimitExceeded, Exception) as e:
        status = "error"
        ec, short = _classify_scan_error(e)
        original = f"{type(e).__name__}: {e}"
        message = f"[EC={ec}] {short} – {original}"[:1000]
        result = {"status": "error", "message": message}
    finally:
        # Actualizamos estado del dispositivo siempre
        try:
            try:
                dev = db.get(Device, device_id)
            except Exception:
                dev = db.query(Device).get(device_id)
            if dev is not None:
                dev.last_scan_status = status
                dev.last_scan_message = message
                dev.last_scan_timestamp = datetime.utcnow()
                db.commit()
        except Exception:
            db.rollback()
        finally:
            try:
                db.close()
            except Exception:
                pass

    return result

@celery_app.task(name="trigger_scan_for_all_devices_task")
def _trigger_scan_for_all_devices_task(device_ids: list[int] | None = None, limit: int | None = None, batch_size: int = 0):
    """Encola un scan_single_f5 por cada device.

    - Si `device_ids` viene, filtra por ese subconjunto.
    - Si `limit` viene, limita el número de dispositivos.
    - `batch_size` opcional para futuras pausas/control de ráfaga (no duerme por ahora).
    Devuelve un resumen con la cantidad programada.
    """
    try:
        from db.base import SessionLocal
        from db.models import Device
    except Exception as e:
        # Si la BD no está disponible, fallamos con mensaje claro
        raise RuntimeError(f"No puedo importar DB para encolar scans: {e}")

    db = SessionLocal()
    scheduled = 0
    try:
        q = db.query(Device)
        if device_ids:
            q = q.filter(Device.id.in_(device_ids))
        if limit:
            q = q.limit(int(limit))
        devices = q.all()

        for d in devices:
            # Usamos el nombre del task para evitar acoplamiento con símbolos locales
            celery_app.send_task("scan_single_f5", args=[d.id])
            scheduled += 1
            # (Opcional) control de ráfaga en el futuro con batch_size

        return {"scheduled": scheduled, "requested": len(device_ids or []), "limit": limit}
    finally:
        try:
            db.close()
        except Exception:
            pass

@celery_app.task(name="maintenance.mark_stale_running_scans")
def mark_stale_running_scans(max_age_minutes: int = 30) -> int:
    """Safety net: any device stuck in 'running' for too long is marked as error.

    Returns the number of rows updated.
    """
    try:
        from db.base import SessionLocal
        from db.models import Device
    except Exception:
        # If DB imports fail, skip quietly
        return 0

    cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
    db = SessionLocal()
    updated = 0
    try:
        q = db.query(Device).filter(
            Device.last_scan_status == "running",
            Device.last_scan_timestamp != None,  # noqa: E711
            Device.last_scan_timestamp < cutoff,
        )
        for dev in q.all():
            dev.last_scan_status = "error"
            dev.last_scan_message = "[EC=TIMEOUT] Scan marked as stale (timeout exceeded)."
            dev.last_scan_timestamp = datetime.utcnow()
            updated += 1
        if updated:
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    return updated