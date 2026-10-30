import {
  APEX_DOMAIN,
  DEMO_HOST,
  PLATFORM_APPS,
  PLATFORM_ENVIRONMENTS,
  PRODUCTION_HOST,
  STAGING_ALIAS_HOST,
  STAGING_HOST,
  VPS_HOSTNAME,
  VPS_IPV4,
  appStartPath,
  originFromHost,
  type PlatformApp,
  type PlatformEnvironment,
} from "@/lib/platform";

export const DOMAIN_SETTINGS_KEY = "vgmf_domain_settings";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "CAA" | "SRV";

export type DnsRecord = {
  id: string;
  environment: PlatformEnvironment;
  app: PlatformApp | "platform";
  type: DnsRecordType;
  host: string;
  value: string;
  ttl: number;
  priority?: number;
  proxied?: boolean;
  notes?: string;
};

export type EnvironmentDomain = {
  label: string;
  hostname: string;
  aliasHostnames: string[];
  canonicalUrl: string;
  wwwHostname: string;
  ipv4: string;
  ipv6: string;
  cnameHost: string;
  cnameTarget: string;
  ttl: number;
  nameservers: string[];
  sslEmail: string;
  forceHttps: boolean;
  indexPublic: boolean;
  apps: Record<PlatformApp, { hostname: string; path: string; publicUrl: string }>;
};

export type DomainSettings = {
  apexDomain: string;
  vpsHostname: string;
  vpsIpv4: string;
  vpsIpv6: string;
  defaultTtl: number;
  sslEmail: string;
  nameservers: string[];
  environments: Record<PlatformEnvironment, EnvironmentDomain>;
  records: DnsRecord[];
  updatedAt?: string;
};

function emptyAppHosts(hostname: string): Record<PlatformApp, { hostname: string; path: string; publicUrl: string }> {
  return Object.fromEntries(
    PLATFORM_APPS.map((app) => {
      const path = appStartPath(app);
      return [app, { hostname, path, publicUrl: `${originFromHost(hostname)}${path === "/" ? "" : path}` }];
    })
  ) as Record<PlatformApp, { hostname: string; path: string; publicUrl: string }>;
}

function environmentDomain(
  label: string,
  hostname: string,
  options: { aliases?: string[]; indexPublic: boolean; www?: string }
): EnvironmentDomain {
  return {
    label,
    hostname,
    aliasHostnames: options.aliases ?? [],
    canonicalUrl: originFromHost(hostname),
    wwwHostname: options.www ?? "",
    ipv4: VPS_IPV4,
    ipv6: "",
    cnameHost: hostname,
    cnameTarget: VPS_HOSTNAME,
    ttl: 300,
    nameservers: [],
    sslEmail: "admin@vaidyagogate.org",
    forceHttps: true,
    indexPublic: options.indexPublic,
    apps: emptyAppHosts(hostname),
  };
}

export function defaultDomainSettings(): DomainSettings {
  return {
    apexDomain: APEX_DOMAIN,
    vpsHostname: VPS_HOSTNAME,
    vpsIpv4: VPS_IPV4,
    vpsIpv6: "",
    defaultTtl: 300,
    sslEmail: "admin@vaidyagogate.org",
    nameservers: [],
    environments: {
      staging: environmentDomain("Staging", STAGING_HOST, {
        aliases: [STAGING_ALIAS_HOST],
        indexPublic: false,
      }),
      demo: environmentDomain("Demo", DEMO_HOST, { indexPublic: false }),
      production: environmentDomain("Production", PRODUCTION_HOST, {
        aliases: [`www.${PRODUCTION_HOST}`],
        indexPublic: true,
        www: `www.${PRODUCTION_HOST}`,
      }),
    },
    records: defaultDnsRecords(),
  };
}

export function defaultDnsRecords(): DnsRecord[] {
  const ttl = 300;
  return [
    {
      id: "staging-a",
      environment: "staging",
      app: "platform",
      type: "A",
      host: STAGING_HOST,
      value: VPS_IPV4,
      ttl,
      notes: "User-requested staging hostname (spelling: stagging).",
    },
    {
      id: "staging-alias-a",
      environment: "staging",
      app: "platform",
      type: "A",
      host: STAGING_ALIAS_HOST,
      value: VPS_IPV4,
      ttl,
      notes: "Already pointed at the Mumbai VPS and has a Let's Encrypt certificate.",
    },
    {
      id: "staging-cname",
      environment: "staging",
      app: "platform",
      type: "CNAME",
      host: STAGING_HOST,
      value: `${VPS_HOSTNAME}.`,
      ttl,
      notes: "Use CNAME *or* A, not both, for the same host.",
    },
    {
      id: "demo-a",
      environment: "demo",
      app: "platform",
      type: "A",
      host: DEMO_HOST,
      value: VPS_IPV4,
      ttl,
      notes: "Demo copy of customer, admin, staff and support.",
    },
    {
      id: "demo-cname",
      environment: "demo",
      app: "platform",
      type: "CNAME",
      host: DEMO_HOST,
      value: `${VPS_HOSTNAME}.`,
      ttl,
      notes: "Optional CNAME to the VPS hostname instead of an A record.",
    },
    ...PLATFORM_APPS.flatMap((app) => [
      {
        id: `staging-app-${app}`,
        environment: "staging" as const,
        app,
        type: "A" as const,
        host: STAGING_HOST,
        value: VPS_IPV4,
        ttl,
        notes: `${app} app is served from ${originFromHost(STAGING_HOST)}${appStartPath(app) === "/" ? "" : appStartPath(app)}`,
      },
      {
        id: `demo-app-${app}`,
        environment: "demo" as const,
        app,
        type: "A" as const,
        host: DEMO_HOST,
        value: VPS_IPV4,
        ttl,
        notes: `${app} demo is served from ${originFromHost(DEMO_HOST)}${appStartPath(app) === "/" ? "" : appStartPath(app)}`,
      },
    ]),
  ];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function sanitizeAppHosts(
  hostname: string,
  incoming?: Partial<Record<PlatformApp, Partial<EnvironmentDomain["apps"][PlatformApp]>>>
): EnvironmentDomain["apps"] {
  const base = emptyAppHosts(hostname);
  for (const app of PLATFORM_APPS) {
    const row = incoming?.[app];
    const host = asString(row?.hostname, hostname) || hostname;
    const path = asString(row?.path, appStartPath(app)) || appStartPath(app);
    const publicUrl = asString(row?.publicUrl) || `${originFromHost(host)}${path === "/" ? "" : path}`;
    base[app] = { hostname: host, path, publicUrl };
  }
  return base;
}

function sanitizeEnvironment(label: string, hostname: string, incoming?: Partial<EnvironmentDomain>, indexPublic = false): EnvironmentDomain {
  const aliases = hostname === STAGING_HOST ? [STAGING_ALIAS_HOST] : hostname === PRODUCTION_HOST ? [`www.${PRODUCTION_HOST}`] : [];
  const defaults = environmentDomain(label, hostname, {
    indexPublic,
    aliases,
    www: hostname === PRODUCTION_HOST ? `www.${PRODUCTION_HOST}` : "",
  });
  if (!incoming) return defaults;
  const mergedHost = asString(incoming.hostname, hostname) || hostname;
  return {
    ...defaults,
    ...incoming,
    label: asString(incoming.label, label) || label,
    hostname: mergedHost,
    aliasHostnames: incoming.aliasHostnames != null ? asStringList(incoming.aliasHostnames) : defaults.aliasHostnames,
    canonicalUrl: asString(incoming.canonicalUrl, originFromHost(mergedHost)) || originFromHost(mergedHost),
    wwwHostname: asString(incoming.wwwHostname, defaults.wwwHostname),
    ipv4: asString(incoming.ipv4, VPS_IPV4) || VPS_IPV4,
    ipv6: asString(incoming.ipv6),
    cnameHost: asString(incoming.cnameHost, mergedHost) || mergedHost,
    cnameTarget: asString(incoming.cnameTarget, VPS_HOSTNAME) || VPS_HOSTNAME,
    ttl: asNumber(incoming.ttl, 300),
    nameservers: incoming.nameservers != null ? asStringList(incoming.nameservers) : defaults.nameservers,
    sslEmail: asString(incoming.sslEmail, "admin@vaidyagogate.org"),
    forceHttps: incoming.forceHttps !== false,
    indexPublic: incoming.indexPublic ?? indexPublic,
    apps: sanitizeAppHosts(mergedHost, incoming.apps),
  };
}

const DNS_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "CAA", "SRV"];

function sanitizeRecord(record: Partial<DnsRecord>, index: number): DnsRecord | null {
  const type = DNS_TYPES.includes(record.type as DnsRecordType) ? (record.type as DnsRecordType) : "A";
  const host = asString(record.host).trim();
  const value = asString(record.value).trim();
  if (!host || !value) return null;
  const environment = PLATFORM_ENVIRONMENTS.includes(record.environment as PlatformEnvironment)
    ? (record.environment as PlatformEnvironment)
    : "staging";
  const app: DnsRecord["app"] =
    record.app === "platform" || PLATFORM_APPS.includes(record.app as PlatformApp)
      ? (record.app as DnsRecord["app"])
      : "platform";
  return {
    id: asString(record.id) || `dns-${index}-${host}`,
    environment,
    app,
    type,
    host,
    value,
    ttl: asNumber(record.ttl, 300),
    priority: typeof record.priority === "number" ? record.priority : undefined,
    proxied: record.proxied === true,
    notes: asString(record.notes),
  };
}

export function sanitizeDomainSettings(input?: Partial<DomainSettings> | null): DomainSettings {
  const defaults = defaultDomainSettings();
  if (!input) return defaults;
  return {
    apexDomain: asString(input.apexDomain, defaults.apexDomain) || defaults.apexDomain,
    vpsHostname: asString(input.vpsHostname, defaults.vpsHostname) || defaults.vpsHostname,
    vpsIpv4: asString(input.vpsIpv4, defaults.vpsIpv4) || defaults.vpsIpv4,
    vpsIpv6: asString(input.vpsIpv6),
    defaultTtl: asNumber(input.defaultTtl, defaults.defaultTtl),
    sslEmail: asString(input.sslEmail, defaults.sslEmail),
    nameservers: asStringList(input.nameservers),
    environments: {
      staging: sanitizeEnvironment("Staging", STAGING_HOST, input.environments?.staging, false),
      demo: sanitizeEnvironment("Demo", DEMO_HOST, input.environments?.demo, false),
      production: sanitizeEnvironment("Production", PRODUCTION_HOST, input.environments?.production, true),
    },
    records: Array.isArray(input.records)
      ? input.records.map((record, index) => sanitizeRecord(record, index)).filter((row): row is DnsRecord => Boolean(row))
      : defaults.records,
    updatedAt: asString(input.updatedAt) || undefined,
  };
}

export function dnsZoneSnippet(settings: DomainSettings) {
  const lines = [
    `; VGMF DNS — point these at ${settings.vpsIpv4} (${settings.vpsHostname})`,
    `$ORIGIN ${settings.apexDomain}.`,
    `$TTL ${settings.defaultTtl}`,
    ...settings.records.map((record) => {
      const host = record.host.replace(new RegExp(`\\.?${settings.apexDomain}$`), "") || "@";
      const pri = record.type === "MX" || record.type === "SRV" ? `${record.priority ?? 10} ` : "";
      return `${host.padEnd(24)} ${String(record.ttl).padEnd(6)} IN ${record.type.padEnd(6)} ${pri}${record.value}`;
    }),
  ];
  return lines.join("\n");
}

export function getDomainSettings(): DomainSettings {
  if (typeof window === "undefined") return defaultDomainSettings();
  try {
    const raw = window.localStorage.getItem(DOMAIN_SETTINGS_KEY);
    return raw ? sanitizeDomainSettings(JSON.parse(raw) as Partial<DomainSettings>) : defaultDomainSettings();
  } catch {
    return defaultDomainSettings();
  }
}

export function saveDomainSettings(settings: DomainSettings) {
  if (typeof window === "undefined") return;
  const next = sanitizeDomainSettings({ ...settings, updatedAt: new Date().toISOString() });
  window.localStorage.setItem(DOMAIN_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vgmf-cms"));
  return next;
}
