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
 * Answers describe how the products and the buying process work. Anything that
 * depends on commercial policy not yet confirmed is written conservatively and
 * points at the support team rather than stating a firm commitment.
 */
export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'choosing',
    title: 'Choosing a system',
    description: 'Sizing, chemistry and which family fits your home.',
    entries: [
      {
        id: 'sizing',
        question: 'How do I know what inverter size I need?',
        answer:
          'Add up the wattage of everything you want running during a cut, then allow headroom for start-up surge on motors and compressors. The inverter VA rating must cover that total; the battery Ah rating decides how long it lasts. Our load calculator does both calculations from a list of appliances and returns matching iTarang systems.',
      },
      {
        id: 'va-vs-ah',
        question: 'What is the difference between VA and Ah?',
        answer:
          'VA is the inverter’s capacity — what you can run at once. Ah is the battery’s capacity — how long you can run it. A large inverter with a small battery runs plenty of appliances for a short time; a small inverter with a large battery runs a few appliances for a long time.',
      },
      {
        id: 'lithium-vs-tubular',
        question: 'Should I choose lithium or tubular?',
        answer:
          'Choose lithium if you want a maintenance-free system with a much longer replacement interval and can absorb the higher purchase price. Choose tall tubular if the up-front cost matters more and you can accommodate ventilation and periodic water topping. For daily long outages, both work; lithium simply lasts longer per rupee over time.',
      },
      {
        id: 'sine-wave',
        question: 'Why does pure sine wave matter?',
        answer:
          'Pure sine wave output matches the shape of grid supply. Fans and refrigerator compressors run at rated efficiency instead of humming and running hot, and switch-mode electronics — televisions, laptop adapters, routers — see supply indistinguishable from the mains. Every iTarang inverter is pure sine wave.',
      },
      {
        id: 'refrigerator',
        question: 'Can an inverter run my refrigerator?',
        answer:
          'Yes, from 1500VA upward. A compressor draws several times its running current for a fraction of a second on start-up, and the inverter must absorb that surge without tripping. Below 1500VA, plan to leave refrigeration off backup.',
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery & installation',
    description: 'How your order reaches you and who commissions it.',
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
          'Installation by a certified technician is included with inverters, batteries and combos. UPS units are plug-and-play and do not need an installation visit. Your slot is booked after the order is confirmed.',
      },
      {
        id: 'installation-time',
        question: 'How long does installation take?',
        answer:
          'A standard single-battery installation takes about 60–90 minutes including cable routing, commissioning and a load test. A 24V or 48V system with a battery bank takes longer and may need a site survey first.',
      },
      {
        id: 'site-survey',
        question: 'When is a site survey needed?',
        answer:
          'For high-capacity systems from 2200VA upward, and for any solar installation. The engineer confirms incoming supply rating, cable runs, battery placement and ventilation before installation is scheduled.',
      },
    ],
  },
  {
    id: 'warranty',
    title: 'Warranty & service',
    description: 'What is covered, for how long, and how to claim.',
    entries: [
      {
        id: 'warranty-length',
        question: 'How long is the warranty?',
        answer:
          'It varies by product and is stated on every product page: inverters carry 24 or 36 months, tubular batteries 36 to 48 months, and lithium batteries 60 months. The written terms ship with the product.',
      },
      {
        id: 'warranty-register',
        question: 'Do I need to register my warranty?',
        answer:
          'It is not mandatory, but registering your serial number means a future claim never depends on locating the original invoice. Registration takes a minute in the Owner Centre.',
      },
      {
        id: 'warranty-claim',
        question: 'How do I raise a service request?',
        answer:
          'Register a complaint in the Owner Centre with your serial number and a description of the fault. You receive a reference number, and a technician is assigned from the service network covering your pincode.',
      },
      {
        id: 'maintenance',
        question: 'What maintenance does a battery need?',
        answer:
          'Lithium batteries need none. Flooded lead acid batteries — tubular and flat plate — need distilled water topping up roughly every four to six months, more often in hot conditions. The float indicators on each cell show when a cell needs attention.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Orders & returns',
    description: 'Payment, tracking, cancellation and replacement.',
    entries: [
      {
        id: 'payment',
        question: 'What payment methods can I use?',
        answer:
          'UPI, credit and debit cards, net banking and no-cost EMI on eligible orders. Cash on delivery is available on eligible orders and pincodes, confirmed at checkout.',
      },
      {
        id: 'gst',
        question: 'Can I get a GST invoice?',
        answer:
          'Yes. Enter your GSTIN in the cart before placing the order and the invoice is issued against it. Every order receives a GST invoice regardless.',
      },
      {
        id: 'tracking',
        question: 'How do I track my order?',
        answer:
          'Use the Track order page with your order number and the phone number on the order, or open the order from your account.',
      },
      {
        id: 'returns-policy',
        question: 'Can I return a product?',
        answer:
          'Products that arrive damaged or faulty are replaced. Returns for change of mind are assessed case by case and depend on whether the unit has been installed — contact support before arranging anything.',
      },
    ],
  },
];

export const ALL_FAQS: FaqEntry[] = FAQ_SECTIONS.flatMap((s) => s.entries);
