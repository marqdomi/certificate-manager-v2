# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.endpoints import deployments

# Importamos TODOS nuestros routers
from api.endpoints import f5_scans, certificates, devices, pfx, auth # <-- AÑADIR auth

app = FastAPI(title="Certificate Management Tool V2")

# --- CONFIGURACIÓN DE CORS REFORZADA ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Orígenes permitidos
    allow_credentials=True,                   # Permite cookies/autorización
    allow_methods=["*"],                      # Permite TODOS los métodos (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],                      # Permite TODAS las cabeceras
)
# --- FIN DE LA CONFIGURACIÓN ---
# --- REGISTRO DE TODOS LOS ROUTERS ---

# ¡AÑADIMOS EL ROUTER DE AUTENTICACIÓN!
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

app.include_router(f5_scans.router, prefix="/api/v1/f5", tags=["F5 Scans"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["Certificates"])
app.include_router(devices.router, prefix="/api/v1/devices", tags=["Devices"])
app.include_router(pfx.router, prefix="/api/v1/pfx", tags=["PFX"])
app.include_router(deployments.router, prefix="/api/v1/deployments", tags=["Deployments"])

@app.get("/")
def read_root():
    return {"message": "Certificate Management Tool V2 - Backend is running!"}