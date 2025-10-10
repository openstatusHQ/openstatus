package server_test

import (
	"database/sql"
	"testing"

	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

func TestParseAssertions_TextBodyContains(t *testing.T) {
	// Input JSON for the test
	input := `[{"version":"v1","type":"textBody","compare":"contains","target":"mydata"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	_, _, bodyAssertions := server.ParseAssertions(assertions)

	if len(bodyAssertions) != 1 {
		t.Fatalf("expected 1 body assertion, got %d", len(bodyAssertions))
	}

	got := bodyAssertions[0]
	if got.Target != "mydata" {
		t.Errorf("expected Target to be 'mydata', got '%s'", got.Target)
	}

	if got.Comparator != private_locationv1.StringComparator_STRING_COMPARATOR_CONTAINS {
		t.Errorf("expected Comparator to be STRING_COMPARATOR_CONTAINS, got %v", got.Comparator)
	}
}

func TestParseAssertions_HttpStatusEquals(t *testing.T) {
	// Input JSON for the test
	input := `[{"version":"v1","type":"status","compare":"eq","target":200}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	statusAssertion, _, _ := server.ParseAssertions(assertions)

	if len(	statusAssertion) != 1 {
		t.Fatalf("expected 1 body assertion, got %d", len(statusAssertion))
	}

	got := 	statusAssertion[0]
	if got.Target != 200 {
		t.Errorf("expected Target to be 'mydata', got '%d'", got.Target)
	}

	if got.Comparator != private_locationv1.NumberComparator_NUMBER_COMPARATOR_EQUAL {
		t.Errorf("expected Comparator to be STRING_COMPARATOR_CONTAINS, got %v", got.Comparator)
	}
}
