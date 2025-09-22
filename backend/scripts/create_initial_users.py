# backend/scripts/create_initial_users.py
# 
# ⚠️  SCRIPT ACTUALIZADO - Crea usuarios con propiedades completas
# 
# Este script crea usuarios iniciales con todos los campos requeridos:
# - SUPER_ADMIN: Usuario con máximos privilegios (admin123)
# - OPERATOR: Usuario con permisos de operación (R0undt0w3r!)  
# - VIEWER: Usuario con permisos de solo lectura (R0undt0w3r!)
#
# IMPORTANTE: Cambiar contraseñas en producción
#

from db.base import SessionLocal
from db.models import User
from services.auth_service import hash_password

# --- DATOS DE LOS USUARIOS INICIALES ---
# En un entorno real, las contraseñas vendrían de un lugar seguro,
# pero para la configuración inicial esto es aceptable.
# ¡NO USES ESTAS CONTRASEÑAS EN PRODUCCIÓN!
INITIAL_USERS = [
    {
        "username": "admin",
        "password": "admin123",  # ⬅️ NUEVA PASSWORD PRINCIPAL
        "role": "super_admin",   # ⬅️ ROLE CORRECTO (super_admin, no SUPER_ADMIN)
        "email": "admin@company.com",
        "full_name": "System Administrator",
        "is_active": True
    },
    {
        "username": "operator",
        "password": "R0undt0w3r!",
        "role": "operator",
        "email": "operator@company.com", 
        "full_name": "System Operator",
        "is_active": True
    },
    {
        "username": "viewer",
        "password": "R0undt0w3r!",
        "role": "viewer",
        "email": "viewer@company.com",
        "full_name": "System Viewer", 
        "is_active": True
    }
]

def create_users():
    db = SessionLocal()
    print("Creating initial users with complete properties...")
    
    try:
        for user_data in INITIAL_USERS:
            # Verificamos si el usuario ya existe
            existing_user = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing_user:
                # Hasheamos la contraseña antes de guardarla
                hashed_pass = hash_password(user_data["password"])
                
                new_user = User(
                    username=user_data["username"],
                    hashed_password=hashed_pass,
                    role=user_data["role"],           # String role (super_admin, operator, viewer)
                    auth_type="local",               # Auth type as string
                    email=user_data["email"],        # ⬅️ NUEVO: Email completo
                    full_name=user_data["full_name"], # ⬅️ NUEVO: Nombre completo
                    is_active=user_data["is_active"]
                )
                db.add(new_user)
                print(f"  ✅ Created user: {user_data['username']} (role: {user_data['role']}, email: {user_data['email']})")
            else:
                print(f"  ⚠️  User '{user_data['username']}' already exists. Skipping.")
        
        db.commit()
        print("\n🎉 Initial user creation process finished successfully!")
        print("\n📋 Login credentials:")
        print("   👑 ADMIN:    admin / admin123")
        print("   🔧 OPERATOR: operator / R0undt0w3r!")  
        print("   👁️  VIEWER:   viewer / R0undt0w3r!")
    
    except Exception as e:
        db.rollback()
        print(f"❌ An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_users()