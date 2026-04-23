#!/usr/bin/env python3
"""
Script para crear usuarios iniciales del sistema.
Versión simplificada sin LDAP/AD, solo usuarios locales.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.base import SessionLocal
from db.models import User, UserRole
from services.auth_service import pwd_context
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_initial_users():
    """Create initial users for the system"""
    db = SessionLocal()
    
    try:
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            logger.info("✅ Admin user already exists, skipping creation")
            return True
        
        # Create admin user
        admin_user = User(
            username="admin",
            hashed_password=pwd_context.hash("admin123"),
            auth_type="local",
            email="admin@localhost",
            full_name="System Administrator",
            role="ADMIN",
            is_active=True,
            is_locked=False,
            created_at=datetime.utcnow(),
            created_by="system"
        )
        
        db.add(admin_user)
        
        # Create a demo viewer user
        viewer_user = User(
            username="viewer",
            hashed_password=pwd_context.hash("viewer123"),
            auth_type="local",
            email="viewer@localhost",
            full_name="Demo Viewer",
            role="VIEWER",
            is_active=True,
            is_locked=False,
            created_at=datetime.utcnow(),
            created_by="system"
        )
        
        db.add(viewer_user)
        
        # Commit the changes
        db.commit()
        
        logger.info("✅ Initial users created successfully!")
        logger.info("   - admin / admin123 (ADMIN role)")
        logger.info("   - viewer / viewer123 (VIEWER role)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating initial users: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def verify_users():
    """Verify that users were created correctly"""
    db = SessionLocal()
    
    try:
        users = db.query(User).all()
        logger.info(f"Found {len(users)} users in database:")
        
        for user in users:
            logger.info(f"  - {user.username} ({user.role}) - Active: {user.is_active}")
        
        return len(users) > 0
        
    except Exception as e:
        logger.error(f"❌ Error verifying users: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("🚀 Creating initial users...")
    
    if create_initial_users():
        if verify_users():
            logger.info("🎉 User setup completed successfully!")
            sys.exit(0)
        else:
            logger.error("❌ User verification failed")
            sys.exit(1)
    else:
        logger.error("❌ User creation failed")
        sys.exit(1)