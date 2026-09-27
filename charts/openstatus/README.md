# openstatus Helm chart

Runs the self-hosted stack from [`docker-compose.github-packages.yaml`](../../docker-compose.github-packages.yaml)
on Kubernetes. It follows the [self-hosting guide](https://www.openstatus.dev/docs/guides/self-hosting-openstatus)
step for step; read that first.

| Compose service | Kubernetes |
|---|---|
| `libsql` | StatefulSet + PVC |
| `tinybird-local` | StatefulSet + PVCs |
| `db-migrate` | init container of `workflows` (idempotent) |
| `workflows`, `server`, `private-location`, `checker`, `dashboard`, `status-page` | Deployment + Service |
| Part 2: `tb --local deploy` and the token | `tinybird-bootstrap` post-install/upgrade Job |
| Part 4: `/cron/private-location-health` | CronJob |
| Probe (`private-location` image) | optional Deployment (`probe.enabled`) |

## Install

```bash
helm install openstatus ./charts/openstatus -n openstatus --create-namespace \
  --set urls.dashboard=https://openstatus.example.com \
  --set urls.server=https://api.openstatus.example.com
```

`.env.docker` values go in `env` (plain) and `secrets.extra` or `secrets.existingSecret`
(sensitive). `AUTH_SECRET` and `CRON_SECRET` are generated on first install and kept on upgrade.

Expose the dashboard, status page and API with your own Ingress or Gateway; the chart creates
ClusterIP Services only.

## After install

1. Sign in. With `SELF_HOST=true` the magic link is printed in the dashboard log:
   `kubectl logs deploy/<release>-openstatus-dashboard | grep "Magic Link"`.
2. Set the workspace limits (guide step 9) against the libSQL Service.
3. Create a private location, store its key in a Secret as `OPENSTATUS_KEY`, then enable the probe:
   `--set probe.enabled=true --set probe.existingSecret=<secret>`.

## Values worth knowing

| Key | Default | Notes |
|---|---|---|
| `image.tag` | `latest` | Upstream publishes `latest`, `main` and short-SHA tags. |
| `image.digests` | `{}` | Per-image digest pins (`openstatus-server: sha256:...`). Images are rebuilt only when their app changes, so one SHA tag rarely covers every image. Third-party images take `<component>.image.digest`. |
| `tinybird.bootstrap.sourceUrl` | `main` tarball | Pin to the same commit as `image.tag`. |
| `tinybird.bootstrap.sourceTokenSecret` | unset | Secret with a GitHub token, for a private fork's `api.github.com/.../tarball/<sha>` URL. |
| `tinybird.enabled` | `true` | Set `false` for Tinybird Cloud; provide `TINYBIRD_URL` and `tinybird.existingSecret`. |
| `env.AUTH_OIDC_ISSUER` | unset | Generic OIDC login (`AUTH_OIDC_ID`, `AUTH_OIDC_NAME`; `AUTH_OIDC_SECRET` via `secrets.extra`). |
