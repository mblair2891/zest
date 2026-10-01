import { related, steps, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const DELIVERY_TOPICS: GuideTopic[] = [
  topic({
    id: "delivery-channels",
    chapterId: "orders",
    title: "Delivery channels",
    summary: "Marketplace orders open a check as Marketplace payable. No second card.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "kitchen_bar"],
    keywords: ["delivery", "doordash", "uber", "grubhub", "otter", "webhook", "86", "marketplace"],
    openView: "settings",
    blocks: [
      why(
        "A marketplace already charged the guest. The house check records that payable and fires the kitchen the same way as a to-go ticket.",
      ),
      steps(
        "Settings or Integrations → Delivery channels. Each channel is Marketplace or Courier-dispatch. DoorDash, Uber Eats, and Grubhub are the marketplace adapters. The tablet webhook stays on so a middleware tablet can post an order.",
        "Sandbox and live keys are per channel. With both empty, only the webhook accepts orders. A native status or 86 push waits until a key is saved.",
        "An inbound order opens a check. The dining option is Delivery- and the channel. The tender is Marketplace payable. Guest name, phone, channel order number, due time, and special instructions print on the kitchen ticket.",
        "Food groups route to the order printers and the order display the same way as to-go. The pickup rail shows the order when the food is bumped. The ready text is the same pickup message, and it can be turned off per channel.",
        "Publish a delivery menu from the entity catalog. A percent or a flat amount overrides the channel price. 86 in the POS marks that item unavailable on channels that have keys. The house menu row stays.",
        "Accept, or auto-accept, then Prep, Ready, and Picked up. Cancel needs a reason. Status goes to the native API when keys exist. Otherwise it is logged. Hours and Pause are per channel.",
        "Expected payout is the guest total minus that channel’s commission percent. Owner ops lists delivery sales beside house sales. Items sold still count in actual versus theoretical.",
      ),
      ul(
        "Do not take a second card on a marketplace check. Quantum Payments does not run on it.",
        "Alcohol is added only when the venue allows delivery alcohol and the channel item is mapped.",
        "A down channel queues the outbound update and shows a banner. The POS keeps taking house checks.",
      ),
      warn("Channel 86 does not delete the house item. Un-86 on the POS brings it back for the dining room."),
      related("kitchen-bar-routing", "menu-modifiers", "printers-kds", "owner-ops", "quantum-payments"),
    ],
  }),
];
