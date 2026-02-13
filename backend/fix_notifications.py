#!/usr/bin/env python3
"""Fix notifications table schema"""
from sqlalchemy import create_engine, text
import os

engine = create_engine(os.environ['DATABASE_URL'])

with engine.connect() as conn:
    # Get current columns
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications'"
    ))
    existing = {row[0] for row in result}
    print(f"Existing columns: {existing}")
    
    # Columns to add
    additions = [
        ("data", "ALTER TABLE notifications ADD COLUMN data TEXT"),
        ("action_label", "ALTER TABLE notifications ADD COLUMN action_label VARCHAR(100)"),
        ("expires_at", "ALTER TABLE notifications ADD COLUMN expires_at TIMESTAMP"),
    ]
    
    for col, sql in additions:
        if col not in existing:
            print(f"Adding column: {col}")
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"  OK: {col}")
            except Exception as e:
                print(f"  ERROR: {e}")
                conn.rollback()
        else:
            print(f"SKIP: {col} already exists")
    
    # Also fix user_preferences if needed
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_preferences'"
    ))
    up_existing = {row[0] for row in result}
    print(f"\nuser_preferences columns: {up_existing}")
    
    up_additions = [
        ("notification_types", "ALTER TABLE user_preferences ADD COLUMN notification_types TEXT"),
        ("dashboard_layout", "ALTER TABLE user_preferences ADD COLUMN dashboard_layout TEXT"),
    ]
    
    for col, sql in up_additions:
        if col not in up_existing:
            print(f"Adding column: {col}")
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"  OK: {col}")
            except Exception as e:
                print(f"  ERROR: {e}")
                conn.rollback()
        else:
            print(f"SKIP: {col} already exists")

print("\nDone!")
