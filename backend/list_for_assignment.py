#!/usr/bin/env python3
"""
Script para asignar credential templates a dispositivos
"""
import sys
sys.path.insert(0, "/app")

from db.session import SessionLocal
from db.models import CredentialTemplate, Device

db = SessionLocal()

# 1. Listar templates
print("=" * 60)
print("CREDENTIAL TEMPLATES:")
print("=" * 60)
templates = db.query(CredentialTemplate).all()
template_map = {}
for t in templates:
    template_map[t.name.lower()] = t
    print(f"  ID: {t.id} | Name: {t.name} | Default: {t.is_default}")

# 2. Listar dispositivos agrupados
print("\n" + "=" * 60)
print("DEVICES BY TYPE:")
print("=" * 60)

omnitracs_devices = []
other_devices = []

devices = db.query(Device).all()
for d in devices:
    hostname_lower = d.hostname.lower() if d.hostname else ""
    if "omnitracs" in hostname_lower or "otx" in hostname_lower:
        omnitracs_devices.append(d)
    else:
        other_devices.append(d)

print(f"\nOmnitracs devices: {len(omnitracs_devices)}")
for d in omnitracs_devices[:5]:
    print(f"  - {d.hostname} ({d.ip_address})")
if len(omnitracs_devices) > 5:
    print(f"  ... and {len(omnitracs_devices) - 5} more")

print(f"\nOther devices (Solera): {len(other_devices)}")
for d in other_devices[:5]:
    print(f"  - {d.hostname} ({d.ip_address})")
if len(other_devices) > 5:
    print(f"  ... and {len(other_devices) - 5} more")

db.close()
