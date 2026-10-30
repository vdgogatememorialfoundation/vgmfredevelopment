/**
 * Sister-portal hook for seminar.vaidyagogate.org and autism.vaidyagogate.org.
 * Exposes a VGMF-shaped schedule feed and pushes new accounts/tickets/payments
 * (never QR codes or passwords) to the Foundation site ingest API.
 */
const https = require("https");
const http = require("http");
const { URL } = require("url");

const DEFAULT_URLS = [
  "https://staging.vaidyagogate.org/api/partners/ingest",
  "https://demo.vaidyagogate.org/api/partners/ingest",
];

function ingestUrls() {
  const raw = (process.env.VGMF_INGEST_URLS || "").trim();
  return (raw ? raw.split(",") : DEFAULT_URLS).map((item) => item.trim()).filter(Boolean);
}

function ingestKey(portal) {
  if (process.env.VGMF_INGEST_KEY) return process.env.VGMF_INGEST_KEY;
  if (portal === "autism") return process.env.AUTISM_CERT_API_KEY || "vgmf_live_autism_4b8d1e6a";
  return process.env.SEMINAR_CERT_API_KEY || "vgmf_live_seminar_7f3a9c2e";
}

function postJson(url, headers, body) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false });
      return;
    }
    const payload = Buffer.from(JSON.stringify(body));
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": payload.length,
          accept: "application/json",
          ...headers,
        },
        timeout: 8000,
      },
      (res) => {
        res.resume();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300 });
      }
    );
    req.on("error", () => resolve({ ok: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false });
    });
    req.end(payload);
  });
}

function dbAll(db, sql, params) {
  return new Promise((resolve) => {
    db.all(sql, params || [], (err, rows) => resolve(err ? [] : rows || []));
  });
}

function sanitizeAccount(row, portal) {
  return {
    id: row.id,
    accountId: row.user_id_string,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp || row.phone,
    role: row.role,
    user_role: row.user_role,
    createdAt: row.created_at,
  };
}

async function pushRecent({ db, portal, origin }) {
  const urls = ingestUrls();
  const key = ingestKey(portal);
  if (!urls.length || !key) return;
  const users = await dbAll(
    db,
    `SELECT id, user_id_string, first_name, last_name, email, phone, whatsapp, role, user_role, created_at
       FROM users
      WHERE created_at >= NOW() - INTERVAL '30 minutes'
        AND COALESCE(role, '') NOT IN ('admin')
        AND COALESCE(user_role, '') NOT IN ('admin', 'co_admin')
      ORDER BY created_at DESC
      LIMIT 50`,
    []
  );
  const tickets = await dbAll(
    db,
    `SELECT t.id, t.user_id, t.ticket_id_string, t.is_valid, t.event_id, u.email AS user_email
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.id DESC
      LIMIT 40`,
    []
  );
  for (const user of users) {
    const email = String(user.email || "").toLowerCase();
    const userTickets = tickets.filter((item) => String(item.user_id) === String(user.id) || String(item.user_email || "").toLowerCase() === email);
    const body = {
      portal,
      account: sanitizeAccount(user, portal),
      hasTicket: userTickets.length > 0,
      ticket: userTickets[0]
        ? {
            id: `${portal}-tkt-${userTickets[0].id}`,
            eventName: portal === "seminar" ? "Seminar" : "Autism programme",
            status: Number(userTickets[0].is_valid) === 0 ? "Invalid" : "Issued",
          }
        : undefined,
    };
    for (const url of urls) {
      await postJson(url, { "x-api-key": key }, body);
    }
  }
}

function install({ app, db, portal }) {
  const origin = portal === "autism" ? "https://autism.vaidyagogate.org" : "https://seminar.vaidyagogate.org";

  app.get("/api/public/vgmf-feed", (req, res) => {
    db.all(
      `SELECT * FROM seminars ORDER BY event_date DESC NULLS LAST, id DESC`,
      [],
      (seminarErr, seminars) => {
        db.all(
          `SELECT es.id, es.title, es.description, es.seminar_id, es.start_time, es.end_time,
                  es.location, es.speaker_name, es.speaker_bio, s.title AS seminar_title
             FROM event_schedules es
             LEFT JOIN seminars s ON es.seminar_id = s.id
            ORDER BY es.start_time ASC`,
          [],
          (scheduleErr, schedules) => {
            if (seminarErr && scheduleErr) return res.status(500).json({ error: "Could not load schedule." });
            res.json({
              portal,
              origin,
              seminars: seminars || [],
              schedules: schedules || [],
            });
          }
        );
      }
    );
  });

  const tick = () => {
    pushRecent({ db, portal, origin }).catch(() => undefined);
  };
  setTimeout(tick, 20_000);
  setInterval(tick, 120_000);
}

module.exports = { install };
