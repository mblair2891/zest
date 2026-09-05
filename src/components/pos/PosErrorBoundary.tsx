import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SummexMark } from "@/components/brand/SummexMark";
import { isProspectDemo } from "@/lib/demo/session";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function isRealTenant(): boolean {
  try {
    if (isProspectDemo()) return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Catches render crashes (incl. max update depth) and offers a clean recovery. */
export class PosErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Summex] render error", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private clearDemoAndReload = () => {
    if (isRealTenant()) {
      this.reload();
      return;
    }
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("summex-") || k.startsWith("zest-") || k.startsWith("blair") || k.startsWith("harbor"))) {
          keys.push(k);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const real = isRealTenant();
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg px-6 pt-[var(--grok-banner-h,0px)] text-center">
          <SummexMark className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-foreground">
            Summex hit a snag
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {real
              ? "Something went wrong loading this location. Reload to continue. This does not erase the house."
              : "Something went wrong loading the console. Reloading usually fixes it."}
          </p>
          <p className="max-w-lg break-all font-mono text-[11px] text-danger">
            {this.state.error.message}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={this.reload}>Reload</Button>
            {!real && (
              <Button variant="outline" onClick={this.clearDemoAndReload}>
                Reset demo data & reload
              </Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
