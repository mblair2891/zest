import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Isolates a venue-console tab so a render loop cannot unmount the chrome. */
export class TabErrorBoundary extends Component<
  { children: ReactNode; tab: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Summex] tab ${this.props.tab}`, error, info.componentStack);
  }

  componentDidUpdate(prev: { tab: string }) {
    if (prev.tab !== this.props.tab && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg space-y-3 p-4 text-center" data-demo="tab-error">
          <p className="text-sm font-medium">This tab hit an error.</p>
          <p className="break-all font-mono text-[11px] text-danger">{this.state.error.message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
