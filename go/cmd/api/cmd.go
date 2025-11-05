package api

import "github.com/urfave/cli/v3"

func Command() *cli.Command {
	cmd := &cli.Command{
		Name: "api",
		Usage: "Run openstatus API server",
		Action: action,
		Flags: []cli.Flag{
			&cli.IntFlag{
				Name:    "port",
				Aliases: []string{"p"},
				Value:   8080,
				Usage:   "Port to listen on",
				Sources: cli.EnvVars("OPENSTATUS_PORT"),
			},
		},
	}
	return cmd
}
