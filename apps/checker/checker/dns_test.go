package checker_test

import (
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/checker"
)


func TestPingDNS(t *testing.T) {
	ctx := t.Context()
	data, err := checker.Dns(ctx, "openstat.us")
	if err != nil {
		t.Errorf("Dns() error = %v", err)
	}
	if len(data.A) == 0 {
		t.Errorf("Dns() A records = %v", data.A)
	}
}
