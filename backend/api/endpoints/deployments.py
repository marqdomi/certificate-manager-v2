"""
Deployments endpoints: plan/preview/validate/execute and new-pfx deployment.
All endpoints are registered via `main.py` with prefix `/api/v1/deployments`.
"""

from typing import List, Optional
import json

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session

# Certificate parsing for validation endpoints
from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import serialization

from db.base import get_db
from db.models import Device, User, UserRole
from services import auth_service, pfx_service, f5_service_logic, encryption_service
import logging

logger = logging.getLogger(__name__)

# IMPORTANT: define the router BEFORE using it in any decorators
router = APIRouter(tags=["Deployments"])  # no internal prefix; `main.py` adds /api/v1/deployments


# ---------------------------------------------
# Build a dry-run deployment plan (no changes)
# ---------------------------------------------
@router.post("/plan", summary="Build a dry-run deployment plan (no changes on device)")
async def build_deployment_plan(
    db: Session = Depends(get_db),
    device_id: int = Form(...),
    old_cert_name: str = Form(""),
    mode: str = Form(...),  # pfx | pem
    # PFX inputs
    pfx_file: UploadFile = File(None),
    pfx_password: Optional[str] = Form(None),
    # PEM inputs
    cert_pem: Optional[str] = Form(None),
    key_pem: Optional[str] = Form(None),
    # Options
    install_chain_from_pfx: Optional[bool] = Form(False),
    chain_name: Optional[str] = Form("DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"),
    update_profiles: Optional[bool] = Form(True),
    selected_profiles: Optional[str] = Form(None),
    partition: str = Form("Common"),
    timeout_seconds: Optional[int] = Form(45),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Device credentials not set")

    username = device.username
    password = encryption_service.decrypt_data(device.encrypted_password)

    # Parse optional selected_profiles JSON
    profiles_list = None
    if selected_profiles:
        try:
            profiles_list = json.loads(selected_profiles)
            if not isinstance(profiles_list, list):
                raise ValueError("selected_profiles must be a JSON array")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid selected_profiles: {e}")

    # Derive new object name if possible
    new_object_name = None
    try:
        if mode.lower() == "pfx" and pfx_file is not None:
            data = await pfx_file.read()
            new_object_name = f5_service_logic.derive_object_name_from_pfx(data, pfx_password)
        elif mode.lower() == "pem" and cert_pem:
            new_object_name = f5_service_logic.derive_object_name_from_pem(cert_pem)
    except Exception:
        # keep new_object_name as None if we cannot derive it; still return a plan
        new_object_name = None

    # Live usage lookup for the old cert (only if provided)
    try:
        usage = None
        if old_cert_name:
            usage = f5_service_logic.preview_certificate_usage(
                hostname=device.ip_address,
                username=username,
                password=password,
                cert_name=old_cert_name,
                partition=partition,
                timeout=timeout_seconds,
            )
        else:
            usage = {"profiles": [], "virtual_servers": []}
    except Exception as e:
        # Don't hard fail the plan if usage lookup errors; include it as warning
        usage = {"profiles": [], "virtual_servers": [], "warning": str(e)}

    # Decide which profiles would be updated
    if profiles_list is not None:
        profiles_to_update = profiles_list
    else:
        profiles_to_update = usage.get("profiles", []) if update_profiles else []

    plan = {
        "device": device.hostname,
        "device_ip": device.ip_address,
        "old_cert_name": old_cert_name or None,
        "mode": mode,
        "derived_new_object": new_object_name,
        "chain_name": chain_name,
        "install_chain_from_pfx": bool(install_chain_from_pfx),
        "update_profiles": bool(update_profiles),
        "profiles_detected": usage.get("profiles", []),
        "virtual_servers": usage.get("virtual_servers", []),
        "profiles_to_update": profiles_to_update,
        "actions": [
            ("upload+install cert/key from PFX" if mode.lower()=="pfx" else "upload+install cert/key from PEM"),
            ("update selected profiles" if update_profiles and (profiles_to_update or old_cert_name) else "no profile updates"),
        ],
    }

    return {"dry_run": True, "plan": plan}


# ----------------------------------------------------
# Deploy a new certificate from PFX to one or more F5s
# ----------------------------------------------------
@router.post("/new-pfx", summary="Deploy a new certificate from PFX to one or more devices")
async def new_pfx_deployment(
    db: Session = Depends(get_db),
    pfx_file: UploadFile = File(...),
    target_device_ids: List[int] = Form(...),
    pfx_password: Optional[str] = Form(None),
    install_chain_from_pfx: Optional[bool] = Form(False),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    """
    Deploys a new certificate to one or more devices.
    This does not update any existing SSL profiles.
    """
    devices = db.query(Device).filter(Device.id.in_(target_device_ids)).all()
    if not devices:
        raise HTTPException(status_code=404, detail="No valid target devices found.")

    pfx_data = await pfx_file.read()

    deployment_results = []
    for device in devices:
        try:
            if not device.encrypted_password:
                raise ValueError("Credentials are not set for this device.")

            f5_username = device.username
            f5_password = encryption_service.decrypt_data(device.encrypted_password)

            result = f5_service_logic.deploy_and_update_f5(
                hostname=device.ip_address,
                username=f5_username,
                password=f5_password,
                old_cert_name="",  # empty means: do not update profiles
                pfx_data=pfx_data,
                pfx_password=pfx_password,
                install_chain_from_pfx=install_chain_from_pfx,
            )

            deployment_results.append({"device": device.hostname, "status": "success", "details": result})
        except Exception as e:
            error_message = str(e)
            logger.info(f"ERROR deploying to {device.hostname}: {error_message}")
            deployment_results.append({"device": device.hostname, "status": "failed", "error": error_message})
            db.rollback()

    return {"deployment_results": deployment_results}


# ----------------------------------------------------------------
# Preview which profiles/VS would be affected by replacing a cert
# ----------------------------------------------------------------
@router.post("/preview", summary="Preview which profiles/VS would be affected by replacing a cert")
async def preview_deployment(
    db: Session = Depends(get_db),
    device_id: int = Form(...),
    old_cert_name: str = Form(...),
    partition: str = Form('Common'),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Device credentials not set")
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)
    try:
        usage = f5_service_logic.preview_certificate_usage(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            cert_name=old_cert_name,
            partition=partition
        )
        return usage
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------
# Confirm updating selected profiles to a new cert object
# -------------------------------------------------------------
@router.post("/confirm", summary="Confirm updating selected profiles to a new cert object")
async def confirm_deployment(
    db: Session = Depends(get_db),
    device_id: int = Form(...),
    old_cert_name: str = Form(...),
    new_object_name: str = Form(...),
    chain_name: str = Form('DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1'),
    selected_profiles: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Device credentials not set")
    f5_username = device.username
    f5_password = encryption_service.decrypt_data(device.encrypted_password)
    try:
        profiles_list = None
        if selected_profiles:
            try:
                profiles_list = json.loads(selected_profiles)
                if not isinstance(profiles_list, list):
                    raise ValueError("selected_profiles must be a JSON array")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid selected_profiles: {e}")
        updated = f5_service_logic.update_profiles_with_new_cert(
            hostname=device.ip_address,
            username=f5_username,
            password=f5_password,
            old_cert_name=old_cert_name,
            new_cert_name=new_object_name,
            chain_name=chain_name,
            selected_profiles=profiles_list
        )
        return {"updated_profiles": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------
# Validate certificate payload (PFX or PEM)
# ---------------------------------------------
@router.post("/validate", summary="Validate certificate payload (PFX or PEM) and return metadata")
async def validate_deployment(
    mode: str = Form(..., description="pfx or pem"),
    pfx_file: UploadFile = File(None),
    pfx_password: Optional[str] = Form(None),
    cert_pem: Optional[str] = Form(None),
    key_pem: Optional[str] = Form(None),
    chain_pem: Optional[str] = Form(None),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    """
    Accept either a PFX upload or raw PEMs and returns parsed metadata:
    CN, SANs, not_after, and warnings.
    """
    warnings = []
    parsed = {"cn": None, "san": [], "not_after": None}

    def _dt_to_iso(dt):
        try:
            return dt.isoformat()
        except Exception:
            return str(dt)

    try:
        if mode.lower() == "pfx":
            if not pfx_file:
                raise HTTPException(status_code=400, detail="pfx_file is required for mode=pfx")
            data = await pfx_file.read()
            try:
                key_obj, cert_obj, extra = pkcs12.load_key_and_certificates(
                    data,
                    pfx_password.encode("utf-8") if pfx_password else None
                )
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Could not open PFX. Is the password correct? {e}")

            parsed["cn"] = cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value if cert_obj else None
            # SANs (DNS + IPs)
            try:
                san_ext = cert_obj.extensions.get_extension_for_class(x509.SubjectAlternativeName)
                dns_names = list(san_ext.value.get_values_for_type(x509.DNSName))
                ip_addrs = [str(ip) for ip in san_ext.value.get_values_for_type(x509.IPAddress)]
                combined = dns_names + ip_addrs
                # de-duplicate while preserving order
                parsed["san"] = list(dict.fromkeys(combined))
            except x509.ExtensionNotFound:
                # No SAN extension present
                parsed["san"] = []
                warnings.append("Certificate has no SAN extension.")
            except Exception as e:
                # Unexpected parsing issue; do not incorrectly claim "no SAN"
                warnings.append(f"Could not parse SAN extension: {e}")
            # not_after
            try:
                not_after = getattr(cert_obj, "not_valid_after_utc", None) or cert_obj.not_valid_after
                parsed["not_after"] = _dt_to_iso(not_after)
            except Exception:
                pass

        elif mode.lower() == "pem":
            if not cert_pem or not key_pem:
                raise HTTPException(status_code=400, detail="cert_pem and key_pem are required for mode=pem")
            try:
                cert_obj = x509.load_pem_x509_certificate(cert_pem.encode("utf-8"))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid cert_pem: {e}")
            try:
                serialization.load_pem_private_key(key_pem.encode("utf-8"), password=None)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid key_pem: {e}")

            parsed["cn"] = cert_obj.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
            try:
                san_ext = cert_obj.extensions.get_extension_for_class(x509.SubjectAlternativeName)
                dns_names = list(san_ext.value.get_values_for_type(x509.DNSName))
                ip_addrs = [str(ip) for ip in san_ext.value.get_values_for_type(x509.IPAddress)]
                combined = dns_names + ip_addrs
                parsed["san"] = list(dict.fromkeys(combined))
            except x509.ExtensionNotFound:
                parsed["san"] = []
                warnings.append("Certificate has no SAN extension.")
            except Exception as e:
                warnings.append(f"Could not parse SAN extension: {e}")
            try:
                not_after = getattr(cert_obj, "not_valid_after_utc", None) or cert_obj.not_valid_after
                parsed["not_after"] = _dt_to_iso(not_after)
            except Exception:
                pass
        else:
            raise HTTPException(status_code=400, detail="mode must be 'pfx' or 'pem'")

        return {"parsed": parsed, "warnings": warnings}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------
# Execute deployment (PFX or PEM) with optional dry_run
# -------------------------------------------------
@router.post("/execute", summary="Execute deployment (PFX or PEM) with optional dry_run")
async def execute_deployment(
    db: Session = Depends(get_db),
    device_id: int = Form(...),
    old_cert_name: str = Form(""),
    mode: str = Form(...),  # pfx | pem
    # PFX inputs
    pfx_file: UploadFile = File(None),
    pfx_password: Optional[str] = Form(None),
    # PEM inputs
    cert_pem: Optional[str] = Form(None),
    key_pem: Optional[str] = Form(None),
    # Options
    install_chain_from_pfx: Optional[bool] = Form(False),
    chain_name: Optional[str] = Form("DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"),
    update_profiles: Optional[bool] = Form(True),
    selected_profiles: Optional[str] = Form(None),
    dry_run: Optional[bool] = Form(False),
    timeout_seconds: Optional[int] = Form(60),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN, UserRole.OPERATOR]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.encrypted_password:
        raise HTTPException(status_code=400, detail="Device credentials not set")

    username = device.username
    password = encryption_service.decrypt_data(device.encrypted_password)

    # Build a plan (always) for UI purposes
    plan = {
        "device": device.hostname,
        "old_cert_name": old_cert_name or None,
        "mode": mode,
        "actions": [],
        "profiles_to_update": []
    }

    if selected_profiles:
        try:
            profiles_list = json.loads(selected_profiles)
            if not isinstance(profiles_list, list):
                raise ValueError("selected_profiles must be a JSON array")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid selected_profiles: {e}")
    else:
        profiles_list = None

    try:
        if mode.lower() == "pfx":
            if not pfx_file:
                raise HTTPException(status_code=400, detail="pfx_file is required for mode=pfx")
            pfx_data = await pfx_file.read()
            plan["actions"].append("upload+install cert/key from PFX")

            if dry_run:
                # Only simulate
                return {"dry_run": True, "plan": plan}

            result = f5_service_logic.deploy_from_pfx_and_update_profiles(
                hostname=device.ip_address,
                username=username,
                password=password,
                old_cert_name=old_cert_name or "",
                pfx_data=pfx_data,
                pfx_password=pfx_password,
                chain_name=chain_name,
                install_chain_from_pfx=install_chain_from_pfx,
                timeout=timeout_seconds
            )

            # If update_profiles is False, ensure we didn't touch profiles
            if not update_profiles:
                result["updated_profiles"] = []
            else:
                # If specific selection is provided, call a second pass to limit updates
                if profiles_list is not None and old_cert_name:
                    ups = f5_service_logic.update_profiles_with_new_cert(
                        hostname=device.ip_address,
                        username=username,
                        password=password,
                        old_cert_name=old_cert_name,
                        new_cert_name=result["new_cert_object"],
                        chain_name=chain_name,
                        selected_profiles=profiles_list,
                        timeout=timeout_seconds
                    )
                    result["updated_profiles"] = ups

            return {"dry_run": False, "result": result}

        elif mode.lower() == "pem":
            if not cert_pem or not key_pem:
                raise HTTPException(status_code=400, detail="cert_pem and key_pem are required for mode=pem")
            plan["actions"].append("upload+install cert/key from PEM")

            if dry_run:
                return {"dry_run": True, "plan": plan}

            result = f5_service_logic.deploy_from_pem_and_update_profiles(
                hostname=device.ip_address,
                username=username,
                password=password,
                old_cert_name=old_cert_name or "",
                cert_pem=cert_pem,
                key_pem=key_pem,
                chain_name=chain_name,
                timeout=timeout_seconds
            )

            if not update_profiles:
                result["updated_profiles"] = []
            else:
                if profiles_list is not None and old_cert_name:
                    ups = f5_service_logic.update_profiles_with_new_cert(
                        hostname=device.ip_address,
                        username=username,
                        password=password,
                        old_cert_name=old_cert_name,
                        new_cert_name=result["new_cert_object"],
                        chain_name=chain_name,
                        selected_profiles=profiles_list,
                        timeout=timeout_seconds
                    )
                    result["updated_profiles"] = ups

            return {"dry_run": False, "result": result}

        else:
            raise HTTPException(status_code=400, detail="mode must be 'pfx' or 'pem'")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))