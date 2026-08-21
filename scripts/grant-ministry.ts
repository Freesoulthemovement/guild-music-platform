/**
 * Grants the ministry (administrator) role to an existing account.
 *
 * Needed once per environment: /api/admin/grant-ministry requires the caller
 * to already hold the role, so a fresh production database has no way to
 * create the first administrator through the app.
 *
 * Usage:
 *   npx tsx scripts/grant-ministry.ts you@example.com
 *   npx tsx scripts/grant-ministry.ts --username yourhandle
 *   npx tsx scripts/grant-ministry.ts --revoke you@example.com
 */
import { storage } from "../server/storage";
import { pool } from "../server/db";

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const byUsername = args.includes("--username");
  const identifier = args.find((a) => !a.startsWith("--"));

  if (!identifier) {
    console.error(
      "Usage: npx tsx scripts/grant-ministry.ts <email|--username handle> [--revoke]",
    );
    process.exit(1);
  }

  const user = byUsername
    ? await storage.getUserByUsername(identifier)
    : await (async () => {
        const credential = await storage.getCredentialByEmail(identifier);
        return credential ? storage.getUser(credential.userId) : undefined;
      })();

  if (!user) {
    console.error(
      `No account found for ${identifier}. ` +
        `Register through the app first, then run this again.`,
    );
    process.exit(1);
  }

  const current = user.roles ?? [];
  const has = current.includes("ministry");

  if (revoke) {
    if (!has) {
      console.log(`${user.username} does not have the ministry role. Nothing to do.`);
    } else {
      const updated = await storage.updateUserRoles(
        user.id,
        current.filter((r) => r !== "ministry"),
      );
      console.log(`Revoked ministry from ${user.username}. Roles: ${(updated.roles ?? []).join(", ") || "(none)"}`);
    }
  } else if (has) {
    console.log(`${user.username} already has the ministry role.`);
  } else {
    const updated = await storage.updateUserRoles(user.id, [...current, "ministry"]);
    console.log(`Granted ministry to ${user.username}. Roles: ${(updated.roles ?? []).join(", ")}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
