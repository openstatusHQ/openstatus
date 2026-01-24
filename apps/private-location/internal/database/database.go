package database

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

var (
	dbUrl      = os.Getenv("DB_URL")
	authToken  = os.Getenv("DB_AUTH_TOKEN")
	dbInstance *sqlx.DB
)

// New returns a database connection, reusing an existing connection if available.
func New() *sqlx.DB {
	// Reuse Connection
	if dbInstance != nil {
		return dbInstance
	}

	url := fmt.Sprintf("%s?auth_token=%s", dbUrl, authToken)
	c, err := sql.Open("libsql", url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open db %s: %s", url, err)
		os.Exit(1)
	}

	db := sqlx.NewDb(c, "sqlite3")
	dbInstance = db

	return db
}

// Close closes the database connection.
func Close() error {
	if dbInstance != nil {
		err := dbInstance.Close()
		dbInstance = nil
		return err
	}
	return nil
}
