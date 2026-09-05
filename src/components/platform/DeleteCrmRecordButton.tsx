import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteCrmOrPipelineFn, previewCrmDeleteFn } from "@/lib/saas/crm-api";
import {
  DELETE_TRAINING_PROMPT,
  deleteLeadPrompt,
  type CrmDeleteClass,
} from "@/lib/saas/delete-org";

export function DeleteCrmRecordButton({
  kind,
  id,
  fallbackName,
  fallbackClass,
  onDeleted,
  onError,
}: {
  kind: "crm" | "pipeline";
  id: string;
  fallbackName: string;
  fallbackClass?: CrmDeleteClass;
  onDeleted: () => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const preview = await previewCrmDeleteFn({ data: { kind, id } });
      const cls = preview.class || fallbackClass || "lead";
      const name = preview.name || fallbackName;
      if (cls === "lead") {
        if (!window.confirm(deleteLeadPrompt(name))) return;
        await deleteCrmOrPipelineFn({
          data: { kind, id, confirmName: name, extraConfirm: false },
        });
      } else if (cls === "training") {
        if (!window.confirm(deleteLeadPrompt(name))) return;
        if (!window.confirm(DELETE_TRAINING_PROMPT)) return;
        await deleteCrmOrPipelineFn({
          data: { kind, id, confirmName: name, extraConfirm: true },
        });
      } else {
        const typed = window.prompt(`Type ${name} to delete this live tenant:`);
        if (typed == null) return;
        await deleteCrmOrPipelineFn({
          data: { kind, id, confirmName: typed, extraConfirm: true },
        });
      }
      onDeleted();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="destructive"
      className="h-7 px-2 text-xs"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        void run();
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
