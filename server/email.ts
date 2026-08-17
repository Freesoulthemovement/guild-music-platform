import { log } from "./index";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Transactional email delivery.
 *
 * Talks to Resend over plain HTTP rather than through their SDK, which keeps
 * this dependency-free and makes switching providers a change to this one
 * function — Postmark and SES differ only in URL, headers and body shape.
 *
 * With no API key configured the message is logged instead of sent, so the
 * whole reset and verification flow is exercisable locally without an account.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    log(
      `email not sent (RESEND_API_KEY/EMAIL_FROM unset) -> to=${message.to} subject="${message.subject}"`,
      "email",
    );
    log(message.text.replace(/\n/g, " | "), "email");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email delivery failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/** Absolute base URL for links in emails. Falls back to the request's own origin. */
export function appBaseUrl(fallback: string): string {
  return (process.env.APP_BASE_URL || fallback).replace(/\/$/, "");
}

const wrap = (heading: string, body: string, button?: { label: string; url: string }) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0b0f;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#14141b;border:1px solid #26262f;border-radius:16px;padding:32px;color:#e6e6ea">
    <h1 style="margin:0 0 16px;font-size:20px;color:#fff">${heading}</h1>
    <p style="margin:0 0 24px;line-height:1.6;color:#b4b4c0">${body}</p>
    ${
      button
        ? `<a href="${button.url}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${button.label}</a>
    <p style="margin:24px 0 0;font-size:12px;color:#75758a;word-break:break-all">Or paste this into your browser:<br>${button.url}</p>`
        : ""
    }
  </div>
</div>`;

export function passwordResetEmail(url: string, minutes: number): Omit<EmailMessage, "to"> {
  return {
    subject: "Reset your Producers Circle password",
    html: wrap(
      "Reset your password",
      `Someone asked to reset the password for this account. This link expires in ${minutes} minutes and can be used once. If it wasn't you, no action is needed — your password has not changed.`,
      { label: "Reset password", url },
    ),
    text: `Reset your Producers Circle password.\n\nThis link expires in ${minutes} minutes and can only be used once:\n${url}\n\nIf you did not request this, ignore this email — your password has not changed.`,
  };
}

export function verifyEmailEmail(url: string, hours: number): Omit<EmailMessage, "to"> {
  return {
    subject: "Confirm your email for the Producers Circle",
    html: wrap(
      "Confirm your email",
      `Confirm this address to finish setting up your Producers Circle account. This link expires in ${hours} hours.`,
      { label: "Confirm email", url },
    ),
    text: `Confirm your email for the Producers Circle.\n\nThis link expires in ${hours} hours:\n${url}`,
  };
}
