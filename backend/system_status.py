#!/usr/bin/env python3
"""
Script de verificación rápida del estado del sistema CMT v2.5
Muestra un resumen del estado actual de la base de datos.

Uso: python system_status.py
"""

import sys
import os
from datetime import datetime

# Add the parent directory to the path so we can import from backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging

# Disable SQLAlchemy info logging for cleaner output
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

def print_header():
    """Print header"""
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    CMT v2.5 System Status                   ║
║                    {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                    ║
╚══════════════════════════════════════════════════════════════╝
""")

def check_database_connection():
    """Check if database is accessible"""
    try:
        from db.base import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1;")
        db.close()
        return True, "✅ Connected"
    except Exception as e:
        return False, f"❌ Error: {str(e)[:50]}..."

def check_tables():
    """Check database tables"""
    try:
        from db.base import SessionLocal
        from sqlalchemy import text
        
        db = SessionLocal()
        result = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';"))
        tables = [row[0] for row in result.fetchall()]
        db.close()
        
        expected_tables = ['users', 'devices', 'certificates', 'user_sessions', 'user_activities']
        missing = [t for t in expected_tables if t not in tables]
        
        if missing:
            return False, f"❌ Missing tables: {', '.join(missing)}"
        else:
            return True, f"✅ {len(tables)} tables found"
            
    except Exception as e:
        return False, f"❌ Error: {str(e)[:50]}..."

def check_users():
    """Check users in the system"""
    try:
        from db.base import SessionLocal
        from db.models import User
        
        db = SessionLocal()
        users = db.query(User).all()
        active_users = [u for u in users if u.is_active]
        admin_users = [u for u in users if u.role == "ADMIN"]
        db.close()
        
        return True, f"✅ {len(users)} total ({len(active_users)} active, {len(admin_users)} admin)"
        
    except Exception as e:
        return False, f"❌ Error: {str(e)[:50]}..."

def check_devices():
    """Check devices in the system"""
    try:
        from db.base import SessionLocal
        from db.models import Device
        
        db = SessionLocal()
        devices = db.query(Device).all()
        active_devices = [d for d in devices if d.active]
        devices_with_creds = [d for d in devices if d.encrypted_password]
        db.close()
        
        return True, f"✅ {len(devices)} total ({len(active_devices)} active, {len(devices_with_creds)} with credentials)"
        
    except Exception as e:
        return False, f"❌ Error: {str(e)[:50]}..."

def check_certificates():
    """Check certificates in the system"""
    try:
        from db.base import SessionLocal
        from db.models import Certificate
        
        db = SessionLocal()
        certificates = db.query(Certificate).all()
        db.close()
        
        return True, f"✅ {len(certificates)} certificates found"
        
    except Exception as e:
        return False, f"❌ Error: {str(e)[:50]}..."

def main():
    """Main function"""
    print_header()
    
    checks = [
        ("Database Connection", check_database_connection),
        ("Database Tables", check_tables),
        ("Users", check_users),
        ("Devices", check_devices),
        ("Certificates", check_certificates),
    ]
    
    results = []
    all_good = True
    
    print("🔍 Running system checks...\n")
    
    for check_name, check_function in checks:
        try:
            success, message = check_function()
            results.append((check_name, success, message))
            if not success:
                all_good = False
        except Exception as e:
            results.append((check_name, False, f"❌ Exception: {str(e)[:50]}..."))
            all_good = False
    
    # Print results
    print("📊 System Status Report:")
    print("─" * 60)
    
    for check_name, success, message in results:
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {check_name:<20} {message}")
    
    print("─" * 60)
    
    if all_good:
        print("🎉 All systems operational!")
        print("\n🌐 Access your system:")
        print("   Frontend: http://localhost:5173")
        print("   Backend API: http://localhost:8000")
        print("   Login: admin / admin123")
    else:
        print("⚠️  Some issues detected. Consider running master_setup.py")
    
    print("\n" + "═" * 60)
    
    return all_good

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Status check interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)