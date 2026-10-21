import type { Metadata } from "next";
import { Suspense } from "react";
import { Calculator } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadCalculator } from "@/components/tools/load-calculator";
import { SupportTeaser } from "@/components/support/support-teaser";

export const metadata: Metadata = {
  title: "Inverter & battery load calculator",
  description:
    "Pick 1 BHK to villa, adjust your appliances and backup hours, and see the battery Ah, kWh and inverter VA your home needs — with the iTarang home battery that fits.",
  alternates: { canonical: "/tools/load-calculator" },
};

export default function LoadCalculatorPage() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Tools", href: "/tools/load-calculator" },
              { label: "Load calculator" },
            ]}
          />
          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
              <Calculator className="h-6 w-6" />
            </span>
            <div>
              <p className="eyebrow">Free sizing tool for home backup</p>
              <h1 className="heading-1 mt-1 text-balance">
                Size your inverter and battery properly
              </h1>
              <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                Pick your home, adjust the appliances you want running during a
                power cut, choose how many hours of backup you need and tap{" "}
                <strong className="text-foreground">Let&rsquo;s plan</strong>.
                We work out the battery and inverter size, show the arithmetic,
                and point you at the LiFePO4 home battery we stock for it.
                Nothing here needs an email address.
              </p>
              {/* Said on the page, not only enforced in the engine.
                  `lib/sizing/recommend.ts` refuses to answer a home load with a
                  traction pack — three independent barriers — but a shopper
                  arriving with an e-rickshaw battery in mind should be told
                  that before they fill in a form, not after. */}
              <p className="mt-2 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
                This calculator covers{" "}
                <strong className="text-foreground">home appliances</strong>{" "}
                only. It does not size electric-vehicle batteries.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-12">
              <Skeleton className="h-[32rem] w-full lg:col-span-7" />
              <Skeleton className="h-[26rem] w-full lg:col-span-5" />
            </div>
          }
        >
          <LoadCalculator />
        </Suspense>
      </div>

      <SupportTeaser />
    </>
  );
}
