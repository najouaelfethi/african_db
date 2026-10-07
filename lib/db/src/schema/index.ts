import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "Pending",
  "Valid",
  "Disapproved",
]);

export const contactRequestsTable = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  institution: text("institution").notNull(),
  requestType: text("request_type").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  details: text("details"),
  status: contactRequestStatusEnum("status").default("Pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertContactRequestSchema = createInsertSchema(
  contactRequestsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type ContactRequestStatus = "Pending" | "Valid" | "Disapproved";
export type ContactRequest = typeof contactRequestsTable.$inferSelect;
