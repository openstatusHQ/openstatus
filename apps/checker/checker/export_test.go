package checker

import (
	"net"
	"testing"
)

// SetResolverForTest swaps the package resolver so tests can point lookups at a
// stub, and restores it when the test ends.
func SetResolverForTest(t *testing.T, r *net.Resolver) {
	t.Helper()

	previous := resolver
	resolver = r
	t.Cleanup(func() { resolver = previous })
}
