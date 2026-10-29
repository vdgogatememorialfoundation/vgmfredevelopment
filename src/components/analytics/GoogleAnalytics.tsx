"use client";

import { useEffect } from "react";
import { getSettings } from "@/lib/admin-store";

export function GoogleAnalytics() {
  useEffect(() => {
    const id = getSettings().apiKeys.googleAnalytics?.trim();
    if (!id || document.getElementById("vgmf-ga")) return;

    const script = document.createElement("script");
    script.id = "vgmf-ga";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);

    const inline = document.createElement("script");
    inline.id = "vgmf-ga-inline";
    inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id.replace(/'/g, "")}',{anonymize_ip:true});`;
    document.head.appendChild(inline);
  }, []);

  return null;
}
