import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";
import {
  submitContactRequest,
  type ContactRequestPayload,
  type ContactRequestType,
} from "./services/contactService";

const REQUEST_TYPES: ContactRequestType[] = [
  "General inquiry",
  "Collaboration request",
  "Submit/add research data",
  "Other",
];

const initialForm: ContactRequestPayload = {
  fullName: "",
  email: "",
  institution: "",
  requestType: "General inquiry",
  subject: "",
  message: "",
  details: "",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ContactPage({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<ContactRequestPayload>(initialForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ContactRequestPayload, string>>
  >({});
  const [submitState, setSubmitState] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof ContactRequestPayload>(
    key: K,
    value: ContactRequestPayload[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitState(null);
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof ContactRequestPayload, string>> = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Please enter your full name.";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!isValidEmail(form.email)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!form.institution.trim()) {
      nextErrors.institution = "Please enter your institution or organization.";
    }
    if (!form.subject.trim()) {
      nextErrors.subject = "Please enter a subject.";
    }
    if (!form.message.trim()) {
      nextErrors.message = "Please enter your message.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) {
      setSubmitState({
        type: "error",
        message: "Please fix the highlighted fields and try again.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitState(null);

    try {
      await submitContactRequest({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        institution: form.institution.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        details: form.details?.trim() || "",
      });

      setForm(initialForm);
      setSubmitState({
        type: "success",
        message:
          "Your request has been submitted successfully. Our team will review it shortly.",
      });
    } catch (error) {
      setSubmitState({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The request could not be submitted. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 lg:px-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Contact
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Get in touch with the Africa Database team
            </h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:border-primary/30 hover:text-primary transition"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-7"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-1">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Full name
                </span>
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    updateField("fullName", event.target.value)
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  placeholder="Your full name"
                  aria-invalid={Boolean(errors.fullName)}
                />
                {errors.fullName && (
                  <span className="mt-1 block text-[11px] text-destructive">
                    {errors.fullName}
                  </span>
                )}
              </label>

              <label className="block md:col-span-1">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Email address
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  placeholder="name@institution.org"
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && (
                  <span className="mt-1 block text-[11px] text-destructive">
                    {errors.email}
                  </span>
                )}
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Institution / organization
                </span>
                <input
                  value={form.institution}
                  onChange={(event) =>
                    updateField("institution", event.target.value)
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  placeholder="University, research center, etc."
                  aria-invalid={Boolean(errors.institution)}
                />
                {errors.institution && (
                  <span className="mt-1 block text-[11px] text-destructive">
                    {errors.institution}
                  </span>
                )}
              </label>

              <label className="block md:col-span-1">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Request type
                </span>
                <select
                  value={form.requestType}
                  onChange={(event) =>
                    updateField(
                      "requestType",
                      event.target.value as ContactRequestType,
                    )
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                >
                  {REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-1">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Subject
                </span>
                <input
                  value={form.subject}
                  onChange={(event) =>
                    updateField("subject", event.target.value)
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  placeholder="Brief summary of your request"
                  aria-invalid={Boolean(errors.subject)}
                />
                {errors.subject && (
                  <span className="mt-1 block text-[11px] text-destructive">
                    {errors.subject}
                  </span>
                )}
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Message / request
                </span>
                <textarea
                  value={form.message}
                  onChange={(event) =>
                    updateField("message", event.target.value)
                  }
                  rows={6}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  placeholder="Tell us more about your inquiry, collaboration idea, or data contribution."
                  aria-invalid={Boolean(errors.message)}
                />
                {errors.message && (
                  <span className="mt-1 block text-[11px] text-destructive">
                    {errors.message}
                  </span>
                )}
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-[11px] font-medium text-foreground">
                  Additional details or dataset / link
                </span>
                <textarea
                  value={form.details ?? ""}
                  onChange={(event) =>
                    updateField("details", event.target.value)
                  }
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  placeholder="Optional: datasets, reports, links, or relevant context"
                />
              </label>
            </div>

            {submitState && (
              <div
                className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                  submitState.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {submitState.type === "success" ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                )}
                <span>{submitState.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={16} />
              {isSubmitting ? "Submitting…" : "Submit request"}
            </button>
          </form>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Direct contact
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">
                    ARC AIR team
                  </h2>
                </div>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  We review new inquiries, collaboration proposals, and research
                  data submissions on a regular basis.
                </p>
                <p>
                  Email:{" "}
                  <a
                    href="mailto:africanairdatabase@um6p.ma"
                    className="font-medium text-primary hover:underline"
                  >
                    africanairdatabase@um6p.ma
                  </a>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
