import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { platformEnv } from "@/lib/platform";

const HOSTED_ROOT = "/VGMF-PLATFORM/data";

export function vgmfDataDir() {
  if (process.env.VGMF_DATA_DIR) return process.env.VGMF_DATA_DIR;
  const env = platformEnv();
  if (env === "staging" || env === "demo" || env === "production") {
    return join(/* turbopackIgnore: true */ HOSTED_ROOT, env);
  }
  return join(/* turbopackIgnore: true */ process.cwd(), "data");
}

export function ensureDataDir(subdir = "") {
  const base = vgmfDataDir();
  const dir = subdir ? join(/* turbopackIgnore: true */ base, subdir) : base;
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* read-only host */
  }
  return dir;
}

export function dataFile(...parts: string[]) {
  return join(/* turbopackIgnore: true */ ensureDataDir(), ...parts);
}
