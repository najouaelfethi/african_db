import { apiUrl } from "./apiUrl";

export type ContactRequestType =
  | "General inquiry"
  | "Collaboration request"
  | "Submit/add research data"
  | "Other";

export interface ContactRequestPayload {
  fullName: string;
  email: string;
  institution: string;
  requestType: ContactRequestType;
  subject: string;
  message: string;
  details?: string;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  } catch {
    // Non-JSON error body: use the status fallback below.
  }
  return `Request failed with status ${response.status}`;
}

export async function submitContactRequest(
  payload: ContactRequestPayload,
): Promise<{ id: string; status: string }> {
  const response = await fetch(apiUrl("/api/v1/contact-requests"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: payload.fullName,
      email: payload.email,
      institution: payload.institution,
      request_type: payload.requestType,
      subject: payload.subject,
      message: payload.message,
      details: payload.details || null,
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as { id: string; status: string };
}
