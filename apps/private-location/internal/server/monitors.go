package server

import (
	"context"

	"connectrpc.com/connect"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// import (
// 	"context"

// 	"connectrpc.com/connect"
// 	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
// )

func (h *privateLocationHandler) Monitors(ctx context.Context, req *connect.Request[private_locationv1.MonitorsRequest]) (*connect.Response[private_locationv1.MonitorsResponse], error) {
	req.Header().Get("openstatus-token")

	return connect.NewResponse(&private_locationv1.MonitorsResponse{}), nil
}
