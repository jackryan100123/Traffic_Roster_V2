import sqlite3
import os

def get_table_info(db_path):
    """Connect to SQLite database and return table information"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [table[0] for table in cursor.fetchall()]
    
    table_info = {}
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table});")
        columns = cursor.fetchall()
        # Column format: (cid, name, type, notnull, dflt_value, pk)
        table_info[table] = [{'name': col[1], 'type': col[2], 'primary_key': col[5] == 1} for col in columns]
        
        # Also get first row as example
        cursor.execute(f"SELECT * FROM {table} LIMIT 1;")
        row = cursor.fetchone()
        if row:
            table_info[table + '_sample'] = row
    
    conn.close()
    return table_info

if __name__ == "__main__":
    old_db_path = os.path.join('old_data', 'old_data.sqlite3')
    
    if not os.path.exists(old_db_path):
        print(f"Database file not found: {old_db_path}")
        exit(1)
    
    print(f"Analyzing database: {old_db_path}")
    table_info = get_table_info(old_db_path)
    
    # Print table information
    for table_name in [t for t in table_info if not t.endswith('_sample')]:
        print(f"\nTable: {table_name}")
        print("-" * 40)
        for col in table_info[table_name]:
            pk_marker = "(PK)" if col['primary_key'] else ""
            print(f"{col['name']} - {col['type']} {pk_marker}")
        
        # Print sample data if available
        sample_key = f"{table_name}_sample"
        if sample_key in table_info:
            print("\nSample Row:")
            sample = table_info[sample_key]
            for i, col in enumerate(table_info[table_name]):
                if i < len(sample):
                    print(f"  {col['name']}: {sample[i]}") 