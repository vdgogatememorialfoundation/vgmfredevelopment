const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, idx)] = value;
  }
  return env;
}

const secrets = "/VGMF-PLATFORM/secrets";

module.exports = {
  apps: [
    {
      name: "fellowship-demo",
      cwd: "/var/www/demo.fellowship.vaidyagogate.org",
      script: "scripts/start-with-keepalive.mjs",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3013",
        ...loadEnv(path.join(secrets, "fellowship-demo.env")),
      },
    },
    {
      name: "autism-demo",
      cwd: "/var/www/demo.autism.vaidyagogate.org",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3014",
        ...loadEnv(path.join(secrets, "autism-demo.env")),
      },
    },
  ],
};
