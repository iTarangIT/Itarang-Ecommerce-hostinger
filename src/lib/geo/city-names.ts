/**
 * One spelling per city, for comparing a campaign's cities with a delivery
 * address.
 *
 * The city list (`country-state-city`) still carries several old names —
 * "Gurgaon", "Bombay"-era spellings — while customers who type their city use
 * either. Both sides go through `cityKey` before they are compared, so a
 * campaign for Gurugram applies to an address in Gurgaon and the other way
 * round. Kept free of the city list itself so it can run anywhere.
 */

const RENAMED: Record<string, string> = {
  gurgaon: 'gurugram',
  bombay: 'mumbai',
  'new bombay': 'navi mumbai',
  madras: 'chennai',
  calcutta: 'kolkata',
  bangalore: 'bengaluru',
  'bangalore urban': 'bengaluru',
  'bengaluru urban': 'bengaluru',
  mysore: 'mysuru',
  mangalore: 'mangaluru',
  belgaum: 'belagavi',
  hubli: 'hubballi',
  'hubli-dharwad': 'hubballi',
  bellary: 'ballari',
  gulbarga: 'kalaburagi',
  shimoga: 'shivamogga',
  tumkur: 'tumakuru',
  bijapur: 'vijayapura',
  poona: 'pune',
  baroda: 'vadodara',
  trivandrum: 'thiruvananthapuram',
  cochin: 'kochi',
  calicut: 'kozhikode',
  pondicherry: 'puducherry',
  allahabad: 'prayagraj',
  benares: 'varanasi',
  banaras: 'varanasi',
  cawnpore: 'kanpur',
  simla: 'shimla',
  'new delhi': 'delhi',
  vizag: 'visakhapatnam',
  orissa: 'odisha',
  aurangabad: 'chhatrapati sambhajinagar',
  osmanabad: 'dharashiv',
  faizabad: 'ayodhya',
  mughalsarai: 'pandit deen dayal upadhyaya nagar',
};

/** Lower-case, single-spaced, and renamed to the current name where one is known. */
export function cityKey(name: string): string {
  const plain = name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  return RENAMED[plain] ?? plain;
}

export function sameCity(a: string, b: string): boolean {
  return cityKey(a) === cityKey(b);
}
