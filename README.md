# VGMF platform

Next.js website plus four Expo apps (customer, admin, staff, support) for the Vaidya Gogate Memorial Foundation.

**Hosting is the Mumbai VPS**, not Vercel, and **Postgres is on that VPS**, not Neon.

- Staging: https://staging.vaidyagogate.org
- Demo (same four apps, separate databases): http://demo.vaidyagogate.org once DNS exists
- Layout, Nginx, PM2 and DNS: `deploy/vps/README.md`

```bash
npm install
npm run dev
```

Admin → Settings → Domains & DNS holds hostname, CNAME, A, TTL and nameserver fields.
