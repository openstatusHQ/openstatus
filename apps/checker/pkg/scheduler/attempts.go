package scheduler

import (
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

func toHTTPAttempts(attempts []*job.HttpPrivateRegionData) []*v1.HTTPAttempt {
	out := make([]*v1.HTTPAttempt, 0, len(attempts))
	for _, a := range attempts {
		out = append(out, &v1.HTTPAttempt{
			Id:            a.ID,
			Latency:       a.Latency,
			Timestamp:     a.Timestamp,
			RequestStatus: a.RequestStatus,
			Message:       a.Message,
			Body:          a.Body,
			Headers:       a.Headers,
			Timing:        a.Timing,
			StatusCode:    int64(a.StatusCode),
			Error:         int64(a.Error),
		})
	}

	return out
}

func toTCPAttempts(attempts []*job.TCPPrivateRegionData) []*v1.TCPAttempt {
	out := make([]*v1.TCPAttempt, 0, len(attempts))
	for _, a := range attempts {
		out = append(out, &v1.TCPAttempt{
			Id:            a.ID,
			Latency:       a.Latency,
			Timestamp:     a.Timestamp,
			Message:       a.Message,
			RequestStatus: a.RequestStatus,
			Error:         int64(a.Error),
			Timing:        a.Timing,
		})
	}

	return out
}

func toDNSAttempts(attempts []*job.DNSPrivateRegionData) []*v1.DNSAttempt {
	out := make([]*v1.DNSAttempt, 0, len(attempts))
	for _, a := range attempts {
		out = append(out, &v1.DNSAttempt{
			Id:            a.ID,
			Latency:       a.Latency,
			Timestamp:     a.Timestamp,
			RequestStatus: a.RequestStatus,
			Message:       a.Message,
			Records:       toProtoRecords(a.Records),
			Error:         int64(a.Error),
		})
	}

	return out
}

func toICMPAttempts(attempts []*job.ICMPPrivateRegionData) []*v1.ICMPAttempt {
	out := make([]*v1.ICMPAttempt, 0, len(attempts))
	for _, a := range attempts {
		out = append(out, &v1.ICMPAttempt{
			Id:              a.ID,
			Latency:         a.Latency,
			LatencyMin:      a.LatencyMin,
			LatencyMax:      a.LatencyMax,
			PacketsSent:     a.PacketsSent,
			PacketsReceived: a.PacketsReceived,
			Timestamp:       a.Timestamp,
			Message:         a.Message,
			RequestStatus:   a.RequestStatus,
			Error:           int64(a.Error),
			Timing:          a.Timing,
		})
	}

	return out
}

func toGRPCAttempts(attempts []*job.GRPCPrivateRegionData) []*v1.GRPCAttempt {
	out := make([]*v1.GRPCAttempt, 0, len(attempts))
	for _, a := range attempts {
		out = append(out, &v1.GRPCAttempt{
			Id:            a.ID,
			Latency:       a.Latency,
			Timestamp:     a.Timestamp,
			ServingStatus: a.ServingStatus,
			GrpcCode:      a.GRPCCode,
			Message:       a.Message,
			RequestStatus: a.RequestStatus,
			Error:         int64(a.Error),
			Timing:        a.Timing,
		})
	}

	return out
}
