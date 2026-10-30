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
| `demo.fellowship.vaidyagogate.org` | Demo copy of `fellowship.vaidyagogate.org` |
| `demo.autism.vaidyagogate.org` | Demo copy of `autism.vaidyagogate.org` |
| `demo.seminar.vaidyagogate.org` | Existing seminar demo |

After `demo` / `stagging` resolve, issue certs:

```
certbot --nginx -d demo.vaidyagogate.org
certbot --nginx --expand -d staging.vaidyagogate.org -d stagging.vaidyagogate.org
certbot --nginx -d demo.fellowship.vaidyagogate.org
certbot --nginx -d demo.autism.vaidyagogate.org
```

Enable `nginx-ssl-default.conf` (`ssl_reject_handshake` on the default HTTPS server). Without it, a hostname that has an A record but no certificate is served by the first SSL vhost on this machine (`autism.vaidyagogate.org`). That is why `https://demo.vaidyagogate.org` briefly showed the live autism site until its own Let's Encrypt certificate was issued.

Admin → Settings → Domains & DNS holds hostname, CNAME, A, TTL, nameserver, per-app URL and sister-site (fellowship / autism / seminar) fields.

## Sister demos (fellowship + autism)

Same pattern as `demo.seminar.vaidyagogate.org`: a cloned tree, a cloned Postgres database, a new port, and `DEMO_MODE=1`. Live sites are not modified.

```
/VGMF-PLATFORM/postgres/demo/fellowship   → database vgmf_demo_fellowship (owner vgmf_user)
/VGMF-PLATFORM/postgres/demo/autism       → database vgmf_demo_autism (owner autism_user)
/var/www/demo.fellowship.vaidyagogate.org → PM2 fellowship-demo, 127.0.0.1:3013
/var/www/demo.autism.vaidyagogate.org     → PM2 autism-demo, 127.0.0.1:3014
```

On the VPS:

```
bash /VGMF-PLATFORM/deploy/provision-sister-demos.sh
```

Fellowship is rebuilt so `NEXT_PUBLIC_APP_URL` is `https://demo.fellowship.vaidyagogate.org`. Autism reads `PUBLIC_BASE_URL` at runtime. Both stay noindex.

## Processes

- Staging: `127.0.0.1:3005` behind nginx (`vgmf-staging`)
- Demo: `127.0.0.1:3012` behind nginx (`vgmf-demo`)
- Fellowship demo: `127.0.0.1:3013` (`fellowship-demo`)
- Autism demo: `127.0.0.1:3014` (`autism-demo`)

Copy `deploy/vps/ecosystem.config.cjs` to `/VGMF-PLATFORM/ecosystem.config.cjs` and run `pm2 start /VGMF-PLATFORM/ecosystem.config.cjs`. Sister demos use `ecosystem-sister-demos.config.cjs`.

Do not deploy this repo on Vercel. `vercel.json` skips Git auto-deploys. Disconnect the Vercel GitHub app in the Vercel dashboard if older PR branches still trigger iad1 builds.
