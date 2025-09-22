# backend/set_credential.py

import argparse
from db.base import SessionLocal
from db.models import Device
from services.encryption_service import encrypt_data
from getpass import getpass

def set_credentials(hostnames: list[str] | None, username: str):
    db = SessionLocal()
    
    if hostnames:
        devices_to_update = db.query(Device).filter(Device.hostname.in_(hostnames)).all()
        # Verificamos si encontramos todos los dispositivos solicitados
        found_hostnames = {d.hostname for d in devices_to_update}
        not_found = set(hostnames) - found_hostnames
        if not_found:
            print(f"WARNING: The following hostnames were not found in the database and will be skipped: {', '.join(not_found)}")
        print(f"Attempting to update credentials for {len(devices_to_update)} device(s).")
    else:
        devices_to_update = db.query(Device).all()
        print(f"No specific hostnames provided. Will attempt to update all {len(devices_to_update)} devices.")

    if not devices_to_update:
        print("No devices to update.")
        db.close()
        return

    # Ahora la petición de contraseña incluye el username que especificaste
    password = getpass(f"Enter password for user '{username}' for the selected devices: ")
    if not password:
        print("Password cannot be empty. Aborting.")
        db.close()
        return

    encrypted_password = encrypt_data(password)
    
    try:
        for device in devices_to_update:
            device.username = username
            device.encrypted_password = encrypted_password
        
        db.commit()
        print(f"\nSuccessfully updated credentials for {len(devices_to_update)} device(s).")

    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # --- PARSER DE ARGUMENTOS MEJORADO ---
    parser = argparse.ArgumentParser(
        description="Set credentials for managed devices.",
        formatter_class=argparse.RawTextHelpFormatter # Para un 'help' más bonito
    )
    
    parser.add_argument(
        "--hostnames", 
        nargs='*', # 0 o más argumentos
        help="Optional: A space-separated list of hostnames.\nIf omitted, all devices in the database will be updated."
    )
    parser.add_argument(
        "--username", 
        default="admin", # Sigue siendo el valor por defecto si no se especifica
        help="The username to set for the devices (default: 'admin')."
    )
    
    args = parser.parse_args()
    
    set_credentials(hostnames=args.hostnames, username=args.username)