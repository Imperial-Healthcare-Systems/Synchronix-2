import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Nodemailer needs the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_LABELS = {
  name: "Contact Name",
  companyName: "Company Name",
  contact: "Contact Number",
  phone: "Phone",
  email: "Email",
  region: "Coverage",
  regionDetail: "Region(s) specified",
  service: "Service of interest",
  vendorService: "Vendor / Service Category",
  vendorOther: "Other category (specified)",
  message: "Message",
};

function esc(s) {
  return String(s == null ? "" : s).replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}

export async function POST(req) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: silently accept (and drop) obvious bots.
  if (data._hp) return NextResponse.json({ ok: true });

  const formType = data._form === "partner" ? "Partner Registration" : "Contact Enquiry";

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const to = process.env.CONTACT_TO || "info@synchronixintegrated.com";
  const from = process.env.CONTACT_FROM || user;

  if (!host || !user || !pass) {
    // Not configured yet — tell the client clearly (logged server-side too).
    console.error("[contact] SMTP env vars missing (SMTP_HOST/SMTP_USER/SMTP_PASS).");
    return NextResponse.json(
      { ok: false, error: "Email service is not configured yet." },
      { status: 503 }
    );
  }

  // Build the email body from submitted fields (skip internal _ keys and empties).
  const entries = Object.entries(data).filter(
    ([k, v]) => !k.startsWith("_") && String(v ?? "").trim() !== ""
  );
  const rows = entries
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#1b3a4b;vertical-align:top;white-space:nowrap">${esc(
          FIELD_LABELS[k] || k
        )}</td><td style="padding:6px 0;color:#16201c">${esc(v)}</td></tr>`
    )
    .join("");
  const text = entries.map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v}`).join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#16201c">
    <h2 style="color:#1b3a4b;margin:0 0 4px">New ${esc(formType)}</h2>
    <p style="color:#5c6b63;margin:0 0 18px">Submitted via the Synchronix website.</p>
    <table style="border-collapse:collapse">${rows}</table>
  </div>`;

  // 465 = implicit TLS, 587 = STARTTLS. Allow explicit override for self-hosted servers.
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  // Self-hosted (Hestia/Exim) mail certs sometimes don't match the SMTP host.
  // Set SMTP_TLS_REJECT_UNAUTHORIZED=false to accept a self-signed / mismatched cert.
  const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });

  try {
    await transporter.sendMail({
      from: `"Synchronix Website" <${from}>`,
      to,
      replyTo: data.email || undefined,
      subject: `${formType} — ${data.name || data.companyName || "Website"}`,
      text,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] sendMail failed:", err?.message || err);
    return NextResponse.json({ ok: false, error: "Failed to send message." }, { status: 502 });
  }
}
