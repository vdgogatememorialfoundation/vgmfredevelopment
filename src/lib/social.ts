import { siteConfig } from "@/lib/constants";
import type { SocialLinks } from "@/types";

export const SOCIAL_NETWORKS = [
  { id: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/…" },
  { id: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/…" },
  { id: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/…" },
  { id: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/…" },
  { id: "twitter", label: "X (Twitter)", placeholder: "https://x.com/…" },
  { id: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/91…" },
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];

export function emptySocial(): SocialLinks {
  return {
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    twitter: "",
    whatsapp: "",
  };
}

export function isPublicSocialUrl(url?: string) {
  const value = (url ?? "").trim();
  if (!value || value === "#") return false;
  return /^https?:\/\//i.test(value);
}

export function mergeSocial(social?: Partial<SocialLinks> | null): SocialLinks {
  return {
    ...emptySocial(),
    ...siteConfig.social,
    ...(social ?? {}),
  };
}

export function configuredSocial(social?: Partial<SocialLinks> | null) {
  const merged = mergeSocial(social);
  return SOCIAL_NETWORKS.filter((network) => isPublicSocialUrl(merged[network.id])).map((network) => ({
    ...network,
    href: merged[network.id]!.trim(),
  }));
}
