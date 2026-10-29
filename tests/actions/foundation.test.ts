import { beforeAll, describe, expect, it, vi } from "vitest";
import { raw } from "@/server/db/raw";
import { hashToken, newToken } from "@/server/security/tokens";
import { as, isNotFound, newBrowser, redirectOf } from "../setup/request";

vi.mock("next/headers", async () => (await import("../setup/request")).nextHeadersMock);

/**
 * The real server actions and page guards, called as different people.
 * Rule 4: every permission is checked on the server — so these tests call the
 * actions directly, as a script would, without any UI hiding buttons.
 */

const { signUpAction, acceptInviteAction, loginAction } = await import("@/app/(auth)/actions");
const { saveBranchAction, saveWarehouseAction, saveCompanyProfileAction } = await import("@/app/app/(shell)/settings/actions");
const { inviteMemberAction, changeMemberRoleAction, removeMemberAction } = await import("@/app/app/(shell)/settings/members/actions");
const { saveRoleAction } = await import("@/app/app/(shell)/settings/roles/actions");
const { requestOrganizationDeletionAction, cancelOrganizationDeletionAction } = await import(
  "@/app/app/(shell)/settings/delete-organization/actions"
);
const { switchOrganizationAction } = await import("@/app/app/actions");
const { requestAccountDeletionAction } = await import("@/app/app/(shell)/account/actions");
const { getAppContext, requirePage } = await import("@/server/auth/context");
const { purgeOrganization, anonymiseUser } = await import("@/server/db/purge");
const { SUPPORT_COOKIE } = await import("@/server/platform/support");

type Browser = ReturnType<typeof newBrowser>;

async function signUp(name: string, email: string, organizationName: string): Promise<Browser> {
  const browser = newBrowser();
  as(browser);
  const to = await redirectOf(() =>
    signUpAction({ name, email, password: "correct horse battery", organizationName, stateCode: "29", acceptPolicies: true }),
  );
  expect(to).toBe("/verify-email");
  await raw.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  return browser;
}

async function orgIdOf(browser: Browser): Promise<string> {
  as(browser);
  const result = await getAppContext();
  if (result.status !== "ok") throw new Error(`no context: ${result.status}`);
  return result.ctx.org.id;
}

async function invite(owner: Browser, email: string, roleKey: string): Promise<Browser> {
  const orgId = await orgIdOf(owner);
  const role = await raw.role.findUniqueOrThrow({ where: { organizationId_key: { organizationId: orgId, key: roleKey } } });
  as(owner);
  const result = await inviteMemberAction({ email, roleId: role.id });
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  const token = result.ok ? result.data!.link.split("/invite/")[1]! : "";
  const member = newBrowser();
  as(member);
  const to = await redirectOf(() =>
    acceptInviteAction({ token, name: email.split("@")[0], password: "another long password", acceptPolicies: true }),
  );
  expect(to).toBe("/app");
  return member;
}

let owner: Browser;
let ownerOrg: string;
let sales: Browser;

beforeAll(async () => {
  owner = await signUp("Asha Rao", "asha@alpha.test", "Alpha Traders");
  ownerOrg = await orgIdOf(owner);
  sales = await invite(owner, "ravi@alpha.test", "SALES");
});

describe("sign-up", () => {
  it("creates the organization with everything it starts with", async () => {
    const [roles, branches, warehouses, years, series, members] = await Promise.all([
      raw.role.count({ where: { organizationId: ownerOrg } }),
      raw.branch.findMany({ where: { organizationId: ownerOrg } }),
      raw.warehouse.count({ where: { organizationId: ownerOrg } }),
      raw.financialYear.count({ where: { organizationId: ownerOrg } }),
      raw.numberSeries.count({ where: { organizationId: ownerOrg } }),
      raw.membership.findMany({ where: { organizationId: ownerOrg }, include: { role: true } }),
    ]);
    expect(roles).toBe(7);
    expect(branches).toHaveLength(1);
    expect(branches[0]!.isHeadOffice).toBe(true);
    expect(warehouses).toBe(1);
    expect(years).toBe(1);
    expect(series).toBe(17);
    expect(members.find((member) => member.role.key === "OWNER")).toBeTruthy();
  });

  it("records acceptance of the current Terms and Privacy Policy", async () => {
    const user = await raw.user.findUniqueOrThrow({ where: { email: "asha@alpha.test" } });
    expect(await raw.policyAcceptance.count({ where: { userId: user.id } })).toBe(2);
  });

  it("refuses a second account with the same email", async () => {
    as(newBrowser());
    const result = await signUpAction({
      name: "X",
      email: "asha@alpha.test",
      password: "correct horse battery",
      organizationName: "X",
      stateCode: "29",
      acceptPolicies: true,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong password with a generic message", async () => {
    as(newBrowser());
    const result = await loginAction({ email: "asha@alpha.test", password: "wrong password!" });
    expect(result).toMatchObject({ ok: false, message: "That email and password don't match." });
  });
});

describe("permissions are checked on the server", () => {
  it("lets the Owner add a branch, with its own number series", async () => {
    as(owner);
    const result = await saveBranchAction({ name: "Bengaluru", code: "BLR", stateCode: "29", isActive: true });
    expect(result.ok).toBe(true);
    const branch = await raw.branch.findFirstOrThrow({ where: { organizationId: ownerOrg, code: "BLR" } });
    const prefixes = await raw.numberSeries.findMany({ where: { branchId: branch.id }, select: { prefix: true } });
    expect(prefixes).toHaveLength(17);
    expect(prefixes.map((row) => row.prefix)).toContain("INBLR/{FY}/");
  });

  it("refuses settings and members to a Sales role, and 404s the page", async () => {
    as(sales);
    expect(await saveBranchAction({ name: "Sneaky", code: "SNK", stateCode: "29", isActive: true })).toMatchObject({
      ok: false,
      message: "You don't have permission to do that.",
    });
    const role = await raw.role.findFirstOrThrow({ where: { organizationId: ownerOrg, key: "VIEWER" } });
    expect((await inviteMemberAction({ email: "x@alpha.test", roleId: role.id })).ok).toBe(false);
    expect(await isNotFound(() => requirePage("settings.write"))).toBe(true);
    expect(await isNotFound(() => requirePage("owner"))).toBe(true);
  });

  it("never lets anyone assign a role above their own", async () => {
    // A manager role ranked 20 with users.manage and roles.manage.
    as(owner);
    const created = await saveRoleAction({
      name: "Office manager",
      description: null,
      rank: 20,
      capabilities: ["users.manage", "roles.manage", "settings.write"],
    });
    expect(created.ok).toBe(true);
    const managerRole = await raw.role.findFirstOrThrow({ where: { organizationId: ownerOrg, name: "Office manager" } });
    const manager = await invite(owner, "meera@alpha.test", managerRole.key);

    as(manager);
    const ownerRole = await raw.role.findFirstOrThrow({ where: { organizationId: ownerOrg, key: "OWNER" } });
    const accountant = await raw.role.findFirstOrThrow({ where: { organizationId: ownerOrg, key: "ACCOUNTANT" } });
    expect((await inviteMemberAction({ email: "boss@alpha.test", roleId: ownerRole.id })).ok).toBe(false);
    expect((await inviteMemberAction({ email: "acc@alpha.test", roleId: accountant.id })).ok).toBe(false);

    const ownerMembership = await raw.membership.findFirstOrThrow({ where: { organizationId: ownerOrg, roleId: ownerRole.id } });
    expect((await removeMemberAction({ membershipId: ownerMembership.id })).ok).toBe(false);
    expect((await changeMemberRoleAction({ membershipId: ownerMembership.id, roleId: managerRole.id })).ok).toBe(false);

    // Can't grant what they don't hold, or create a role at their own rank.
    expect((await saveRoleAction({ name: "Approver", description: null, rank: 30, capabilities: ["accounts.approve"] })).ok).toBe(false);
    expect((await saveRoleAction({ name: "Peer", description: null, rank: 20, capabilities: [] })).ok).toBe(false);
    // Below them, with what they hold: fine.
    expect((await saveRoleAction({ name: "Clerk", description: null, rank: 30, capabilities: ["settings.write"] })).ok).toBe(true);
  });

  it("keeps the last Owner", async () => {
    as(owner);
    const mine = await raw.membership.findFirstOrThrow({
      where: { organizationId: ownerOrg, user: { email: "asha@alpha.test" } },
    });
    expect((await removeMemberAction({ membershipId: mine.id })).ok).toBe(false);
  });
});

describe("tenant isolation through the actions", () => {
  let other: Browser;
  let otherOrg: string;

  beforeAll(async () => {
    other = await signUp("Kiran Shah", "kiran@beta.test", "Beta Foods");
    otherOrg = await orgIdOf(other);
  });

  it("can't attach a warehouse to another organization's branch", async () => {
    const foreignBranch = await raw.branch.findFirstOrThrow({ where: { organizationId: otherOrg } });
    as(owner);
    const result = await saveWarehouseAction({ branchId: foreignBranch.id, name: "Stolen", code: "STL", address: null, isActive: true });
    expect(result.ok).toBe(false);
    expect(await raw.warehouse.count({ where: { code: "STL" } })).toBe(0);
  });

  it("can't edit another organization's branch by id", async () => {
    const foreignBranch = await raw.branch.findFirstOrThrow({ where: { organizationId: otherOrg } });
    as(owner);
    const result = await saveBranchAction({
      id: foreignBranch.id,
      name: "Hijacked",
      code: "HJK",
      stateCode: "29",
      isActive: true,
      version: foreignBranch.version,
    });
    expect(result.ok).toBe(false);
    expect((await raw.branch.findUniqueOrThrow({ where: { id: foreignBranch.id } })).name).toBe(foreignBranch.name);
  });

  it("can't switch into an organization without a membership", async () => {
    as(owner);
    expect((await switchOrganizationAction(otherOrg)).ok).toBe(false);
  });
});

describe("support view", () => {
  it("is read-only and logs every page", async () => {
    const admin = await raw.platformAdmin.create({ data: { email: "staff@hyperzen.test", name: "Staff", passwordHash: "x" } });
    const token = newToken();
    await raw.supportSession.create({
      data: {
        tokenHash: hashToken(token),
        platformAdminId: admin.id,
        targetOrganizationId: ownerOrg,
        reason: "Customer asked for help",
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const support = newBrowser();
    support.jar.set(SUPPORT_COOKIE, token);
    as(support, "/app/settings/branches");

    const result = await getAppContext();
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.ctx.kind).toBe("support");
      expect(result.ctx.readOnly).toBe(true);
    }
    expect(await raw.supportAccessLog.count({ where: { targetOrganizationId: ownerOrg, path: "/app/settings/branches" } })).toBe(1);
    expect(await saveCompanyProfileAction({ legalName: "Changed", version: 1 })).toMatchObject({
      ok: false,
      message: "The support view is read-only.",
    });
  });
});

describe("suspension and deletion", () => {
  it("locks members out of a suspended organization", async () => {
    await raw.organization.update({ where: { id: ownerOrg }, data: { status: "SUSPENDED" } });
    as(sales);
    expect((await getAppContext()).status).toBe("unavailable");
    expect((await saveBranchAction({ name: "X", code: "X1", stateCode: "29", isActive: true })).ok).toBe(false);
    await raw.organization.update({ where: { id: ownerOrg }, data: { status: "ACTIVE" } });
  });

  it("schedules organization deletion only with the exact legal name, and can cancel it", async () => {
    as(owner);
    expect((await requestOrganizationDeletionAction({ confirmation: "alpha" })).ok).toBe(false);
    const organization = await raw.organization.findUniqueOrThrow({ where: { id: ownerOrg } });
    expect((await requestOrganizationDeletionAction({ confirmation: organization.legalName })).ok).toBe(true);
    expect((await raw.organization.findUniqueOrThrow({ where: { id: ownerOrg } })).status).toBe("PENDING_DELETION");

    as(sales);
    expect((await getAppContext()).status).toBe("unavailable");

    as(owner);
    expect((await cancelOrganizationDeletionAction({})).ok).toBe(true);
    expect((await raw.organization.findUniqueOrThrow({ where: { id: ownerOrg } })).status).toBe("ACTIVE");
  });

  it("won't delete the only Owner's account while others depend on the organization", async () => {
    as(owner);
    const result = await requestAccountDeletionAction({ confirmation: "DELETE" });
    expect(result.ok).toBe(false);
  });

  it("purges one organization completely and nothing else", async () => {
    const doomed = await signUp("Temp User", "temp@gamma.test", "Gamma Temp");
    const doomedOrg = await orgIdOf(doomed);
    const before = await raw.branch.count({ where: { organizationId: { not: doomedOrg } } });
    await purgeOrganization(doomedOrg);
    expect(await raw.organization.findUnique({ where: { id: doomedOrg } })).toBeNull();
    expect(await raw.role.count({ where: { organizationId: doomedOrg } })).toBe(0);
    expect(await raw.branch.count({ where: { organizationId: { not: doomedOrg } } })).toBe(before);
  });

  it("anonymises a deleted account but keeps the organization's records", async () => {
    const salesUser = await raw.user.findUniqueOrThrow({ where: { email: "ravi@alpha.test" } });
    await anonymiseUser(salesUser.id);
    const after = await raw.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(after.name).toBe("Deleted user");
    expect(after.email).toContain("@deleted.invalid");
    expect(after.status).toBe("DELETED");
    expect(await raw.activityLog.count({ where: { organizationId: ownerOrg } })).toBeGreaterThan(0);
  });
});
