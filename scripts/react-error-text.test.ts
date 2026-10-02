import assert from "node:assert/strict";
import test from "node:test";
import { reactErrorText } from "../src/components/platform/react-error-text.ts";

test("production React #185 logs the real maximum-update-depth message", () => {
  const minified =
    "Minified React error #185; visit https://react.dev/errors/185 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  const text = reactErrorText(new Error(minified));
  assert.match(text, /Maximum update depth exceeded/);
  assert.match(text, /#185/);
});
