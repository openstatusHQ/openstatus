package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

type dockerCompose struct {
	Services map[string]struct {
		Environment []string `yaml:"environment"`
	} `yaml:"services"`
}

func TestDeploymentSetsTinybirdToken(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "coolify-deployment.yaml"))
	require.NoError(t, err)

	var compose dockerCompose
	require.NoError(t, yaml.Unmarshal(data, &compose))

	service, ok := compose.Services["private-location"]
	require.True(t, ok, "private-location service must exist in coolify-deployment.yaml")

	var tokenEntry string
	for _, entry := range service.Environment {
		if strings.HasPrefix(entry, "TINYBIRD_TOKEN=") {
			tokenEntry = entry
			break
		}
	}
	require.NotEmpty(t, tokenEntry, "private-location must set TINYBIRD_TOKEN")
	require.Equal(t, "TINYBIRD_TOKEN=${TINYBIRD_TOKEN:-${TINY_BIRD_API_KEY:-}}", tokenEntry)
}
