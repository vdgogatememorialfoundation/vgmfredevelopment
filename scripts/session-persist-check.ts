/**
 * Browser-less check that admin sessions survive a localStorage wipe
 * until clearSession (Logout).
 */
const store = new Map<string, string>();
const cookies = new Map<string, string>();

function cookieString() {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

const windowMock = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  },
  location: { protocol: "https:" },
  dispatchEvent: () => true,
  addEventListener: () => {},
};

const documentMock = {
  get cookie() {
    return cookieString();
  },
  set cookie(value: string) {
    const [pair] = String(value).split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);
    if (String(value).includes("Max-Age=0")) cookies.delete(name);
    else cookies.set(name, raw);
  },
};

Object.assign(globalThis, {
  window: windowMock,
  document: documentMock,
  Event: class Event {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  },
});

async function main() {
  const { getSession, setSession, clearSession, persistUntilLogoutEnabled } = await import("@/lib/auth");

  const user = {
    id: "usr-admin-001",
    firstName: "Admin",
    lastName: "VGMF",
    email: "admin@vaidyagogate.org",
    phone: "+91 90000 00001",
    whatsapp: "+91 90000 00001",
    role: "admin" as const,
    password: "admin123",
    lastLoginAt: "2026-10-30T12:00:00.000Z",
  };

  if (!persistUntilLogoutEnabled()) throw new Error("persistUntilLogout should default on");

  setSession(user);
  if (getSession()?.email !== user.email) throw new Error("session missing after setSession");
  if (!cookies.has("vgmf_session")) throw new Error("session cookie was not written");
  const cookieRaw = decodeURIComponent(cookies.get("vgmf_session")!);
  if (cookieRaw.includes("admin123")) throw new Error("password leaked into cookie");

  store.delete("vgmf_session");
  const restored = getSession();
  if (restored?.email !== user.email) throw new Error("session did not restore from cookie after localStorage wipe");
  if (!store.get("vgmf_session")) throw new Error("cookie restore did not refill localStorage");

  clearSession();
  if (getSession()) throw new Error("session still present after Logout");
  if (cookies.has("vgmf_session")) throw new Error("cookie still present after Logout");

  console.log("session persist check ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
