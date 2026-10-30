#!/usr/bin/env python3
"""Post-certbot nginx tweaks for sister demos. Run as root on the VPS."""
from pathlib import Path

AUTISM = Path("/etc/nginx/sites-available/demo.autism.vaidyagogate.org")
FELLOWSHIP = Path("/etc/nginx/sites-available/demo.fellowship.vaidyagogate.org")
AUTISM_BANNER = (
    '<div id="demo-mode-banner" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483000;'
    "background:#b45309;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;"
    'padding:6px 12px;">DEMO MODE — demo.autism.vaidyagogate.org · test data only · '
    "nothing here affects the live site</div>"
)


def rewrite(path: Path, banner: str | None) -> None:
    if not path.exists():
        raise SystemExit(f"missing {path}")
    lines = path.read_text().splitlines(True)
    out = []
    for line in lines:
        if "sub_filter" in line or "Accept-Encoding" in line:
            continue
        if "proxy_hide_header X-Robots-Tag;" in line:
            continue
        if "proxy_pass http://fellowship_demo" in line or "proxy_pass http://autism_demo" in line:
            out.append("        proxy_hide_header X-Robots-Tag;\n")
            if banner:
                out.append('        proxy_set_header Accept-Encoding "";\n')
                out.append(f"        sub_filter \"</body>\" '{banner}</body>';\n")
                out.append("        sub_filter_once on;\n")
            out.append(line)
            continue
        out.append(line)
    path.write_text("".join(out))
    print("patched", path)


if __name__ == "__main__":
    rewrite(FELLOWSHIP, None)
    rewrite(AUTISM, AUTISM_BANNER)
