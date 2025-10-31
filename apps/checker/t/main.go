package main

import "net"

func main() {
	mxRecords, err := net.LookupMX("google.fr")
	if err != nil {
		panic(err)
	}

	for _, r := range mxRecords {
		println(r.Host, r.Pref)

	}
}
