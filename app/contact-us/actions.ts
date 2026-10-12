"use server";

import nodemailer from "nodemailer";

// The demo form's fields, named by their doc labels (DemoForm.tsx). The first five are required.
const FIELDS = [
  "Full name", "Email address", "Phone number, with country code", "Rotary club name", "District number",
  "Your role", "I am interested in", "Message",
] as const;
const REQUIRED = FIELDS.slice(0, 5);

export type Values = Partial<Record<(typeof FIELDS)[number], string>>;
export type SendState = { status: "idle" | "sent" | "error"; values?: Values; at?: number }; // at: when it failed

/** Emails a demo request to the ROW team. SMTP settings come from the environment (see .env.example). */
export async function sendDemoRequest(_prev: SendState, form: FormData): Promise<SendState> {
  // Bots fill every field, including the hidden one: pretend it worked and send nothing
  if (String(form.get("website") ?? "")) return { status: "sent" };

  const values: Values = {};
  for (const f of FIELDS) {
    const raw = String(form.get(f) ?? "").trim();
    // one line each (keeps the subject and body clean), the message may wrap; lengths are capped
    values[f] = f === "Message" ? raw.slice(0, 4000) : raw.replace(/\s+/g, " ").slice(0, 200);
  }
  const email = values["Email address"] ?? "";
  if (REQUIRED.some((f) => !values[f]) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", values, at: Date.now() };

  const { SMTP_HOST, SMTP_PORT = "587", SMTP_USER, SMTP_PASS } = process.env;
  const from = process.env.MAIL_FROM || "web@kaizeninfotech.com";
  const to = process.env.MAIL_TO || "naren@kaizeninfotech.com";
  if (!SMTP_HOST || !SMTP_PASS) {
    console.error("[contact] SMTP_HOST and SMTP_PASS are not set, so the demo request was not emailed");
    return { status: "error", values, at: Date.now() };
  }

  try {
    const port = Number(SMTP_PORT);
    await nodemailer
      .createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER || from, pass: SMTP_PASS } })
      .sendMail({
        from: { name: "Roster On Wheels", address: from },
        to,
        replyTo: email, // a reply goes straight to the person who asked
        subject: `Book a free demo: ${values["Rotary club name"]}`,
        text: FIELDS.filter((f) => values[f]).map((f) => `${f}: ${values[f]}`).join("\n"),
      });
    return { status: "sent" };
  } catch (err) {
    console.error("[contact] the demo request email failed", err);
    return { status: "error", values, at: Date.now() };
  }
}
