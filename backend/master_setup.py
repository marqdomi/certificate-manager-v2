#!/usr/bin/env python3
"""
Script maestro para inicialización completa del sistema CMT v2.5
Ejecuta todo el proceso de setup en una sola ejecución:
1. Creación de tablas
2. Creación de usuarios iniciales
3. Importación de dispositivos
4. Configuración de credenciales para dispositivos

Uso: python master_setup.py
"""

import sys
import os
import traceback
from datetime import datetime

# Add the parent directory to the path so we can import from backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging

# Configure logging with colors and better formatting
class ColoredFormatter(logging.Formatter):
    """Custom formatter for colored output"""
    
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

# Apply colored formatter to console handler
for handler in logger.handlers:
    if isinstance(handler, logging.StreamHandler):
        handler.setFormatter(ColoredFormatter('%(asctime)s - %(levelname)s - %(message)s'))

def print_banner():
    """Print a nice banner for the script"""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                    CMT v2.5 Master Setup                    ║
    ║                Certificate Management Tool                   ║
    ║                     Complete Initialization                 ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)

def step_1_create_tables():
    """Step 1: Create database tables"""
    logger.info("🏗️  STEP 1/4: Creating database tables...")
    
    try:
        from db.base import engine, SessionLocal
        from db.models import Base
        from sqlalchemy import text
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ All tables created successfully!")
        
        # Verify tables were created
        db = SessionLocal()
        try:
            result = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';"))
            tables = [row[0] for row in result.fetchall()]
            logger.info(f"📋 Found {len(tables)} tables: {', '.join(tables[:5])}{'...' if len(tables) > 5 else ''}")
        finally:
            db.close()
            
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating tables: {e}")
        return False

def step_2_create_users():
    """Step 2: Create initial users"""
    logger.info("👥 STEP 2/4: Creating initial users...")
    
    try:
        from db.base import SessionLocal
        from db.models import User
        from services.auth_service import pwd_context
        
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
                created_by="master_setup"
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
                created_by="master_setup"
            )
            
            db.add(viewer_user)
            db.commit()
            
            logger.info("✅ Users created successfully!")
            logger.info("   📋 admin / admin123 (ADMIN role)")
            logger.info("   📋 viewer / viewer123 (VIEWER role)")
            
            return True
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Error creating users: {e}")
        return False

def step_3_import_devices():
    """Step 3: Import devices from CSV"""
    logger.info("🖥️  STEP 3/4: Importing devices from CSV...")
    
    try:
        import csv
        from db.base import SessionLocal
        from db.models import Device
        
        csv_path = "/app/Device_Inventory.csv"
        
        db = SessionLocal()
        try:
            imported_count = 0
            skipped_count = 0
            
            with open(csv_path, mode='r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                for row in reader:
                    hostname = row.get("Hostname")
                    ip_address = row.get("Login IP")
                    site = row.get("Site")
                    version = row.get("Version")
                    platform = row.get("Platform")
                    serial_number = row.get("Serial Number")

                    if not hostname or not ip_address:
                        skipped_count += 1
                        continue

                    # Check if device already exists
                    existing_device = db.query(Device).filter(
                        (Device.hostname == hostname) | (Device.ip_address == ip_address)
                    ).first()

                    if not existing_device:
                        new_device = Device(
                            hostname=hostname,
                            ip_address=ip_address,
                            site=site,
                            version=version,
                            platform=platform,
                            serial_number=serial_number,
                            active=True,
                            username="admin"  # Default username
                        )
                        db.add(new_device)
                        imported_count += 1
                    else:
                        skipped_count += 1

            db.commit()
            logger.info(f"✅ Device import completed!")
            logger.info(f"   📦 {imported_count} new devices imported")
            logger.info(f"   ⚠️  {skipped_count} devices skipped (already existed or invalid)")
            
            return True
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
            
    except FileNotFoundError:
        logger.error(f"❌ Device CSV file not found at {csv_path}")
        return False
    except Exception as e:
        logger.error(f"❌ Error importing devices: {e}")
        return False

def step_4_set_credentials():
    """Step 4: Set credentials for all devices"""
    logger.info("🔐 STEP 4/4: Setting credentials for all devices...")
    
    try:
        from db.base import SessionLocal
        from db.models import Device
        from services.encryption_service import encrypt_data
        
        username = "admin"
        password = "R0undt0w3r!"
        
        db = SessionLocal()
        try:
            # Get all devices
            devices = db.query(Device).all()
            
            if not devices:
                logger.info("⚠️  No devices found in database")
                return True
            
            # Encrypt the password
            encrypted_password = encrypt_data(password)
            
            # Update all devices
            updated_count = 0
            for device in devices:
                device.username = username
                device.encrypted_password = encrypted_password
                updated_count += 1
            
            db.commit()
            logger.info(f"✅ Credentials updated successfully!")
            logger.info(f"   🔑 Username: {username}")
            logger.info(f"   🔒 Password: [ENCRYPTED] ({len(password)} chars)")
            logger.info(f"   📊 {updated_count} devices updated")
            
            return True
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Error setting credentials: {e}")
        return False

def print_summary(success_steps, total_steps):
    """Print final summary"""
    if success_steps == total_steps:
        summary = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║                    🎉 SETUP COMPLETED! 🎉                   ║
    ║                                                              ║
    ║  All {total_steps} steps completed successfully!                         ║
    ║                                                              ║
    ║  Your CMT v2.5 system is ready to use:                      ║
    ║  • Database tables created                                   ║
    ║  • Admin and viewer users ready                              ║
    ║  • Devices imported and configured                           ║
    ║  • Credentials set for all devices                           ║
    ║                                                              ║
    ║  🌐 Frontend: http://localhost:5173                          ║
    ║  🔐 Login: admin / admin123                                  ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
        """
    else:
        summary = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║                    ⚠️  SETUP INCOMPLETE ⚠️                   ║
    ║                                                              ║
    ║  {success_steps}/{total_steps} steps completed successfully.                      ║
    ║  Please check the logs above for errors.                    ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
        """
    
    print(summary)

def main():
    """Main execution function"""
    start_time = datetime.now()
    print_banner()
    
    logger.info(f"🚀 Starting CMT v2.5 master setup at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    steps = [
        ("Create Tables", step_1_create_tables),
        ("Create Users", step_2_create_users),
        ("Import Devices", step_3_import_devices),
        ("Set Credentials", step_4_set_credentials),
    ]
    
    success_count = 0
    total_steps = len(steps)
    
    for i, (step_name, step_function) in enumerate(steps, 1):
        try:
            logger.info(f"")
            logger.info(f"{'='*60}")
            if step_function():
                success_count += 1
            else:
                logger.error(f"❌ {step_name} failed!")
                break
        except Exception as e:
            logger.error(f"❌ {step_name} failed with exception: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            break
    
    end_time = datetime.now()
    duration = end_time - start_time
    
    logger.info(f"")
    logger.info(f"{'='*60}")
    logger.info(f"⏱️  Total execution time: {duration.total_seconds():.2f} seconds")
    
    print_summary(success_count, total_steps)
    
    return success_count == total_steps

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.error("\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")
        sys.exit(1)