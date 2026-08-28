import { callout, cta, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const KIOSK_WAITLIST_TOPICS: GuideTopic[] = [
  topic({
    id: "feature-kiosk",
    chapterId: "kiosk",
    title: "Guest kiosk",
    summary: "Order, waitlist, and reservation check-in on a large-touch surface.",
    roles: "all",
    keywords: ["kiosk", "self-serve", "check-in", "guest"],
    blocks: [
      why(
        "A kiosk is for the guest, not the PIN session. Chrome stays quiet. Buttons stay large.",
      ),
      ul(
        "Open /kiosk (optional ?loc= for a location).",
        "Modes in Settings: Order · Check-in / waitlist · Combined tabs.",
        "Combined home: Order | Check in | Waitlist.",
      ),
      steps(
        "Set kiosk mode and waitlist on Settings or Host stand.",
        "Point the kiosk device at /kiosk.",
        "Staff keep POS open for Host stand, tickets, and notifications.",
      ),
      callout(
        "Partial",
        "Waitlist texts log on the Host stand when Twilio is not configured — they are not live carrier SMS. Reservation codes are unique per location per day.",
      ),
      cta("/kiosk", "Open guest kiosk"),
      related("feature-waitlist", "feature-reservation-checkin", "type-restaurant", "type-qsr"),
    ],
  }),
  topic({
    id: "feature-waitlist",
    chapterId: "kiosk",
    title: "Waitlist",
    summary: "Kiosk join, quoted wait range, table-ready text, guest remove link.",
    roles: ["owner_manager", "server", "host_operator", "platform_admin"],
    keywords: ["waitlist", "sms", "quoted wait", "kiosk", "table ready"],
    openView: "waitlist",
    blocks: [
      why(
        "When the room cannot seat now, the guest should join themselves — and leave themselves — without a staff PIN.",
      ),
      ul(
        "Settings: waitlistEnabled, active reason (kitchen backed up, short kitchen staff, short floor staff, at capacity, custom).",
        "Kiosk shows a range such as about 25–35 min — never a fake exact minute.",
        "Join collects name, phone, party size. SMS (or sandbox log) includes a remove link.",
        "Host stand: notify ready, seat, no-answer, remove. Notify texts “Your table is ready” plus the same remove link.",
      ),
      steps(
        "Turn Waitlist on and pick a reason.",
        "Guest taps Add me to waitlist on /kiosk.",
        "Host taps Notify when a table can take them.",
        "Guest may remove via the link; staff see a waitlist notification.",
      ),
      warn(
        "Without TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER, messages are sandbox-logged on the Host stand. They are not live carrier SMS.",
      ),
      related("feature-kiosk", "feature-reservation-checkin", "type-restaurant", "type-bar-lounge"),
    ],
  }),
  topic({
    id: "feature-reservation-checkin",
    chapterId: "kiosk",
    title: "Reservation check-in",
    summary: "Book with a code, kiosk last-name + code, staff “Guest checked in”.",
    roles: ["owner_manager", "server", "host_operator", "platform_admin"],
    keywords: ["reservation", "check-in", "code", "kiosk", "host"],
    openView: "waitlist",
    blocks: [
      why(
        "The guest should not need a staff member to prove they booked. A short code by SMS or email is enough.",
      ),
      ul(
        "Book: name, party size, time, phone, email. Status starts booked.",
        "A 4-character check-in code is generated and sent.",
        "Kiosk: last name + code against today’s booked reservations for this location.",
        "Success → checked_in. Host/floor get an in-app notice with party size and table suggestion.",
        "Staff can still Seat from the Host stand. Cancel and no-show remain available.",
      ),
      steps(
        "Book from Host stand or the kiosk Book a table panel.",
        "Guest uses /kiosk → Check in with last name + the 4-character code from the booking message.",
      ),
      tip("Codes avoid 0/O and 1/I. They are unique per location per day."),
      related("feature-kiosk", "feature-waitlist", "type-restaurant"),
    ],
  }),
];
