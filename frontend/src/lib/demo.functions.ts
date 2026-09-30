import { createServerFn } from "@tanstack/react-start";

export type DemoSubmission = {
  // Step 1 — salon information
  salonName: string;
  salonType: string;
  ownerName: string;
  phone: string;
  email: string;
  whatsapp?: string | undefined;
  description?: string | undefined;
  seats?: number | undefined;
  yearsInBusiness?: number | undefined;
  // Step 2 — location
  address: string;
  state: string;
  district: string;
  city: string;
  area?: string | undefined;
  pinCode: string;
  mapsUrl?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  // Step 3 — business
  openingTime: string;
  closingTime: string;
  weeklyClosedDay?: number | undefined;
  servicesOffered?: string | undefined;
  startingPrice?: number | undefined;
  instagramUrl?: string | undefined;
  facebookUrl?: string | undefined;
  websiteUrl?: string | undefined;
  // credentials
  password: string;
};

export type DemoSubmissionResult = {
  salonId: string;
  user: { id: number; email: string; username: string; full_name: string; role: string };
  access: string;
  refresh: string;
};

function req(value: string | undefined, label: string) {
  if (!value || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

/**
 * Public onboarding endpoint for "Book a Demo".
 * Creates the owner account, profile, salon record and demo request in one pass.
 * The salon stays pending + inactive until a Super Admin approves it.
 */
export const submitDemoRequest = createServerFn({ method: "POST" })
  .inputValidator((input: DemoSubmission) => {
    req(input.salonName, "Salon name");
    req(input.salonType, "Salon type");
    req(input.ownerName, "Owner name");
    req(input.phone, "Mobile number");
    req(input.address, "Full address");
    req(input.state, "State");
    req(input.district, "District");
    req(input.pinCode, "Pincode");
    req(input.openingTime, "Opening time");
    req(input.closingTime, "Closing time");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
      throw new Error("A valid email is required.");
    if (!input.password || input.password.length < 8)
      throw new Error("Password must be at least 8 characters.");
    return input;
  })
  .handler(async ({ data }) => {
    const { API_URL } = await import("@/lib/api-client");
    const response = await fetch(`${API_URL}/demo/submit/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { error: text };
    }
    if (!response.ok) {
      const detail = body["error"] || body["detail"];
      const validationErrors = Object.entries(body)
        .map(
          ([field, errors]) =>
            `${field}: ${Array.isArray(errors) ? errors.join(", ") : String(errors)}`,
        )
        .join("; ");
      throw new Error(
        String(detail || validationErrors || `Demo request failed (${response.status}).`),
      );
    }
    if (
      typeof body["salonId"] !== "string" ||
      typeof body["access"] !== "string" ||
      typeof body["refresh"] !== "string" ||
      !body["user"] ||
      typeof body["user"] !== "object"
    ) {
      throw new Error(
        "The backend created the demo request but did not return a usable account session.",
      );
    }
    return body as unknown as DemoSubmissionResult;
  });
