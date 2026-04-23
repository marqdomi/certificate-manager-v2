#!/usr/bin/env python3
"""
Script de reset completo del sistema CMT v2.5
Limpia toda la información existente y ejecuta el setup completo desde cero.

ADVERTENCIA: Este script eliminará TODOS los datos existentes!

Uso: python master_reset_and_setup.py
"""

import sys
import os
import traceback
from datetime import datetime

# Add the parent directory to the path so we can import from backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging

# Same colored formatter as master_setup
class ColoredFormatter(logging.Formatter):
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[92m',     # Green
        'WARNING': '\033[93m',  # Yellow
        'ERROR': '\033[91m',    # Red
        'CRITICAL': '\033[95m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, '')
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Apply colored formatter
for handler in logger.handlers:
    if isinstance(handler, logging.StreamHandler):
        handler.setFormatter(ColoredFormatter('%(asctime)s - %(levelname)s - %(message)s'))

def print_warning_banner():
    """Print warning banner"""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                    ⚠️  WARNING! ⚠️                           ║
    ║                                                              ║
    ║              CMT v2.5 COMPLETE RESET & SETUP                ║
    ║                                                              ║
    ║  This script will DELETE ALL existing data:                  ║
    ║  • All database tables will be dropped                      ║
    ║  • All users will be removed                                 ║
    ║  • All devices will be deleted                               ║
    ║  • All certificates will be lost                             ║
    ║                                                              ║
    ║  Then it will recreate everything from scratch.              ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)

def confirm_reset():
    """Ask for user confirmation"""
    logger.warning("🚨 This operation will DELETE ALL DATA in the database!")
    logger.warning("🚨 This action cannot be undone!")
    
    try:
        response = input("\nType 'RESET' to confirm, or anything else to cancel: ")
        return response.strip() == "RESET"
    except KeyboardInterrupt:
        return False

def reset_database():
    """Drop all tables and recreate them"""
    logger.info("🗑️  Resetting database (dropping all tables)...")
    
    try:
        from db.base import engine
        from db.models import Base
        
        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        logger.info("✅ All tables dropped successfully!")
        
        # Recreate all tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ All tables recreated successfully!")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error resetting database: {e}")
        return False

def main():
    """Main execution function"""
    start_time = datetime.now()
    print_warning_banner()
    
    # Ask for confirmation
    if not confirm_reset():
        logger.info("❌ Reset cancelled by user")
        return False
    
    logger.info(f"🚀 Starting complete reset and setup at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Reset database
    if not reset_database():
        logger.error("❌ Database reset failed!")
        return False
    
    # Step 2: Run master setup
    logger.info("🔄 Running master setup...")
    try:
        # Import and run master setup
        from master_setup import main as master_setup_main
        setup_success = master_setup_main()
        
        if setup_success:
            end_time = datetime.now()
            duration = end_time - start_time
            
            final_banner = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║                🎉 RESET & SETUP COMPLETED! 🎉               ║
    ║                                                              ║
    ║  Database completely reset and reconfigured!                 ║
    ║  Total time: {duration.total_seconds():.1f} seconds                                 ║
    ║                                                              ║
    ║  🌐 Frontend: http://localhost:5173                          ║
    ║  🔐 Login: admin / admin123                                  ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
            """
            print(final_banner)
            return True
        else:
            logger.error("❌ Master setup failed after database reset!")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error running master setup: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.error("\n❌ Reset interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")
        sys.exit(1)