import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy public salon-registration route — now replaced by Book a Demo. */
export const Route = createFileRoute("/register-salon")({
  beforeLoad: () => {
    throw redirect({ to: "/book-demo", replace: true });
  },
});
