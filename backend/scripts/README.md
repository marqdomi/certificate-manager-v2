# 📋 Scripts de Configuración de Base de Datos

## 🎯 Scripts de Uso Principal

### ✅ `create_initial_users.py` - **SCRIPT ACTUALIZADO**
**🔥 USAR ESTE SCRIPT** - Crea usuarios con propiedades completas

```bash
# Ejecutar desde el contenedor backend
docker-compose exec backend sh -c "cd /app && PYTHONPATH=/app python scripts/create_initial_users.py"
```

**Usuarios que crea:**
- 👑 **admin** / **admin123** - SUPER_ADMIN con máximos privilegios
- 🔧 **operator** / **R0undt0w3r!** - OPERATOR con permisos de operación  
- 👁️ **viewer** / **R0undt0w3r!** - VIEWER con permisos de solo lectura

**Propiedades incluidas:**
- ✅ Username, password, role
- ✅ Email completo (`admin@company.com`)
- ✅ Full name (`System Administrator`)
- ✅ Auth type (`local`)
- ✅ Active status

---

### ✅ `create_tables.py` - Creación de Tablas
Crea todas las tablas de la base de datos usando SQLAlchemy

```bash
docker-compose exec backend sh -c "cd /app && PYTHONPATH=/app python scripts/create_tables.py"
```

---

## ⚠️ Scripts Obsoletos / Alternativos

### ❌ `/app/create_admin_user.py` - **NO USAR**
Este script usa configuración async y rutas absolutas que no funcionan en el entorno Docker.

**Problemas:**
- ❌ Usa rutas absolutas hardcodeadas
- ❌ Requiere configuración async compleja
- ❌ No funciona en Docker sin modificaciones

**Status:** Mantener solo como referencia, NO usar en producción

---

## 🚀 Flujo de Configuración Recomendado

1. **Crear tablas:**
   ```bash
   docker-compose exec backend sh -c "cd /app && PYTHONPATH=/app python scripts/create_tables.py"
   ```

2. **Crear usuarios iniciales:**
   ```bash
   docker-compose exec backend sh -c "cd /app && PYTHONPATH=/app python scripts/create_initial_users.py"
   ```

3. **Verificar en base de datos:**
   ```bash
   docker-compose exec db psql -U user -d certmgr -c "SELECT username, role, email, full_name FROM users;"
   ```

---

## 🔐 Credenciales por Defecto

**⚠️ CAMBIAR EN PRODUCCIÓN**

| Usuario | Password | Rol | Descripción |
|---------|----------|-----|-------------|
| admin | admin123 | super_admin | Administrador del sistema |
| operator | R0undt0w3r! | operator | Operador del sistema |
| viewer | R0undt0w3r! | viewer | Solo lectura |

---

## 📝 Notas de Desarrollo

- **Roles válidos:** `super_admin`, `admin`, `cert_manager`, `f5_operator`, `auditor`, `operator`, `viewer`
- **Frontend reconoce:** Roles `super_admin` y `admin` como administradores
- **Auth types:** `local`, `ad` (Microsoft AD)
- **Passwords:** Se hashean automáticamente con bcrypt

---

## 🔧 Troubleshooting

### Error "No module named 'db'"
```bash
# Asegúrate de usar PYTHONPATH=/app
docker-compose exec backend sh -c "cd /app && PYTHONPATH=/app python scripts/script_name.py"
```

### Error "relation does not exist"
```bash
# Crear tablas primero
docker-compose exec backend sh -c "cd /app && PYTHONPATH=/app python scripts/create_tables.py"
```