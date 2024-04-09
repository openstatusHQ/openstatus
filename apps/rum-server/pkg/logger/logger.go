package logger

import (
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Configure(logLevel string) {
	level, err := zerolog.ParseLevel(logLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	zerolog.DefaultContextLogger = func() *zerolog.Logger {
		logger := log.With().Caller().Logger()
		return &logger
	}()
}
