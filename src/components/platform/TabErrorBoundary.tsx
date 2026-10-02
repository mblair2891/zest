import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reactErrorText } from "@/components/platform/react-error-text";

/** Isolates a venue-console tab so a render loop cannot unmount the chrome. */
export class TabErrorBoundary extends Component<
  { children: ReactNode; tab: string },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: reactErrorText(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(
      `[Summex] tab ${this.props.tab}: ${reactErrorText(error)}`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prev: { tab: string }) {
    if (prev.tab !== this.props.tab && this.state.message) {
      this.setState({ message: null });
    }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="mx-auto max-w-lg space-y-3 p-4 text-center" data-demo="tab-error">
          <p className="text-sm font-medium">This tab hit an error.</p>
          <p className="break-all font-mono text-[11px] text-danger">{this.state.message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ message: null })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
