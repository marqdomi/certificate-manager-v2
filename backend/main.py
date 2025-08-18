from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importamos TODOS nuestros routers
from api.endpoints import auth, f5_scans, certificates, devices, pfx, deployments
import os
from api.endpoints import f5_cache
from api.endpoints import f5_vips
from api.endpoints import f5_vips, vips

app = FastAPI(title="Certificate Management Tool V2")

app.include_router(f5_cache.router, prefix="/api/v1")
app.include_router(f5_vips.router)

# Read CORS allowlist from env (comma-separated), default to local dev
_cors_origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# --- CONFIGURACIÓN DE CORS REFORZADA ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- FIN DE LA CONFIGURACIÓN ---
# --- REGISTRO DE TODOS LOS ROUTERS ---
app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["Authentication"])
app.include_router(f5_scans.router,    prefix="/api/v1",              tags=["F5 Scans"])
app.include_router(certificates.router,prefix="/api/v1/certificates",tags=["Certificates"])
app.include_router(devices.router,     prefix="/api/v1/devices",     tags=["Devices"])
app.include_router(pfx.router,         prefix="/api/v1/pfx",         tags=["PFX"])
app.include_router(deployments.router, prefix="/api/v1/deployments", tags=["Deployments"])

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "Certificate Management Tool V2 - Backend is running!"}