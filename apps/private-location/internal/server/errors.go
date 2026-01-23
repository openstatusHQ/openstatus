package server

import "errors"

// Common errors used across the server package
var (
	ErrMissingToken         = errors.New("missing token")
	ErrMonitorNotFound      = errors.New("monitor not found")
	ErrPrivateLocationNotFound = errors.New("private location not found")
)
