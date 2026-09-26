import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { publishLocationFn, saveMenuItemFn } from "@/lib/access/api";
import { extractMenuIntakeFn, uploadMenuFileFn } from "@/lib/menu/intake-api";
import {
  applyIntakeAnswers,
  bulkAcceptRows,
  editIntakeRow,
  formatMenuFileSize,
  menuAnalyzeSource,
  menuFileIsImage,
  menuFileRejection,
  rowsToCommit,
  type IntakeSettings,
  type MenuIntakeDraft,
} from "@/lib/menu/intake";
import { formatCurrency } from "@/lib/utils";
import { isProspectDemo } from "@/lib/demo/session";
import { flushLocationCatalog } from "@/lib/pos/persist-location-setup";
import { usePosStore } from "@/lib/pos/store";
import { noteChecklistSave } from "@/lib/saas/checklist-link";

export function EntityMenuIntake(props: {
  entityId: string;
  entityName: string;
  orgId: string;
  locationId: string;
  settings: IntakeSettings;
}) {
  const { entityId, entityName, orgId, locationId, settings } = props;
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<{
    name: string;
    size: number;
    mime: string;
    base64: string;
    preview: string;
  } | null>(null);
  const [fileId, setFileId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<MenuIntakeDraft | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCash, setEditCash] = useState("");
  const [editMods, setEditMods] = useState("");
  const [editAlcohol, setEditAlcohol] = useState<"yes" | "no" | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dismissFileNotice = () => {
    setFileNotice(null);
    setFile(null);
    setFileId("");
    clearFileInput();
  };

  const onFile = (picked: File | undefined) => {
    if (!picked) return;
    const rejection = menuFileRejection({ name: picked.name, size: picked.size });
    if (rejection) {
      setFile(null);
      setFileId("");
      clearFileInput();
      setFileNotice(rejection);
      return;
    }
    setFileId("");
    setMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] || "" : result;
      if (!base64) {
        setFile(null);
        setMessage("That file was empty.");
        return;
      }
      const preview = menuFileIsImage(picked.name) ? result : "";
      setFile({
        name: picked.name,
        size: picked.size,
        mime: picked.type || "",
        base64,
        preview,
      });
    };
    reader.readAsDataURL(picked);
  };

  const upload = async () => {
    if (!file?.base64) return;
    if (!locationId) {
      setMessage("Open this entity on a location before uploading.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const saved = await uploadMenuFileFn({
        data: {
          orgId,
          locationId,
          entityId,
          fileName: file.name,
          mime: file.mime,
          bodyBase64: file.base64,
        },
      });
      setFileId(saved.id);
      setFile((current) =>
        current ? { ...current, name: saved.fileName, size: saved.byteSize } : current,
      );
      setMessage("Uploaded");
    } catch (err) {
      setFileId("");
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const analyze = async () => {
    if (!entityId && !entityName) return;
    const source = menuAnalyzeSource({ text: pasted, fileId });
    if (source.kind === "refuse") {
      toast("Upload a menu first");
      return;
    }
    setBusy(true);
    setMessage("");
    setAiError("");
    setAnswers({});
    setEditing(null);
    try {
      const next = await extractMenuIntakeFn({
        data: {
          entityId,
          text: source.kind === "text" ? source.text : pasted,
          fileId: source.kind === "file" ? source.fileId : undefined,
          locationId: locationId || undefined,
          cashDiscountEnabled: settings.cashDiscountEnabled,
          cashDiscountPercent: settings.cashDiscountPercent,
          cashRoundIncrement: settings.cashRoundIncrement,
        },
      });
      const rows = next.rows.map((row) => ({ ...row, entityId }));
      setDraft({ ...next, entityId, rows });
      if (rows.length === 0) setMessage(next.note || "No items found — try a sharper photo.");
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Reading the menu failed.";
      setDraft(null);
      if (msg === "Upload a menu first") {
        toast(msg);
        return;
      }
      setAiError(msg);
    } finally {
      setBusy(false);
    }
  };

  const withAnswers = (current: MenuIntakeDraft) =>
    applyIntakeAnswers(current, answers, settings);

  const openEdit = (rowId: string) => {
    if (!draft) return;
    const row = draft.rows.find((r) => r.id === rowId);
    if (!row) return;
    setEditing(rowId);
    setEditName(row.name);
    setEditGroup(row.group);
    setEditDesc(row.description);
    setEditCash(row.cashCents != null ? (row.cashCents / 100).toFixed(2) : "");
    setEditMods(row.modifiers.join(", "));
    setEditAlcohol(row.alcohol === true ? "yes" : row.alcohol === false ? "no" : "");
  };

  const saveEdit = () => {
    if (!draft || !editing) return;
    const cents = Math.round(Number(editCash) * 100);
    setDraft(
      editIntakeRow(
        withAnswers(draft),
        editing,
        {
          name: editName,
          group: editGroup,
          description: editDesc,
          cashCents: cents > 0 ? cents : null,
          alcohol: editAlcohol === "yes" ? true : editAlcohol === "no" ? false : null,
          modifiers: editMods
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        settings,
      ),
    );
    setEditing(null);
  };

  const publish = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    const ready = withAnswers(draft);
    setDraft(ready);
    const accepted = rowsToCommit(ready.rows, entityId);
    let n = 0;
    const skipped: string[] = [];
    const committed = new Set<string>();
    for (const row of accepted) {
      const groupName = row.group.trim();
      if (!groupName) {
        skipped.push(row.name);
        continue;
      }
      const state = usePosStore.getState();
      let cat = state.categories.find(
        (c) => c.name.trim().toLowerCase() === groupName.toLowerCase(),
      );
      if (!cat) {
        const made = state.createCategory({
          name: groupName,
          station: row.station,
          destinationName: row.station === "bar" ? "Bar" : "Kitchen",
        });
        cat = made.id
          ? usePosStore.getState().categories.find((c) => c.id === made.id)
          : undefined;
      }
      if (!cat) {
        skipped.push(row.name);
        continue;
      }
      let modifierGroupIds: string[] = [];
      if (row.modifiers.length) {
        const made = usePosStore.getState().createModifierGroup({
          name: `${row.name} extras`.slice(0, 40),
          required: false,
          min: 0,
          max: Math.max(1, row.modifiers.length),
          options: row.modifiers.map((name) => ({ name: name.slice(0, 40), priceCents: 0 })),
        });
        if (made.id) modifierGroupIds = [made.id];
      }
      const item = usePosStore.getState().createMenuItem({
        name: row.name,
        description: row.description || undefined,
        priceCents: row.cashCents ?? 0,
        categoryId: cat.id,
        station: row.station,
        vendorId: entityId,
        course: row.course,
        modifierGroupIds,
      });
      if (item.id) {
        n += 1;
        committed.add(row.id);
      } else skipped.push(row.name);
    }
    if (n === 0) {
      setBusy(false);
      setMessage(
        skipped.length
          ? "Those rows stayed in the draft. Add the menu group on this entity, then Save / Publish again."
          : "Accept a row with a cash price, then Save / Publish.",
      );
      return;
    }
    try {
      if (!isProspectDemo() && orgId && locationId) {
        await flushLocationCatalog("menu");
        void saveMenuItemFn({
          data: { orgId, locationId, action: "create", operatorId: entityId },
        }).catch(() => undefined);
        await publishLocationFn({ data: { orgId, locationId } });
      }
      noteChecklistSave({ tab: "menu", focus: "menu" });
      const held = skipped.length
        ? ` ${skipped.length} rows stayed in the draft until their group exists.`
        : "";
      setMessage(
        `Published ${n} items for ${entityName}. The order pad picks them up from this publish.${held}`,
      );
      if (!skipped.length) setDraft(null);
      else {
        setDraft({
          ...ready,
          rows: ready.rows.filter((r) => !committed.has(r.id)),
          questions: ready.questions.filter((q) => !committed.has(q.rowId)),
        });
      }
    } catch {
      setMessage(
        `${n} items are on this tablet’s menu for ${entityName}. Publish to stations did not finish — tap Save / Publish again.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const live = draft ? withAnswers(draft) : null;
  const acceptedCount = live ? rowsToCommit(live.rows, entityId).length : 0;

  return (
    <section
      className="mb-4 rounded-2xl border border-border bg-surface p-3"
      data-menu-intake={entityId || "house"}
      data-menu-intake-entity={entityId || "house"}
      data-menu-file-id={fileId || undefined}
    >
      <h3 className="text-sm font-semibold">Upload a menu · {entityName}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        PDF, photo, DOCX, or pasted text. This draft belongs to {entityName}. Cash price is the
        till price. Card price follows this venue’s cash-discount rule. Save / Publish sends the
        accepted rows to stations.
      </p>
      <div className="mt-3 grid gap-2">
        <label className="text-[11px] text-muted-foreground">
          Menu file
          <input
            ref={fileInputRef}
            className="mt-1 block w-full text-sm"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.docx,image/*"
            data-menu-intake-file
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {file ? (
          <div className="flex items-center gap-3" data-menu-file-picked={file.name}>
            {file.preview ? (
              <img
                src={file.preview}
                alt=""
                className="h-14 w-14 rounded-md border border-border object-cover"
                data-menu-file-thumb
              />
            ) : null}
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium" data-menu-file-name>
                {file.name}
              </p>
              <p className="text-muted-foreground" data-menu-file-size>
                {formatMenuFileSize(file.size)}
                {fileId ? " · Uploaded" : uploading ? " · Uploading…" : ""}
              </p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void upload()}
            disabled={!file || uploading || busy || Boolean(fileId)}
            data-menu-upload
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void analyze()}
            disabled={busy || uploading || (!pasted.trim() && !fileId)}
            data-menu-analyze
          >
            {busy ? "Reading menu…" : "Analyze"}
          </Button>
        </div>
        <VoiceTextarea
          rows={4}
          value={pasted}
          onChange={setPasted}
          placeholder="Or paste the menu. Plates on its own line, then Smash Burger 14."
          data-menu-intake-paste
        />
      </div>

      {live && live.note ? (
        <p className="mt-3 text-xs text-muted-foreground" data-menu-intake-note>
          {live.note}
        </p>
      ) : null}

      {live && live.questions.length > 0 ? (
        <div className="mt-3 grid gap-2" data-menu-intake-questions>
          <p className="text-xs font-medium">Answer on this screen. Type or speak.</p>
          {live.questions.map((q) => (
            <label key={q.id} className="block text-xs">
              {q.prompt}
              <VoiceTextarea
                rows={2}
                value={answers[q.id] ?? ""}
                onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                hint={false}
              />
            </label>
          ))}
        </div>
      ) : null}

      {live && live.rows.length > 0 ? (
        <div className="mt-3" data-menu-intake-draft>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft(bulkAcceptRows(withAnswers(draft!)))}
            >
              Accept all open rows
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void publish()}
              disabled={busy || acceptedCount === 0}
              data-menu-intake-publish
            >
              Save / Publish{acceptedCount ? ` (${acceptedCount})` : ""}
            </Button>
            <span className="self-center text-[11px] text-muted-foreground">
              {live.source === "ai" ? "Read with AI" : "Read from the page text"}
            </span>
          </div>
          <ul className="grid gap-2">
            {live.rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-bg p-2"
                data-intake-row={row.id}
                data-intake-entity={row.entityId}
                data-intake-status={row.status}
                data-intake-cash={row.cashCents ?? ""}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {row.group ? `${row.group} · ` : ""}
                      {row.name}
                    </p>
                    {row.description ? (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Cash {row.cashCents != null ? formatCurrency(row.cashCents) : "—"}
                      {row.cardCents != null ? ` · Card ${formatCurrency(row.cardCents)}` : ""}
                      {" · "}
                      {row.station === "bar" ? "Bar section" : "Kitchen printer"}
                      {row.modifiers.length ? ` · ${row.modifiers.join(", ")}` : ""}
                      {row.size ? ` · ${row.size}` : ""}
                      {row.abv ? ` · ${row.abv} ABV` : ""}
                      {row.eightySix ? ` · 86 ${row.eightySix}` : ""}
                      {row.priceBasis === "ask" ? " · Confirm cash or card" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={row.status === "accepted" ? "success" : "outline"}
                      onClick={() =>
                        setDraft(
                          editIntakeRow(withAnswers(draft!), row.id, { status: "accepted" }, settings),
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row.id)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={row.status === "dropped" ? "secondary" : "ghost"}
                      onClick={() =>
                        setDraft(
                          editIntakeRow(withAnswers(draft!), row.id, { status: "dropped" }, settings),
                        )
                      }
                    >
                      Drop
                    </Button>
                  </div>
                </div>
                {editing === row.id ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Item name" />
                    <Input value={editGroup} onChange={(e) => setEditGroup(e.target.value)} placeholder="Group" />
                    <Input
                      value={editCash}
                      inputMode="decimal"
                      onChange={(e) => setEditCash(e.target.value)}
                      placeholder="Cash price"
                    />
                    <select
                      className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
                      value={editAlcohol}
                      onChange={(e) => setEditAlcohol(e.target.value as "yes" | "no" | "")}
                      aria-label={`Alcohol for ${row.name}`}
                    >
                      <option value="">Alcohol?</option>
                      <option value="yes">Contains alcohol</option>
                      <option value="no">No alcohol</option>
                    </select>
                    <Input
                      className="sm:col-span-2"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                    />
                    <Input
                      className="sm:col-span-2"
                      value={editMods}
                      onChange={(e) => setEditMods(e.target.value)}
                      placeholder="Extras, comma separated"
                    />
                    <Button type="button" size="sm" onClick={saveEdit}>
                      Save row
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {aiError ? (
        <p
          role="alert"
          data-menu-ai-error
          className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {aiError}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-xs text-primary" data-menu-intake-message>
          {message}
        </p>
      ) : null}
      <Dialog open={fileNotice != null} onOpenChange={(open) => { if (!open) dismissFileNotice(); }}>
        <DialogContent data-menu-file-notice>
          <DialogHeader>
            <DialogTitle>Menu file</DialogTitle>
            <DialogDescription>{fileNotice}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={dismissFileNotice} data-menu-file-notice-ok>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
