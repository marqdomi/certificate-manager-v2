# backend/import_devices.py
import csv
from db.base import SessionLocal
from db.models import Device

def import_devices_from_csv(filepath: str):
    db = SessionLocal()
    print(f"Importing devices from {filepath}...")
    
    try:
        with open(filepath, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            imported_count = 0
            for row in reader:
                hostname = row.get("Hostname")
                ip_address = row.get("Login IP")
                site = row.get("Site")
                version = row.get("Version")

                if not hostname or not ip_address:
                    print(f"Skipping row due to missing hostname or IP: {row}")
                    continue

                # Verificamos si el dispositivo ya existe para no duplicarlo
                existing_device = db.query(Device).filter(
                    (Device.hostname == hostname) | (Device.ip_address == ip_address)
                ).first()

                if not existing_device:
                    new_device = Device(
                        hostname=hostname,
                        ip_address=ip_address,
                        site=site,
                        version=version
                    )
                    db.add(new_device)
                    imported_count += 1
                    print(f"  + Added: {hostname}")
                else:
                    print(f"  - Skipped (already exists): {hostname}")

        db.commit()
        print(f"\nImport complete! {imported_count} new devices were added.")
    
    except FileNotFoundError:
        print(f"ERROR: File not found at {filepath}")
    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # La ruta al archivo DENTRO del contenedor Docker
    csv_path_in_container = "/app/Device_Inventory.csv"
    import_devices_from_csv(csv_path_in_container)