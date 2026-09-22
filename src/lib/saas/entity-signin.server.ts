/**
 * Archived or removed selling entities cannot sign in.
 * A sibling operator is a different id and stays open.
 * House staff (no operator id) stay open.
 */
import { getSql } from "@/lib/db";

export async function sellingEntitySignInOpen(
  operatorId: string | null | undefined,
): Promise<boolean> {
  const id = String(operatorId ?? "").trim();
  if (!id) return true;
  try {
    const sql = await getSql();
    const rows = await sql<{ archived_at: string | null }>`
      select archived_at from operators where id = ${id} limit 1
    `;
    if (!rows[0]) return false;
    return !rows[0].archived_at;
  } catch {
    return true;
  }
}
