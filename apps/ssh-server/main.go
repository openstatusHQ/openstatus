package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gliderlabs/ssh"
)

//go:embed banner.txt
var banner string

func bannerfunc(ctx ssh.Context) string {
	return banner
}

var statusOk = `
+----------------------------------+
|                                  |
|       All Systems Operational    |
|                                  |
+----------------------------------+
`
var statusDegraded = `
+----------------------------------+
|                                  |
|       System is degraded         |
|                                  |
+----------------------------------+
`
var statusPartialOutage = `
+----------------------------------+
|                                  |
|   System is partially out of     |
|       service                    |
|                                  |
+----------------------------------+
`
var statusMajorOutage = `
+----------------------------------+
|                                  |
|       System is out of service   |
|                                  |
+----------------------------------+
`
var statusUnderMaintenance = `
+----------------------------------+
|                                  |
|       System is under            |
|       maintenance                |
|                                  |
+----------------------------------+
`
var statusIncident = `
+----------------------------------+
|                                  |
|   System is partially out of     |
|       service                    |
|                                  |
+----------------------------------+
`

type status struct {
	Status string `json:"status"`
}

func handler(s ssh.Session) {
	url := fmt.Sprintf("https://api.openstatus.dev/public/status/%s", s.User())
	res, err := http.Get(url)
	if err != nil {
		fmt.Fprintf(s, "Error fetching status: %v\n", err)
		return
	}
	defer res.Body.Close()
	var status status
	json.NewDecoder(res.Body).Decode(&status)

	var currentStatus string
	switch status.Status {
	case "operational":
		currentStatus = statusOk
	case "degraded_performance":
		currentStatus = statusDegraded
	case "partial_outage":
	currentStatus = statusPartialOutage
	case "major_outage":
		currentStatus = statusMajorOutage
	case "under_maintenance":
		currentStatus = statusUnderMaintenance
	case "incident":
		currentStatus = statusIncident
	default:
		currentStatus = ""
	}

	if currentStatus == "" {
		io.WriteString(s, "Unknown status page")
		return
	}

	io.WriteString(s, fmt.Sprintf("\nCurrent Status for: %s\n\n%s\n\nVisit the status page at https://%s.openstatus.dev/\n\n", s.User(), currentStatus, s.User()))
}

func main() {

	server := &ssh.Server{
		Addr:          ":2222",
		BannerHandler: bannerfunc,
		Handler:       handler,

	}
	ssh.HostKeyFile("/data/id_rsa")
	// server.AddHostKey(ssh.HostKeyFile(filepath string))

	log.Println("starting ssh server on port 2222...")
	log.Fatal(server.ListenAndServe())


}
