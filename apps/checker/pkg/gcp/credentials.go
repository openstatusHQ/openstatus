package gcp

import (
	"fmt"
	"os"
	"strings"

	"cloud.google.com/go/auth"
)

// Credentials builds the service account credentials shared by every GCP
// client of the checker from the GCP_* environment variables.
func Credentials() (*auth.Credentials, error) {
	privateKey := strings.ReplaceAll(os.Getenv("GCP_PRIVATE_KEY"), "\\n", "\n")
	opts := &auth.Options2LO{
		Email:        os.Getenv("GCP_CLIENT_EMAIL"),
		PrivateKey:   []byte(privateKey),
		PrivateKeyID: os.Getenv("GCP_PRIVATE_KEY_ID"),
		Scopes: []string{
			"https://www.googleapis.com/auth/cloud-platform",
		},
		TokenURL: "https://oauth2.googleapis.com/token",
	}

	tp, err := auth.New2LOTokenProvider(opts)
	if err != nil {
		return nil, fmt.Errorf("creating token provider: %w", err)
	}

	return auth.NewCredentials(&auth.CredentialsOptions{
		TokenProvider: tp,
	}), nil
}
