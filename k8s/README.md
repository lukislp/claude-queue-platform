# k8s/

Manifests for running [claude-queue-platform](../README.md) on the real cluster
(`pinode01`/`pinode02`, k3s, arm64).

Onboarded into the cluster-wide [homelab-infra](https://github.com/lukislp/homelab-infra)
Flux GitOps pattern - this repo owns its own Flux wiring (`k8s/flux/`), rather than a
central repo managing it on this repo's behalf. `03-redis.yaml`, `04-api.yaml` and
`05-web.yaml` are **Flux-managed**: `k8s/flux/` watches GHCR for new `api`/`web` image
tags and auto-bumps the `$imagepolicy`-marked image lines, `k8s/flux-deploy/kustomization.yaml`
is the subset Flux actually applies. Everything else (`00-namespace.yaml`,
`01-secrets-sealed.yaml`, `02-postgres.yaml`, `06-routes.yaml`, `07-netpol.yaml`) stays
**bootstrap-only** - applied once by hand, never touched by Flux (homelab-infra's
`flux/01-reconciler-rbac.yaml` least-privilege ClusterRole doesn't grant those kinds).

## Bootstrap (once)

```bash
export KUBECONFIG=$env:USERPROFILE\.kube\studylife-config   # PowerShell

# 1. the bootstrap-only resources (namespace, SealedSecret, CNPG cluster, routes, NetworkPolicies)
kubectl apply -k k8s/

# 2. wire this repo into Flux - additive, doesn't touch any other app's objects
kubectl apply -f k8s/flux/
flux get sources git claude-queue-platform
flux get kustomizations claude-queue-deploy
```

After step 2, Flux applies `03-redis.yaml`, `04-api.yaml` and `05-web.yaml` on its own
(5-minute reconcile interval) - no manual `kubectl apply -f k8s/04-api.yaml` needed, and
image-automation-controller commits new image tags to `main` automatically as they're
published.

Regenerating the SealedSecret (e.g. after a secret rotation): see the command in
`01-secrets-sealed.yaml`'s header.

## Exposing it (manual, outside this repo)

The HTTPRoutes (`06-routes.yaml`) stay in this repo, not `homelab-infra` - same as every
other app-specific route.

1. **Gateway listeners**: `studylife-gateway` (in `nginx-gateway`) needs four listeners -
   `claudequeue.heim.lan`, `claudequeue.lukas2311-homelab.com`,
   `claudequeue-api.heim.lan`, `claudequeue-api.lukas2311-homelab.com` - added live via a
   surgical, append-only `kubectl patch --type=json` (see that Gateway's own documented
   incident for why never a wholesale re-`apply`), then backfilled into homelab-infra.
2. **DNS**: point `claudequeue.heim.lan` and `claudequeue-api.heim.lan` at the Gateway's
   MetalLB IP.
3. **Public name** (optional): NGINX Proxy Manager proxy hosts forwarding the
   `lukas2311-homelab.com` names to their `heim.lan` counterparts.

Until DNS/NPM are done, reach the app via port-forward instead (see below) - it works
fully, it's just not reachable via its normal hostname.

## First-time setup

```bash
kubectl -n claude-queue port-forward svc/web 3000:3000
kubectl -n claude-queue port-forward svc/api 4000:4000
```

Open `http://localhost:3000/register`, create an account, then follow the platform
README's "Ersten Nutzer anlegen und testen" section.

## Watch it

```bash
kubectl -n claude-queue get pods
kubectl -n claude-queue logs -f deploy/api
kubectl -n claude-queue logs -f deploy/web
flux logs --kind ImageUpdateAutomation --name claude-queue-platform -n flux-system
```

## Tear down

```bash
kubectl delete -f k8s/flux/       # stop Flux from reconciling/recreating the app Deployments first
kubectl delete -k k8s/
kubectl delete namespace claude-queue
```
