import "server-only";

/** A problem the person can fix; its message is shown as it is. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** Optimistic locking: the row changed since the form was opened. */
export class StaleVersionError extends Error {
  constructor() {
    super("Someone else changed this while you were editing. Reload the page and try again.");
    this.name = "StaleVersionError";
  }
}

type PrismaLike = { name?: string; code?: string; meta?: { target?: unknown } };

/** Turn any thrown error into a message that's safe to show. Unknown errors are logged, not shown. */
export function describeError(error: unknown): { message: string; field?: string } {
  if (error instanceof UserError) return { message: error.message, field: error.field };
  if (error instanceof StaleVersionError) return { message: error.message };
  const known = error as PrismaLike;
  if (known?.name === "ReadOnlyViolation") return { message: "The support view is read-only." };
  if (known?.name === "PrismaClientKnownRequestError") {
    switch (known.code) {
      case "P2002": {
        const target = Array.isArray(known.meta?.target) ? (known.meta.target as string[]) : [];
        const field = target.find((name) => name !== "organizationId");
        return { message: "That already exists — it must be unique.", field };
      }
      case "P2003":
        return { message: "That's still in use, or refers to something that no longer exists." };
      case "P2025":
        return { message: "That record no longer exists." };
    }
  }
  if (known?.name === "TenantViolation") {
    console.error("[tenant] isolation violation blocked:", error);
  } else {
    console.error("[action] unexpected error:", error);
  }
  return { message: "Something went wrong. Please try again." };
}
