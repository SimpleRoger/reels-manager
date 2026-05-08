import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

function msUntilSydney7am(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0");
  const elapsed = h * 3600 + m * 60 + s;
  const until = 7 * 3600 - elapsed;
  return (until <= 0 ? until + 86400 : until) * 1000;
}

export function useScheduledRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = msUntilSydney7am();
      timeout = setTimeout(() => {
        queryClient.invalidateQueries();
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeout);
  }, [queryClient]);
}
