import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";
import { narrationError, requireOwnedTrack, serializeTrack } from "@/lib/narration/tracks";
import { removeRecordings } from "@/lib/narration/storage";

type RouteContext = { params: Promise<{ trackId: string }> };

/** PATCH /api/narrations/tracks/[trackId] — rename, or mark ready. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { trackId } = await context.params;
    const owned = await requireOwnedTrack(trackId, auth.user.id);
    if ("error" in owned) return owned.error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return narrationError("invalid_request", "Request body must be JSON", 400);
    }

    const { label: rawLabel, status: rawStatus } = body as {
      label?: unknown;
      status?: unknown;
    };

    const data: { label?: string; status?: string } = {};

    if (rawLabel !== undefined) {
      const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
      if (!label || label.length > 80) {
        return narrationError("invalid_request", "label must be 1-80 characters", 400, {
          field: "label",
        });
      }
      data.label = label;
    }

    if (rawStatus !== undefined) {
      if (rawStatus !== "draft" && rawStatus !== "ready") {
        return narrationError("invalid_request", "status must be 'draft' or 'ready'", 400, {
          field: "status",
        });
      }
      data.status = rawStatus;
    }

    if (Object.keys(data).length === 0) {
      return narrationError("invalid_request", "Nothing to update", 400);
    }

    const track = await prisma.user_narration_track.update({
      where: { id: trackId },
      data,
      include: { pages: { include: { page: { select: { page_number: true } } } } },
    });

    return NextResponse.json({ track: serializeTrack(track) });
  } catch (error) {
    console.error("[narration] update track failed:", error);
    return narrationError("internal_error", "Failed to update narration track", 500);
  }
}

/** DELETE /api/narrations/tracks/[trackId] — remove audio objects, then rows. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { trackId } = await context.params;
    const owned = await requireOwnedTrack(trackId, auth.user.id);
    if ("error" in owned) return owned.error;

    const pages = await prisma.user_narration_page.findMany({
      where: { track_id: trackId },
      select: { audio_path: true },
    });

    // Storage first: an orphaned row is repairable, an orphaned object is not
    // discoverable once its row is gone.
    await removeRecordings(pages.map((p) => p.audio_path));

    await prisma.user_narration_track.delete({ where: { id: trackId } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[narration] delete track failed:", error);
    return narrationError("internal_error", "Failed to delete narration track", 500);
  }
}
