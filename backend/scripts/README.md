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

## �️ Gestión de Dispositivos

### ✅ `import_devices.py` - **IMPORTACIÓN DE DISPOSITIVOS**
**🔥 USAR ESTE SCRIPT** - Importa dispositivos desde CSV

```bash
# Ejecutar desde el contenedor backend
docker-compose exec backend python scripts/import_devices.py
```

**Características:**
- 📥 **Importa desde:** `/app/Device_Inventory.csv`
- 🔍 **Detecta duplicados:** Por hostname o IP
- 📊 **Campos mapeados:** hostname, ip_address, site, version, platform, serial_number
- ✅ **Última ejecución:** 96 dispositivos importados exitosamente

**Estructura CSV esperada:**
```csv
Hostname,Login IP,Site,Version,Platform,Serial Number
device.example.com,10.1.1.100,us-dc01,17.1.1.4,vcmp,f5-serial-123
```

**Ejemplo de salida:**
```
+ Added: device.example.com (10.1.1.100)
- Skipped (already exists): existing.example.com

Import complete! 96 new devices were added.
```

### ✅ `set_credential.py` - **CONFIGURACIÓN DE CREDENCIALES**
**🔥 USAR ESTE SCRIPT** - Configura credenciales para dispositivos

```bash
# Configurar credenciales para dispositivos específicos
docker-compose exec backend python scripts/set_credential.py --hostnames "device1.example.com" "device2.example.com" --username admin

# Configurar credenciales para todos los dispositivos
docker-compose exec backend python scripts/set_credential.py --username admin
```

**Características:**
- 🔐 **Encriptación segura:** Passwords encriptados en base de datos
- 🎯 **Selectivo o masivo:** Dispositivos específicos o todos
- 👤 **Username configurable:** Por defecto 'admin'
- ✅ **Estado actual:** 96/96 dispositivos con credenciales configuradas

**Credenciales actuales:**
- 👤 **Usuario:** admin
- 🔐 **Password:** R0undt0w3r!

**Ejemplo de uso interactivo:**
```
python scripts/set_credential.py --username admin
Enter password for user 'admin' for the selected devices: [password]
Successfully updated credentials for 96 device(s).
```

---

## �🔧 Troubleshooting

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