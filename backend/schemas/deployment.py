


from pydantic import BaseModel
from typing import List, Optional, Any

class DeploymentPlan(BaseModel):
    device: str
    device_ip: str
    old_cert_name: Optional[str]
    mode: str
    derived_new_object: Optional[str]
    chain_name: Optional[str]
    install_chain_from_pfx: bool = False
    update_profiles: bool = True
    profiles_detected: List[str] = []
    virtual_servers: List[Any] = []
    profiles_to_update: List[str] = []
    actions: List[str] = []

class DeploymentPlanResponse(BaseModel):
    dry_run: bool = True
    plan: DeploymentPlan