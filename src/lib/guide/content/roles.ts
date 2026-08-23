import { callout, p, related, steps, tip, topic, ul, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ROLE_GUIDE_TOPICS: GuideTopic[] = [
  topic({
    id: "role-platform-admin",
    chapterId: "roles",
    title: "Platform Admin",
    summary: "Tenants, pipeline, demos, and support — not a restaurant PIN.",
    roles: ["platform_admin"],
    keywords: ["admin", "pipeline", "tenants", "demos", "control plane"],
    blocks: [
      why(
        "Platform Admin sees the fleet. It is not a floor login and must not be shared as a demo password.",
      ),
      ul(
        "Console — live organizations only. Demo houses do not appear here.",
        "Pipeline — prospects from intake through contract and onboarding.",
        "Demos — shareable type rooms and the full product tour. Isolated from tenants.",
      ),
      steps(
        "Sign in, complete the forced password change, land on the control plane.",
        "Use Console, Pipeline, and Demos in the header. The choice sticks until you click another.",
        "Empty tenants is valid. Do not expect demo orgs in statistics.",
        "Send prospects a /demo/{type} link — never this Admin session.",
      ),
      callout(
        "Same topic",
        "Deeper tenant/support steps also live under Platform admin: tenants & support.",
      ),
      related("platform-admin", "prospect-demos", "empty-start", "prospect-intake"),
    ],
  }),
  topic({
    id: "role-owner",
    chapterId: "roles",
    title: "Owner / manager",
    summary: "Location, staff, money, and packages after the site is live.",
    roles: ["owner_manager"],
    keywords: ["owner", "manager", "settings", "staff", "money"],
    blocks: [
      why(
        "The owner opens the house, sets PINs and packages, and owns the period close.",
      ),
      ul(
        "Open POS for the location. PIN as owner or manager.",
        "Staff, menu, floor, cash drawer, settlement.",
        "Packages decide which modules appear. Core POS and KDS are the floor.",
      ),
      steps(
        "Confirm the location mode (restaurant vs host + operators) matches how you actually serve.",
        "Add staff PINs and section assignments.",
        "Build enough menu to send a ticket. Do not wait for a demo seed.",
        "Close the period on Settle. Guest cards are Quantum Payments.",
      ),
      tip("The Operators Guide overlay is in the header on every surface."),
      related("login", "invites-roles", "host-capture", "type-restaurant"),
    ],
  }),
  topic({
    id: "role-server",
    chapterId: "roles",
    title: "Server / floor",
    summary: "Tables, checks, send, pay — the guest-facing path.",
    roles: ["server"],
    keywords: ["server", "floor", "check", "seat", "pay"],
    blocks: [
      why(
        "The server owns the check. Kitchen and bar see tickets, not the guest.",
      ),
      steps(
        "PIN in. Your home screen is usually Floor or Order.",
        "Seat (or open a counter check). Add items. Send.",
        "Take Quantum Payments. Do not open a second check for another operator on a host floor.",
      ),
      p(
        "On a host + multi-operator floor, food and drinks still live on one guest check. You are not splitting cards by stall.",
      ),
      related("type-restaurant", "type-food-hall", "host-capture"),
    ],
  }),
  topic({
    id: "role-kitchen-bar",
    chapterId: "roles",
    title: "Kitchen / bar",
    summary: "Tickets, bump, recall. You do not take the guest card.",
    roles: ["kitchen_bar"],
    keywords: ["kitchen", "bar", "kds", "bump", "ticket"],
    blocks: [
      why(
        "The rail is the source of truth for the line. Bump tells the floor the item is up.",
      ),
      steps(
        "PIN into Kitchen or Bar. You see only your station’s tickets.",
        "Start, bump, or recall. Do not take payment from the KDS.",
        "On a host floor, bar tickets belong to the bar operator; kitchen tickets to the kitchen operator.",
      ),
      related("type-food-hall", "type-bar-lounge", "type-restaurant"),
    ],
  }),
  topic({
    id: "role-vendor",
    chapterId: "roles",
    title: "Vendor / operator",
    summary: "A stall, kitchen brand, or truck on a host floor.",
    roles: ["vendor_operator", "host_operator"],
    keywords: ["vendor", "operator", "stall", "portal", "settlement"],
    blocks: [
      why(
        "You cook or pour for a host brand. The guest pays the host. You are paid on the period.",
      ),
      ul(
        "Your tickets route to your station only.",
        "Settlement shows merchandise share, fees, and any host cut.",
        "A $35 dispute fee, when filed, splits by merchandise on that check.",
      ),
      p(
        "The Laundry demo (Steam Distillery + Diamond House BBQ) is the rehearsal for this model. It is not a live tenant.",
      ),
      related("type-food-hall", "host-capture", "chargebacks", "prospect-demos"),
    ],
  }),
];
