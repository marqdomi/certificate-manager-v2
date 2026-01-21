#!/usr/bin/env python3
"""
Script para identificar la IP que debe registrarse en NPS/RADIUS
"""
import socket
import requests
import netifaces

print("=" * 70)
print("INFORMACIÓN DE RED PARA REGISTRO EN RADIUS/NPS")
print("=" * 70)

# 1. IP Local (privada)
print("\n📍 IP Local (Red Interna):")
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    local_ip = s.getsockname()[0]
    s.close()
    print(f"   {local_ip}")
except Exception as e:
    print(f"   ❌ No se pudo obtener: {e}")

# 2. IP Pública (VPN Netskope)
print("\n🌐 IP Pública (Salida a Internet / VPN):")
try:
    response = requests.get('https://api.ipify.org?format=json', timeout=5)
    public_ip = response.json()['ip']
    print(f"   {public_ip}")
    print(f"   ← Esta es la IP que ve el servidor RADIUS desde fuera")
except Exception as e:
    print(f"   ❌ No se pudo obtener: {e}")

# 3. Todas las interfaces de red
print("\n🔌 Todas las Interfaces de Red:")
try:
    for interface in netifaces.interfaces():
        addrs = netifaces.ifaddresses(interface)
        if netifaces.AF_INET in addrs:
            for addr in addrs[netifaces.AF_INET]:
                ip = addr['addr']
                if not ip.startswith('127.'):
                    print(f"   {interface}: {ip}")
except Exception as e:
    # Si netifaces no está instalado, usar método alternativo
    print("   (Instala 'netifaces' para ver todas las interfaces)")

# 4. Hostname
print(f"\n💻 Hostname: {socket.gethostname()}")

print("\n" + "=" * 70)
print("INSTRUCCIONES PARA EL ADMINISTRADOR DE RADIUS/NPS")
print("=" * 70)

print("""
Por favor, envía la siguiente información al administrador de NPS:

┌────────────────────────────────────────────────────────────────┐
│ Solicitud de Registro en RADIUS/NPS para CMT                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Aplicación: CMT (Certificate Management Tool)                 │
│ Ambiente:   Desarrollo (Dev)                                  │
│                                                                │
│ IP del Cliente RADIUS:                                        │
""")

if 'public_ip' in locals():
    print(f"│   {public_ip} (IP pública - VPN Netskope)               │")
else:
    print("│   [TU_IP_PUBLICA]                                          │")

if 'local_ip' in locals():
    print(f"│   {local_ip} (IP local - si el NPS está en la misma red)  │")
else:
    print("│   [TU_IP_LOCAL]                                            │")

print("""│                                                                │
│ Puerto RADIUS: 1812 (UDP)                                     │
│                                                                │
│ Shared Secret:                                                │
│   Por favor generar uno seguro (mínimo 22 caracteres)         │
│   Ejemplo: $(openssl rand -base64 32)                         │
│                                                                │
│ NAS Identifier: CMT-Development                               │
│                                                                │
│ Network Policies necesarias:                                  │
│   1. CMT-Admins: Usuarios del grupo "CMT-Admins"              │
│      → Filter-Id: "CMT-Admin"                                 │
│                                                                │
│   2. CMT-Operators: Usuarios del grupo "SG-Network-Operators" │
│      → Filter-Id: "CMT-Operator"                              │
│                                                                │
│   3. CMT-Viewers: Otros usuarios autenticados                 │
│      → Filter-Id: "CMT-Viewer" (opcional)                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘

""")

print("💡 NOTAS:")
print("   - Si estás usando Netskope VPN, usa la IP pública")
print("   - Si el servidor NPS está en la misma red, podría usar IP local")
print("   - El admin de NPS debe configurarte como 'RADIUS Client'")
print("   - Necesitarás el shared secret que generen para tu .env")
print()
print("=" * 70)
