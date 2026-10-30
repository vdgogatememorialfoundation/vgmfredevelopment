# VGMF on the Mumbai VPS

This Next.js site and the four Expo apps (customer, admin, staff, support) run on Hostinger KVM `srv1787209.hstgr.cloud` (`89.116.32.1`). They do not use Vercel or Neon.

## Layout

```
/VGMF-PLATFORM/
  postgres/                 tablespaces (owned by postgres)
    platform/
    staging/{customer,admin,staff,support}/
    demo/{customer,admin,staff,support}/
  apps/{staging,demo}/      Next.js standalone builds
  data/{staging,demo}/      published feed and domain JSON
  secrets/                  env files (mode 600, not in git)
```

Databases: `vgmf_{staging|demo}_{platform,customer,admin,staff,support}`.

## DNS at the registrar

Add A records to `89.116.32.1` (or CNAME to `srv1787209.hstgr.cloud`, not both for the same host):

| Host | Purpose |
| --- | --- |
| `staging.vaidyagogate.org` | Already pointed here; TLS exists |
| `stagging.vaidyagogate.org` | Requested staging spelling |
| `demo.vaidyagogate.org` | Demo of all four apps |

After `demo` / `stagging` resolve, issue certs:

```
certbot --nginx -d demo.vaidyagogate.org
certbot --nginx --expand -d staging.vaidyagogate.org -d stagging.vaidyagogate.org
```

Admin → Settings → Domains & DNS holds hostname, CNAME, A, TTL, nameserver and per-app URL fields.

## Processes

- Staging: `127.0.0.1:3005` behind nginx (`vgmf-staging`)
- Demo: `127.0.0.1:3012` behind nginx (`vgmf-demo`)

Copy `deploy/vps/ecosystem.config.cjs` to `/VGMF-PLATFORM/ecosystem.config.cjs` and run `pm2 start /VGMF-PLATFORM/ecosystem.config.cjs`.

Do not deploy this repo on Vercel. `vercel.json` skips Git auto-deploys. Disconnect the Vercel GitHub app in the Vercel dashboard if older PR branches still trigger iad1 builds.
