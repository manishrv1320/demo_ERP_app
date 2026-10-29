import type { Metadata } from "next";
import Link from "next/link";
import { supportEmail } from "@/server/email/platform";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Delete your account or organization",
  description: "How to delete a Hyperzen ERP account or organization, with or without the Android app.",
};

/**
 * Public page that works without the app — Google Play's account-deletion
 * requirement links here from the store listing.
 */
export default async function DeleteAccountPage() {
  const contact = await supportEmail();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-[15px] leading-relaxed md:px-6">
      <h1 className="text-[28px] font-semibold md:text-[34px]">Delete your Hyperzen ERP account or organization</h1>
      <p className="mt-3 text-[var(--a-muted)]">
        Hyperzen ERP is provided by Hyperzen Innovation Pvt Ltd. You can delete your data from the Android app or from any
        web browser — you don&apos;t need the app.
      </p>

      <h2 className="mt-10 text-[19px] font-semibold">Delete your account</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          Sign in at <Link href="/login" className="text-[var(--accent)] underline">this website</Link> or in the app.
        </li>
        <li>Open your profile picture (top right), then <strong>Your account</strong>.</li>
        <li>
          Optional: tap <strong>Download my data</strong> to keep a copy.
        </li>
        <li>
          Under <strong>Delete my account</strong>, tap the button and type <strong>DELETE</strong> to confirm.
        </li>
      </ol>
      <p className="mt-3">
        You&apos;re signed out of every device straight away. For 30 days you can cancel by signing in again. After that,
        your name, email address, phone number and password are permanently erased. Business documents you created inside
        an organization belong to that organization and stay with it, shown as &ldquo;Deleted user&rdquo;.
      </p>
      <p className="mt-3">
        If you&apos;re the only Owner of an organization that has other members, make one of them an Owner first (Settings →
        Members), or delete the organization. An organization where you&apos;re the only member is deleted with your account.
      </p>

      <h2 className="mt-10 text-[19px] font-semibold">Delete an organization (Owners only)</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Sign in and open the organization.</li>
        <li>
          Go to <strong>Settings → Delete organization</strong>.
        </li>
        <li>
          Tap <strong>Download all data</strong> to export every record and file as a zip.
        </li>
        <li>Tap <strong>Delete this organization</strong> and type its legal name to confirm.</li>
      </ol>
      <p className="mt-3">
        Members lose access immediately. During the 30-day grace period an Owner can cancel. After that every record and
        file of the organization is permanently deleted.
      </p>

      <h2 className="mt-10 text-[19px] font-semibold">What may be kept</h2>
      <p className="mt-3">
        Copies can remain in our encrypted backups until those are rotated. Backups are used only to recover from a failure.
      </p>

      <h2 className="mt-10 text-[19px] font-semibold">Can&apos;t sign in?</h2>
      <p className="mt-3">
        Reset your password with <Link href="/forgot-password" className="text-[var(--accent)] underline">Forgot password</Link>.
        {contact ? (
          <>
            {" "}
            Or write to <a href={`mailto:${contact}`} className="text-[var(--accent)] underline">{contact}</a> from the email
            address on your account, and we&apos;ll delete it for you.
          </>
        ) : (
          <> Or contact Hyperzen through https://hyperzen.in from the email address on your account, and we&apos;ll delete it for you.</>
        )}
      </p>
    </article>
  );
}
