# backend/api/endpoints/csr.py
"""
CSR Generation API Endpoints

Provides endpoints for:
- Generating CSR + Private Key locally
- Validating CSRs
- Completing renewal with signed certificate
- Listing pending CSR requests

This solves the F5 key export limitation by generating keys outside F5.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
import json
import logging

from db.base import get_db
from db.models import RenewalRequest, RenewalStatus, Certificate
from schemas.csr import (
    CSRGenerateRequest,
    CSRGenerateResponse,
    CSRValidateRequest,
    CSRValidateResponse,
    CSRCompleteRequest,
    CSRCompleteResponse,
    PendingCSRResponse,
    PendingCSRListResponse,
)
from services.csr_service import (
    generate_csr_with_key,
    validate_csr,
    decrypt_private_key,
    create_pfx_from_components,
    CSRGenerationError,
)
from services.auth_service import get_current_user
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/csr", tags=["CSR Generator"])


@router.post("/generate", response_model=CSRGenerateResponse)
async def generate_csr_endpoint(
    request: CSRGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a new CSR and private key.
    
    The private key is returned ONCE in this response - save it immediately!
    It's also stored encrypted in the database for later PFX assembly.
    
    Flow:
    1. Call this endpoint to get CSR + Key
    2. Submit CSR to your Certificate Authority (DigiCert, etc.)
    3. Call /csr/complete with the signed certificate
    """
    try:
        # Validate certificate_id if provided
        if request.certificate_id:
            cert = db.query(Certificate).filter(Certificate.id == request.certificate_id).first()
            if not cert:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Certificate with ID {request.certificate_id} not found"
                )
        
        # Generate CSR and key
        result = generate_csr_with_key(
            common_name=request.common_name,
            organization=request.organization,
            organizational_unit=request.organizational_unit,
            locality=request.locality,
            state=request.state,
            country=request.country,
            email=request.email,
            san_dns_names=request.san_dns_names,
            san_ip_addresses=request.san_ip_addresses,
            key_size=request.key_size,
        )
        
        # Store in database
        renewal_request = RenewalRequest(
            original_certificate_id=request.certificate_id,
            common_name=request.common_name,
            san_names=json.dumps(result["san_names"]),
            key_size=request.key_size,
            status=RenewalStatus.CSR_GENERATED,
            csr_content=result["csr_pem"],
            encrypted_private_key=result["key_pem_encrypted"],
            created_by=current_user.username,
        )
        
        db.add(renewal_request)
        db.commit()
        db.refresh(renewal_request)
        
        logger.info(f"CSR generated for CN={request.common_name} by {current_user.username}, request_id={renewal_request.id}")
        
        return CSRGenerateResponse(
            csr_pem=result["csr_pem"],
            key_pem=result["key_pem"],  # Only returned here - not stored unencrypted!
            renewal_request_id=renewal_request.id,
            common_name=result["common_name"],
            san_names=result["san_names"],
            key_size=result["key_size"],
            created_at=result["created_at"],
        )
        
    except CSRGenerationError as e:
        logger.error(f"CSR generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in CSR generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate CSR: {str(e)}"
        )


@router.post("/validate", response_model=CSRValidateResponse)
async def validate_csr_endpoint(
    request: CSRValidateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Validate a CSR and extract its details.
    
    Useful for verifying CSR before submitting to CA.
    """
    result = validate_csr(request.csr_pem)
    return CSRValidateResponse(**result)


@router.post("/complete", response_model=CSRCompleteResponse)
async def complete_csr_endpoint(
    request: CSRCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Complete the CSR process with a signed certificate.
    
    After receiving the signed certificate from your CA:
    1. Call this endpoint with the certificate
    2. CMT will assemble a PFX file
    3. The PFX can then be deployed to F5
    """
    from cryptography import x509
    
    # Get the renewal request
    renewal = db.query(RenewalRequest).filter(
        RenewalRequest.id == request.renewal_request_id
    ).first()
    
    if not renewal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Renewal request {request.renewal_request_id} not found"
        )
    
    if renewal.status not in [RenewalStatus.CSR_GENERATED, RenewalStatus.CERT_RECEIVED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Renewal request is in status {renewal.status.value}, cannot complete"
        )
    
    try:
        # Decrypt the stored private key
        key_pem = decrypt_private_key(renewal.encrypted_private_key)
        
        # Parse the certificate to extract details
        cert = x509.load_pem_x509_certificate(request.certificate_pem.encode())
        
        # Extract CN from certificate
        cn_attrs = cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
        cert_cn = cn_attrs[0].value if cn_attrs else renewal.common_name
        
        # Extract issuer
        issuer_attrs = cert.issuer.get_attributes_for_oid(x509.oid.NameOID.ORGANIZATION_NAME)
        issuer = issuer_attrs[0].value if issuer_attrs else "Unknown"
        
        # Create PFX
        pfx_data = create_pfx_from_components(
            cert_pem=request.certificate_pem,
            key_pem=key_pem,
            chain_pem=request.chain_pem,
            passphrase=request.pfx_passphrase
        )
        
        # Generate filename
        pfx_filename = f"{cert_cn.replace('*', 'wildcard').replace('.', '_')}_{renewal.id}.pfx"
        
        # Update renewal request
        renewal.status = RenewalStatus.PFX_READY
        renewal.signed_certificate_pem = request.certificate_pem
        renewal.certificate_chain_pem = request.chain_pem
        renewal.pfx_filename = pfx_filename
        renewal.cert_expiration_date = cert.not_valid_after_utc
        renewal.cert_issuer = issuer
        
        db.commit()
        
        logger.info(f"CSR completed for request_id={renewal.id}, PFX ready: {pfx_filename}")
        
        # Store PFX temporarily for download (you might want to use a proper file storage)
        # For now, we'll store it in a temp location or return it directly
        import os
        pfx_dir = "/tmp/cmt_pfx"
        os.makedirs(pfx_dir, exist_ok=True)
        pfx_path = os.path.join(pfx_dir, pfx_filename)
        with open(pfx_path, "wb") as f:
            f.write(pfx_data)
        
        return CSRCompleteResponse(
            success=True,
            pfx_filename=pfx_filename,
            common_name=cert_cn,
            expiration_date=cert.not_valid_after_utc,
            issuer=issuer,
            ready_for_deployment=True,
            message=f"PFX file created successfully. Ready to deploy to F5."
        )
        
    except Exception as e:
        logger.error(f"Failed to complete CSR: {e}")
        renewal.status = RenewalStatus.FAILED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process certificate: {str(e)}"
        )


@router.get("/pending", response_model=PendingCSRListResponse)
async def list_pending_csrs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = None
):
    """
    List pending CSR requests.
    
    Shows CSRs that are waiting for CA signature or completion.
    """
    query = db.query(RenewalRequest)
    
    # Filter by status if provided
    if status_filter:
        try:
            status_enum = RenewalStatus(status_filter)
            query = query.filter(RenewalRequest.status == status_enum)
        except ValueError:
            pass  # Ignore invalid status
    else:
        # By default, show non-completed requests
        query = query.filter(
            RenewalRequest.status.in_([
                RenewalStatus.CSR_GENERATED,
                RenewalStatus.CERT_RECEIVED,
                RenewalStatus.PFX_READY
            ])
        )
    
    requests = query.order_by(desc(RenewalRequest.created_at)).all()
    
    pending_list = []
    for req in requests:
        # Get certificate name if linked
        cert_name = None
        if req.original_certificate_id:
            cert = db.query(Certificate).filter(
                Certificate.id == req.original_certificate_id
            ).first()
            if cert:
                cert_name = cert.name
        
        pending_list.append(PendingCSRResponse(
            id=req.id,
            certificate_id=req.original_certificate_id,
            certificate_name=cert_name,
            common_name=req.common_name,
            san_names=json.loads(req.san_names) if req.san_names else [],
            status=req.status.value,
            created_at=req.created_at,
            csr_pem=req.csr_content,
        ))
    
    return PendingCSRListResponse(
        pending_requests=pending_list,
        total=len(pending_list)
    )


@router.get("/{request_id}", response_model=PendingCSRResponse)
async def get_csr_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get details of a specific CSR request.
    
    Note: Private key is NOT returned here for security.
    """
    renewal = db.query(RenewalRequest).filter(
        RenewalRequest.id == request_id
    ).first()
    
    if not renewal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSR request {request_id} not found"
        )
    
    # Get certificate name if linked
    cert_name = None
    if renewal.original_certificate_id:
        cert = db.query(Certificate).filter(
            Certificate.id == renewal.original_certificate_id
        ).first()
        if cert:
            cert_name = cert.name
    
    return PendingCSRResponse(
        id=renewal.id,
        certificate_id=renewal.original_certificate_id,
        certificate_name=cert_name,
        common_name=renewal.common_name,
        san_names=json.loads(renewal.san_names) if renewal.san_names else [],
        status=renewal.status.value,
        created_at=renewal.created_at,
        csr_pem=renewal.csr_content,
    )


@router.get("/{request_id}/download-pfx")
async def download_pfx(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download the generated PFX file.
    """
    from fastapi.responses import FileResponse
    import os
    
    renewal = db.query(RenewalRequest).filter(
        RenewalRequest.id == request_id
    ).first()
    
    if not renewal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSR request not found"
        )
    
    if renewal.status != RenewalStatus.PFX_READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PFX not ready. Complete the CSR process first."
        )
    
    pfx_path = f"/tmp/cmt_pfx/{renewal.pfx_filename}"
    if not os.path.exists(pfx_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PFX file not found. It may have been cleaned up."
        )
    
    return FileResponse(
        pfx_path,
        media_type="application/x-pkcs12",
        filename=renewal.pfx_filename
    )


@router.delete("/{request_id}")
async def delete_csr_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a CSR request.
    
    Warning: This permanently deletes the encrypted private key!
    """
    import os
    
    renewal = db.query(RenewalRequest).filter(
        RenewalRequest.id == request_id
    ).first()
    
    if not renewal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSR request not found"
        )
    
    # Clean up PFX file if exists
    if renewal.pfx_filename:
        pfx_path = f"/tmp/cmt_pfx/{renewal.pfx_filename}"
        if os.path.exists(pfx_path):
            os.remove(pfx_path)
    
    db.delete(renewal)
    db.commit()
    
    logger.info(f"CSR request {request_id} deleted by {current_user.username}")
    
    return {"message": f"CSR request {request_id} deleted successfully"}
