package database

import (
	// "database/sql"
	"database/sql"
	"fmt"

	// "log"
	"os"

	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	// "github.com/tursodatabase/go-libsql"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

var DB *sqlx.DB

var (
	dbUrl      = os.Getenv("DB_URL")
	authToken  = os.Getenv("DB_AUTH_TOKEN")
	dbInstance *sqlx.DB
)

func New() *sqlx.DB {
	// Reuse Connection
	if dbInstance != nil {
		return dbInstance
	}

	url := fmt.Sprintf("%s?auth_token=%s", dbUrl, authToken)
	fmt.Println(url)
	c, err := sql.Open("libsql", url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open db %s: %s", url, err)
		os.Exit(1)
	}
	// dir, err := os.MkdirTemp("", "libsql-*")
	//    if err != nil {
	//        fmt.Println("Error creating temporary directory:", err)
	//        os.Exit(1)
	//    }
	//    defer os.RemoveAll(dir)

	//    dbPath := filepath.Join(dir, dbName)
	//    fmt.Println(dbPath)
	//    connector, err := libsql.NewEmbeddedReplicaConnector(dbPath, url,
	//        libsql.WithAuthToken(authToken),
	//    )
	//    if err != nil {
	//        fmt.Println("Error creating connector:", err)
	//        os.Exit(1)
	//    }
	//    defer connector.Close()

	//    c := sql.OpenDB(connector)

	db := sqlx.NewDb(c, "sqlite3")

	return db
}
