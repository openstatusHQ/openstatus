package clickhouse

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/openstatusHQ/rum-server/pkg/utils"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

func NewClient() (driver.Conn, error) {

	var (
		dbUrl      = utils.Env("CLICKHOUSE_URL", "localhost:9000")
		dbName     = utils.Env("CLICKHOUSE_DATABASE", "default")
		dbUsername = utils.Env("CLICKHOUSE_USERNAME", "default")
		dbPassword = utils.Env("CLICKHOUSE_PASSWORD", "")
		ctx        = context.Background()
		conn, err  = clickhouse.Open(&clickhouse.Options{
			Addr: []string{dbUrl},
			Auth: clickhouse.Auth{
				Database: dbName,
				Username: dbUsername,
				Password: dbPassword,
			},
			// Protocol: clickhouse.HTTP,
			// for  dev
			TLS: &tls.Config{
				InsecureSkipVerify: true,
			},
			Settings: clickhouse.Settings{
				"max_execution_time": 60,
			},
			DialTimeout: time.Second * 30,
			Compression: &clickhouse.Compression{
				Method: clickhouse.CompressionLZ4,
			},
			Debug:                true,
			BlockBufferSize:      10,
			MaxCompressionBuffer: 10240,
		})
	)

	if err != nil {
		return nil, err
	}

	fmt.Println("Connected to Clickhouse")
	if err := conn.Ping(ctx); err != nil {
		if exception, ok := err.(*clickhouse.Exception); ok {
			fmt.Printf("Exception [%d] %s \n%s\n", exception.Code, exception.Message, exception.StackTrace)
		}
		return nil, err
	}
	return conn, nil
}
