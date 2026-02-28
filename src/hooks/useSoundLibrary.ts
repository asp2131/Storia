import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type SoundAsset = {
  name: string;
  size?: number | null;
  updatedAt?: string | null;
  url: string;
  category: string;
};

export type SoundLibraryData = {
  categories: Record<string, SoundAsset[]>;
};

export function useSoundLibrary() {
  return useQuery({
    queryKey: ["sound-library"],
    queryFn: async (): Promise<SoundLibraryData> => {
      const response = await fetch("/api/soundscapes");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load sound library");
      }
      const data = await response.json();
      return { categories: data.categories ?? {} };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadAudio(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<{
      url: string;
      path: string;
      name: string;
      size: number;
    }> => {
      const formData = new FormData();
      formData.append("file", file);
      if (bookId) formData.append("bookId", bookId);

      const response = await fetch("/api/admin/audio-uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to upload audio");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sound-library"] });
    },
  });
}
