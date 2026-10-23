export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSection {
  id: string;
  title: string;
  description: string;
  entries: FaqEntry[];
}

/**
 * Support FAQ content.
 *
 * Rewritten for what the business actually sells — Trontek LiFePO4 batteries
 * for 2- and 3-wheelers, homes and storage, and their chargers. The previous
 * answers described inverters, tubular batteries and installation-included
 * offers that do not exist.
 *
 * Two rules from the business ("Website changes", Oct 2026): no lead-acid
 * call-outs, and standard answers on refunds and failed payments. The full
 * policies live at `/policies/refund` and `/policies/payment-failure`; these
 * answers summarise them.
 *
 * The first entry of each section is what the homepage support band previews,
 * so each section leads with its most-asked question.
 */
export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'choosing',
    title: 'Choosing a battery',
    description: 'Which battery fits your vehicle or your home.',
    entries: [
      {
        id: 'which-battery',
        question: 'How do I choose the right battery for my vehicle?',
        answer:
          'Match the voltage first: the pack must have the same system voltage as your vehicle’s controller — 48 V, 60 V or 72 V for most scooters, 51 V, 61 V or 64 V for e-rickshaws. Then choose capacity (Ah) for the range you need: more ampere-hours means more kilometres per charge. The mobility calculator works this out from your motor rating and daily distance.',
      },
      {
        id: 'home-sizing',
        question: 'Which battery do I need for home backup?',
        answer:
          'Add up the watts of what you want running during a cut and multiply by the hours you need. The battery must store that much energy, and it must match your inverter’s battery input voltage (12 V or 24 V for most homes). The load calculator does the arithmetic and recommends a battery from the range.',
      },
      {
        id: 'why-lfp',
        question: 'Why lithium iron phosphate (LiFePO4)?',
        answer:
          'It is the most thermally stable lithium chemistry, lasts thousands of charge cycles, needs no maintenance and weighs far less for the same energy. Every pack carries a battery management system that balances the cells and protects against over-charge, over-discharge, short circuit and over-temperature.',
      },
      {
        id: 'charger',
        question: 'Which charger should I use?',
        answer:
          'One rated for your pack’s charge voltage — never a charger built for another voltage or another chemistry. Each EV battery page lists the Trontek chargers that match it, and the cart suggests them when you add a battery.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Orders, payment & refunds',
    description: 'Paying, offers, failed payments, cancellations and refunds.',
    entries: [
      {
        id: 'payment',
        question: 'What payment methods can I use?',
        answer:
          'UPI, credit and debit cards, net banking and wallets, through Razorpay. Paying by UPI takes ₹200 off the order. Card EMI is available at the payment step on your card issuer’s terms. Payment is taken online when you place the order.',
      },
      {
        id: 'payment-failed',
        question: 'My payment failed but money was deducted. What now?',
        answer:
          'Do not pay again straight away. A failed payment that was debited is reversed to the same account automatically, usually within 5–7 working days and often sooner. If your order shows as paid within 30 minutes, nothing more is needed. The payment failure policy explains the full process.',
      },
      {
        id: 'coupons',
        question: 'Which coupon codes can I use?',
        answer:
          'The codes running right now, and what each applies to, are listed on the Offers page. Enter the code in your cart. One code per order; each code states its own limits, such as once per customer. The UPI discount applies on top.',
      },
      {
        id: 'returns-policy',
        question: 'Can I return a product or get a refund?',
        answer:
          'A product that arrives damaged, faulty or not as ordered is replaced or refunded — report it within 48 hours of delivery with photos. Unused products in their original sealed packaging can be returned within 7 days of delivery. Refunds go back to the original payment method within 5–7 working days of approval. The refund policy has the details.',
      },
      {
        id: 'cancel',
        question: 'Can I cancel my order?',
        answer:
          'Yes, free of charge until it is dispatched — call customer care with your order number. Once dispatched, refuse the delivery or follow the return process instead. A cancelled prepaid order is refunded in full to the original payment method.',
      },
      {
        id: 'gst',
        question: 'Can I get a GST invoice?',
        answer:
          'Yes. Enter your GSTIN at checkout and the invoice is issued against it. Every order receives a GST invoice regardless.',
      },
      {
        id: 'tracking',
        question: 'How do I track my order?',
        answer:
          'Use the Track order page with your order number and the phone number on the order, or open the order from your account.',
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery & installation',
    description: 'How your order reaches you.',
    entries: [
      {
        id: 'delivery-charge',
        question: 'How much does delivery cost?',
        answer:
          'Standard delivery is free on orders above ₹4,999. Below that a flat delivery charge applies and is shown in the cart before you pay. Batteries ship in protective crates at no extra charge.',
      },
      {
        id: 'installation',
        question: 'Is installation included?',
        answer:
          'Only where the product page says so. EV packs are fitted by your vehicle dealer or mechanic; home batteries connect to a lithium-ready inverter. If you are unsure, call customer care before ordering.',
      },
    ],
  },
  {
    id: 'warranty',
    title: 'Warranty & service',
    description: 'What is covered, for how long, and who to call.',
    entries: [
      {
        id: 'warranty-length',
        question: 'How long is the warranty?',
        answer:
          'It is stated on every product page, in the manufacturer’s own words — for example 3 years or 1200 cycles on the LiEV e-rickshaw packs, and 5 years or 4000 cycles on the Powercube home batteries, whichever comes first.',
      },
      {
        id: 'warranty-claim',
        question: 'How do I make a warranty claim?',
        answer:
          'Register a complaint with your order number and the battery’s serial number, or call a warranty number on the support page. You get a reference number and the claim is handled with Trontek.',
      },
      {
        id: 'maintenance',
        question: 'What maintenance does the battery need?',
        answer:
          'None. Keep it dry and away from direct heat, charge it with the matching charger, and do not open the casing — opening it voids the warranty.',
      },
      {
        id: 'grievance',
        question: 'Who do I contact if my complaint is not resolved?',
        answer:
          'iTarang’s grievance officer, Chirag Garg. Grievances are acknowledged within 48 hours and resolved within one month. Contact details are on the grievance page.',
      },
    ],
  },
];

export const ALL_FAQS: FaqEntry[] = FAQ_SECTIONS.flatMap((s) => s.entries);
