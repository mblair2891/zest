/** Full text for production's minified React invariants. Dev builds already include it. */
const REACT_PROD_ERRORS: Record<string, string> = {
  "185":
    "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.",
};

/** Message safe to print in production logs and on the tab error boundary. */
export function reactErrorText(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const code = /Minified React error #(\d+)/.exec(message)?.[1];
  const decoded = code ? REACT_PROD_ERRORS[code] : undefined;
  if (decoded) return `${decoded} (${message})`;
  return message || "Unknown render error";
}
