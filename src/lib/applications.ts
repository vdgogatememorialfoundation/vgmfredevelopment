import { submitPublic } from "@/lib/public-submit";
import type { Application } from "@/types";

const APPLICATIONS_KEY = "vgmf_applications";

export function getAllApplications(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(APPLICATIONS_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

export function getApplication(applicationId: string): Application | null {
  const id = applicationId.trim().toUpperCase();
  return (
    getAllApplications().find(
      (application) => application.applicationId.toUpperCase() === id
    ) ?? null
  );
}

export function saveApplication(application: Application) {
  if (typeof window === "undefined") return;
  const current = getAllApplications();
  current.unshift(application);
  window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(current));
  void submitPublic("applications", {
    applicationId: application.applicationId,
    eventName: application.eventName,
    name: application.name,
    email: application.email,
    phone: application.phone ?? "",
    appliedAt: application.appliedAt.slice(0, 10),
  });
}