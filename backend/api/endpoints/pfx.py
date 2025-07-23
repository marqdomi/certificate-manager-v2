# backend/api/endpoints/pfx.py
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from typing import Optional
import io

from services import pfx_service
from db.models import User
from services import auth_service

router = APIRouter()

@router.post("/generate", summary="Generate a PFX file")
async def generate_pfx_file(
    certificate: UploadFile = File(...),
    private_key: UploadFile = File(...),
    output_name: str = Form(...),
    password: Optional[str] = Form(None),
    chain: Optional[UploadFile] = File(None),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Generate a PFX (PKCS#12) file from uploaded certificate, private key, and optional chain.
    """
    try:
        cert_bytes = await certificate.read()
        key_bytes = await private_key.read()
        chain_bytes = await chain.read() if chain else None

        # ✅ --- LA CORRECCIÓN CLAVE ESTÁ AQUÍ --- ✅
        # Cambiamos los nombres de los argumentos para que coincidan con la
        # definición de la función en pfx_service.py (de _bytes a _pem).
        pfx_data = await run_in_threadpool(
            pfx_service.create_pfx, 
            cert_pem=cert_bytes,  # <--- CORREGIDO
            key_pem=key_bytes,    # <--- CORREGIDO
            chain_pem=chain_bytes,# <--- CORREGIDO
            password=password
        )
        
        if not pfx_data:
            raise ValueError("PFX generation resulted in empty data. Check if key matches certificate.")

        pfx_filename = f"{output_name}.pfx"
        headers = {
            'Content-Disposition': f'attachment; filename="{pfx_filename}"'
        }

        return StreamingResponse(
            io.BytesIO(pfx_data),
            media_type="application/x-pkcs12",
            headers=headers
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid input for PFX generation: {e}"
        )
    except Exception as e:
        print(f"UNEXPECTED ERROR in PFX generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected internal error occurred while generating the PFX file."
        )