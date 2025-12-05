from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os

# Import rate limiter
from core.rate_limiter import limiter

# Import custom exceptions and logger
from core.exceptions import CMTException
from core.logger import setup_logger

logger = setup_logger("cmt.main")

# Import all routers in one place
from api.endpoints import (
    auth,
    f5_scans,
    certificates,
    devices,
    pfx,
    deployments,
    f5_cache,
    f5_vips,
)

app = FastAPI(
    title="Certificate Management Tool V2",
    description="Enterprise certificate lifecycle management for F5 devices",
    version="2.5.0",
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Custom exception handler for CMT exceptions
@app.exception_handler(CMTException)
async def cmt_exception_handler(request: Request, exc: CMTException):
    """Handle all CMT custom exceptions with structured JSON response."""
    logger.warning(f"CMT Exception: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )

# Routers that don't need a special tag/prefix beyond here
app.include_router(f5_cache.router, prefix="/api/v1", tags=["cache"])
app.include_router(f5_vips.router, prefix="/api/v1/vips", tags=["vips"])

# Read CORS allowlist from env (comma-separated), support either var name
_cors_env = os.getenv("BACKEND_CORS_ORIGINS", os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173"))
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REGISTER ALL ROUTERS ---
app.include_router(auth.router,         prefix="/api/v1/auth",         tags=["Authentication"])
app.include_router(f5_scans.router,     prefix="/api/v1",              tags=["F5 Scans"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["Certificates"])
app.include_router(devices.router,      prefix="/api/v1/devices",      tags=["Devices"])
app.include_router(pfx.router,          prefix="/api/v1/pfx",          tags=["PFX"])
app.include_router(deployments.router,  prefix="/api/v1/deployments",  tags=["Deployments"])

# Optional: hashing self-test at startup to catch env/package drift early
try:
    from services.auth_service import pwd_context
    _probe = pwd_context.hash("probe")
    assert pwd_context.verify("probe", _probe)
    logger.info("Password hashing self-test passed")
except Exception as _e:  # don't crash prod, but log visibly
    logger.warning(f"Password hashing self-test failed: {_e}")

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "Certificate Management Tool V2 - Backend is running!"}