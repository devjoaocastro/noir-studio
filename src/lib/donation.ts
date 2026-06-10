// Shared donation amount — written by the DOM slider (Interface),
// read every frame by the 3D coral cluster (Experience) without re-renders.

export const DONATION_MIN = 5
export const DONATION_MAX = 500

let amount = 60

export function setDonation(value: number) {
  amount = Math.min(DONATION_MAX, Math.max(DONATION_MIN, value))
}

export function getDonation() {
  return amount
}

/** 0..1 — how "alive" the reef should look for the current pledge. */
export function donationVitality() {
  return (amount - DONATION_MIN) / (DONATION_MAX - DONATION_MIN)
}
