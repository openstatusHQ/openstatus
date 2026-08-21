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
