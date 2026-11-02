"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { SEMINAR_ADSENSE_CLIENT, seminarDisplaySlot, seminarSavedTag, seminarVideoAdTag } from "@/lib/seminar-ads";

type Access = {
  allowed?: boolean;
  reason?: string | null;
  detail?: string;
  checks?: {
    registered?: boolean;
    paid?: boolean;
    paidAbsent?: boolean;
    attendedCertified?: boolean;
    paidOther?: boolean;
    volunteer?: boolean;
  };
};

type SeminarVideo = {
  id: number;
  year: number;
  title: string;
  description?: string;
  kind: string;
  albumId?: number | null;
  partNo?: number | null;
  priceInr?: number;
  priceMode?: string;
  priceTbd?: boolean;
  personalPrice?: boolean;
  listPriceInr?: number;
  seminarTitle?: string;
  durationSec?: number | null;
  positionSec?: number;
  access?: Access;
};

type SeminarYear = {
  year: number;
  title: string;
  description?: string;
  allAllowed?: boolean;
  bundlePriceInr?: number | null;
  priceTbd?: boolean;
  videos: SeminarVideo[];
};

type Ads = { enabled?: boolean; adsenseClient?: string; adsenseSlot?: string; imaAdTag?: string };

type Catalog = {
  years?: SeminarYear[];
  pendingPurchases?: { id: number; video_id?: number | null; year?: number; status?: string }[];
  ads?: Ads;
  license?: string;
  maxDevices?: number;
  blocked?: number;
  viewer?: { volunteer?: boolean };
};

type PaymentOption = { id: string; gateway?: string; mode?: string };

declare global {
  interface Window {
    Hls?: {
      isSupported: () => boolean;
      Events: { ERROR: string; MANIFEST_PARSED: string };
      ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string };
      new (config: Record<string, unknown>): {
        loadSource: (url: string) => void;
        attachMedia: (video: HTMLVideoElement) => void;
        on: (event: string, handler: (event: string, data?: { fatal?: boolean; type?: string; response?: { code?: number } }) => void) => void;
        destroy: () => void;
        stopLoad: () => void;
        startLoad: () => void;
        recoverMediaError: () => void;
      };
    };
    adsbygoogle?: unknown[];
    google?: { ima?: ImaNamespace };
  }
}

type ImaAdsManager = {
  init: (width: number, height: number, viewMode: string) => void;
  start: () => void;
  destroy: () => void;
  addEventListener: (type: string, handler: () => void) => void;
};

type ImaAdsLoader = {
  requestAds: (request: {
    adTagUrl: string;
    linearAdSlotWidth: number;
    linearAdSlotHeight: number;
    nonLinearAdSlotWidth: number;
    nonLinearAdSlotHeight: number;
  }) => void;
  contentComplete: () => void;
  destroy: () => void;
  addEventListener: (
    type: string,
    handler: (event: { getAdsManager?: (video: HTMLVideoElement, settings: { restoreCustomPlaybackStateOnAdBreakComplete: boolean }) => ImaAdsManager }) => void,
    capture?: boolean
  ) => void;
};

type ImaNamespace = {
  settings: { setDisableCustomPlaybackForIOS10Plus: (value: boolean) => void };
  AdDisplayContainer: new (container: HTMLElement, video: HTMLVideoElement) => { initialize: () => void; destroy: () => void };
  AdsLoader: new (display: { initialize: () => void }) => ImaAdsLoader;
  AdsRequest: new () => {
    adTagUrl: string;
    linearAdSlotWidth: number;
    linearAdSlotHeight: number;
    nonLinearAdSlotWidth: number;
    nonLinearAdSlotHeight: number;
  };
  AdsRenderingSettings: new () => { restoreCustomPlaybackStateOnAdBreakComplete: boolean };
  AdErrorEvent: { Type: { AD_ERROR: string } };
  AdEvent: { Type: { CONTENT_PAUSE_REQUESTED: string; CONTENT_RESUME_REQUESTED: string; ALL_ADS_COMPLETED: string } };
  AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
  ViewMode: { NORMAL: string };
};

type AdRuntime = {
  loader: ImaAdsLoader;
  manager: ImaAdsManager | null;
  savedTag: string;
  timeout: number;
  cancelled: boolean;
  onEnded: (() => void) | null;
  onTime: (() => void) | null;
  settle: (() => void) | null;
};

const HLS_SRC = "https://seminar.vaidyagogate.org/vendor/hls.light.min.js?v=1.7.3";
const IMA_SRC = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
const MIDROLL_AFTER_SEC = 8 * 60;

function money(value?: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function durationLabel(sec?: number | null) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  if (!total) return "";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours} h${minutes ? ` ${minutes} min` : ""}`;
  return minutes ? `${minutes} min` : `${total} sec`;
}

function accessLabel(access?: Access) {
  if (!access?.allowed) return "";
  if (access.reason === "volunteer") return "Free for volunteers";
  if (access.reason === "attended_certified" || access.reason === "paid_other") return "Free — you paid and attended";
  if (access.reason === "paid_absent") return "Free — you paid for this seminar";
  if (access.reason === "purchase") return "Purchased";
  if (access.reason === "admin_paid") return "Payment recorded by the seminar office";
  if (access.reason === "public") return "Free";
  return "Enabled by the seminar office";
}

function whyLocked(access?: Access) {
  const checks = access?.checks || {};
  if (access?.reason === "blocked") return "The seminar office has turned this video off for your account.";
  if (!checks.registered) return "You did not register for this seminar, so this recording is paid.";
  if (!checks.paid) return "Your registration fee is not paid yet, so this recording is not included.";
  if (checks.paidOther) return "You are checked in. This recording opens for that group when the office enables it, or you can unlock it.";
  return access?.detail || "Unlock this recording to watch it.";
}

function deviceId() {
  const key = "vgmf_seminar_video_device";
  let id = window.localStorage.getItem(key) || "";
  if (!/^[a-f0-9]{32}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(key, id);
  }
  return id;
}

function loadScript(src: string, marker: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-${marker}]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "1") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset[marker] = "1";
    script.onload = () => {
      script.setAttribute("data-loaded", "1");
      resolve();
    };
    script.onerror = () => reject(new Error("Could not load."));
    document.head.appendChild(script);
  });
}

function AdBanner({ slot }: { slot: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (!slot || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* this unit was already filled */
    }
  }, [slot]);
  if (!slot) return null;
  return (
    <ins
      className="adsbygoogle my-4 block"
      style={{ display: "block" }}
      data-ad-client={SEMINAR_ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

export function SeminarVideoLibrary() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adDisplayRef = useRef<{ initialize: () => void; destroy: () => void } | null>(null);
  const adsRef = useRef<AdRuntime | null>(null);
  const phaseRef = useRef<"idle" | "pre" | "content" | "mid" | "post">("idle");
  const midRef = useRef(false);
  const hlsRef = useRef<{ destroy: () => void; stopLoad: () => void; startLoad: () => void; recoverMediaError: () => void } | null>(null);
  const playRef = useRef<{ token: string; videoId: number; timer: number } | null>(null);
  const catalogRef = useRef<Catalog | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [payments, setPayments] = useState<PaymentOption[]>([]);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "" });
  const [linked, setLinked] = useState(true);
  const [note, setNote] = useState("");
  const [payNote, setPayNote] = useState("");
  const [qr, setQr] = useState("");
  const [playerTitle, setPlayerTitle] = useState("");
  const [watermark, setWatermark] = useState("");
  const [adOn, setAdOn] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/seminar-videos", { credentials: "same-origin", cache: "no-store" });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        linked?: boolean;
        error?: string;
        catalog?: Catalog;
        paymentOptions?: PaymentOption[];
        viewer?: { name?: string; email?: string; phone?: string };
      } | null;
      if (response.status === 401) {
        setNote("Sign in to watch seminar videos.");
        return;
      }
      if (!data?.ok && data?.linked !== false) throw new Error(data?.error || "Seminar videos could not be loaded.");
      setLinked(data.linked !== false);
      setCatalog(data.catalog || null);
      setPayments(data.paymentOptions || []);
      setProfile({ name: data.viewer?.name || "", email: data.viewer?.email || "", phone: data.viewer?.phone || "" });
      setNote(data.linked === false ? data.error || "" : "");
    } catch (error) {
      setCatalog(null);
      setLinked(false);
      setNote((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    void loadScript(IMA_SRC, "vgmfIma").catch(() => undefined);
  }, [user]);

  const releaseAds = useCallback((video: HTMLVideoElement | null) => {
    const runtime = adsRef.current;
    phaseRef.current = "idle";
    midRef.current = false;
    if (runtime) {
      runtime.cancelled = true;
      runtime.settle = null;
      window.clearTimeout(runtime.timeout);
      if (video && runtime.onEnded) video.removeEventListener("ended", runtime.onEnded);
      if (video && runtime.onTime) video.removeEventListener("timeupdate", runtime.onTime);
      try {
        runtime.manager?.destroy();
      } catch {
        /* already closed */
      }
      try {
        runtime.loader.destroy();
      } catch {
        /* already closed */
      }
      adsRef.current = null;
    }
    try {
      adDisplayRef.current?.destroy();
    } catch {
      /* the ad display was already closed */
    }
    adDisplayRef.current = null;
    setAdOn(false);
  }, []);

  const ensureDisplay = useCallback((video: HTMLVideoElement) => {
    const ima = window.google?.ima;
    const container = adContainerRef.current;
    if (!ima || !container) return false;
    ima.settings.setDisableCustomPlaybackForIOS10Plus(true);
    if (!adDisplayRef.current) {
      adDisplayRef.current = new ima.AdDisplayContainer(container, video);
      try {
        adDisplayRef.current.initialize();
      } catch {
        /* the display container was already initialized for this gesture */
      }
    }
    return true;
  }, []);

  const openLoader = useCallback((video: HTMLVideoElement, savedTag: string) => {
    const ima = window.google?.ima;
    if (!ima || !adDisplayRef.current) return null;
    const loader = new ima.AdsLoader(adDisplayRef.current);
    const runtime: AdRuntime = {
      loader,
      manager: null,
      savedTag,
      timeout: 0,
      cancelled: false,
      onEnded: null,
      onTime: null,
      settle: null,
    };
    adsRef.current = runtime;
    loader.addEventListener(
      ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (event) => {
        const current = adsRef.current;
        if (!current || current.cancelled || !event.getAdsManager) return;
        const rendering = new ima.AdsRenderingSettings();
        rendering.restoreCustomPlaybackStateOnAdBreakComplete = true;
        let manager: ImaAdsManager;
        try {
          manager = event.getAdsManager(video, rendering);
        } catch {
          current.settle?.();
          return;
        }
        try {
          current.manager?.destroy();
        } catch {
          /* the previous break already ended */
        }
        current.manager = manager;
        const stage = adContainerRef.current?.parentElement;
        const width = stage?.clientWidth || 640;
        const height = stage?.clientHeight || 360;
        manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => current.settle?.());
        manager.addEventListener(ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
          window.clearTimeout(current.timeout);
          setAdOn(true);
          try {
            video.pause();
          } catch {
            /* the ad overlay owns playback */
          }
        });
        manager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => current.settle?.());
        manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
          setAdOn(false);
          current.settle?.();
        });
        try {
          manager.init(width, height, ima.ViewMode.NORMAL);
          manager.start();
        } catch {
          current.settle?.();
        }
      },
      false
    );
    loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => adsRef.current?.settle?.(), false);
    return runtime;
  }, []);

  const requestBreak = useCallback((when: "pre" | "mid" | "post", offsetMs: number, onDone: () => void) => {
    const ima = window.google?.ima;
    const runtime = adsRef.current;
    const video = videoRef.current;
    const container = adContainerRef.current;
    if (!ima || !runtime || runtime.cancelled || !video || !container) {
      onDone();
      return;
    }
    phaseRef.current = when === "mid" ? "mid" : when === "post" ? "post" : "pre";
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(runtime.timeout);
      runtime.settle = null;
      setAdOn(false);
      if (runtime.cancelled) return;
      phaseRef.current = when === "post" ? "idle" : "content";
      onDone();
    };
    runtime.settle = settle;
    runtime.timeout = window.setTimeout(settle, 12000);
    const stage = container.parentElement;
    const width = stage?.clientWidth || 640;
    const height = stage?.clientHeight || 360;
    const request = new ima.AdsRequest();
    request.adTagUrl = runtime.savedTag || seminarVideoAdTag(window.location.href, when, offsetMs);
    request.linearAdSlotWidth = width;
    request.linearAdSlotHeight = height;
    request.nonLinearAdSlotWidth = width;
    request.nonLinearAdSlotHeight = 150;
    try {
      runtime.loader.requestAds(request);
    } catch {
      settle();
    }
  }, []);

  const armContentAds = useCallback((video: HTMLVideoElement, durationHint: number) => {
    const runtime = adsRef.current;
    if (!runtime || runtime.cancelled) return;
    const onEnded = () => {
      if (phaseRef.current !== "content") return;
      if (runtime.savedTag) {
        try {
          runtime.loader.contentComplete();
        } catch {
          /* the saved tag has no post-roll */
        }
        return;
      }
      requestBreak("post", 0, () => undefined);
    };
    const onTime = () => {
      if (runtime.savedTag || runtime.cancelled || midRef.current || phaseRef.current !== "content") return;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationHint;
      if (duration < MIDROLL_AFTER_SEC) return;
      const mark = duration / 2;
      if (video.currentTime > mark + 15) {
        midRef.current = true;
        return;
      }
      if (video.currentTime < Math.max(60, mark)) return;
      midRef.current = true;
      requestBreak("mid", Math.round(video.currentTime * 1000), () => {
        void video.play().catch(() => undefined);
      });
    };
    runtime.onEnded = onEnded;
    runtime.onTime = onTime;
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTime);
  }, [requestBreak]);

  const stop = useCallback((silent = false) => {
    const current = playRef.current;
    const video = videoRef.current;
    releaseAds(video);
    if (current) {
      window.clearInterval(current.timer);
      const position = video ? video.currentTime : null;
      void fetch("/api/seminar-videos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ action: "progress", videoId: current.videoId, token: current.token, positionSec: position }),
      }).catch(() => undefined);
      void fetch("/api/seminar-videos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ action: "end", videoId: current.videoId, token: current.token }),
      }).catch(() => undefined);
      playRef.current = null;
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        /* already closed */
      }
      hlsRef.current = null;
    }
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (!silent) {
      setPlayerTitle("");
      setWatermark("");
    }
  }, [releaseAds]);

  useEffect(() => () => stop(true), [stop]);

  const watch = async (videoId: number, title: string, durationSec?: number | null) => {
    stop(true);
    flushSync(() => {
      setPlayerTitle(title);
      setAdOn(false);
    });
    setPayNote("");
    setNote("Preparing secure playback…");
    const primed = videoRef.current;
    if (primed) ensureDisplay(primed);
    try {
      const [response] = await Promise.all([
        fetch("/api/seminar-videos", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "session", videoId, deviceId: deviceId() }),
        }),
        loadScript(IMA_SRC, "vgmfIma").catch(() => undefined),
      ]);
      const session = (await response.json().catch(() => null)) as {
        error?: string;
        playlistUrl?: string;
        token?: string;
        positionSec?: number;
        watermark?: { license?: string; name?: string; id?: string };
      } | null;
      if (!response.ok || !session?.playlistUrl || !session.token) throw new Error(session?.error || "This recording is locked.");
      const playlistUrl = session.playlistUrl;
      const video = videoRef.current;
      if (!video) return;
      const mark = [session.watermark?.license, session.watermark?.name, session.watermark?.id].filter(Boolean).join(" · ");
      setWatermark(mark);
      setNote("");
      const start = Number(session.positionSec) || 0;
      const token = session.token;
      const durationHint = Number(durationSec) || 0;
      const begin = () => {
        phaseRef.current = "content";
        armContentAds(video, durationHint);
        if (start > 5) {
          try {
            video.currentTime = start;
          } catch {
            /* the browser will start at zero */
          }
        }
        void video.play().catch(() => undefined);
      };
      const startPlayback = async () => {
        playRef.current = {
          token,
          videoId,
          timer: window.setInterval(() => {
            void fetch("/api/seminar-videos", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "progress", videoId, token, positionSec: video.currentTime }),
            }).catch(() => undefined);
          }, 15000),
        };
        if (video.canPlayType("application/vnd.apple.mpegurl") && !window.MediaSource) {
          video.src = playlistUrl;
          video.addEventListener("loadedmetadata", begin, { once: true });
          return;
        }
        await loadScript(HLS_SRC, "vgmfHls");
        const Hls = window.Hls;
        if (!Hls || !Hls.isSupported()) throw new Error("This browser cannot play protected video. Use a current Chrome, Edge, Firefox, or Safari.");
        const hls = new Hls({
          enableWorker: false,
          xhrSetup: (xhr: XMLHttpRequest) => {
            xhr.setRequestHeader("X-Vgmf-Device", deviceId());
          },
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, begin);
        hls.on(Hls.Events.ERROR, (_event, err) => {
          if (err?.response?.code === 403 || err?.response?.code === 410) setNote("Playback stopped because this video was opened somewhere else. Press Watch to continue here.");
          else if (err?.fatal && err.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (err?.fatal && err.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        });
        hls.loadSource(playlistUrl);
        hls.attachMedia(video);
      };
      const saved = seminarSavedTag(catalogRef.current?.ads?.imaAdTag);
      try {
        if (ensureDisplay(video)) openLoader(video, saved);
      } catch {
        releaseAds(video);
      }
      if (adsRef.current) requestBreak("pre", 0, () => void startPlayback().catch((error: Error) => setNote(error.message)));
      else await startPlayback();
    } catch (error) {
      setNote((error as Error).message);
    }
  };

  const checkPayment = async (purchaseId: number) => {
    const response = await fetch("/api/seminar-videos", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "status", purchaseId }),
    });
    const data = (await response.json().catch(() => null)) as { paid?: boolean; error?: string } | null;
    if (!response.ok) throw new Error(data?.error || "The payment could not be checked.");
    if (data?.paid) await load();
    else setPayNote("The payment has not been seen yet. If you have paid, wait a minute and check again.");
    return Boolean(data?.paid);
  };

  const buy = async (target: { videoId?: number; year?: number }) => {
    setQr("");
    setPayNote("Starting payment…");
    const razor = payments.find((option) => option.gateway === "razorpay" && option.mode === "live") || payments.find((option) => option.gateway === "razorpay");
    if (!razor) {
      setPayNote("Razorpay is not available right now. Contact the seminar office and they can unlock the video after payment.");
      return;
    }
    const response = await fetch("/api/seminar-videos", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "purchase", videoId: target.videoId ?? null, year: target.year ?? null, mid: razor.id }),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      purchaseId?: number;
      paymentType?: string;
      amount?: number;
      qrImageUrl?: string;
      message?: string;
      keyId?: string;
      label?: string;
      razorpayOrder?: { id: string; amount: number; currency?: string };
    } | null;
    if (!response.ok || !result?.purchaseId) {
      setPayNote(result?.error || "Payment could not be started.");
      return;
    }
    if (result.paymentType === "dqr" && result.qrImageUrl) {
      setQr(result.qrImageUrl);
      setPayNote(result.message || `Scan the UPI QR to pay ${money(result.amount)}.`);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        if (await checkPayment(result.purchaseId).catch(() => false)) {
          setQr("");
          setPayNote("Payment received. The video is unlocked.");
          return;
        }
      }
      return;
    }
    if (result.paymentType !== "razorpay_checkout" || !result.keyId || !result.razorpayOrder) {
      setPayNote(result.message || "Payment started.");
      return;
    }
    try {
      await loadScript("https://checkout.razorpay.com/v1/checkout.js", "vgmfRazorpay");
    } catch {
      setPayNote("Razorpay did not load. Disable ad blockers and try again.");
      return;
    }
    if (!window.Razorpay) {
      setPayNote("Razorpay did not load. Disable ad blockers and try again.");
      return;
    }
    const purchaseId = result.purchaseId;
    const checkout = new window.Razorpay({
      key: result.keyId,
      amount: result.razorpayOrder.amount,
      currency: result.razorpayOrder.currency || "INR",
      name: "Vaidya Gogate Memorial Foundation",
      description: result.label || "Seminar video access",
      order_id: result.razorpayOrder.id,
      prefill: { name: profile.name, email: profile.email, contact: profile.phone },
      theme: { color: "#8F2D2D" },
      handler: (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        void fetch("/api/seminar-videos", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "verify", purchaseId, ...payment }),
        })
          .then(async (verifyResponse) => {
            const verify = (await verifyResponse.json().catch(() => null)) as { error?: string } | null;
            if (!verifyResponse.ok) throw new Error(verify?.error || "Payment could not be confirmed.");
            setPayNote("Payment received. The video is unlocked.");
            void load();
          })
          .catch((error: Error) => setPayNote(error.message));
      },
      modal: { ondismiss: () => setPayNote("Payment window closed. You can try again.") },
    });
    checkout.on("payment.failed", (payload) => {
      const description = payload && typeof payload === "object" && "error" in payload ? (payload as { error?: { description?: string } }).error?.description : "";
      setPayNote(description || "Payment failed. You can try again.");
    });
    checkout.open();
  };

  const years = catalog?.years || [];
  const pending = catalog?.pendingPurchases || [];
  const slot = seminarDisplaySlot(catalog?.ads);

  return (
    <div className="space-y-6">
      <AdBanner slot={slot} />
      {!user && (
        <div className="rounded-2xl border border-border bg-white p-6">
          <p className="text-sm text-text-muted">Sign in to watch seminar videos.</p>
          <Link href="/login?next=/videos/seminars" className="btn-primary mt-4 inline-flex">Sign in</Link>
        </div>
      )}
      {user && loading && <p className="text-sm text-text-muted">Loading seminar videos…</p>}
      {user && !loading && !linked && <p className="rounded-2xl border border-border bg-white p-6 text-sm text-text-muted">{note}</p>}
      {playerTitle && (
        <>
          <AdBanner slot={slot} />
          <div className="overflow-hidden rounded-2xl border border-border bg-black">
            <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white">
              <p className="text-sm font-semibold">{playerTitle}</p>
              <button type="button" className="text-xs font-semibold text-white/80" onClick={() => stop(false)}>Close</button>
            </div>
            <div className="relative">
              <video
                ref={videoRef}
                controls
                playsInline
                controlsList="nodownload noremoteplayback noplaybackrate"
                className="aspect-video w-full bg-black"
                onContextMenu={(event) => event.preventDefault()}
              />
              <div ref={adContainerRef} className={`absolute inset-0 ${adOn ? "z-20" : "pointer-events-none"}`} />
              {watermark && !adOn && <p className="pointer-events-none absolute bottom-14 right-3 z-10 max-w-[70%] rounded bg-black/50 px-2 py-1 text-[10px] text-white">{watermark}</p>}
            </div>
          </div>
          <AdBanner slot={slot} />
        </>
      )}
      {payNote && <p className="text-sm text-text-primary">{payNote}</p>}
      {qr && <img src={qr} alt="UPI payment QR" className="h-52 w-52 rounded-xl border border-border bg-white p-2" />}
      {user && linked && !loading && years.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-sm text-text-muted">
          No recordings are published yet.
        </p>
      )}
      {years.map((year) => {
        const albums = year.videos.filter((item) => item.kind === "album");
        const albumIds = new Set(albums.map((item) => item.id));
        const singles = year.videos.filter((item) => item.kind !== "album" && !(item.albumId && albumIds.has(item.albumId)));
        const partsOf = (albumId: number) => year.videos.filter((item) => item.kind !== "album" && item.albumId === albumId);
        return (
          <section key={year.year} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-ink">{year.title || `Seminar ${year.year}`}</h2>
              </div>
              {year.priceTbd && !year.allAllowed ? (
                <span className="text-xs font-semibold text-text-muted">Price will be updated later</span>
              ) : year.bundlePriceInr && year.bundlePriceInr > 0 && !year.allAllowed ? (
                <button type="button" className="btn-outline" onClick={() => void buy({ year: year.year })}>Unlock all {year.year} videos · {money(year.bundlePriceInr)}</button>
              ) : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {albums.map((album) => (
                <article key={album.id} className="rounded-2xl border border-border bg-white p-5 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-burgundy">Album</p>
                  <h3 className="mt-1 font-semibold text-ink">{album.title}</h3>
                  <div className="mt-3">{renderActions(album, true)}</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {partsOf(album.id).map((part) => (
                      <div key={part.id} className="rounded-xl border border-border p-4">{renderCard(part, true)}</div>
                    ))}
                  </div>
                </article>
              ))}
              {singles.map((item) => (
                <article key={item.id} className="rounded-2xl border border-border bg-white p-5">{renderCard(item, false)}</article>
              ))}
            </div>
          </section>
        );
      })}
      {user && linked && note && !playerTitle && <p className="text-sm text-text-primary">{note}</p>}
    </div>
  );

  function renderActions(item: SeminarVideo, insideAlbum = false) {
    const waiting = pending.find((row) => row.video_id === item.id || (item.albumId && row.video_id === item.albumId) || (!row.video_id && row.year === item.year));
    if (item.access?.allowed && item.kind !== "album") {
      const resume = (item.positionSec || 0) > 30;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={() => void watch(item.id, item.title, item.durationSec)}>{resume ? "Resume" : "Watch"}</button>
          <span className="text-xs font-semibold text-emerald-800">{accessLabel(item.access)}</span>
        </div>
      );
    }
    if (item.access?.allowed && item.kind === "album") {
      return <span className="text-xs font-semibold text-emerald-800">{accessLabel(item.access)} · all parts</span>;
    }
    if (waiting) {
      return (
        <button type="button" className="btn-outline" onClick={() => void checkPayment(waiting.id).catch((error: Error) => setPayNote(error.message))}>
          Check payment
        </button>
      );
    }
    if (item.priceTbd && !item.personalPrice) return <p className="text-xs text-text-muted">Price will be updated later. {whyLocked(item.access)}</p>;
    if (insideAlbum && item.kind !== "album") return <p className="text-xs text-text-muted">Unlocks with the album. {whyLocked(item.access)}</p>;
    if ((item.priceInr || 0) > 0) {
      return (
        <div className="space-y-1">
          <button type="button" className="btn-primary" onClick={() => void buy({ videoId: item.id })}>Unlock · {money(item.priceInr)}</button>
          <p className="text-xs text-text-muted">{whyLocked(item.access)}</p>
        </div>
      );
    }
    return <p className="text-xs text-text-muted">{whyLocked(item.access)}</p>;
  }

  function renderCard(item: SeminarVideo, insideAlbum: boolean) {
    return (
      <>
        <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>{item.kind === "full" ? "Single video" : `Part ${item.partNo ?? ""}`.trim()}</span>
          <span>{durationLabel(item.durationSec)}</span>
        </div>
        <h3 className="mt-2 font-semibold text-ink">{item.title}</h3>
        {item.seminarTitle && <p className="mt-1 text-xs text-burgundy">{item.seminarTitle}</p>}
        <div className="mt-3">{renderActions(item, insideAlbum)}</div>
      </>
    );
  }
}
