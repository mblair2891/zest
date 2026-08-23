import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGuideStore } from "@/lib/guide/store";

export function GuideLearnLink({
  topicId,
  children,
  className,
  compact,
}: {
  topicId: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const openGuide = useGuideStore((s) => s.openGuide);
  return (
    <button
      type="button"
      onClick={() => openGuide(topicId)}
      className={cn(
        "inline-flex items-center gap-1 text-link underline-offset-2 hover:underline",
        compact ? "text-[11px] font-medium" : "text-xs font-medium",
        className,
      )}
    >
      <CircleHelp className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {children ?? "Learn"}
    </button>
  );
}
