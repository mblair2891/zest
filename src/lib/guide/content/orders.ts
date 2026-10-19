import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ORDER_TOPICS: GuideTopic[] = [
  topic({
    id: "menu-modifiers",
    chapterId: "orders",
    title: "Menu, categories, modifiers",
    summary: "Build the item tree the floor and ODS will use.",
    roles: ["owner_manager", "server", "kitchen_bar", "vendor_operator", "host_operator"],
    keywords: ["menu", "category", "modifier", "86", "item", "assist", "ai", "omit", "voice", "upload", "pdf", "docx", "draft", "publish", "well book", "wells", "highball", "open food", "open liquor", "open price", "keypad"],
    openView: "menu",
    blocks: [
      why(
        "Routing, settlement, and allergens all hang off the menu. A missing modifier or operator tag shows up as a wrong ticket or a wrong payout.",
      ),
      steps(
        "Every entity menu includes Open Food and Open Liquor. They stay on the order pad for every entity, including All. Tap one and a keypad asks for the amount, including cents. Confirm adds that exact amount as both the cash price and the card price. Cash discount and rounding do not change it. The card pay screen and the amount authorized use that exact amount. No preset price is required. Open Food prints on the food order printer and belongs to the food entity. Open Liquor prints on the bar order printer and belongs to the bar entity. Either can be added to any check. A menu item marked Open price uses the same keypad and keeps that item’s selling entity. They are not archived, deleted, or replaced by a menu upload or a well book.",
        "Each selling entity has an Inventory page. It lists that entity's menu items and ingredients with the current on-hand quantity, the unit, and the last counted or received date. Search and filter narrow the list. Entering a count updates the on-hand quantity. Items with zero stock are marked. An ingredient at or under its minimum is marked low. A menu item at 1 or 2 is marked low. The page is available to the entity's manager and to any role the location grants inventory access.",
        "Open Menu for the selling entity. Choose a PDF, JPEG, PNG, or DOCX. The file name, size, and a thumbnail for a photo show on the form. A file over 5 MB, or a file that is not a photo, PDF, or DOCX, opens a notice with the size and the 5 MB maximum. OK closes it and clears the picker so you can choose again. Upload stays off until a file that fits is chosen. Upload stores that file on this entity. Analyze stays off until Upload finishes. Paste or voice does not use Upload. Analyze with no stored file says Upload a menu first and does not start a read.",
        "Analyze says Reading menu… and sends the stored file id and the entity id. A photo (JPEG, PNG, WebP, HEIC) is read as a page. A PDF uses its text, and a scan is read as page images. A DOCX uses its text. The draft is for this entity only: group, name, description, cash price when printed, modifiers, and for a drink the ABV or size and any 86 note. One price is marked cash or card unknown until you answer. Nothing is published until Save / Publish. If menu reading is not configured, a red banner says AI is not configured. A provider error is shown on the page. An empty read says No items found — try a sharper photo.",
        "If a price, a group, or cash versus card is missing, type the whole answer in the box. Voice is optional. Nothing is applied until Send or Enter. Typing cash, card, yes, or a dollar amount in the middle of a sentence does not submit it. Cash price and Card price are buttons, not keys. After Send, “cash price is $15” sets the cash price to $15.00 and the card price from that entity’s percent and rounding. Tax stays on the venue tax screen.",
        "Review the draft. Accept, edit, or drop each row. Bulk accept marks every open row. Save / Publish writes the accepted rows onto that entity and publishes them for stations. The order pad shows those items. Another entity’s menu stays as it was.",
        "Add or edit one item by hand when you prefer. The price field is Cash price. The menu price shown beside it is the card price, from that entity’s percent and rounding. An entity login saves its own items. A refresh shows the name and the card price. Another entity’s items and house payouts stay as they were.",
        "Or tap Describe with AI. Type or speak one item. One price is cash. Assist asks cash or card when the discount is on and the basis is open. Confirm writes that item.",
        "On a host venue, a guest operator works that operator’s entity. The host can assign the operator on a new item.",
        "The menu list is grouped by category, with a category filter and a section header for each group (Well, Vodka, Rum, Specialty, and whatever groups exist). Click an item to edit the name and price, 86 or un-86, or archive. Staff is people, PINs, and roles — there is no 86 board on Staff. Stations see an 86 immediately. New items, prices, modifiers, and categories reach stations after Publish, on the next PIN.",
        "A bar, or any entity flagged as drinks, has Well book Off or On. On lists that entity’s well spirits on the order pad. Tap a spirit. The screen lists every in-stock bottle of that spirit, grouped by price level. The lowest level is labeled Well and shows the base price. Each higher level shows its name and the upcharge from Well, for example +$2. Out-of-stock bottles are hidden. Choose a bottle, then single or double, then a mixer. The drink is added at the well price plus that upcharge. A named cocktail such as Sex on the Beach stays its own menu item and is not built this way. Spirit-only items and mixer-only items are not listed as well drinks. Vodka and Coke is not a listed line. The popup is a bottom sheet with large targets, so one thumb can use it on a tablet. A built single is 1.5 oz of that spirit and the mixer. A double is 3 oz of that spirit and the mixer. The same rule covers gin, vodka, whiskey, tequila, rum, and bourbon with cola, soda, tonic, juice, or ginger ale. You can still edit the pour. Hide a mixer and it leaves the popup. A food entity is unchanged. Upload a specialty menu beside the well. Those rows stay unless you choose Replace well book. The order pad lists Wells, then the specialty groups.",
        "An uploaded menu, photo or file, reads each item name and description. AI proposes a recipe: ingredients and amounts. Review each guess: approve or discard. Discard keeps the menu item and stores no recipe. Approve saves the recipe on that item when you Save / Publish. Nothing is saved until you choose. A known well such as Rum and Coke fills itself and is not a guess.",
        "The menu can add a non-alcoholic drink: cola, diet cola, lemon-lime, orange soda, root beer, orange juice, cranberry, pineapple, lemonade, iced tea, coffee, soda water, or still water. There is no alcohol line. The recipe is the drink itself. Sell it alone, or add it as a modifier on a cocktail.",
        "Analyze again and each new row is compared with this entity’s live items, by name and group, ignoring case, punctuation, and size words such as oz. A match asks Replace, Amend, or Keep both. Replace all matches does that for every match. Nothing is duplicated in silence, including a well drink. Replace keeps the same item id. Amend folds the new description, modifiers, and price into that item. Keep both adds a second item. Clear unmatched drafts drops only the draft rows that did not match. The live catalog stays.",
        "Delete is for an item with no order, sale, comp, or void on that id. Confirm, and it leaves the catalog. An item with any ticket line can only be archived. Archived items leave the order pad and stay on old tickets and costing. The list filter is Active or Archived. Restore brings an archived item back. To start over, delete the active items with no sales, archive the ones with sales, then Analyze again.",
      ),
      tip(
        "Analyze does not run on a file that was only chosen and not uploaded. If AI is not configured, the banner says so and the draft is not invented. Describe with AI still uses category templates (burger, steak, pizza, salad, cocktail, …) for one item. You confirm before that item saves.",
      ),
      related("kitchen-bar-routing", "multi-operator-orders", "onboarding-wizard", "setup-by-voice"),
    ],
  }),
  topic({
    id: "kitchen-bar-routing",
    chapterId: "orders",
    title: "Kitchen vs bar routing",
    summary: "Food by menu group. Drinks by floor section. One Send, one slip per line.",
    roles: ["owner_manager", "kitchen_bar", "server"],
    keywords: ["routing", "station", "kitchen", "bar", "ticket", "fire", "destination", "course"],
    openView: "kitchen",
    blocks: [
      why(
        "A single-line kitchen should not drown in paper. Plate, sandwich, side, and dessert on one Star are one ticket — not four.",
      ),
      ul(
        "Open Food fires to the food order printer and the line belongs to the food entity. Open Liquor fires to the bar order printer and the line belongs to the bar entity. Tap one and a keypad asks for the amount, including cents. That exact amount is both the cash price and the card price. Cash discount and rounding do not change it. The card pay screen and the amount authorized use that exact amount. A menu item marked Open price uses the same keypad. Both stay on every entity’s order pad and can be added to any check.",
        "Food groups (Plates, Sandwich, Sides, Dessert, Salad, Pizza, …) each have an order destination and an order printer. Table section does not route food.",
        "Default for one kitchen: every food group → Kitchen → that one Star. Same destination + same printer on one Send is one slip. Map Salad or Pizza to another printer for a second slip.",
        "Drinks / bar-entity items fire to the bar printer for that table’s section (bar-rail / well is a section). If only one bar printer exists, every section maps to it. No bar printer: kitchen printer.",
        "Do not cut per menu group when those groups map to the same destination and printer. Do not cut per course unless Settings → Separate course tickets is on (default off).",
        "Hold a course to keep mains in the window until apps are bumped. Online / order-ahead uses fire rules (immediate, on arrival, delay).",
      ),
      steps(
        "An item that has not been sent can be removed from the check. It leaves the check. A sent item can only be voided or comped, and the reason comes from the location list. A check with no sent items can be deleted. Once any item has been sent, the check is voided or comped as a whole. Voided and comped items stay on the check with the reason and are left out of the total. Deleting an item or voiding an open check takes it off that check. Refresh and the other stations keep it gone. A sent item sends a cancel ticket to the kitchen or bar that had it. Void check leaves open checks and the floor map, and the table goes empty.",
        "On Order, open Wells. The list is spirits. Tap one. In-stock bottles of that spirit are grouped by price level. Well shows the base price. A higher level shows its name and the upcharge from Well, for example +$2. Out-of-stock bottles are hidden. Choose a bottle, then single or double, then a mixer. That drink lands on the check at the well price plus that upcharge. A named cocktail such as Sex on the Beach stays its own item. Vodka and Coke is not a listed line. A spirit alone, or a mixer alone, is not a well drink on that list. Other groups still tap straight onto the check. The open check sits on the left third of the order screen. The menu fills the right two-thirds in portrait and landscape. The check stays visible and scrolls on its own. Each line shows the quantity and the name, with the cash price and the card price on that same line. Modifiers and notes sit under the item. A thin colored edge marks the selling entity, and a short entity name shows when the check has more than one. A line that has not been sent stays bright. A sent line is muted and carries a check mark. Cash and card totals stay at the bottom with Send, Print check, and Pay. Off the clock, the order screen shows NOT CLOCKED IN with Clock in. On the clock it shows Clocked in and the time in the venue timezone. The printed guest check and the on-screen guest check show the server as a first name and last initial. Lines stay on the check while you tap the menu. Split, edit, and send stay on that check.",
        "Send fires LAN 9100 from this station (or a queued docked host/ODS). This tablet does not pick the printer — the venue map does. Food groups mapped to destination Kitchen print on that Kitchen order printer as one ticket. Drinks print on the bar printer for that table’s section.",
        "Settings (or Menu): map a group to another destination or named printer when the house has a salad line, pizza, or pastry printer. Map Dessert off Kitchen → two slips on that Send.",
        "Kitchen order display shows food tickets; Bar ODS shows beverage tickets. Host floors still route by selling entity when printers are entity-scoped.",
        "When this device is online, Send writes the tickets to the location — every POS and ODS at that location sees the same check within a few seconds. Refresh keeps it.",
        "Expo or the server marks Delivered when the table has the plate.",
      ),
      related("kds", "menu-modifiers", "multi-operator-orders", "printers-kds", "receipts-by-vendor", "sections", "check-numbers"),
    ],
  }),
  topic({
    id: "check-numbers",
    chapterId: "orders",
    title: "Check numbers",
    summary: "Table plus that table’s daily sequence. Same id on every slip. No date in the number.",
    roles: ["owner_manager", "server", "kitchen_bar", "host_operator"],
    keywords: ["check number", "ticket", "T1-03", "guest check", "star", "ods", "qr"],
    openView: "order",
    blocks: [
      why(
        "The kitchen, the guest check, and the QR have to name the same check. The date is already on the ticket clock, so it is not repeated in the number.",
      ),
      p(
        "The visible id is assigned when the check opens. Format: T{table}-{seq}. Example: T1-03 is the third check opened on table 1 that venue day. To-go and any check with no table: TO-03. Bar tab: BAR-03. {seq} starts at 01 after local midnight in the venue IANA timezone, and it counts per table (to-go and bar each have their own count). It is not a forever #101 and not a separate number per selling entity. One house check, one id. The order id and the open time stay the reporting keys.",
      ),
      ul(
        "Two dining checks on table 1 the same day print T1-01 then T1-02. A check on table 2 the same minute is T2-01. To-go is TO-01 even if the dining room already has checks.",
        "After local midnight that table’s next new check is T1-01 again. A check still open from yesterday keeps T1-02 if that is the number it opened with.",
        "The bold guest-check number, Star kitchen ticket, order display, pay QR, and the on-screen check use that same id. None of them print YYMMDD in the number.",
      ),
      steps(
        "Open a table. The check number shows on the order pad as soon as the check exists.",
        "Send. The Star ticket header is that number, not a second kitchen counter.",
        "Print check. The Epson guest check is a narrow ticket strip: quantity and name on the left, cash and card on that same line, a blank line between items, and the pay QR at the bottom when it is on. The header is the same number. The pay QR opens that check.",
      ),
      related("kitchen-bar-routing", "kds", "receipts-by-vendor", "floor-tables", "table-qr"),
    ],
  }),
  topic({
    id: "multi-operator-orders",
    chapterId: "orders",
    title: "Multi-operator: one guest check",
    summary: "Line vendor tagging, one pay, tickets still split by operator.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["multi-operator", "vendor", "operator a", "operator b", "one check", "tagging"],
    openView: "hall",
    blocks: [
      why(
        "A hall guest should not run three cards. The guest tenders once; capture splits to Operator A and Operator B merchants. Each still sees their own tickets and period payouts.",
      ),
      p(
        "Example: Host Venue. Guest orders tacos from Operator A and a cocktail from Operator B. One check, split capture to each merchant, two ODS tickets, receipt grouped by vendor.",
      ),
      steps(
        "Items carry the operator set on the menu. The hall cart can mix stalls on one check. On the ticket strip, each line keeps a thin colored edge in that entity’s color, and a short entity name when the check has more than one.",
        "Fire still routes by station + operator so Operator A’s kitchen does not see Operator B’s drinks.",
        "Pay once at the host stand (or table). The guest-facing name is the location. Finix pays each operator their share. The receipt groups lines by vendor.",
        "Period settlement still nets cash, host cut, fees, and any $35 dispute fee by merchandise share. ODS routing does not change.",
      ),
      shot(
        "One guest check with Operator A food lines and Operator B drink lines, single tender.",
        "Check panel showing two operators and one payment.",
      ),
      warn(
        "Do not take a second card “for the bar” on a host check. That breaks settlement and the guest receipt.",
      ),
      related("single-vs-multi", "host-capture", "receipts-by-vendor", "settlement", "chargebacks", "kds"),
    ],
  }),
  topic({
    id: "kds",
    chapterId: "orders",
    title: "Order display (ODS): Start, Bump, notify",
    summary: "Station displays route by kitchen/bar and operator. Start to prepare, Bump when ready. Originating server is notified.",
    roles: ["owner_manager", "kitchen_bar", "server"],
    keywords: ["ods", "kds", "order display", "bump", "start", "recall", "ticket", "notification", "bar display"],
    openView: "kitchen",
    blocks: [
      why(
        "Bump is the contract between station and floor. If bump is skipped, tables never go Up and food dies in the window.",
      ),
      shot(
        "Kitchen order display with All operators / stall filters, Start, and Bump.",
        "ODS ticket columns with Start and Bump.",
      ),
      steps(
        "Send from the floor. Tickets land on the kitchen or bar ODS for that station and operator — including a second tablet and a kitchen display, not only this station.",
        "Start when you begin prep (Preparing). Bump when the plate/drink is ready. Those actions persist on the location; the originating POS shows Ready without a refresh wait longer than a few seconds.",
        "The originating server’s device toasts, chimes, and vibrates (where the platform allows). The table pulses Up.",
        "Expo or the server marks Delivered on the floor. Recall if you bumped too early.",
        "Serverless food: when every food item on the check is bumped, the guest gets a text, Name, order id is ready. Pick up at the pickup label. A later drink on the bar ticket does not send that text again. Expo or staff tap Picked up to clear the pickup rail. An optional second text waits the minutes set on the venue if they have not picked up.",
        "Mute sound from the header bell. Multi-op: filter All operators or a single stall.",
        "Each ticket stamp (and the paper kitchen ticket) shows venue local time from Settings → Location timezone — not UTC and not the tablet’s zone.",
      ),
      callout(
        "Tickets are live across devices when online",
        "Open checks, sent lines, Start/Bump, table status, and cash payments are stored for the location. A paired tablet with a valid PIN is enough for that shared floor. Another paired tablet sees the open check, the bump, an 86, and the clock punch. A second POS and the kitchen ODS share the same floor while the house is online. Offline, this station still works from its cache and queues the change; other devices catch up when the uplink returns. We do not pretend two tablets share a check with no internet.",
      ),
      tip(
        "Ahead and curbside tickets may wait until the guest is marked arrived — see Online fire rules if a ticket “never showed.”",
      ),
      related("kitchen-bar-routing", "device-roles", "wifi-offline", "floor-tables", "printers-kds", "troubleshooting"),
    ],
  }),
  topic({
    id: "online-ahead",
    chapterId: "orders",
    title: "Online, order ahead & table QR",
    summary: "Guest ordering, claim codes, and kitchen fire rules.",
    roles: ["owner_manager", "server", "kitchen_bar"],
    keywords: ["online", "order ahead", "qr", "curbside", "claim code", "fire rules"],
    openView: "online",
    blocks: [
      why(
        "A ticket that fires before the guest exists clogs the board. Fire rules exist so kitchen sees work when it can actually leave the window.",
      ),
      steps(
        "Guest orders on the public page (ahead, pickup, curbside, delivery) or via table QR.",
        "They receive an order number and claim code.",
        "Default for ahead/curbside: wait until arrival.",
        "On arrival: scan table QR → I ordered ahead → claim code, or staff taps Guest arrived on the Online board.",
        "Kitchen receives the ticket according to the channel’s fire rule (immediate, on arrival, delay after order, delay after arrival).",
        "That fire writes a venue print job. A docked host, ODS, or the house print agent sends raw 9100 — the guest phone never prints. If no worker is online, the ticket stays open and stations show “N kitchen tickets waiting to print.”",
      ),
      related("kds", "kitchen-bar-routing", "tenders-tips", "printers-kds"),
    ],
  }),
];
