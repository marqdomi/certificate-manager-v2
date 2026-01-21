#!/usr/bin/env python3
"""Quick RADIUS connectivity test"""
import os
import sys
sys.path.insert(0, '.')

# Set test environment
os.environ['RADIUS_SERVER'] = '10.119.1.15'
os.environ['RADIUS_SECRET'] = 'test_secret_placeholder'
os.environ['RADIUS_PORT'] = '1812'
os.environ['RADIUS_TIMEOUT'] = '3'

from services.radius_auth import get_radius_service, is_radius_enabled

print("=" * 50)
print("RADIUS Configuration Test")
print("=" * 50)

print(f"\n✓ RADIUS enabled: {is_radius_enabled()}")

service = get_radius_service()
if service:
    print(f"✓ Server: {service.config.server}:{service.config.port}")
    
    print("\nTesting connection...")
    success, message = service.test_connection()
    print(f"  Result: {message}")
    
    if success:
        print("\n⚠️  Server responded! But without correct secret, auth will fail.")
        print("    You need to get the shared secret from your network team.")
    else:
        print("\n❌ No response - check firewall or server status")
else:
    print("❌ Failed to initialize RADIUS service")

print("\n" + "=" * 50)
