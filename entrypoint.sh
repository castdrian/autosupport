#!/bin/bash

# Path to SQLite database file inside the container
CONTAINER_DB_FILE="/usr/src/app/autosupport.db"
# Path to SQLite database file on the host
HOST_DB_FILE="./autosupport.db"

# Check if the database file exists on the host
if [ ! -f "$HOST_DB_FILE" ]; then
    echo "Creating SQLite database at $HOST_DB_FILE"
    sqlite3 "$HOST_DB_FILE" "VACUUM;"
fi

# Ensure the database file is accessible inside the container
ln -sf "$HOST_DB_FILE" "$CONTAINER_DB_FILE"

# Execute the container's main process
exec "$@"
