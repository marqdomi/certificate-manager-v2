#!/usr/bin/env python3
"""
Script para inferir y poblar cluster_key e is_primary_preferred basándose en patrones de hostname.

Patrones detectados:
1. usdc01-fab1-lb-001-black → cluster: usdc01-fab1-lb-black, 001 = primary
2. eudc01-lb-001-blue → cluster: eudc01-lb-blue, 001 = primary  
3. dc1-f5-xrs-int-01 → cluster: dc1-f5-xrs-int, 01 = primary
4. USDC01-LB01-BLUE-PRI → cluster: USDC01-BLUE, LB01 & PRI = primary
5. Standalone devices without -01/-02 pattern → cluster = hostname (unique)
"""

import re
import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.base import SessionLocal
from db.models import Device

def infer_cluster_key(hostname: str) -> tuple[str, bool]:
    """
    Infer cluster_key and is_primary_preferred from hostname patterns.
    Returns (cluster_key, is_primary)
    """
    hostname_lower = hostname.lower()
    
    # Pattern 1: USDC01-LB01-BLUE-PRI / USDC01-LB02-BLUE-SEC (Solera uppercase)
    # Cluster key: site-color (e.g., USDC01-BLUE)
    match = re.match(r'^(USDC\d+)-LB0[12]-([A-Z]+(?:NP)?)-(?:PRI|SEC)\.', hostname, re.IGNORECASE)
    if match:
        site = match.group(1).upper()
        color = match.group(2).upper()
        is_primary = '-PRI.' in hostname.upper()
        return f"{site}-{color}", is_primary
    
    # Pattern 2: eudc01-lb-001-blue / eudc01-lb-002-blue
    # Cluster key: site-color (e.g., eudc01-blue)
    match = re.match(r'^(eudc\d+)-lb-00[12]-([a-z]+)\.', hostname_lower)
    if match:
        site = match.group(1)
        color = match.group(2)
        is_primary = '-001-' in hostname_lower
        return f"{site}-{color}", is_primary
    
    # Pattern 3: usdc02-fab1-lb-001-black / usdc02-fab1-lb-002-black
    # Also: usdc01-fab1-lb-001-black-nonprod
    match = re.match(r'^(usdc\d+)-fab\d+-lb-00[12]-([a-z-]+)\.', hostname_lower)
    if match:
        site = match.group(1)
        suffix = match.group(2).rstrip('-')  # e.g., "black" or "black-nonprod"
        is_primary = '-001-' in hostname_lower
        return f"{site}-{suffix}", is_primary
    
    # Pattern 4: usdc01-fab1-lb-001 / usdc01-fab1-lb-002 (no color)
    # Or: usdc01-fab1-lb-003 through 006 (standalone or odd numbered)
    match = re.match(r'^(usdc\d+)-fab(\d+)-lb-(\d{3})\.', hostname_lower)
    if match:
        site = match.group(1)
        fab = match.group(2)
        num = int(match.group(3))
        # Pair 001/002, 003/004, 005/006
        pair_base = ((num - 1) // 2) * 2 + 1
        is_primary = (num == pair_base)
        return f"{site}-fab{fab}-lb-{pair_base:03d}", is_primary
    
    # Pattern 5: audc10-fab1-lb-001 / audc10-fab1-lb-002 (other regions)
    match = re.match(r'^([a-z]+\d+)-fab(\d+)-lb-(\d{3})\.', hostname_lower)
    if match:
        site = match.group(1)
        fab = match.group(2)
        num = int(match.group(3))
        pair_base = ((num - 1) // 2) * 2 + 1
        is_primary = (num == pair_base)
        return f"{site}-fab{fab}-lb", is_primary
    
    # Pattern 6: axrudc10lb150 / axrudc10lb151 (Russia compact naming)
    match = re.match(r'^(axrudc\d+lb)(\d+)\.', hostname_lower)
    if match:
        prefix = match.group(1)
        num = int(match.group(2))
        pair_base = (num // 2) * 2  # 150/151 -> 150
        is_primary = (num == pair_base)
        return prefix, is_primary
    
    # Pattern 7: rudc10-lb-001 / rudc10-lb-002
    match = re.match(r'^(rudc\d+)-lb-00([12])\.', hostname_lower)
    if match:
        site = match.group(1)
        is_primary = match.group(2) == '1'
        return f"{site}-lb", is_primary
    
    # Pattern 8: sgdc10-fab1-lb-001 / sgdc10-fab1-lb-002
    match = re.match(r'^(sgdc\d+)-fab(\d+)-lb-00([12])\.', hostname_lower)
    if match:
        site = match.group(1)
        fab = match.group(2)
        is_primary = match.group(3) == '1'
        return f"{site}-fab{fab}-lb", is_primary
    
    # Pattern 9: bedc01-fab1-lb-001 / bedc01-fab1-lb-002
    match = re.match(r'^(bedc\d+)-fab(\d+)-lb-00([12])\.', hostname_lower)
    if match:
        site = match.group(1)
        fab = match.group(2)
        is_primary = match.group(3) == '1'
        return f"{site}-fab{fab}-lb", is_primary
    
    # Pattern 10: Omnitracs dc1-xxx-01 / dc1-xxx-02
    match = re.match(r'^(dc1-[a-z]+-[a-z]+)-0([12])\.', hostname_lower)
    if match:
        prefix = match.group(1)
        is_primary = match.group(2) == '1'
        return prefix, is_primary
    
    # Pattern 11: Omnitracs dc1-f5-xrs-xxx-01 / dc1-f5-xrs-xxx-02
    match = re.match(r'^(dc1-f5-xrs-[a-z]+)-0([12])\.', hostname_lower)
    if match:
        prefix = match.group(1)
        is_primary = match.group(2) == '1'
        return prefix, is_primary
    
    # Pattern 12: Omnitracs longer patterns dc1-xxx-xxx-01/02
    match = re.match(r'^(dc1-[a-z]+-[a-z]+-[a-z]+)-0([12])\.', hostname_lower)
    if match:
        prefix = match.group(1)
        is_primary = match.group(2) == '1'
        return prefix, is_primary
    
    # Pattern 13: na-oec-02-xxx-01/02
    match = re.match(r'^(na-oec-\d+-[a-z]+-[a-z]+)-0([12])\.', hostname_lower)
    if match:
        prefix = match.group(1)
        is_primary = match.group(2) == '1'
        return prefix, is_primary
    
    # Fallback: No cluster detected (standalone device)
    return None, False


def main():
    print("=" * 60)
    print("Populating cluster_key and is_primary_preferred")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        devices = db.query(Device).all()
        print(f"\nFound {len(devices)} devices")
        
        updated = 0
        clusters = {}  # Track cluster counts
        
        for device in devices:
            cluster_key, is_primary = infer_cluster_key(device.hostname)
            
            if cluster_key:
                clusters[cluster_key] = clusters.get(cluster_key, 0) + 1
            
            # Only update if values changed
            if device.cluster_key != cluster_key or device.is_primary_preferred != is_primary:
                old_cluster = device.cluster_key
                old_primary = device.is_primary_preferred
                
                device.cluster_key = cluster_key
                device.is_primary_preferred = is_primary
                updated += 1
                
                primary_str = "⭐ PRIMARY" if is_primary else "  secondary"
                print(f"  {device.hostname}")
                print(f"    cluster: {old_cluster or '(none)'} → {cluster_key or '(standalone)'}")
                print(f"    primary: {old_primary} → {primary_str}")
        
        db.commit()
        
        print(f"\n{'=' * 60}")
        print(f"Updated {updated} devices")
        print(f"\nCluster summary ({len(clusters)} clusters detected):")
        for cluster, count in sorted(clusters.items()):
            print(f"  {cluster}: {count} device(s)")
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
