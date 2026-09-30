import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/**
 * Subscribe to Postgres changes on one or more tables and invalidate the
 * matching React Query caches so open pages update without a refresh.
 */
export function useRealtime(tables: string[], keys: unknown[][], filter?: string) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");
  const cacheKey = JSON.stringify(keys);

  useEffect(() => {
    const channel = api.channel(`rt:${tableKey}:${filter ?? "all"}:${Math.random().toString(36).slice(2)}`);

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table },
        () => {
          for (const key of keys) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
        },
      );
    }

    channel.subscribe();

    return () => {
      void api.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, cacheKey, filter]);
}
