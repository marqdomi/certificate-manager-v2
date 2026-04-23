#!/usr/bin/env python3
"""
Script para crear todas las tablas de la base de datos.
Versión simplificada sin LDAP/AD, solo usuarios locales.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.base import engine, SessionLocal
from db.models import Base
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tables():
    """Create all database tables"""
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ All tables created successfully!")
        return True
    except Exception as e:
        logger.error(f"❌ Error creating tables: {e}")
        return False

def verify_tables():
    """Verify that all expected tables exist"""
    try:
        db = SessionLocal()
        
        # Check if we can query the basic tables (PostgreSQL version)
        from sqlalchemy import text
        result = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';"))
        tables = [row[0] for row in result.fetchall()]
        
        expected_tables = [
            'users',
            'user_sessions',
            'user_activities',
            'devices', 
            'certificates',
            'renewal_requests',
            'system_config',
            'ssl_profiles_cache',
            'ssl_profile_vips_cache',
            'cert_profile_links_cache'
        ]
        
        logger.info(f"Found tables: {tables}")
        
        missing_tables = [t for t in expected_tables if t not in tables]
        if missing_tables:
            logger.warning(f"Missing tables: {missing_tables}")
        else:
            logger.info("✅ All expected tables found!")
            
        db.close()
        return len(missing_tables) == 0
        
    except Exception as e:
        logger.error(f"❌ Error verifying tables: {e}")
        return False

if __name__ == "__main__":
    logger.info("🚀 Starting database table creation...")
    
    # Create tables
    if create_tables():
        # Verify tables were created
        if verify_tables():
            logger.info("🎉 Database setup completed successfully!")
            sys.exit(0)
        else:
            logger.error("❌ Table verification failed")
            sys.exit(1)
    else:
        logger.error("❌ Table creation failed")
        sys.exit(1)