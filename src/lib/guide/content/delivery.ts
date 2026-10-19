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
        "With those partner fields empty, only the signed webhook accepts orders. The open check sits on the left third of the order screen and the menu fills the right two-thirds, in portrait and landscape. The printed guest check is a compact ticket strip. Cash and card sit on the same line, a blank line sits between items, and the pay QR prints at the bottom when the venue turns it on. Signing in on a station checks the receipt and order printers and refreshes the connection banner. Backspace on the station PIN pad removes the last digit. The station PIN pad sits in the center of the screen at a normal size in portrait and landscape. Venue Settings, Cash / Drawer, has Cash drawer open requires manager approval. It is on until a location admin or manager turns it off. On asks for a manager PIN before the drawer opens. Off opens the drawer for staff who already have that drawer. Venue Settings, Scheduling / Clock-in, has Allow clock-in for unscheduled shifts. It is off until a location admin or manager turns it on. Off blocks a clock-in when no shift covers now. On asks the person to confirm, then marks that punch Unscheduled on timecards, labor cost, staffing recommendations, and the hours file. A scheduled shift still clocks in as usual. The open check is a compact ticket strip beside or over the menu. Each line shows the quantity and name, with cash and card on that line. A colored edge marks the selling entity. A sent line is muted. Guest checks show the server as a first name and last initial. Staff records keep a first name, a last name, an employee number, and a pay rate. The hours export lists the employee number, first name, last name, pay rate type, pay rate, hours worked, entity, and role. Labor cost uses that rate. Deleting an item or voiding an open check takes it off the open check, the floor, and the order display. An item that has not been sent is removed. A sent item is voided and that station gets a cancel ticket. A check with nothing sent can be deleted. A sent check is voided, the table goes empty, and the check stays gone on every station. The station PIN pad and the floor, order, pay, and kitchen screens fit the display. On a landscape station the whole pad shows, including Enter and Clock in, with no scroll. Turn the station and the pad refits. Clock out stays in Close out. A card reader connects by Bluetooth, Network, or USB. USB plugs into the station. Pay shows the reader ready when that reader is attached and takes the card on it. Card reader not connected blocks the card until it is plugged back in. Bluetooth and Network stay available when those are selected. A receipt or order printer uses Ethernet or USB. Ethernet keeps the static IP and port 9100. USB shows USB, and USB printer not connected when nothing is plugged in — the job waits on the station that owns that printer. The Star kitchen printer stays on Ethernet. The station sends the same ticket either way. An open food or open liquor amount stays exact on cash and on card, including the card pay screen and the amount authorized. Cash discount and rounding do not change it. An item that has not been sent can be removed from the check. A sent item can only be voided or comped, and the reason comes from the location list. A check with no sent items can be deleted. Once any item has been sent, the check is voided or comped as a whole. Voided and comped items stay on the check with the reason and are left out of the total. Open Food, Open Liquor, and any item marked Open price use the amount entered as both the cash price and the card price. Cash discount and rounding do not change that amount. A regular menu item still uses that entity’s cash discount and rounding. Receipts and reports show the open amount as entered. Guest checks, paid receipts, and both tip slips print larger type, with a blank line between the header, the items, the totals, and the signature. Each suggested tip stays on one complete line. After the card is authorized, one tip slip prints. After the tip is entered, ask whether the customer wants a receipt. Yes prints the paid receipt once, and that total includes the tip. A status or 86 push waits until that vendor is configured.",
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
