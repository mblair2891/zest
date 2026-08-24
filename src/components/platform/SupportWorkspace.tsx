import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  addTicketCommentFn,
  createSupportTicketFn,
  listCrmAccountsFn,
  listSupportTicketsFn,
  listTicketCommentsFn,
  patchSupportTicketFn,
} from "@/lib/saas/crm-api";
import {
  SUPPORT_MACROS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportTicket,
  type TicketComment,
  type TicketStatus,
} from "@/lib/saas/crm-types";
import { formatDateTime } from "@/lib/utils";

const BADGE: Record<TicketStatus, "info" | "warn" | "success" | "secondary"> = {
  open: "info",
  pending: "warn",
  resolved: "success",
  closed: "secondary",
};

export function SupportWorkspace() {
  const [rows, setRows] = useState<SupportTicket[] | null>(null);
  const [filter, setFilter] = useState<TicketStatus | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listSupportTicketsFn({ data: { status: filter } }).then(setRows);
    void listCrmAccountsFn({ data: { q: "", stage: "all" } }).then((a) =>
      setAccounts(a.map((x) => ({ id: x.id, name: x.name }))),
    );
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openId) return;
    void listTicketCommentsFn({ data: { ticketId: openId } }).then(setComments);
  }, [openId]);

  const ticket = rows?.find((t) => t.id === openId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Support</h2>
        <GuideLearnLink topicId="saas-support" compact>
          Learn
        </GuideLearnLink>
        {(["all", ...TICKET_STATUSES] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s}
          </Button>
        ))}
      </div>
      {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <div className="w-full max-w-sm overflow-y-auto border-r border-border p-3">
          <form
            className="mb-3 space-y-2 rounded-xl border border-border bg-surface p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              void createSupportTicketFn({
                data: { subject, body, accountId: accountId || undefined, priority: "normal" },
              })
                .then((t) => {
                  setSubject("");
                  setBody("");
                  setOpenId(t.id);
                  load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
            }}
          >
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <select
              className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Account (optional)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Input placeholder="First comment" value={body} onChange={(e) => setBody(e.target.value)} />
            <Button size="sm" type="submit">
              New ticket
            </Button>
          </form>
          {rows?.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenId(t.id)}
              className={`mb-1 w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-surface-2 ${openId === t.id ? "bg-surface-2" : "bg-surface"}`}
            >
              <span className="flex justify-between gap-2">
                <span className="font-medium">{t.subject}</span>
                <Badge variant={BADGE[t.status]}>{t.status}</Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {t.accountName ?? t.orgName ?? "Unlinked"} · {t.priority}
              </span>
            </button>
          ))}
          {rows?.length === 0 && <p className="text-sm text-muted-foreground">No tickets in this filter.</p>}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {!ticket && <p className="text-sm text-muted-foreground">Select a ticket.</p>}
          {ticket && (
            <div>
              <h3 className="text-lg font-semibold">{ticket.subject}</h3>
              <p className="text-xs text-muted-foreground">
                {ticket.accountName} · {formatDateTime(Date.parse(ticket.createdAt))}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TICKET_STATUSES.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={ticket.status === s ? "default" : "outline"}
                    onClick={() =>
                      void patchSupportTicketFn({ data: { ticketId: ticket.id, status: s } }).then(load)
                    }
                  >
                    {s}
                  </Button>
                ))}
                {TICKET_PRIORITIES.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={ticket.priority === p ? "default" : "ghost"}
                    onClick={() =>
                      void patchSupportTicketFn({ data: { ticketId: ticket.id, priority: p } }).then(load)
                    }
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                    <p>{c.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.authorName ?? "Staff"} · {formatDateTime(Date.parse(c.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Macros</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {SUPPORT_MACROS.map((m) => (
                  <Button key={m.id} size="sm" variant="outline" onClick={() => setReply(m.body)}>
                    {m.title}
                  </Button>
                ))}
              </div>
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addTicketCommentFn({ data: { ticketId: ticket.id, body: reply } }).then(() => {
                    setReply("");
                    void listTicketCommentsFn({ data: { ticketId: ticket.id } }).then(setComments);
                    load();
                  });
                }}
              >
                <textarea
                  className="min-h-24 w-full rounded-lg border border-border bg-bg p-2 text-sm"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  required
                />
                <Button size="sm" type="submit">
                  Comment
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
