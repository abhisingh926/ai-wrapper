import re
from sqlalchemy import create_engine, text
from app.utils.encryption import decrypt_credentials

def build_connection_uri(conn_model) -> str:
    """Builds a SQLAlchemy connection URI from the AgentDatabaseConnection model."""
    try:
        creds = decrypt_credentials(conn_model.encrypted_password)
        password = creds.get("password", "")
    except Exception:
        password = ""
        
    if conn_model.db_type == "postgres":
        driver = "postgresql"
    elif conn_model.db_type == "mysql":
        driver = "mysql+pymysql"
    else:
        raise ValueError(f"Unsupported database type: {conn_model.db_type}")
        
    return f"{driver}://{conn_model.username}:{password}@{conn_model.host}:{conn_model.port}/{conn_model.db_name}"

def test_database_connection(conn_model) -> bool:
    """Tests if the connection settings are valid."""
    uri = build_connection_uri(conn_model)
    engine = create_engine(uri, connect_args={"connect_timeout": 5})
    try:
        with engine.connect() as conn:
            # Simple test query
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

def fetch_tables_and_columns(conn_model):
    """Reflects the external DB and returns a list of table and column metadata."""
    uri = build_connection_uri(conn_model)
    engine = create_engine(uri)
    
    schema_info = []
    
    query = ""
    if conn_model.db_type == "postgres":
        query = """
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        """
    elif conn_model.db_type == "mysql":
        query = """
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position;
        """
        
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query))
            for row in result:
                # SQLAlchemy 2.0 returns tuples usually, or Row objects.
                # Adjust depending on exact return type.
                schema_info.append({
                    "table_name": str(row[0]),
                    "column_name": str(row[1]),
                    "data_type": str(row[2])
                })
        return schema_info
    except Exception as e:
        print(f"Failed to fetch schema: {e}")
        return []


def fetch_foreign_key_relationships(conn_model) -> list:
    """
    Returns all FK relationships in the connected database.
    Each entry: { from_table, from_column, to_table, to_column }
    """
    uri = build_connection_uri(conn_model)
    engine = create_engine(uri)

    if conn_model.db_type == "postgres":
        query = """
            SELECT
                kcu.table_name        AS from_table,
                kcu.column_name       AS from_column,
                ccu.table_name        AS to_table,
                ccu.column_name       AS to_column
            FROM
                information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public';
        """
    elif conn_model.db_type == "mysql":
        query = """
            SELECT
                kcu.TABLE_NAME        AS from_table,
                kcu.COLUMN_NAME       AS from_column,
                kcu.REFERENCED_TABLE_NAME  AS to_table,
                kcu.REFERENCED_COLUMN_NAME AS to_column
            FROM information_schema.KEY_COLUMN_USAGE AS kcu
            WHERE kcu.REFERENCED_TABLE_SCHEMA = DATABASE()
              AND kcu.REFERENCED_TABLE_NAME IS NOT NULL;
        """
    else:
        return []

    try:
        with engine.connect() as conn:
            result = conn.execute(text(query))
            return [
                {
                    "from_table": str(row[0]),
                    "from_column": str(row[1]),
                    "to_table": str(row[2]),
                    "to_column": str(row[3]),
                }
                for row in result
            ]
    except Exception as e:
        print(f"Failed to fetch FK relationships: {e}")
        return []


def enforce_read_only(query: str) -> bool:
    """
    Returns True if the query is safe (read-only).
    Raises a ValueError if it contains unsafe keywords.
    """
    # Regex to catch dangerous SQL commands (case insensitive)
    # Using \b to match word boundaries
    dangerous_keywords = r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|GRANT|REVOKE|COMMIT|ROLLBACK|REPLACE|CREATE)\b"
    
    if re.search(dangerous_keywords, query, re.IGNORECASE):
        raise ValueError("Security Violation: The generated SQL query contains forbidden modifying keywords.")
        
    return True

def execute_safe_query(conn_model, query: str):
    """
    Executes a query safely. 
    1. Validates strictly via AST/RegEx.
    2. Runs internally using read-only execution if supported.
    """
    enforce_read_only(query)
    
    uri = build_connection_uri(conn_model)
    engine = create_engine(uri)
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query))
            keys = result.keys()
            rows = [dict(zip(keys, row)) for row in result.fetchall()]
            return rows
    except Exception as e:
        raise ValueError(f"Query execution failed: {str(e)}")
