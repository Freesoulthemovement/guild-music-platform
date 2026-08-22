/**
 * Black-box checks against a deployed instance.
 *
 * Everything here runs from outside, the way a member's browser would, so it
 * catches the class of problem that never appears in local testing: a proxy
 * that strips headers, a cookie that will not set over the real TLS chain, a
 * demo account that survived into production.
 *
 * Usage:
 *   npm run preflight -- https://yourdomain.com
 *   npm run preflight -- https://yourdomain.com --register
 *
 * --register additionally creates one throwaway account to exercise signup,
 * session and upload configuration. It leaves that account behind; delete it
 * afterwards, or run it only against a staging database.
 */

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const doRegister = process.argv.includes("--register");

if (!base.startsWith("http")) {
  console.error("Usage: npm run preflight -- https://yourdomain.com [--register]");
  process.exit(1);
}

type Level = "PASS" | "FAIL" | "WARN" | "INFO";
const results: { level: Level; label: string; detail?: string }[] = [];
const note = (level: Level, label: string, detail?: string) =>
  results.push({ level, label, detail });

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(base + path, { redirect: "manual", ...init });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* html or redirect */ }
  return { res, text, json };
}

async function main() {
  // ── Reachability ──────────────────────────────────────────────────────────
  if (!base.startsWith("https://")) {
    note("FAIL", "Served over HTTPS",
      "Session cookies are marked Secure in production and will not be set over http.");
  } else {
    note("PASS", "Served over HTTPS");
  }

  try {
    const { res } = await call("/");
    res.status === 200
      ? note("PASS", "Client app is served", `GET / returned ${res.status}`)
      : note("FAIL", "Client app is served", `GET / returned ${res.status}. Did the build run?`);
  } catch (err: any) {
    note("FAIL", "Host reachable", err.message);
    report();
    return;
  }

  // ── Health ────────────────────────────────────────────────────────────────
  const health = await call("/api/health");
  health.json?.status === "ok"
    ? note("PASS", "Liveness probe", `uptime ${health.json.uptime}s`)
    : note("FAIL", "Liveness probe", `Expected {status:"ok"}, got ${health.res.status}`);

  const ready = await call("/api/health/ready");
  if (ready.json?.database === "up") {
    note("PASS", "Database reachable");
  } else {
    note("FAIL", "Database reachable",
      `${ready.json?.error ?? ready.res.status}. Check DATABASE_URL, and that npm run db:push has been run.`);
  }

  // ── Demo accounts must not exist in production ────────────────────────────
  const demo = await call("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "circle-dev-password" }),
  });
  demo.res.status === 200
    ? note("FAIL", "Demo accounts absent",
        "alice@example.com signed in. The seed ran against this database — delete those accounts now.")
    : note("PASS", "Demo accounts absent", `login refused with ${demo.res.status}`);

  // ── Stripe webhook endpoint ───────────────────────────────────────────────
  const hook = await call("/api/stripe/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hello: "world" }),
  });
  if (hook.res.status === 400) {
    note("PASS", "Stripe webhook rejects unsigned posts", "signature verification is active");
  } else {
    note("FAIL", "Stripe webhook rejects unsigned posts",
      `Expected 400, got ${hook.res.status}. An unsigned payload must never be accepted.`);
  }

  // ── Signup, session and storage ───────────────────────────────────────────
  if (!doRegister) {
    note("INFO", "Signup and upload checks skipped", "re-run with --register to include them");
  } else {
    const stamp = Date.now();
    const email = `preflight+${stamp}@example.com`;
    const username = `preflight${stamp}`.slice(0, 28);

    const reg = await call("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "preflight-check-password", username }),
    });

    if (reg.res.status !== 201) {
      note("FAIL", "Registration works", `${reg.res.status} ${reg.json?.message ?? ""}`);
    } else {
      note("PASS", "Registration works", `created ${username}`);

      const setCookie = reg.res.headers.get("set-cookie") ?? "";
      if (!setCookie) {
        note("FAIL", "Session cookie is set",
          "No Set-Cookie. Behind a proxy this usually means trust proxy is not taking effect.");
      } else {
        const flags = ["HttpOnly", "Secure", "SameSite"].filter((f) => setCookie.includes(f));
        flags.length === 3
          ? note("PASS", "Session cookie hardened", flags.join(", "))
          : note("FAIL", "Session cookie hardened", `missing ${["HttpOnly","Secure","SameSite"].filter(f => !flags.includes(f)).join(", ")}`);
      }

      const cookie = setCookie.split(";")[0];
      const presign = await call("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          filename: "preflight.wav", contentType: "audio/wav",
          sizeBytes: 1024, folder: "files",
        }),
      });

      if (presign.res.status === 200) {
        note("PASS", "Object storage configured", "presigned upload URL issued");
        try {
          const host = new URL(presign.json.uploadUrl).origin;
          const cors = await fetch(presign.json.uploadUrl, {
            method: "OPTIONS",
            headers: {
              Origin: base,
              "Access-Control-Request-Method": "PUT",
              "Access-Control-Request-Headers": "content-type",
            },
          });
          const allow = cors.headers.get("access-control-allow-origin");
          allow
            ? note("PASS", "R2 CORS allows this origin", `${host} -> ${allow}`)
            : note("FAIL", "R2 CORS allows this origin",
                `No Access-Control-Allow-Origin from ${host}. Browser uploads will fail silently while the server looks fine. Add a CORS rule for ${base}.`);
        } catch (err: any) {
          note("WARN", "R2 CORS check", err.message);
        }
      } else if (presign.res.status === 503) {
        note("WARN", "Object storage configured",
          "Uploads return 503 — R2 env vars are unset. Fine for a first deploy; required before members upload.");
      } else {
        note("FAIL", "Object storage configured",
          `presign returned ${presign.res.status} ${presign.json?.message ?? ""}`);
      }

      note("INFO", "Throwaway account left behind", `${email} — delete it before launch`);
    }
  }

  report();
}

function report() {
  const width = Math.max(...results.map((r) => r.label.length)) + 2;
  const colour: Record<Level, string> = {
    PASS: "\x1b[32m", FAIL: "\x1b[31m", WARN: "\x1b[33m", INFO: "\x1b[36m",
  };
  console.log(`\nPreflight — ${base}\n${"─".repeat(width + 50)}`);
  for (const r of results) {
    console.log(`${colour[r.level]}${r.level.padEnd(5)}\x1b[0m ${r.label.padEnd(width)} ${r.detail ?? ""}`);
  }
  const failed = results.filter((r) => r.level === "FAIL").length;
  const warned = results.filter((r) => r.level === "WARN").length;
  console.log("─".repeat(width + 50));
  console.log(failed === 0
    ? `No failures${warned ? `, ${warned} warning(s)` : ""}.`
    : `${failed} failure(s) — address these before inviting anyone.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Preflight crashed:", err.message);
  process.exit(1);
});
