# Private Location Orchestrator


A server that allows private regions to register and ingest data from them.

## ICMP monitors

ICMP (ping) monitors run from the checker agent. Sending ICMP echo requests
needs one of the following on the host running the agent:

- **Unprivileged datagram sockets** — set `net.ipv4.ping_group_range` to a range
  that includes the agent's GID (e.g. `sysctl -w net.ipv4.ping_group_range="0 2147483647"`).
  The agent prefers this path and needs no elevated capabilities.
- **Raw sockets** — grant the binary `CAP_NET_RAW` (`setcap cap_net_raw+ep <binary>`)
  or run it as root. The agent falls back to this automatically when datagram
  sockets are unavailable.

Without either, ICMP checks fail to open a socket and are reported as errors.

## gRPC monitors

gRPC monitors call `grpc.health.v1.Health/Check` on the target. Unlike ICMP they
open an ordinary TCP connection, so the agent needs no elevated capabilities and
no `ping_group_range` change.

The monitor's TLS mode decides how the connection is secured:

- `plaintext` — h2c, for a service behind a mesh or load balancer that has
  already terminated TLS.
- `tls` — verify the certificate against the host's trust store.
- `tls_insecure` — use TLS but skip certificate verification, for internal
  services presenting a self-signed or mesh-issued certificate.

A server that is reachable but has not registered the health service answers
`UNIMPLEMENTED`, which is reported with its own message rather than as "down".
