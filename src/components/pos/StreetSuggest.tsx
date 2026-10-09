import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { suggestAddressesFn } from "@/lib/access/api";
import type { AddressSuggestion } from "@/lib/pos/address-suggest";

/**
 * Street field. Suggestions fill street, city, state, and timezone.
 * Typed text is stored as entered, including the space in a name like Grants Pass.
 */
export function StreetSuggest(props: {
  value: string;
  disabled?: boolean;
  checklistFocus?: string;
  onChange: (street: string) => void;
  onPick: (pick: AddressSuggestion) => void;
  onCommit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    if (props.disabled || props.value.trim().length < 3) {
      setRows([]);
      return;
    }
    const timer = setTimeout(() => {
      void suggestAddressesFn({ data: { query: props.value } })
        .then((next) => setRows(Array.isArray(next) ? next : []))
        .catch(() => setRows([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [props.disabled, props.value]);

  return (
    <div className="relative">
      <Input
        value={props.value}
        disabled={props.disabled}
        data-venue-street
        data-venue-address
        data-checklist-focus={props.checklistFocus}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={() => {
          props.onCommit?.();
          window.setTimeout(() => setOpen(false), 180);
        }}
      />
      {open && rows.length > 0 && !props.disabled ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-md"
          data-address-suggest
        >
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                data-address-suggestion={row.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  props.onPick(row);
                  setOpen(false);
                }}
              >
                {row.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
