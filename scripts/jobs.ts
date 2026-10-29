/**
 * Timed jobs, run by the server's own scheduler (crontab), right after the
 * nightly backup:
 *
 *   npm run jobs:daily
 *
 * 1. Removes expired sessions, old one-time codes and notifications past each
 *    organization's retention.
 * 2. Finishes deletions whose 30-day grace period has passed: organizations
 *    are removed with their files; user accounts are anonymised.
 *
 * The activity log is never purged (audit trail requirement).
 */
import "dotenv/config";
import { anonymiseUser, organizationsDueForDeletion, purgeExpired, purgeOrganization, usersDueForDeletion } from "@/server/db/purge";
import { raw } from "@/server/db/raw";

async function daily() {
  const started = Date.now();
  const expired = await purgeExpired();
  console.log(`[jobs] removed ${expired.sessions} sessions, ${expired.codes} codes, ${expired.notifications} notifications`);

  for (const organization of await organizationsDueForDeletion()) {
    await purgeOrganization(organization.id);
    await raw.platformAuditLog.create({
      data: { action: "organization-deleted", targetOrganizationId: organization.id, detail: { legalName: organization.legalName } },
    });
    console.log(`[jobs] deleted organization ${organization.id}`);
  }

  for (const user of await usersDueForDeletion()) {
    await anonymiseUser(user.id);
    console.log(`[jobs] anonymised user ${user.id}`);
  }

  console.log(`[jobs] daily run finished in ${Date.now() - started} ms`);
}

const command = process.argv[2];
if (command !== "daily") {
  console.error("Usage: npm run jobs:daily");
  process.exit(1);
}

daily()
  .catch((error) => {
    console.error("[jobs] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => raw.$disconnect());
