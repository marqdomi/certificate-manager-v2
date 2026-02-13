# backend/assign_credentials.py

from db.session import SessionLocal
from db.models import CredentialTemplate, Device

db = SessionLocal()

# Get templates
templates = {t.name: t for t in db.query(CredentialTemplate).all()}
print("Templates found:", list(templates.keys()))

# Get template for omnitracs
omni_template = templates.get("admin (omnitracs)")
marco_template = templates.get("MarcoTest")

if not omni_template:
    print("ERROR: admin (omnitracs) template not found")
    sys.exit(1)
if not marco_template:
    print("ERROR: MarcoTest template not found")
    sys.exit(1)

print(f"Omnitracs template ID: {omni_template.id}")
print(f"MarcoTest template ID: {marco_template.id}")

# Assign credentials
omni_count = 0
other_count = 0

for device in db.query(Device).all():
    hostname_lower = (device.hostname or "").lower()
    
    # Check if omnitracs device
    if "omnitracs" in hostname_lower or "otx" in hostname_lower or "otr" in hostname_lower:
        device.username = omni_template.username
        device.encrypted_password = omni_template.encrypted_password
        omni_count += 1
    else:
        device.username = marco_template.username
        device.encrypted_password = marco_template.encrypted_password
        other_count += 1

db.commit()
print(f"\nAssigned omnitracs template to {omni_count} devices")
print(f"Assigned MarcoTest template to {other_count} devices")
print("Done!")
db.close()
