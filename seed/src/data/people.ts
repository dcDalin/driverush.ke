/**
 * The demo learners, in a fixed order (the order is their ordinal, which
 * drives their progress, so every run gives the same numbers). Each has one
 * story: the state the seed leaves their school link in, reached through the
 * same RPCs the dashboard and the learner's account menu call.
 *
 * Places are `<school slug>/<branch name>`.
 */
export type Place = `${string}/${string}`;

export type Story =
  /** Added by a branch, then signs up (the link starts on sign-up), or signed up first. */
  | { kind: "active"; at: Place; joins: "before" | "after" }
  /** Added by email, no account yet: the link waits. */
  | { kind: "pending"; at: Place }
  /** Added, then the school took the invite back before they signed up. */
  | { kind: "cancelled"; at: Place }
  /** Added by two schools before signing up: nothing starts, they choose. */
  | { kind: "choosing"; at: [Place, Place] }
  /** Active at one school, added by another, and accepted it (the first ends: switched). */
  | { kind: "switched"; from: Place; to: Place }
  /** Active at one school, added by another, and declined it. */
  | { kind: "declined"; at: Place; declined: Place }
  /** The school ended their month early. */
  | { kind: "released"; at: Place }
  /** Moved to another branch of the same school. */
  | { kind: "moved"; at: Place; to: string }
  /** Their month ran out (dates back-dated by SQL; no time can pass otherwise). */
  | { kind: "expired"; at: Place }
  /** Month ran out, then the school added them again: a fresh month. */
  | { kind: "renewed"; at: Place }
  /** Bought their own month, then a school added them: their paid time is paused. */
  | { kind: "paused"; at: Place }
  /** Their own paid month, no school: plain cars. */
  | { kind: "paid" }
  /** A free account: cloud progress, rotating sponsors. */
  | { kind: "free" };

export type LearnerSpec = {
  email: string;
  name: string;
  story: Story;
  noProgress?: boolean;
};

function learner(name: string, story: Story, noProgress = false): LearnerSpec {
  const first = name.split(" ")[0]?.toLowerCase() ?? name;
  return { email: `${first}@learner.test`, name, story, noProgress };
}

export const DEMO_LEARNERS: LearnerSpec[] = [
  // Blixen
  learner("Achieng Otieno", {
    kind: "active",
    at: "blixen/Nairobi West",
    joins: "after",
  }),
  learner("Baraka Mwangi", {
    kind: "active",
    at: "blixen/Nairobi West",
    joins: "before",
  }),
  learner("Cynthia Wanjiru", {
    kind: "active",
    at: "blixen/Kitengela",
    joins: "after",
  }),
  learner(
    "David Kiprop",
    { kind: "active", at: "blixen/Machakos", joins: "after" },
    true,
  ),
  learner("Faith Njeri", { kind: "pending", at: "blixen/Nairobi West" }),
  learner("George Omondi", { kind: "expired", at: "blixen/Kitengela" }),
  learner("Halima Abdi", {
    kind: "moved",
    at: "blixen/Nairobi West",
    to: "Machakos",
  }),
  learner("Ian Kamau", { kind: "paused", at: "blixen/Nairobi West" }),
  // AA
  learner("Joy Atieno", {
    kind: "active",
    at: "aa/Hurlingham",
    joins: "after",
  }),
  learner("Kevin Mutua", {
    kind: "active",
    at: "aa/Hurlingham",
    joins: "before",
  }),
  learner("Lilian Chepkoech", {
    kind: "active",
    at: "aa/Nakuru",
    joins: "after",
  }),
  learner("Moses Wekesa", { kind: "active", at: "aa/Mombasa", joins: "after" }),
  learner(
    "Nafula Simiyu",
    { kind: "active", at: "aa/Mombasa", joins: "before" },
    true,
  ),
  learner("Omar Hassan", { kind: "released", at: "aa/Mombasa" }),
  learner("Purity Wambui", { kind: "renewed", at: "aa/Hurlingham" }),
  learner("Queen Akinyi", { kind: "cancelled", at: "aa/Nakuru" }),
  learner("Ruth Mumbua", { kind: "pending", at: "aa/Hurlingham" }),
  // Petanns
  learner("Samuel Kibet", {
    kind: "active",
    at: "petanns/Eldoret",
    joins: "after",
  }),
  learner("Tabitha Nduta", {
    kind: "active",
    at: "petanns/Eldoret",
    joins: "before",
  }),
  learner("Victor Ochieng", {
    kind: "active",
    at: "petanns/Kisumu",
    joins: "after",
  }),
  learner("Winnie Jepkosgei", {
    kind: "active",
    at: "petanns/Kisumu",
    joins: "after",
  }),
  learner("Yusuf Mohamed", { kind: "expired", at: "petanns/Kisumu" }),
  // Between schools
  learner("Zawadi Mwende", {
    kind: "choosing",
    at: ["blixen/Kitengela", "aa/Hurlingham"],
  }),
  learner(
    "Brenda Awino",
    { kind: "choosing", at: ["petanns/Kisumu", "aa/Nakuru"] },
    true,
  ),
  learner("Collins Kiptoo", {
    kind: "switched",
    from: "aa/Nakuru",
    to: "petanns/Eldoret",
  }),
  learner("Diana Muthoni", {
    kind: "declined",
    at: "blixen/Machakos",
    declined: "aa/Hurlingham",
  }),
  // No school
  learner("Edwin Odhiambo", { kind: "paid" }),
  learner("Grace Wairimu", { kind: "paid" }),
  learner("Hassan Juma", { kind: "free" }),
  learner("Irene Nyokabi", { kind: "free" }),
  learner("Kelvin Mutiso", { kind: "free" }, true),
  learner("Mercy Wanjala", { kind: "free" }),
];
