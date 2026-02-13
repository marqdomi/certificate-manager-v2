#!/usr/bin/env python3
"""Test F5 scan from inside the container"""
import requests
import sys

BASE_URL = "http://localhost:8000"

def main():
    # Login
    resp = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data={"username": "admin", "password": "R0undt0w3r!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    token = resp.json()["access_token"]
    print(f"Token obtained: {token[:20]}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get devices
    devices = requests.get(f"{BASE_URL}/api/v1/devices/", headers=headers).json()
    print(f"Found {len(devices)} devices")
    
    # Count credentials
    with_creds = [d for d in devices if d.get("encrypted_password")]
    without_creds = [d for d in devices if not d.get("encrypted_password")]
    print(f"With credentials: {len(with_creds)}")
    print(f"Without credentials: {len(without_creds)}")
    
    if not with_creds:
        print("\nNo devices have credentials! Setting credentials for Solera devices...")
        # Set credentials for Solera devices (those with .axadmin.net or .network.axadmin.net)
        solera_pass = "R0undt0w3r!"
        for d in devices:
            hostname = d.get("hostname", "")
            if "axadmin.net" in hostname:
                print(f"  Setting creds for {hostname} (ID {d['id']})...")
                cred_resp = requests.put(
                    f"{BASE_URL}/api/v1/devices/{d['id']}/credentials",
                    headers=headers,
                    json={"username": "admin", "password": solera_pass}
                )
                if cred_resp.status_code == 200:
                    print(f"    OK")
                else:
                    print(f"    FAILED: {cred_resp.status_code}")
        
        # Refresh devices
        devices = requests.get(f"{BASE_URL}/api/v1/devices/", headers=headers).json()
        with_creds = [d for d in devices if d.get("encrypted_password")]
        print(f"\nAfter update: {len(with_creds)} devices with credentials")
    
    # Find a Solera device that should be reachable
    target = None
    for d in devices:
        ip = d.get("ip_address", "")
        if ip.startswith("10.119.35") and d.get("encrypted_password"):
            target = d
            break
    
    if not target:
        # Try any device with credentials
        target = with_creds[0] if with_creds else None
    
    if target:
        hostname = target.get("hostname", "unknown")
        ip = target.get("ip_address", "unknown")
        dev_id = target.get("id", 0)
        print(f"\nTarget: {hostname} ({ip}) ID={dev_id}")
        
        # Trigger scan
        print("Triggering scan...")
        scan_resp = requests.post(
            f"{BASE_URL}/api/v1/f5/scan/{dev_id}",
            headers=headers
        )
        print(f"Scan response: {scan_resp.status_code}")
        result = scan_resp.text[:500] if scan_resp.text else "No response body"
        print(f"Response: {result}")
    else:
        print("No devices with credentials found")

if __name__ == "__main__":
    main()
