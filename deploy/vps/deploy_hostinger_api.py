#!/usr/bin/env python3
"""Deploy staging/demo through the Hostinger API (no SSH).

Hostinger's Docker Manager starts a one-off container on the VPS that enters the host
and runs deploy-web.sh, then the project is removed. Needs HOSTINGER_API_TOKEN
(hPanel -> Account -> API). Usage:
  HOSTINGER_API_TOKEN=... python3 deploy/vps/deploy_hostinger_api.py [branch] [staging] [demo]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://developers.hostinger.com"
VPS_IP = os.environ.get("VPS_IP", "89.116.32.1")
REPO_RAW = "https://raw.githubusercontent.com/vdgogatememorialfoundation/vgmfredevelopment"
PROJECT = "vgmf-deploy"


def call(method, path, body=None):
    token = os.environ.get("HOSTINGER_API_TOKEN", "").strip()
    if not token:
        sys.exit("Set HOSTINGER_API_TOKEN first.")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode() or "null"
            return json.loads(raw)
    except urllib.error.HTTPError as err:
        sys.exit(f"{method} {path} -> HTTP {err.code}: {err.read().decode()[:500]}")


def find_vm():
    vms = call("GET", "/api/vps/v1/virtual-machines")
    for vm in vms if isinstance(vms, list) else vms.get("data", []):
        if VPS_IP in json.dumps(vm):
            return vm["id"]
    sys.exit(f"No virtual machine with IP {VPS_IP} on this Hostinger account.")


def main():
    args = sys.argv[1:]
    branch = args[0] if args else "cursor/delivery-status-9792"
    envs = " ".join(args[1:]) or "staging demo"
    vm = find_vm()
    script = f"curl -fsSL {REPO_RAW}/{branch}/deploy/vps/deploy-web.sh | bash -s -- {branch} {envs}; echo DEPLOY_EXIT=$?"
    compose = "\n".join([
        "services:",
        "  deploy:",
        "    image: ubuntu:24.04",
        "    privileged: true",
        "    pid: host",
        "    network_mode: host",
        '    restart: "no"',
        "    command:",
        *[f"      - {json.dumps(part)}" for part in ["nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--", "bash", "-lc", script]],
        "",
    ])
    print(f"VM {vm}: starting deploy of {branch} -> {envs}")
    call("POST", f"/api/vps/v1/virtual-machines/{vm}/docker", {"project_name": PROJECT, "content": compose})
    seen = 0
    deadline = time.time() + 45 * 60
    exit_line = None
    while time.time() < deadline and not exit_line:
        time.sleep(20)
        logs = call("GET", f"/api/vps/v1/virtual-machines/{vm}/docker/{PROJECT}/logs") or []
        lines = [entry.get("line", "") for svc in logs for entry in svc.get("entries", [])]
        for line in lines[seen:]:
            print(line, flush=True)
            if line.startswith("DEPLOY_EXIT="):
                exit_line = line
        seen = max(seen, len(lines))
    call("DELETE", f"/api/vps/v1/virtual-machines/{vm}/docker/{PROJECT}/down")
    if not exit_line:
        sys.exit("Timed out waiting for the deploy to finish; check the VPS.")
    sys.exit(0 if exit_line == "DEPLOY_EXIT=0" else 1)


if __name__ == "__main__":
    main()
