# backend/create_initial_users.py

from db.base import SessionLocal
from db.models import User, UserRole
from services.auth_service import hash_password

# --- DATOS DE LOS USUARIOS INICIALES ---
# En un entorno real, las contraseñas vendrían de un lugar seguro,
# pero para la configuración inicial esto es aceptable.
# ¡NO USES ESTAS CONTRASEÑAS EN PRODUCCIÓN!
INITIAL_USERS = [
    {
        "username": "admin",
        "password": "R0undt0w3r!",
        "role": UserRole.ADMIN,
        "is_active": True
    },
    {
        "username": "operator",
        "password": "R0undt0w3r!",
        "role": UserRole.OPERATOR,
        "is_active": True
    },
    {
        "username": "viewer",
        "password": "R0undt0w3r!",
        "role": UserRole.VIEWER,
        "is_active": True
    }
]

def create_users():
    db = SessionLocal()
    print("Creating initial users...")
    
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
                    role=user_data["role"],
                    is_active=user_data["is_active"]
                )
                db.add(new_user)
                print(f"  + Created user: {user_data['username']} (role: {user_data['role'].value})")
            else:
                print(f"  - User '{user_data['username']}' already exists. Skipping.")
        
        db.commit()
        print("\nInitial user creation process finished.")
    
    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_users()