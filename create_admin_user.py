#!/usr/bin/env python3
"""
⚠️  SCRIPT OBSOLETO - NO USAR EN PRODUCCIÓN ⚠️

Este script era para crear un usuario admin de prueba pero tiene problemas:
- Usa rutas absolutas hardcodeadas 
- Requiere configuración async compleja
- No funciona en el entorno Docker sin modificaciones

📍 USAR EN SU LUGAR: /app/backend/scripts/create_initial_users.py

Ese script está actualizado para:
✅ Funcionar en Docker
✅ Crear usuarios con propiedades completas
✅ Usar roles correctos (super_admin, no SUPER_ADMIN)
✅ Incluir email y full_name
✅ Documentación completa

MANTENER ESTE ARCHIVO SOLO COMO REFERENCIA
"""

import asyncio
import sys
import os

# ⚠️  ESTA RUTA NO FUNCIONA EN DOCKER
sys.path.append('/Users/marco.dominguez/Projects/cmt-deploy/app/backend')

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from db.models import User, UserRole, AuthType
from services.auth_service import AuthService
from core.config import get_settings

async def create_test_admin():
    """Create a test admin user"""
    settings = get_settings()
    
    # Create async engine
    engine = create_async_engine(
        settings.database_url.replace('postgresql://', 'postgresql+asyncpg://'),
        echo=True
    )
    
    # Create session
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        auth_service = AuthService(session)
        
        # Check if admin user already exists
        admin_user = await auth_service.get_user_by_username('admin')
        if admin_user:
            print("✅ Admin user already exists!")
            print(f"   Username: {admin_user.username}")
            print(f"   Role: {admin_user.role}")
            print(f"   Auth Type: {admin_user.auth_type}")
            return
        
        # Create admin user
        try:
            admin_user = await auth_service.create_user(
                username='admin',
                password='admin123',  # Change this in production!
                email='admin@company.com',
                full_name='System Administrator',
                role=UserRole.SUPER_ADMIN,
                auth_type=AuthType.LOCAL,
                is_active=True
            )
            
            print("✅ Admin user created successfully!")
            print(f"   Username: {admin_user.username}")
            print(f"   Password: admin123")
            print(f"   Role: {admin_user.role}")
            print(f"   Auth Type: {admin_user.auth_type}")
            print(f"   Email: {admin_user.email}")
            print(f"   Full Name: {admin_user.full_name}")
            
        except Exception as e:
            print(f"❌ Failed to create admin user: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_test_admin())