import { siteConfig } from "@/lib/constants";

export const FOUNDATION_NAME = siteConfig.name;

export function applyFoundationBrand(text: string) {
  return text.replace(/\bVGMF\b(?!-)/g, FOUNDATION_NAME);
}

export function wrapFoundationEmail(innerHtml: string) {
  if (innerHtml.includes("data-foundation-email")) return innerHtml;
  return `<!DOCTYPE html>
<html>
<body data-foundation-email="1" style="margin:0;background:#f4efe6;padding:24px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eadfce">
    <tr>
      <td style="background:#6b1c23;padding:22px 28px">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#ffffff">${FOUNDATION_NAME}</p>
        <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#f3d9a4">${siteConfig.tagline}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:#1f2a24">${innerHtml}</td>
    </tr>
    <tr>
      <td style="padding:18px 28px;background:#faf6f0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b645c">
        Warm regards,<br/>${FOUNDATION_NAME}<br/>
        <a href="${siteConfig.url}" style="color:#6b1c23">${siteConfig.url.replace(/^https?:\/\//, "")}</a>
        · ${siteConfig.email}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
