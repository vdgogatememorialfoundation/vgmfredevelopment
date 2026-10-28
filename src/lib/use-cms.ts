"use client";

import { useSyncExternalStore } from "react";
import { articles as seededArticles } from "@/data/articles";
import { announcements as seededAnnouncements } from "@/data/content";
import { events as seededEvents } from "@/data/events";
import { clinics as seededClinics } from "@/data/clinics";
import { flyers as seededFlyers, notices as seededNotices } from "@/data/content";
import { videos as seededVideos } from "@/data/videos";
import {
  clinicKeys,
  defaultFlags,
  flyerKeys,
  getLiveAnnouncements,
  getLiveArticles,
  getLiveClinics,
  getLiveEvents,
  getLiveFlyers,
  getLiveNotices,
  getLiveVideos,
  getSiteFlags,
  noticeKeys,
  subscribeCms,
  videoKeys,
  type SiteFlags,
} from "@/lib/cms";
import type { Announcement, Article, Clinic, Event, Flyer, Notice, Video } from "@/types";

let articleRaw = "\0";
let articleList: Article[] = seededArticles;
let announcementRaw = "\0";
let announcementList: Announcement[] = seededAnnouncements;
let eventRaw = "\0";
let eventList: Event[] = seededEvents;
let flagRaw = "\0";
let flagValue: SiteFlags = defaultFlags;

export function useLiveArticles() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = `${window.localStorage.getItem("vgmf_article_edits") ?? ""}|${window.localStorage.getItem("vgmf_custom_articles") ?? ""}`;
      if (raw === articleRaw) return articleList;
      articleRaw = raw;
      articleList = raw === "|" ? seededArticles : getLiveArticles();
      return articleList;
    },
    () => seededArticles
  );
}

export function useLiveAnnouncements() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = `${window.localStorage.getItem("vgmf_announcement_edits") ?? ""}|${window.localStorage.getItem("vgmf_custom_announcements") ?? ""}`;
      if (raw === announcementRaw) return announcementList;
      announcementRaw = raw;
      announcementList = raw === "|" ? seededAnnouncements : getLiveAnnouncements();
      return announcementList;
    },
    () => seededAnnouncements
  );
}

export function useLiveEvents() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = `${window.localStorage.getItem("vgmf_event_edits") ?? ""}|${window.localStorage.getItem("vgmf_custom_events") ?? ""}`;
      if (raw === eventRaw) return eventList;
      eventRaw = raw;
      eventList = raw === "|" ? seededEvents : getLiveEvents();
      return eventList;
    },
    () => seededEvents
  );
}

export function collectionHook<T>(editsKey: string, customKey: string, seed: T[], read: () => T[]) {
  let rawCache = "\0";
  let valueCache = seed;
  return function useCollection() {
    return useSyncExternalStore(
      subscribeCms,
      () => {
        const raw = `${window.localStorage.getItem(editsKey) ?? ""}|${window.localStorage.getItem(customKey) ?? ""}`;
        if (raw === rawCache) return valueCache;
        rawCache = raw;
        valueCache = raw === "|" ? seed : read();
        return valueCache;
      },
      () => seed
    );
  };
}

export const useLiveNotices = collectionHook<Notice>(noticeKeys.edits, noticeKeys.custom, seededNotices, getLiveNotices);
export const useLiveFlyers = collectionHook<Flyer>(flyerKeys.edits, flyerKeys.custom, seededFlyers, getLiveFlyers);
export const useLiveVideos = collectionHook<Video>(videoKeys.edits, videoKeys.custom, seededVideos, getLiveVideos);
export const useLiveClinics = collectionHook<Clinic>(clinicKeys.edits, clinicKeys.custom, seededClinics, getLiveClinics);

export function useSiteFlags() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem("vgmf_site_flags") ?? "";
      if (raw === flagRaw) return flagValue;
      flagRaw = raw;
      flagValue = raw ? getSiteFlags() : defaultFlags;
      return flagValue;
    },
    () => defaultFlags
  );
}
