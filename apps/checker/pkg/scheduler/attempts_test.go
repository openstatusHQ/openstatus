package scheduler

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
)

func TestToAttempts(t *testing.T) {
	http := toHTTPAttempts([]*job.HttpPrivateRegionData{{ID: "h", StatusCode: 503, Body: "down", Error: 1, Timestamp: 1}})
	require.Len(t, http, 1)
	assert.Equal(t, "h", http[0].GetId())
	assert.EqualValues(t, 503, http[0].GetStatusCode())
	assert.Equal(t, "down", http[0].GetBody())
	assert.EqualValues(t, 1, http[0].GetError())

	tcp := toTCPAttempts([]*job.TCPPrivateRegionData{{ID: "t", Message: "refused", Error: 1, Timestamp: 1}})
	require.Len(t, tcp, 1)
	assert.Equal(t, "refused", tcp[0].GetMessage())

	icmp := toICMPAttempts([]*job.ICMPPrivateRegionData{{ID: "i", PacketsSent: 3, Error: 1, Timestamp: 1}})
	require.Len(t, icmp, 1)
	assert.EqualValues(t, 3, icmp[0].GetPacketsSent())

	grpc := toGRPCAttempts([]*job.GRPCPrivateRegionData{{ID: "g", GRPCCode: 14, Timing: "{}", Error: 1, Timestamp: 1}})
	require.Len(t, grpc, 1)
	assert.EqualValues(t, 14, grpc[0].GetGrpcCode())
	assert.Equal(t, "{}", grpc[0].GetTiming())

	assert.Empty(t, toHTTPAttempts(nil))
}
