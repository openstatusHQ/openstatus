package turso

import (
	"database/sql"
	"fmt"

	"github.com/openstatusHQ/rum-server/pkg/utils"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func GetClient() (*sql.DB, error) {
	// dbName := "local.db"
	primaryUrl := utils.Env("DATABASE_URL", "http://localhost:8080")
	authToken := utils.Env("DATABASE_AUTH_TOKEN", "")

	url := fmt.Sprintf("%s?auth_token=%s", primaryUrl, authToken)
	// syncInterval := time.Minute

	// dir, err := os.MkdirTemp("", "libsql-*")
	// if err != nil {
	// 	fmt.Println("Error creating temporary directory:", err)
	// 	return nil, err
	// }
	// defer os.RemoveAll(dir)

	// dbPath := filepath.Join(dir, dbName)

	// connector, err := libsql.NewEmbeddedReplicaConnector(dbPath, primaryUrl,
	// 	libsql.WithAuthToken(authToken),
	// 	libsql.WithSyncInterval(syncInterval),
	// )

	// if err != nil {
	// 	fmt.Println("Error creating connector:", err)
	// 	return nil, err
	// }
	// defer connector.Close()

	// db := sql.OpenDB(connector)

	db, err := sql.Open("libsql", url)
	if err != nil {
		return nil, err

	}
	return db, nil
}

func GetCurrentWorkspace(db *sql.DB, dsn string) (string, error) {
	var s sql.NullString
	err := db.QueryRow("SELECT id FROM workspace where dsn = ?", dsn).Scan(&s)
	if err != nil {
		return "", err
	}
	if !s.Valid {
		return "", fmt.Errorf("workspace not found")
	}
	return s.String, nil
}
