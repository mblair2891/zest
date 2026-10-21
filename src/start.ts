import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { logSetupPayload, sanitizeFetchedResponse, setupFailureResponse } from "@/lib/pos/setup-response";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serverFns: {
    fetch: async (input, init) => {
      try {
        const response = await fetch(input, init);
        return sanitizeFetchedResponse(response, "server-fn");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        logSetupPayload("server-fn", 0, msg, "");
        return setupFailureResponse();
      }
    },
  },
}));
