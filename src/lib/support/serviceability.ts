/**
 * Pincode serviceability.
 *
 * DEVELOPMENT LOGIC — this is a deterministic stand-in so the delivery-check UI
 * can be built and tested. It must be replaced with a real serviceability
 * dataset or courier API (Delhivery / Shiprocket) before launch. Nothing here
 * reflects actual iTarang coverage.
 */
export interface ServiceabilityResult {
  serviceable: boolean;
  pincode: string;
  /** Working days until delivery. */
  deliveryDays: number;
  codAvailable: boolean;
  installationDays: number;
  message: string;
}

export function checkPincode(raw: string): ServiceabilityResult | { error: string } {
  const pincode = raw.trim();
  if (!/^\d{6}$/.test(pincode)) {
    return { error: 'Enter a valid 6-digit pincode.' };
  }

  const digits = pincode.split('').map(Number);
  const checksum = digits.reduce((sum, d) => sum + d, 0);

  // Deliberately simple and deterministic — same pincode, same answer.
  const serviceable = checksum % 11 !== 0;
  if (!serviceable) {
    return {
      serviceable: false,
      pincode,
      deliveryDays: 0,
      codAvailable: false,
      installationDays: 0,
      message:
        'We do not deliver to this pincode yet. Our team can tell you the nearest serviceable area.',
    };
  }

  const deliveryDays = 2 + (checksum % 4);
  const codAvailable = checksum % 3 !== 0;

  return {
    serviceable: true,
    pincode,
    deliveryDays,
    codAvailable,
    installationDays: deliveryDays + 1,
    message: `Delivery in ${deliveryDays}–${deliveryDays + 1} working days.`,
  };
}
