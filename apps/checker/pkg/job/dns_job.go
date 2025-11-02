package job

import (
	"context"

	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

type DNSPrivateRegionData struct {}

func (jobRunner) DNSJob(ctx context.Context, monitor *v1.DNSMonitor) ( *DNSPrivateRegionData, error) {

	return nil,nil
}
