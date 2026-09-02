import { Component, type ErrorInfo, type ReactNode } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { PRODUCT_NAME } from "@/lib/platform/brand";

function HomeFallback({ error }: { error?: Error | null }) {
  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 pt-[var(--grok-banner-h,0px)] text-center"
      style={{ background: "#0a0a0a", color: "#f7f6f3" }}
    >
      <p className="text-xs font-semibold tracking-[0.32em] uppercase" style={{ color: "#c4b8a5" }}>
        {PRODUCT_NAME}
      </p>
      <h1 className="max-w-xl font-display text-3xl font-medium text-balance">
        The hospitality OS is still here.
      </h1>
      <p className="max-w-md text-sm leading-relaxed" style={{ color: "#9a9488" }}>
        {error?.message
          ? "The homepage hit a snag. Use Sign in, Get pricing, or the Operators Guide."
          : "Something went wrong loading the homepage."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/login"
          className="inline-flex h-12 min-w-36 items-center justify-center rounded-sm px-6 text-xs font-semibold tracking-widest uppercase"
          style={{ background: "#f7f6f3", color: "#0a0a0a" }}
        >
          Sign in
        </a>
        <a
          href="/get-pricing"
          className="inline-flex h-12 min-w-36 items-center justify-center rounded-sm border px-6 text-xs font-semibold tracking-widest uppercase"
          style={{ borderColor: "rgb(196 184 165 / 0.4)", color: "#f7f6f3" }}
        >
          Get pricing
        </a>
        <a
          href="/guide"
          className="inline-flex h-12 items-center px-2 text-xs font-semibold tracking-widest uppercase"
          style={{ color: "#c4b8a5" }}
        >
          Operators Guide
        </a>
      </div>
    </main>
  );
}

export function HomeRouteError({ error }: ErrorComponentProps) {
  return <HomeFallback error={error} />;
}

type BoundaryState = { error: Error | null };

/** Visible recovery if the sales landing throws — never a white screen. */
export class HomeErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Summex] homepage render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) return <HomeFallback error={this.state.error} />;
    return this.props.children;
  }
}
