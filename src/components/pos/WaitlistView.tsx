import { useEffect, useState } from "react";
import { Bell, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosStore } from "@/lib/pos/store";
import { formatTime } from "@/lib/utils";
import {
  bookReservationFn,
  joinWaitlistFn,
  listFrontBoardFn,
  saveFrontSettingsFn,
  setReservationStatusFn,
  setWaitlistStatusFn,
} from "@/lib/front/api";
import { WAITLIST_REASON_LABEL, type WaitlistReason } from "@/lib/front/types";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

export function WaitlistView() {
  const waitlistLocal = usePosStore((s) => s.waitlist);
  const reservationsLocal = usePosStore((s) => s.reservations);
  const tables = usePosStore((s) => s.tables);
  const locId = usePosStore((s) => s.tenantLocationId) || "loc_kiosk";
  const addWaitlist = usePosStore((s) => s.addWaitlist);
  const updateWaitlistStatus = usePosStore((s) => s.updateWaitlistStatus);
  const seatFromWaitlist = usePosStore((s) => s.seatFromWaitlist);
  const addReservation = usePosStore((s) => s.addReservation);
  const updateReservationStatus = usePosStore((s) => s.updateReservationStatus);
  const seatTable = usePosStore((s) => s.seatTable);
  const [remoteWait, setRemoteWait] = useState(waitlistLocal);
  const [remoteRes, setRemoteRes] = useState(reservationsLocal);
  const [reason, setReason] = useState<WaitlistReason | null>("at_capacity");
  const [waitOn, setWaitOn] = useState(true);
  const [messages, setMessages] = useState<
    Array<{ id: string; provider: string; kind: string; to: string; body: string }>
  >([]);

  const refresh = async () => {
    try {
      const board = await listFrontBoardFn({ data: { locationId: locId } });
      setWaitOn(board.settings.waitlistEnabled);
      setReason(board.settings.waitlistReason);
      setRemoteWait(
        board.waitlist.map((w) => ({
          id: w.id,
          name: w.name,
          partySize: w.partySize,
          phone: w.phone,
          quotedMinutes: w.quotedMinutes,
          status: w.status === "removed" ? "cancelled" : w.status,
          createdAt: Date.parse(w.createdAt) || Date.now(),
          notifiedAt: w.notifiedAt ? Date.parse(w.notifiedAt) : undefined,
          optOutToken: w.optOutToken,
        })),
      );
      setRemoteRes(
        board.reservations.map((r) => ({
          id: r.id,
          name: r.name,
          partySize: r.partySize,
          phone: r.phone ?? undefined,
          email: r.email ?? undefined,
          at: Date.parse(r.at),
          time: Date.parse(r.at),
          status: r.status === "checked_in" ? "checked_in" : r.status,
          createdAt: Date.parse(r.createdAt) || Date.now(),
          checkInCode: r.checkInCode,
          tableSuggestion: r.tableSuggestion ?? undefined,
        })),
      );
      setMessages(board.messages);
    } catch {
      setRemoteWait(usePosStore.getState().waitlist);
      setRemoteRes(usePosStore.getState().reservations);
    }
  };

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(t);
  }, [locId]);

  const [name, setName] = useState("");
  const [party, setParty] = useState("2");
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState("20");

  const [rName, setRName] = useState("");
  const [rParty, setRParty] = useState("4");
  const [rPhone, setRPhone] = useState("");

  const waitlist = remoteWait.length ? remoteWait : waitlistLocal;
  const reservations = remoteRes.length ? remoteRes : reservationsLocal;
  const waiting = waitlist.filter(
    (w) => w.status === "waiting" || w.status === "notified",
  );

  const addGuest = () => {
    if (!name.trim()) return;
    const partySize = parseInt(party, 10) || 2;
    if (phone.trim()) {
      void joinWaitlistFn({
        data: {
          locationId: locId,
          name: name.trim(),
          phone: phone.trim(),
          partySize,
        },
      })
        .then((r) => {
          addWaitlist({
            id: r.entry.id,
            name: r.entry.name,
            partySize: r.entry.partySize,
            phone: r.entry.phone,
            quotedMinutes: r.entry.quotedMinutes,
            status: "waiting",
            optOutToken: r.entry.optOutToken,
          });
          void refresh();
        })
        .catch(() => {
          addWaitlist({
            name: name.trim(),
            partySize,
            phone: phone || undefined,
            quotedMinutes: parseInt(quote, 10) || 15,
          });
        });
    } else {
      addWaitlist({
        name: name.trim(),
        partySize,
        quotedMinutes: parseInt(quote, 10) || 15,
      });
    }
    setName("");
    setPhone("");
  };

  const addRes = () => {
    if (!rName.trim()) return;
    const time = Date.now() + 3600000;
    void bookReservationFn({
      data: {
        locationId: locId,
        name: rName.trim(),
        partySize: parseInt(rParty, 10) || 2,
        at: new Date(time).toISOString(),
        phone: rPhone || undefined,
      },
    })
      .then((r) => {
        addReservation({
          id: r.id,
          name: r.name,
          partySize: r.partySize,
          phone: r.phone ?? undefined,
          at: time,
          time,
          checkInCode: r.checkInCode,
          status: "booked",
        });
        void refresh();
      })
      .catch(() => {
        addReservation({
          name: rName.trim(),
          partySize: parseInt(rParty, 10) || 2,
          phone: rPhone || undefined,
          at: time,
          time,
        });
      });
    setRName("");
    setRPhone("");
  };

  const freeTable = tables.find(
    (t) => t.status === "available" && !t.mergedIntoId,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Host stand</h2>
          <Badge variant="info">{waiting.length} waiting</Badge>
          <GuideLearnLink topicId="feature-waitlist" compact>
            Learn
          </GuideLearnLink>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={waitOn}
              onChange={(e) => {
                const on = e.target.checked;
                setWaitOn(on);
                void saveFrontSettingsFn({
                  data: { locationId: locId, waitlistEnabled: on },
                });
              }}
            />
            Waitlist on
          </label>
          <select
            className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
            value={reason ?? ""}
            onChange={(e) => {
              const v = (e.target.value || null) as WaitlistReason | null;
              setReason(v);
              void saveFrontSettingsFn({
                data: {
                  locationId: locId,
                  waitlistReason: v,
                  waitlistEnabled: true,
                },
              });
            }}
          >
            <option value="">Reason…</option>
            {Object.entries(WAITLIST_REASON_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="wait" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 w-auto justify-start">
          <TabsTrigger value="wait">Waitlist</TabsTrigger>
          <TabsTrigger value="res">Reservations</TabsTrigger>
        </TabsList>

        <TabsContent value="wait" className="min-h-0 flex-1 overflow-auto p-3">
          <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-3">
            <Input
              placeholder="Guest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-[10rem]"
            />
            <Input
              placeholder="Party"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              className="w-20"
              inputMode="numeric"
            />
            <Input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="max-w-[9rem]"
            />
            <Input
              placeholder="Quote min"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-24"
              inputMode="numeric"
            />
            <Button size="sm" onClick={addGuest}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {waiting.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Waitlist is empty
              </p>
            )}
            {waiting.map((w) => {
              const waitMin = Math.floor((Date.now() - w.createdAt) / 60000);
              return (
                <div
                  key={w.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {w.name}{" "}
                      <span className="text-muted-foreground">
                        · {w.partySize} guests
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Quoted {w.quotedMinutes}m · waited {waitMin}m
                      {w.phone && ` · ${w.phone}`}
                    </p>
                  </div>
                  <Badge
                    variant={w.status === "notified" ? "warn" : "secondary"}
                  >
                    {w.status}
                  </Badge>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void setWaitlistStatusFn({
                          data: { id: w.id, status: "notified" },
                        })
                          .then(() => {
                            updateWaitlistStatus(w.id, "notified");
                            useNotifyStore.getState().pushNotice({
                              kind: "waitlist_update",
                              title: "Table ready",
                              body: `${w.name} was texted — table ready`,
                            });
                            void refresh();
                          })
                          .catch(() => updateWaitlistStatus(w.id, "notified"));
                      }}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Notify
                    </Button>
                    <Button
                      size="sm"
                      disabled={!freeTable}
                      onClick={() => {
                        if (freeTable) {
                          const res = seatFromWaitlist(w.id, freeTable.id);
                          if (res && !res.ok) alert(res.error);
                        }
                      }}
                    >
                      Seat
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void setWaitlistStatusFn({
                          data: { id: w.id, status: "no_show" },
                        }).finally(() => {
                          updateWaitlistStatus(w.id, "no_show");
                          void refresh();
                        });
                      }}
                    >
                      No answer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void setWaitlistStatusFn({
                          data: { id: w.id, status: "cancelled" },
                        }).finally(() => {
                          updateWaitlistStatus(w.id, "cancelled");
                          void refresh();
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {messages.length > 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-border p-3">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Message log (sandbox if no Twilio)
              </p>
              <ul className="mt-2 space-y-2 text-[11px] text-muted-foreground">
                {messages.slice(0, 6).map((m) => (
                  <li key={m.id}>
                    <span className="font-medium text-foreground">
                      {m.kind}
                    </span>{" "}
                    · {m.provider} · {m.to}
                    <span className="mt-0.5 block">{m.body.slice(0, 140)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="res" className="min-h-0 flex-1 overflow-auto p-3">
          <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-3">
            <Input
              placeholder="Name"
              value={rName}
              onChange={(e) => setRName(e.target.value)}
              className="max-w-[10rem]"
            />
            <Input
              placeholder="Party"
              value={rParty}
              onChange={(e) => setRParty(e.target.value)}
              className="w-20"
            />
            <Input
              placeholder="Phone"
              value={rPhone}
              onChange={(e) => setRPhone(e.target.value)}
              className="max-w-[9rem]"
            />
            <Button size="sm" onClick={addRes}>
              <Plus className="h-3.5 w-3.5" />
              Book
            </Button>
          </div>

          <div className="space-y-2">
            {reservations
              .filter(
                (r) =>
                  r.status === "booked" ||
                  r.status === "confirmed" ||
                  r.status === "checked_in",
              )
              .sort(
                (a, b) => (a.time ?? a.at ?? 0) - (b.time ?? b.at ?? 0),
              )
              .map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {r.name}{" "}
                      <span className="text-muted-foreground">
                        · {r.partySize} guests
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(r.time ?? r.at ?? Date.now())}
                      {r.phone && ` · ${r.phone}`}
                      {r.checkInCode && ` · code ${r.checkInCode}`}
                      {r.notes && ` · ${r.notes}`}
                      {r.tableId &&
                        ` · Table ${tables.find((t) => t.id === r.tableId)?.label}`}
                    </p>
                  </div>
                  <Badge variant="info">{r.status}</Badge>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => {
                        const t =
                          (r.tableId &&
                            tables.find(
                              (x) =>
                                x.id === r.tableId && x.status === "available",
                            )) ||
                          freeTable;
                        if (t) {
                          const res = seatTable(t.id, r.partySize);
                          if (!res.ok) {
                            alert(res.error);
                            return;
                          }
                          updateReservationStatus(r.id, "seated");
                        }
                      }}
                      disabled={!freeTable && !r.tableId}
                    >
                      Seat
                    </Button>
                    {r.status === "booked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void setReservationStatusFn({
                            data: { id: r.id, status: "checked_in" },
                          }).finally(() => {
                            updateReservationStatus(r.id, "checked_in");
                            useNotifyStore.getState().pushNotice({
                              kind: "guest_checked_in",
                              title: "Guest checked in",
                              body: `${r.name} · ${r.partySize}${r.tableSuggestion ? ` · table ${r.tableSuggestion}` : ""}`,
                            });
                            void refresh();
                          });
                        }}
                      >
                        Check in
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateReservationStatus(r.id, "cancelled")
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
