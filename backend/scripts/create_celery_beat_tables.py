# backend/create_celery_beat_tables.py
import os
import sys

# Ensure project is importable
sys.path.append(os.getcwd())

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.django_settings")

def main() -> int:
    try:
        import django
        from django.core.management import call_command

        # Initialize Django
        django.setup()

        print("Creating Celery Beat database tables (django_celery_beat)...")
        call_command("migrate", "django_celery_beat", verbosity=1, interactive=False)
        print("Celery Beat tables created successfully.")
        return 0
    except ModuleNotFoundError as e:
        print(f"\nERROR: {e}. Is Django installed in this environment?")
        print("Check your virtualenv inside the container and PYTHONPATH.")
        print("\n--- sys.path ---")
        import pprint
        pprint.pprint(sys.path)
        print("----------------")
        return 1
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
        print("Please ensure your database is reachable and migrations can run.")
        return 2

if __name__ == "__main__":
    raise SystemExit(main())