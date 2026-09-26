/**
 * Persist a menu file on the venue and entity before Analyze reads it.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";

const MAX_BYTES = 1_500_000;

export type StoredMenuFile = {
  id: string;
  locationId: string;
  entityId: string;
  fileName: string;
  mime: string;
  byteSize: number;
  bodyBase64: string;
};

function mimeFor(fileName: string, given?: string): string {
  const hint = String(given ?? "").trim().toLowerCase();
  if (hint.startsWith("image/") || hint === "application/pdf" || hint.includes("wordprocessingml")) {
    return hint.slice(0, 80);
  }
  const name = fileName.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export async function saveMenuUpload(input: {
  orgId?: string;
  locationId: string;
  entityId: string;
  fileName: string;
  mime?: string;
  bodyBase64: string;
}): Promise<{ id: string; fileName: string; byteSize: number; mime: string }> {
  const locationId = String(input.locationId || "").trim();
  const entityId = String(input.entityId || "").trim().slice(0, 80);
  const fileName = String(input.fileName || "menu").trim().slice(0, 180);
  if (!locationId) throw new Error("Location is required");
  if (!fileName) throw new Error("Choose a menu file");
  const body = String(input.bodyBase64 || "").replace(/\s/g, "");
  if (!body) throw new Error("Upload a menu first");
  const bytes = Buffer.from(body, "base64");
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    throw new Error(bytes.byteLength ? "Use a menu file under 1.5 MB." : "Upload a menu first");
  }
  const id = newId("mfile");
  const mime = mimeFor(fileName, input.mime);
  const sql = await getSql();
  await sql`
    insert into menu_uploads (id, org_id, location_id, entity_id, file_name, mime, byte_size, body_b64)
    values (
      ${id},
      ${String(input.orgId || "").slice(0, 80)},
      ${locationId},
      ${entityId},
      ${fileName},
      ${mime},
      ${bytes.byteLength},
      ${body}
    )
  `;
  return { id, fileName, byteSize: bytes.byteLength, mime };
}

export async function loadMenuUpload(input: {
  id: string;
  locationId: string;
  entityId: string;
}): Promise<StoredMenuFile | null> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    location_id: string;
    entity_id: string;
    file_name: string;
    mime: string;
    byte_size: number;
    body_b64: string;
  }>`
    select id, location_id, entity_id, file_name, mime, byte_size, body_b64
    from menu_uploads
    where id = ${input.id}
      and location_id = ${input.locationId}
      and entity_id = ${String(input.entityId || "").trim()}
    limit 1
  `;
  const row = rows[0];
  if (!row || !row.body_b64) return null;
  return {
    id: row.id,
    locationId: row.location_id,
    entityId: row.entity_id,
    fileName: row.file_name,
    mime: row.mime,
    byteSize: Number(row.byte_size) || 0,
    bodyBase64: row.body_b64,
  };
}
