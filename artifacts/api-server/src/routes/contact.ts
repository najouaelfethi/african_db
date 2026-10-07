import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import * as nodemailer from "nodemailer";
import { z } from "zod";
import {
  assertDb,
  contactRequestsTable,
  type ContactRequestStatus,
} from "@workspace/db";

const router: IRouter = Router();

const requestTypeValues = [
  "General inquiry",
  "Collaboration request",
  "Submit/add research data",
  "Other",
] as const;

const contactRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Please provide a valid email address."),
  institution: z
    .string()
    .trim()
    .min(2, "Institution or organization is required."),
  requestType: z.enum(requestTypeValues, {
    errorMap: () => ({ message: "Please select a valid request type." }),
  }),
  subject: z.string().trim().min(3, "Subject is required."),
  message: z.string().trim().min(10, "Message must contain more detail."),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
});

const statusSchema = z.enum(["Pending", "Valid", "Disapproved"]);

const normalizeRecord = (record: Record<string, unknown>) => ({
  ...record,
  createdAt:
    record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
  updatedAt:
    record.updatedAt instanceof Date
      ? record.updatedAt.toISOString()
      : typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
});

async function sendContactEmail(payload: {
  fullName: string;
  email: string;
  institution: string;
  requestType: string;
  subject: string;
  message: string;
  details?: string;
}) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const adminEmail =
    process.env.CONTACT_EMAIL_TO ?? "africanairdatabase@um6p.ma";

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      "SMTP email configuration is not set. Contact request was stored in the database but no email was sent.",
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const textBody = `New contact/collaboration request\n\nName: ${payload.fullName}\nEmail: ${payload.email}\nInstitution: ${payload.institution}\nRequest type: ${payload.requestType}\nSubject: ${payload.subject}\n\nMessage:\n${payload.message}\n\nAdditional details:\n${payload.details ?? "Not provided"}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? smtpUser,
    to: adminEmail,
    replyTo: payload.email,
    subject: `[Africa Database Contact] ${payload.subject}`,
    text: textBody,
    html: `
      <h2>New contact/collaboration request</h2>
      <p><strong>Name:</strong> ${payload.fullName}</p>
      <p><strong>Email:</strong> ${payload.email}</p>
      <p><strong>Institution:</strong> ${payload.institution}</p>
      <p><strong>Request type:</strong> ${payload.requestType}</p>
      <p><strong>Subject:</strong> ${payload.subject}</p>
      <p><strong>Message:</strong></p>
      <p>${payload.message.replace(/\n/g, "<br />")}</p>
      <p><strong>Additional details:</strong></p>
      <p>${(payload.details ?? "Not provided").replace(/\n/g, "<br />")}</p>
    `,
  });
}

router.get("/v1/contact-requests", async (_req, res) => {
  try {
    const db = assertDb();
    const rows = await db
      .select()
      .from(contactRequestsTable)
      .orderBy(desc(contactRequestsTable.createdAt));

    res.json(
      rows.map((row) => normalizeRecord(row as Record<string, unknown>)),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load contact requests.";

    res.status(503).json({ message });
  }
});

router.post("/v1/contact-requests", async (req, res) => {
  const parsed = contactRequestSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid request payload.",
    });
    return;
  }

  try {
    const db = assertDb();
    const values = {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      institution: parsed.data.institution,
      requestType: parsed.data.requestType,
      subject: parsed.data.subject,
      message: parsed.data.message,
      details: parsed.data.details || null,
      status: "Pending" as ContactRequestStatus,
    };

    const [created] = await db
      .insert(contactRequestsTable)
      .values(values)
      .returning();

    await sendContactEmail({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      institution: parsed.data.institution,
      requestType: parsed.data.requestType,
      subject: parsed.data.subject,
      message: parsed.data.message,
      details: parsed.data.details,
    });

    res.status(201).json(normalizeRecord(created as Record<string, unknown>));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to submit contact request.";

    res.status(503).json({ message });
  }
});

router.patch("/v1/contact-requests/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body?.status);

  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({
      message: "A valid request id and status are required.",
    });
    return;
  }

  try {
    const db = assertDb();
    const [updated] = await db
      .update(contactRequestsTable)
      .set({
        status: parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(contactRequestsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Contact request not found." });
      return;
    }

    res.json(normalizeRecord(updated as Record<string, unknown>));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update contact request status.";

    res.status(503).json({ message });
  }
});

export default router;
