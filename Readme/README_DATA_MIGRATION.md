# Police Roster Data Migration Guide

This guide explains how to migrate data from the old police roster database to the new Django-based system.

## Overview

The migration process involves transferring data from the following tables:

1. `roster_app_zone` → `police_roster.Zone`
2. `roster_app_area` → `police_roster.Area`
3. `roster_app_policeman` → `police_roster.Policeman`
4. `roster_app_deployment` → `police_roster.Deployment`

## Prerequisites

Before running the migration, you must:

1. Ensure the `gender` field is added to the `Policeman` model in `police_roster/models.py`
2. Run database migrations to update your schema:
   ```
   python manage.py makemigrations
   python manage.py migrate
   ```
3. Place the old SQLite database file in the `old_data/` directory (it should be named `old_data.sqlite3`)

## Running the Migration

You can run the data migration using the custom management command:

```bash
# Migrate all data
python manage.py ingest_old_data

# Or migrate specific data types
python manage.py ingest_old_data --zones-only
python manage.py ingest_old_data --areas-only
python manage.py ingest_old_data --policemen-only
python manage.py ingest_old_data --deployments-only
```

## How It Works

The migration script:

1. Connects to the old SQLite database using Python's `sqlite3` module
2. Reads data from the old tables
3. Maps field names and values to match the new model schema
4. Inserts records into the new database using Django's ORM

### Special Handling Notes

- **Zones**: Only the `name` field is migrated. The new `description` field is set to NULL.
- **Policemen**:
  - `rank` values are mapped to the new system's choice codes
  - `preferred_duty` values are mapped to either 'STATIC' or 'FIELD'
  - All policemen are set to `has_fixed_duty=False` and `fixed_area=None`
  - The `gender` field is preserved as-is from the old database
- **Foreign Keys**: The migration preserves relationships between tables by using the same IDs in the new system

## Troubleshooting

If you encounter issues during migration:

1. Check that the old database file exists at the expected location
2. Verify that all required model fields are present in your models
3. Make sure you've run `makemigrations` and `migrate` to prepare your database
4. Check the error output for specific issues with records

For detailed logs, review the console output during migration.

## Detailed Documentation

For more detailed information about the migration implementation, see the README in the `datamigration/` directory.
