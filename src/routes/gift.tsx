import { createFileRoute } from "@tanstack/react-router";
import { GuestGiftPage } from "@/components/gift/GuestGiftPage";

export const Route = createFileRoute("/gift")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gift card balance · Summex" },
      {
        name: "description",
        content:
          "Look up a Summex gift card balance with the full number or last four plus PIN. No login.",
      },
    ],
  }),
  component: GiftRoute,
});

function GiftRoute() {
  return <GuestGiftPage />;
}
