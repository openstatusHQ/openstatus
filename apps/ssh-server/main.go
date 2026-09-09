package main

import (
	"crypto/ed25519"
	"crypto/rand"
	_ "embed"
	"encoding/pem"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	bm "github.com/charmbracelet/wish/bubbletea"
	gossh "golang.org/x/crypto/ssh"
)

//go:embed banner.txt
var banner string

const (
	listenAddr         = ":2222"
	defaultHostKeyPath = "/data/id_rsa"
	// A live board holds the connection open indefinitely, and an abandoned
	// terminal would keep the fly machine awake forever.
	maxSessionDuration = 30 * time.Minute
)

func bannerHandler(ctx ssh.Context) string { return banner }

// hostKey returns the persistent host key stored at path, generating and
// persisting one on first boot. The key has to survive restarts, otherwise
// every client is asked to accept a new host fingerprint each time the machine
// comes back up.
func hostKey(path string) (gossh.Signer, error) {
	switch data, err := os.ReadFile(path); {
	case err == nil:
		signer, err := gossh.ParsePrivateKey(data)
		if err != nil {
			return nil, fmt.Errorf("parsing host key %s: %w", path, err)
		}
		return signer, nil
	case !errors.Is(err, fs.ErrNotExist):
		return nil, fmt.Errorf("reading host key %s: %w", path, err)
	}

	log.Printf("no host key at %s, generating one...", path)
	_, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating host key: %w", err)
	}
	block, err := gossh.MarshalPrivateKey(key, "")
	if err != nil {
		return nil, fmt.Errorf("encoding host key: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("creating host key directory: %w", err)
	}
	if err := os.WriteFile(path, pem.EncodeToMemory(block), 0o600); err != nil {
		return nil, fmt.Errorf("writing host key %s: %w", path, err)
	}
	return gossh.NewSignerFromKey(key)
}

func withHostSigner(signer gossh.Signer) ssh.Option {
	return func(s *ssh.Server) error {
		s.HostSigners = []ssh.Signer{signer}
		return nil
	}
}

func main() {
	configureFromEnv()

	path := os.Getenv("HOST_KEY_PATH")
	if path == "" {
		path = defaultHostKeyPath
	}
	signer, err := hostKey(path)
	if err != nil {
		log.Fatal(err)
	}

	// Middlewares run last-to-first, so the TUI gets the session and the plain
	// renderer is what it falls through to.
	server, err := wish.NewServer(
		wish.WithAddress(listenAddr),
		wish.WithBannerHandler(bannerHandler),
		wish.WithMaxTimeout(maxSessionDuration),
		withHostSigner(signer),
		wish.WithMiddleware(
			plainMiddleware,
			bm.Middleware(teaHandler),
		),
	)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("host key %s (%s)", path, gossh.FingerprintSHA256(signer.PublicKey()))
	log.Printf("starting ssh server on %s...", listenAddr)
	log.Fatal(server.ListenAndServe())
}
