/*
 * NovaCold site settings
 * ----------------------
 * This is the ONLY file you need to edit to change contact details.
 * Leave a value as "" (empty) and the matching button, link or text
 * is hidden on the page automatically.
 *
 * After editing, just re-upload / redeploy. No build step needed.
 */
window.SITE_CONFIG = {
  // Contact email shown in the footer. Example: "hello@novacold.agency"
  email: "",

  // Phone number of the live AI demo line. Used by every "Call our AI now"
  // and "Hear it live" button. Write it the way you want it displayed,
  // e.g. "+1 (555) 010-2030". Include the country code (+...) so the
  // tap-to-call link works for everyone.
  demoPhoneNumber: "",

  // Link to your calendar booking page (Calendly, Cal.com, etc.).
  // Used by every "Book a call" button. Must start with https://
  bookingLink: "",

  // Currency symbol used in the missed-call calculator.
  currencySymbol: "$",

  // Length of the free trial, in days. Set to "" or 0 to hide all
  // free-trial wording.
  trialDays: 7,

  // Where the "Start free trial" (Starter) and "Get Pro" buttons in the
  // homepage Pricing section go. Can be a page on this site or a full
  // https:// link (e.g. a Tally form).
  pricingStarterLink: "/subscribe-starter.html",
  pricingProLink: "/subscribe-pro.html",
};
