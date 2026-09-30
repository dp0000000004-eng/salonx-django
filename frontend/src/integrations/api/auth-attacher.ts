import { createMiddleware } from "@tanstack/react-start";
export const attachDjangoAuth = createMiddleware({ type: "function" }).server(async ({ next }) =>
  next(),
);
