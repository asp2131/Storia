import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SoundscapeAsset = {
  name: string;
  size?: number | null;
  updatedAt?: string | null;
  url: string;
};

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function buildClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bucket =
    url.searchParams.get("bucket") ||
    process.env.SUPABASE_SOUNDSCAPE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BUCKET ||
    "storia-storage";
  const basePath =
    url.searchParams.get("basePath") ||
    process.env.SUPABASE_SOUNDSCAPE_BASE_PATH ||
    process.env.NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BASE_PATH ||
    "audio/curated";

  const supabase = buildClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server listing.",
      },
      { status: 500 }
    );
  }

  const { data: folderData, error: listError } = await supabase.storage
    .from(bucket)
    .list(basePath, {
      limit: 200,
      sortBy: { column: "name", order: "asc" },
    });

  if (listError) {
    return NextResponse.json(
      { error: listError.message || "Failed to list soundscape folders." },
      { status: 500 }
    );
  }

  const folders =
    folderData
      ?.filter((item) => item.id === null || item.metadata === null)
      .map((item) => item.name)
      .filter(Boolean) ?? [];

  const baseFiles =
    folderData
      ?.filter((item) => item.id !== null || item.metadata?.size != null)
      .map((item) => {
        const filePath = `${basePath}/${item.name}`;
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        return {
          name: item.name,
          size: item.metadata?.size ?? null,
          updatedAt: item.updated_at ?? null,
          url: urlData.publicUrl,
        };
      }) ?? [];

  const categoriesMap: Record<string, SoundscapeAsset[]> = {};

  for (const folder of folders) {
    const folderPath = `${basePath}/${folder}`;
    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucket)
      .list(folderPath, {
        limit: 500,
        sortBy: { column: "updated_at", order: "desc" },
      });

    if (fileError) {
      continue;
    }

    const files =
      fileData
        ?.filter((item) => item.id !== null || item.metadata?.size != null)
        .map((item) => {
          const filePath = `${folderPath}/${item.name}`;
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

          return {
            name: item.name,
            size: item.metadata?.size ?? null,
            updatedAt: item.updated_at ?? null,
            url: urlData.publicUrl,
          };
        }) ?? [];

    categoriesMap[folder] = files;
  }

  if (baseFiles.length > 0) {
    categoriesMap["uncategorized"] = baseFiles;
  }

  return NextResponse.json({
    bucket,
    basePath,
    categories: categoriesMap,
  });
}
