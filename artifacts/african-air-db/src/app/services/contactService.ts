export type ContactRequestStatus = "Pending" | "Valid" | "Disapproved";
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

export interface ContactRequestRecord extends ContactRequestPayload {
  id: number;
  status: ContactRequestStatus;
  createdAt: string;
  updatedAt: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse failures and keep the fallback message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function submitContactRequest(
  payload: ContactRequestPayload,
): Promise<ContactRequestRecord> {
  const response = await fetch("/api/v1/contact-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJson<ContactRequestRecord>(response);
}

export async function getContactRequests(): Promise<ContactRequestRecord[]> {
  const response = await fetch("/api/v1/contact-requests", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseJson<ContactRequestRecord[]>(response);
}

export async function updateContactRequestStatus(
  id: number,
  status: ContactRequestStatus,
): Promise<ContactRequestRecord> {
  const response = await fetch(`/api/v1/contact-requests/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  return parseJson<ContactRequestRecord>(response);
}
