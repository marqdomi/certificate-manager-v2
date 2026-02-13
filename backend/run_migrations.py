#!/usr/bin/env python3
"""Script to run database migrations for CMT v2.5.0"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    print(f"Connecting to database...")
    engine = create_engine(db_url)
    
    # List of migrations to apply
    migrations = [
        # Azure AD fields for users table
        ("users", "email", "ALTER TABLE users ADD COLUMN email VARCHAR;"),
        ("users", "full_name", "ALTER TABLE users ADD COLUMN full_name VARCHAR;"),
        ("users", "azure_oid", "ALTER TABLE users ADD COLUMN azure_oid VARCHAR;"),
        ("users", "auth_provider", "ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'local';"),
        ("users", "last_login", "ALTER TABLE users ADD COLUMN last_login TIMESTAMP;"),
        
        # Notifications table
        ("notifications", None, """
            DROP TABLE IF EXISTS notifications CASCADE;
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR NOT NULL DEFAULT 'info',
                priority VARCHAR NOT NULL DEFAULT 'medium',
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                data TEXT,
                action_url VARCHAR(500),
                action_label VARCHAR(100),
                is_read BOOLEAN DEFAULT FALSE,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS ix_notifications_type ON notifications(type);
            CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications(is_read);
            CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at);
        """),
        
        # User preferences table
        ("user_preferences", None, """
            CREATE TABLE IF NOT EXISTS user_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                email_notifications BOOLEAN DEFAULT TRUE,
                push_notifications BOOLEAN DEFAULT TRUE,
                expiry_warning_days INTEGER DEFAULT 30,
                preferred_theme VARCHAR DEFAULT 'light',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            );
        """),
        
        # Cert Master table
        ("cert_master", None, """
            CREATE TABLE IF NOT EXISTS cert_master (
                id SERIAL PRIMARY KEY,
                common_name VARCHAR NOT NULL,
                sans TEXT,
                issuer VARCHAR,
                serial_number VARCHAR UNIQUE,
                not_before TIMESTAMP,
                not_after TIMESTAMP,
                key_type VARCHAR,
                key_size INTEGER,
                signature_algorithm VARCHAR,
                thumbprint VARCHAR,
                status VARCHAR DEFAULT 'active',
                owner_team_id INTEGER,
                notes TEXT,
                auto_renew BOOLEAN DEFAULT FALSE,
                renewal_threshold_days INTEGER DEFAULT 30,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                last_sync TIMESTAMP
            );
        """),
        
        # Teams table
        ("teams", None, """
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                name VARCHAR UNIQUE NOT NULL,
                description TEXT,
                email_contact VARCHAR,
                slack_channel VARCHAR,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """),
        
        # Location types table
        ("location_types", None, """
            CREATE TABLE IF NOT EXISTS location_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR UNIQUE NOT NULL,
                description TEXT,
                color VARCHAR DEFAULT '#6B7280',
                icon VARCHAR DEFAULT 'server',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """),
        
        # Create indexes for Azure AD fields
        ("ix_users_email", None, "CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);"),
        ("ix_users_azure_oid", None, "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_azure_oid ON users(azure_oid);"),
    ]
    
    with engine.connect() as conn:
        # Check existing columns in users table
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
        ))
        existing_columns = {row[0] for row in result}
        print(f"Existing users columns: {existing_columns}")
        
        # Check existing tables
        result = conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        ))
        existing_tables = {row[0] for row in result}
        print(f"Existing tables: {existing_tables}")
        
        for name, column, sql in migrations:
            try:
                # Skip if column already exists
                if column and column in existing_columns:
                    print(f"  SKIP: Column {name}.{column} already exists")
                    continue
                    
                # Skip if table already exists (for table creation)
                if column is None and name in existing_tables and 'CREATE TABLE' in sql:
                    print(f"  SKIP: Table {name} already exists")
                    continue
                
                print(f"  Applying: {name}{'.' + column if column else ''}...")
                conn.execute(text(sql))
                conn.commit()
                print(f"  OK: {name}")
            except ProgrammingError as e:
                if 'already exists' in str(e):
                    print(f"  SKIP: {name} - already exists")
                else:
                    print(f"  ERROR: {name} - {e}")
                conn.rollback()
    
    print("\nMigrations complete!")

if __name__ == "__main__":
    main()
