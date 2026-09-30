import { createFileRoute, redirect } from "@tanstack/react-router";

// The old console moved to /master-dashboard; keep this URL working.
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/master-dashboard", replace: true });
  },
});
