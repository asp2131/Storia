"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatorTextStyle } from "@/types/text-overlay";

const KEY = ["creator-text-style"] as const;

/** The signed-in creator's saved default for new text boxes (null = use the book style). */
export function useCreatorTextStyle() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<CreatorTextStyle | null> => {
      const res = await fetch("/api/admin/text-style");
      // A failed load only means new boxes use the book style; never block the editor on it.
      if (!res.ok) return null;
      return ((await res.json()) as { style: CreatorTextStyle | null }).style;
    },
    staleTime: Infinity,
  });

  const { mutateAsync } = useMutation({
    mutationFn: async (style: CreatorTextStyle): Promise<CreatorTextStyle> => {
      const res = await fetch("/api/admin/text-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style }),
      });
      if (!res.ok) throw new Error("Could not save the text style.");
      return ((await res.json()) as { style: CreatorTextStyle }).style;
    },
    onSuccess: (style) => queryClient.setQueryData(KEY, style),
  });

  return { creatorStyle: data ?? null, saveCreatorStyle: mutateAsync };
}
