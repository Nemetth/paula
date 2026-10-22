"use client";

import { useEffect } from "react";
import { toISODate } from "@/lib/domain/dates";

/** Every screen takes "today" once, when it mounts. An installed app left open
 * overnight would keep showing yesterday, so reload when the date turns over. */
export function CambioDeDia() {
  useEffect(() => {
    const abierta = toISODate(new Date());
    const revisar = () => {
      if (toISODate(new Date()) !== abierta) window.location.reload();
    };
    const cada = setInterval(revisar, 60_000);
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);
    return () => {
      clearInterval(cada);
      document.removeEventListener("visibilitychange", revisar);
      window.removeEventListener("focus", revisar);
    };
  }, []);

  return null;
}
