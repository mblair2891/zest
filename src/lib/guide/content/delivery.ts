import { related, steps, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const DELIVERY_TOPICS: GuideTopic[] = [
  topic({
    id: "delivery-channels",
    chapterId: "orders",
    title: "Delivery channels",
    summary: "DoorDash and Uber Eats open a check as Marketplace payable. No second card.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "kitchen_bar"],
    keywords: ["delivery", "doordash", "uber", "webhook", "86", "marketplace"],
    openView: "settings",
    blocks: [
      why(
        "A marketplace already charged the guest. The house check records that payable and fires the kitchen the same way as a to-go ticket.",
      ),
      steps(
        "Integrations → Delivery. DoorDash takes a developer id, key id, signing secret, store id, and sandbox or live. Uber Eats takes a client id, client secret, store id, and sandbox or live. Commission percent is display only.",
        "With those partner fields empty, only the signed webhook accepts orders and the banner says Waiting for partner keys. A status or 86 push waits until that vendor is configured.",
        "An inbound order opens a check. The dining option is Delivery-DoorDash or Delivery-UberEats. The tender is Marketplace payable. The channel order number and the due time print on the kitchen slip.",
        "SKUs map to entity items. An unmapped line prints as open item and raises a manager flag. Food groups route to the order printers and the order display the same way as to-go. When every food line is bumped, the check is ready for pickup. A phone on the order can get the same ready text.",
        "Publish the delivery menu from the entity catalog when you are ready. An optional percent markup is applied then, not on each keystroke. 86 and un-86 in the POS push that item’s availability. The house menu row stays.",
        "Accept, or auto-accept, then Ready and Picked up. Reject and Cancel need a reason. Those updates go to the vendor API when that vendor is configured. Otherwise they are logged.",
        "Expected payout is the ticket minus that channel’s commission percent. Owner ops lists house sales, DoorDash, and Uber Eats. Items sold still count in actual versus theoretical.",
      ),
      ul(
        "Do not take a second card on a marketplace check. Quantum Payments does not run on it.",
        "Alcohol is added only when the venue allows delivery alcohol and the channel item is mapped.",
        "A down channel queues the outbound update and shows a banner. The POS keeps taking house checks.",
      ),
      warn("Channel 86 does not delete the house item. Un-86 pushes the item available again and leaves the house row in place."),
      related("kitchen-bar-routing", "menu-modifiers", "printers-kds", "owner-ops", "quantum-payments"),
    ],
  }),
];
