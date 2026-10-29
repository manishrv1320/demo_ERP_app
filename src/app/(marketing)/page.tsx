import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Building2, FileText, Landmark, ShieldCheck, Smartphone } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Hyperzen ERP — GST invoicing, stock and accounts for Indian businesses" },
  description:
    "One login for all your businesses: GST invoices, inventory, purchases and accounting with automatic entries. On the web and on Android.",
};

const FEATURES = [
  {
    icon: FileText,
    title: "GST invoicing done right",
    body: "CGST + SGST, UTGST or IGST picked from the place of supply, numbers like INV/26-27/0001, PDFs you can share on WhatsApp.",
  },
  {
    icon: Boxes,
    title: "Stock you can trust",
    body: "Every movement comes from a document — delivery, receipt, transfer or adjustment. Multiple warehouses, barcode lookup and low-stock alerts.",
  },
  {
    icon: Landmark,
    title: "Accounts that balance themselves",
    body: "Every posted document makes its own journal entry. Ledgers, trial balance, P&L, balance sheet and GSTR-1 / 3B summaries.",
  },
  {
    icon: Building2,
    title: "Many companies, one login",
    body: "Run each business with its own GSTIN, books and team. Switch between them in a tap.",
  },
  {
    icon: ShieldCheck,
    title: "Your team, your rules",
    body: "Roles for Accountant, Sales, Storekeeper, HR and more. Everyone sees only what their role allows, and every change is logged.",
  },
  {
    icon: Smartphone,
    title: "Built for the phone too",
    body: "The Android app adds barcode scanning, receipt photos, PDF sharing and an app lock — with the same data as the web.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 md:px-6 md:pb-20 md:pt-24">
        <p className="mb-4 inline-flex rounded-full border border-[var(--a-border)] px-3 py-1 text-[12.5px] text-[var(--a-muted)]">
          For traders, distributors, manufacturers and service firms
        </p>
        <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.1] md:text-[56px]">
          Invoices, stock and accounts —{" "}
          <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">in one place</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--a-muted)] md:text-[18px]">
          Hyperzen ERP keeps your GST invoicing, purchases, inventory and books together, so a sale updates your stock and
          your accounts at the same moment. Use it in the browser or on your Android phone.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className={buttonClass("primary", "md", "md:min-h-12 md:px-5 md:text-[15px]")}>
            Create your account
          </Link>
          <Link href="/login" className={buttonClass("secondary", "md", "md:min-h-12 md:px-5 md:text-[15px]")}>
            Sign in
          </Link>
        </div>
      </section>

      <section className="border-t border-[var(--a-border)] bg-[var(--a-panel-2)]">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)] p-5">
              <feature.icon className="size-6 text-[var(--accent)]" />
              <h2 className="mt-3 text-[16px] font-semibold">{feature.title}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--a-muted)]">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-[22px] font-semibold md:text-[28px]">Your data stays yours</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--a-muted)]">
          Each company&apos;s books are kept strictly apart, stored on our own servers, with files encrypted at rest and every
          connection encrypted. Export everything whenever you like, and delete your account or company from the app.
        </p>
      </section>
    </>
  );
}
