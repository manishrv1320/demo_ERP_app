/**
 * The first versions of the Terms and the Privacy Policy, created on first
 * use. After that they're edited in the platform console (Policies), and every
 * published change bumps the version so each user accepts it again.
 *
 * Format: blank lines separate paragraphs, lines starting "## " are headings,
 * lines starting "- " are list items. {{SUPPORT_EMAIL}} is replaced with the
 * support address from the platform console.
 *
 * Written to match what the code actually collects. Have them reviewed by a
 * lawyer before launch.
 */

export const DEFAULT_POLICIES: { slug: "terms" | "privacy"; title: string; content: string }[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    content: `These terms govern your use of Hyperzen ERP ("the service"), provided by Hyperzen Innovation Pvt Ltd ("Hyperzen", "we"). By creating an account or using the service you agree to them.

## The service
Hyperzen ERP is business software for invoicing, GST, inventory, accounting and payroll. It is available on the web and as an Android app that opens the same service.

## Your account
- You must be at least 18 years old and able to enter into a contract.
- Keep your password secret. You are responsible for what happens under your account.
- The person who creates an organization becomes its Owner and decides who else can access it and with which role.

## Your data
- The business data you enter belongs to your organization. We don't sell it and don't use it for advertising.
- You are responsible for the accuracy of the data and documents you create, and for your own statutory filings (GST returns, TDS, payroll returns and similar). The service prepares summaries and exports; it does not file anything with any government portal.
- You can export your data at any time from the app.

## Acceptable use
Don't use the service for anything unlawful, to issue false invoices, to try to reach another organization's data, to probe or overload our systems, or to resell the service without our written agreement.

## Suspension and deletion
- We may suspend an organization that breaks these terms or the law, or to protect the service or other users. We'll tell the Owner why unless the law prevents it.
- You can delete your account or your organization from the app (or as described at /delete-account). Deletion happens after a 30-day grace period during which it can be cancelled.

## Availability and changes
We work to keep the service available and your data safe, and keep backups, but we can't promise uninterrupted service. We may change the service and these terms; when the terms change, you'll be asked to accept the new version before continuing.

## Liability
The service is provided "as is". To the extent the law allows, Hyperzen is not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us for the service in the 12 months before the claim.

## Law
These terms are governed by the laws of India.

## Contact
Questions: {{SUPPORT_EMAIL}}.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    content: `This policy explains what Hyperzen ERP collects, why, and the choices you have. Hyperzen Innovation Pvt Ltd ("Hyperzen", "we") provides the service.

## What we collect
- Account details: your name, email address, optional phone number, and your password (stored only as a one-way hash).
- Business data your organization enters: company details such as GSTIN and PAN, customers and suppliers, items, invoices and other documents, payments, accounting entries, and — if your organization uses payroll — employee records.
- Photos and files you choose to upload, such as a company logo or expense receipts. The Android app uses the camera or gallery only when you tap to add one.
- Location, only for attendance check-in, only if your organization turns location on and you consent. You can withdraw consent at any time.
- Sign-in and security records: IP address, device and browser type, and when you signed in, so we can protect accounts and show you your signed-in devices.
- If push notifications are turned on for the Android app, a device token from Google's Firebase Cloud Messaging so we can deliver them.

We don't use advertising or analytics trackers, and the app doesn't collect crash reports.

## Why we use it
To provide the service: sign you in, keep each organization's data separate and available to the people its Owner allows, send codes and invitations, and keep the service secure. We don't sell personal data or use it for advertising.

## Where it's stored and who processes it
- Data is stored in our own database and on our own server's disk. Uploaded files are encrypted at rest.
- Traffic passes through Cloudflare, which protects and delivers the service. All connections are encrypted in transit (HTTPS).
- Backups are kept with a cloud storage provider so data can be recovered after a failure.
- If email or SMS sending is set up, messages go through the email or SMS provider configured for that purpose.

## Who can see your organization's data
People your organization's Owner has invited, with the role they were given. Hyperzen staff can open an organization read-only only to provide support, and every such visit is logged.

## Keeping and deleting data
- Your data is kept while your account or organization is active.
- You can delete your account, or an Owner can delete the organization, from the app or as described at /delete-account. After a 30-day grace period the data is permanently removed. Business records you created inside an organization stay with that organization, shown as "Deleted user".
- Copies may remain in backups until those are rotated; they are used only to recover from a failure.

## Your rights
You can see and correct your account details in the app, export your data, withdraw consent for location, and ask us about your data. Write to {{SUPPORT_EMAIL}} — this is also the contact for grievances.

## Children
The service is for businesses and is not meant for anyone under 18.

## Changes
When this policy changes we'll ask you to accept the new version before you continue.`,
  },
];
