#!/usr/bin/env python3
"""
Script para configurar credenciales masivas para todos los dispositivos.
Configura username: admin y password: R0undt0w3r!
"""

import sys
import os

# Add the parent directory to the path so we can import from backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.base import SessionLocal
from db.models import Device
from services.encryption_service import encrypt_data
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def set_bulk_credentials():
    """Set the same credentials for all devices"""
    username = "admin"
    password = "R0undt0w3r!"
    
    db = SessionLocal()
    
    try:
        # Get all devices
        devices = db.query(Device).all()
        logger.info(f"Found {len(devices)} devices in database")
        
        if not devices:
            logger.info("No devices found in database")
            return
        
        # Encrypt the password
        encrypted_password = encrypt_data(password)
        logger.info("Password encrypted successfully")
        
        # Update all devices
        updated_count = 0
        for device in devices:
            device.username = username
            device.encrypted_password = encrypted_password
            updated_count += 1
            logger.info(f"  ✓ Updated: {device.hostname}")
        
        # Commit changes
        db.commit()
        logger.info(f"✅ Successfully updated credentials for {updated_count} devices")
        logger.info(f"   Username: {username}")
        logger.info(f"   Password: [ENCRYPTED]")
        
    except Exception as e:
        logger.error(f"❌ Error updating credentials: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("🚀 Starting bulk credential update...")
    set_bulk_credentials()
    logger.info("🎉 Bulk credential update completed!")