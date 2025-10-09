package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"connectrpc.com/connect"
	private_locationv1 "github.com/openstatushq/openstatus/packages/proto/gen/private_location/v1"
)

// import (
// 	"context"

// 	"connectrpc.com/connect"
// 	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
// )

func (h *privateLocationHandler) Monitors(ctx context.Context, req *connect.Request[private_locationv1.MonitorsRequest]) (*connect.Response[private_locationv1.MonitorsResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing token"))
	}
	var monitors []Monitor

	err := h.db.Select(&monitors, "SELECT monitor.* FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.key = ? AND monitor.deleted_at IS NULL", token)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var v []*private_locationv1.HTTPMonitor
	for _, monitor := range monitors {
		fmt.Println(monitor)


		var headers []*private_locationv1.Headers
		json.Unmarshal([]byte(monitor.Headers), &headers)
		v = append(v, &private_locationv1.HTTPMonitor{
			Url:  monitor.URL,
			Id:   strconv.Itoa(monitor.ID),
			Method: monitor.Method,
			Body: monitor.Body,
			Timeout: (monitor.Timeout),
			DegradedAt: &monitor.DegradedAfter.Int64,
			FollowRedirects: monitor.FollowRedirects,
			Headers: headers,
		})
	}
	return connect.NewResponse(&private_locationv1.MonitorsResponse{
		Monitors: v,
	}), nil
}
