"use client";

import { useEffect, useState } from "react";
import { mergeNotices, type AnyNotice, type PublicNotice } from "@/lib/notice-display";
import { fetchNotices } from "@/lib/notices-client";
import { useLiveNotices } from "@/lib/use-cms";

export function useMergedNotices() {
  const local = useLiveNotices();
  const [remote, setRemote] = useState<PublicNotice[] | null>(null);

  useEffect(() => {
    fetchNotices()
      .then(setRemote)
      .catch(() => setRemote([]));
  }, []);

  return {
    notices: mergeNotices(remote, local) as AnyNotice[],
    ready: remote !== null,
  };
}
