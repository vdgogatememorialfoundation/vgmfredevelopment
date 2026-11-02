"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";

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

type Ads = { enabled?: boolean; adsenseClient?: string; adsenseSlot?: string };

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
  }
}

const HLS_SRC = "https://seminar.vaidyagogate.org/vendor/hls.light.min.js?v=1.7.3";

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

function AdBanner({ ads }: { ads?: Ads }) {
  const pushed = useRef(false);
  const client = ads?.enabled && ads.adsenseClient && ads.adsenseSlot ? ads.adsenseClient : "";
  const slot = ads?.enabled ? ads.adsenseSlot || "" : "";
  useEffect(() => {
    if (!client || !slot || pushed.current) return;
    pushed.current = true;
    void loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`, "vgmfAdsense")
      .then(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          /* the unit was already filled */
        }
      })
      .catch(() => undefined);
  }, [client, slot]);
  if (!client || !slot) return null;
  return (
    <ins
      className="adsbygoogle my-4 block min-h-24"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

export function SeminarVideoLibrary() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void; stopLoad: () => void } | null>(null);
  const playRef = useRef<{ token: string; videoId: number; timer: number } | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [payments, setPayments] = useState<PaymentOption[]>([]);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "" });
  const [linked, setLinked] = useState(true);
  const [note, setNote] = useState("");
  const [payNote, setPayNote] = useState("");
  const [qr, setQr] = useState("");
  const [playerTitle, setPlayerTitle] = useState("");
  const [watermark, setWatermark] = useState("");
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
    void load();
  }, [load]);

  const stop = useCallback((silent = false) => {
    const current = playRef.current;
    const video = videoRef.current;
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
  }, []);

  useEffect(() => () => stop(true), [stop]);

  const watch = async (videoId: number, title: string) => {
    stop(true);
    setPlayerTitle(title);
    setPayNote("");
    setNote("Preparing secure playback…");
    try {
      const response = await fetch("/api/seminar-videos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "session", videoId, deviceId: deviceId() }),
      });
      const session = (await response.json().catch(() => null)) as {
        error?: string;
        playlistUrl?: string;
        token?: string;
        positionSec?: number;
        watermark?: { license?: string; name?: string; id?: string };
      } | null;
      if (!response.ok || !session?.playlistUrl || !session.token) throw new Error(session?.error || "This recording is locked.");
      const video = videoRef.current;
      if (!video) return;
      const mark = [session.watermark?.license, session.watermark?.name, session.watermark?.id].filter(Boolean).join(" · ");
      setWatermark(mark);
      setNote("");
      const start = Number(session.positionSec) || 0;
      const begin = () => {
        if (start > 5) {
          try {
            video.currentTime = start;
          } catch {
            /* the browser will start at zero */
          }
        }
        void video.play().catch(() => undefined);
      };
      const token = session.token;
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
        video.src = session.playlistUrl;
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
      hls.loadSource(session.playlistUrl);
      hls.attachMedia(video);
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
  const ads = catalog?.ads;

  return (
    <div className="space-y-6">
      <AdBanner ads={ads} />
      {!user && (
        <div className="rounded-2xl border border-border bg-white p-6">
          <p className="text-sm text-text-muted">Sign in with the email or phone on your seminar account. Volunteers and people who paid for that seminar watch here without another charge. Anyone who did not register can buy the recording.</p>
          <Link href="/login?next=/videos/seminars" className="btn-primary mt-4 inline-flex">Sign in</Link>
        </div>
      )}
      {user && loading && <p className="text-sm text-text-muted">Loading seminar videos…</p>}
      {user && !loading && !linked && <p className="rounded-2xl border border-border bg-white p-6 text-sm text-text-muted">{note}</p>}
      {playerTitle && (
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
            {watermark && <p className="pointer-events-none absolute bottom-14 right-3 max-w-[70%] rounded bg-black/50 px-2 py-1 text-[10px] text-white">{watermark}</p>}
          </div>
        </div>
      )}
      {payNote && <p className="text-sm text-text-primary">{payNote}</p>}
      {qr && <img src={qr} alt="UPI payment QR" className="h-52 w-52 rounded-xl border border-border bg-white p-2" />}
      {user && linked && !loading && years.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-sm text-text-muted">
          {catalog?.blocked
            ? "The seminar office has turned off your access to these recordings."
            : catalog?.viewer?.volunteer
              ? "Seminar videos are free for volunteer accounts. Recordings appear here after the seminar office publishes them."
              : "Seminar recordings appear here once the seminar office publishes them."}
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
                {year.description && <p className="mt-1 text-sm text-text-muted">{year.description}</p>}
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
                  {album.description && <p className="mt-2 text-sm text-text-muted">{album.description}</p>}
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
          <button type="button" className="btn-primary" onClick={() => void watch(item.id, item.title)}>{resume ? "Resume" : "Watch"}</button>
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
        {item.description && <p className="mt-2 text-sm text-text-muted">{item.description.length > 180 ? `${item.description.slice(0, 177)}…` : item.description}</p>}
        <div className="mt-3">{renderActions(item, insideAlbum)}</div>
      </>
    );
  }
}
