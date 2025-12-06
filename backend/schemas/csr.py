# backend/schemas/csr.py
"""
Pydantic schemas for CSR generation endpoints.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class CSRGenerateRequest(BaseModel):
    """Request body for CSR generation."""
    
    common_name: str = Field(
        ..., 
        description="Common Name (CN) - usually the domain name",
        examples=["example.com", "*.example.com"]
    )
    organization: Optional[str] = Field(
        None, 
        description="Organization (O)",
        examples=["My Company Inc"]
    )
    organizational_unit: Optional[str] = Field(
        None, 
        description="Organizational Unit (OU)",
        examples=["IT Department"]
    )
    locality: Optional[str] = Field(
        None, 
        description="City/Locality (L)",
        examples=["San Francisco"]
    )
    state: Optional[str] = Field(
        None, 
        description="State/Province (ST)",
        examples=["California"]
    )
    country: str = Field(
        "US", 
        description="Country Code (C) - 2 letters",
        min_length=2,
        max_length=2,
        examples=["US", "MX", "CA"]
    )
    email: Optional[str] = Field(
        None, 
        description="Email address",
        examples=["admin@example.com"]
    )
    san_dns_names: Optional[list[str]] = Field(
        None, 
        description="Additional DNS names for SAN extension",
        examples=[["www.example.com", "api.example.com"]]
    )
    san_ip_addresses: Optional[list[str]] = Field(
        None, 
        description="IP addresses for SAN extension",
        examples=[["192.168.1.1", "10.0.0.1"]]
    )
    key_size: int = Field(
        2048, 
        description="RSA key size in bits",
        examples=[2048, 4096]
    )
    
    # Optional: link to existing certificate for renewal tracking
    certificate_id: Optional[int] = Field(
        None, 
        description="ID of existing certificate this CSR is renewing"
    )


class CSRGenerateResponse(BaseModel):
    """Response from CSR generation."""
    
    csr_pem: str = Field(..., description="PEM-encoded CSR")
    key_pem: str = Field(..., description="PEM-encoded private key (download immediately!)")
    renewal_request_id: int = Field(..., description="ID of the renewal request record")
    common_name: str
    san_names: list[str]
    key_size: int
    created_at: str
    
    # Instructions for user
    next_steps: list[str] = Field(
        default=[
            "1. Download and save the private key securely",
            "2. Copy the CSR and submit to your Certificate Authority",
            "3. Once you receive the signed certificate, return to complete the renewal"
        ]
    )


class CSRValidateRequest(BaseModel):
    """Request to validate a CSR."""
    csr_pem: str = Field(..., description="PEM-encoded CSR to validate")


class CSRValidateResponse(BaseModel):
    """Response from CSR validation."""
    valid: bool
    subject: Optional[dict] = None
    san_names: Optional[list[str]] = None
    signature_valid: Optional[bool] = None
    public_key_type: Optional[str] = None
    error: Optional[str] = None


class CSRCompleteRequest(BaseModel):
    """Request to complete CSR process with signed certificate."""
    
    renewal_request_id: int = Field(..., description="ID from CSR generation")
    certificate_pem: str = Field(..., description="Signed certificate from CA (PEM)")
    chain_pem: Optional[str] = Field(
        None, 
        description="Certificate chain (intermediate + root) in PEM format"
    )
    pfx_passphrase: str = Field(
        "changeit",
        description="Passphrase for the generated PFX file"
    )


class CSRCompleteResponse(BaseModel):
    """Response from completing CSR with signed cert."""
    
    success: bool
    pfx_filename: str = Field(..., description="Generated PFX filename")
    common_name: str
    expiration_date: Optional[datetime] = None
    issuer: Optional[str] = None
    
    # For direct F5 upload
    ready_for_deployment: bool = True
    message: str


class PendingCSRResponse(BaseModel):
    """Information about a pending CSR/renewal request."""
    
    id: int
    certificate_id: Optional[int]
    certificate_name: Optional[str]
    common_name: str
    san_names: list[str]
    status: str
    created_at: datetime
    
    # Can re-download CSR but NOT the key
    csr_pem: str
    
    model_config = ConfigDict(from_attributes=True)


class PendingCSRListResponse(BaseModel):
    """List of pending CSRs."""
    pending_requests: list[PendingCSRResponse]
    total: int
