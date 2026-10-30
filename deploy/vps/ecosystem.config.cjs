const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

const secrets = "/VGMF-PLATFORM/secrets";
const stagingEnv = loadEnv(path.join(secrets, "staging.env"));
const demoEnv = loadEnv(path.join(secrets, "demo.env"));

module.exports = {
  apps: [
    {
      name: "vgmf-staging",
      cwd: "/VGMF-PLATFORM/apps/staging",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3005",
        ...stagingEnv,
      },
    },
    {
      name: "vgmf-demo",
      cwd: "/VGMF-PLATFORM/apps/demo",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3012",
        ...demoEnv,
      },
    },
    {
      name: "vgmf-ingest-fellowship",
      cwd: "/VGMF-PLATFORM",
      script: "bin/vgmf-ingest.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        VGMF_INGEST_PORTAL: "fellowship",
        DATABASE_URL: stagingEnv.FELLOWSHIP_DATABASE_URL || "",
      },
    },
  ],
};
