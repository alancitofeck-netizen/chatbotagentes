import { NextResponse, type NextRequest } from "next/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getValidGoogleDriveAccessToken, downloadDriveFile } from "@/lib/integrations/googleDrive";

/** Streams a live (not-yet-imported) Drive file's bytes through our own
 * server — the browser never sees the stored OAuth access token, same
 * reasoning as every other integration in this codebase that keeps tokens
 * server-only. Used by the "Descargar" action in the Google Drive browser
 * tab; already-imported documents just use the existing getDownloadUrl
 * (Supabase Storage signed URL) instead. */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "missing_file_id" }, { status: 400 });

  const { workspaceId } = await requireActiveWorkspace();
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) return NextResponse.json({ error: "not_connected" }, { status: 400 });

  try {
    const { name, mimeType, buffer } = await downloadDriveFile(accessToken, fileId);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch (err) {
    console.error(`[google-drive download] failed for file ${fileId}:`, err);
    return NextResponse.json({ error: "download_failed" }, { status: 500 });
  }
}
