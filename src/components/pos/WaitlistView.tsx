import { useState } from "react";
import { Bell, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosStore } from "@/lib/pos/store";
import { formatTime } from "@/lib/utils";

export function WaitlistView() {
  const waitlist = usePosStore((s) => s.waitlist);
  const reservations = usePosStore((s) => s.reservations);
  const tables = usePosStore((s) => s.tables);
  const addWaitlist = usePosStore((s) => s.addWaitlist);
  const updateWaitlistStatus = usePosStore((s) => s.updateWaitlistStatus);
  const seatFromWaitlist = usePosStore((s) => s.seatFromWaitlist);
  const addReservation = usePosStore((s) => s.addReservation);
  const updateReservationStatus = usePosStore((s) => s.updateReservationStatus);
  const seatTable = usePosStore((s) => s.seatTable);

  const [name, setName] = useState("");
  const [party, setParty] = useState("2");
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState("20");

  const [rName, setRName] = useState("");
  const [rParty, setRParty] = useState("4");
  const [rPhone, setRPhone] = useState("");

  const waiting = waitlist.filter(
    (w) => w.status === "waiting" || w.status === "notified",
  );

  const addGuest = () => {
    if (!name.trim()) return;
    addWaitlist({
      name: name.trim(),
      partySize: parseInt(party, 10) || 2,
      phone: phone || undefined,
      quotedMinutes: parseInt(quote, 10) || 15,
      notes: undefined,
    });
    setName("");
    setPhone("");
  };

  const addRes = () => {
    if (!rName.trim()) return;
    const time = Date.now() + 3600000;
    addReservation({
      name: rName.trim(),
      partySize: parseInt(rParty, 10) || 2,
      phone: rPhone || undefined,
      at: time,
      time,
      notes: undefined,
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
                      onClick={() => updateWaitlistStatus(w.id, "notified")}
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
                      onClick={() => updateWaitlistStatus(w.id, "cancelled")}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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
              .filter((r) => r.status === "booked" || r.status === "confirmed")
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
