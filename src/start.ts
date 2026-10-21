import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { sanitizeFetchedResponse } from "@/lib/pos/setup-response";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serverFns: {
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      return sanitizeFetchedResponse(response, "server-fn");
    },
  },
}));
