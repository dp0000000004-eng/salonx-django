import { api } from "@/lib/api-client";

export type TestResult = { ok: boolean; implemented: boolean; message: string };

/**
 * Gateway test is intentionally honest: the payment-provider integration is not
 * implemented in the Django backend yet, so this can never report "connected".
 */
export async function testGateway(provider: "razorpay" | "phonepe"): Promise<TestResult> {
  if (provider !== "razorpay" && provider !== "phonepe") {
    return { ok: false, implemented: false, message: "Unknown payment gateway." };
  }

  const { data, error } = await api.rpc("payment_gateway_test", { provider });
  if (error) throw new Error(error.message);

  return (data ?? {
    ok: false,
    implemented: false,
    message: "Payment gateway integration is not implemented in the Django backend yet.",
  }) as TestResult;
}
