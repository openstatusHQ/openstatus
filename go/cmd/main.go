package main

import (
	"context"
	"fmt"
	"os"

	"github.com/urfave/cli/v3"
)
func main() {
	if err := os.Setenv("TZ", "UTC"); err != nil {
			panic(err)
	}

	app := &cli.Command{
		Name:  "openstatus",
		Commands: []*cli.Command{},
	}

	if err := app.Run(context.Background(), os.Args); err != nil {
			fmt.Println(err)

			os.Exit(1)
		}
}
