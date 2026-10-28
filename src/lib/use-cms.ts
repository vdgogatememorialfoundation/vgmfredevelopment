"use client";

import { useSyncExternalStore } from "react";
import { articles as seededArticles } from "@/data/articles";
import { announcements as seededAnnouncements } from "@/data/content";
import { events as seededEvents } from "@/data/events";
import {
  defaultFlags,
  getLiveAnnouncements,
  getLiveArticles,
  getLiveEvents,
  getSiteFlags,
  subscribeCms,
  type SiteFlags,
} from "@/lib/cms";
import type { Announcement, Article, Event } from "@/types";

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
