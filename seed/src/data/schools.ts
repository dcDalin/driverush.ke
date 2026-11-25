/**
 * The three demo schools the full seed adds next to the test fixture's Heltz
 * and Top Gear (supabase/seeds/local_demo.sql, never changed here). Names and
 * `sponsorId` follow the live sponsors in app/lib/board/sponsors.ts, so each
 * school's learners see its paint on the board.
 *
 * Every school is made the way it would be for real: DriveRush staff create
 * it with an owner's email, the owner adds branches and admins.
 */
export type BranchSpec = { name: string; town: string };

export type AdminSpec = {
  email: string;
  name: string;
  branches: string[];
  /** Signs up after the owner adds them (the invite is taken up on sign-up), or never. */
  joins: "before" | "after" | "never";
};

export type SchoolSpec = {
  slug: string;
  name: string;
  sponsorId: string;
  owner: { email: string; name: string; joins: "before" | "after" };
  branches: BranchSpec[];
  admins: AdminSpec[];
};

export const DEMO_SCHOOLS: SchoolSpec[] = [
  {
    slug: "blixen",
    name: "Blixen Auto Driving School",
    sponsorId: "blixen",
    owner: {
      email: "owner@blixen.test",
      name: "Njoroge Kariuki",
      joins: "before",
    },
    branches: [
      { name: "Nairobi West", town: "Nairobi" },
      { name: "Kitengela", town: "Kitengela" },
      { name: "Machakos", town: "Machakos" },
    ],
    admins: [
      {
        email: "west.admin@blixen.test",
        name: "Esther Wangari",
        branches: ["Nairobi West"],
        joins: "before",
      },
      // One admin for two branches.
      {
        email: "south.admin@blixen.test",
        name: "Peter Musyoka",
        branches: ["Kitengela", "Machakos"],
        joins: "after",
      },
    ],
  },
  {
    slug: "aa",
    name: "AA Driving School",
    sponsorId: "aa",
    // Signs up after staff create the school: the owner invite is taken up then.
    owner: { email: "owner@aa.test", name: "Fatuma Ali", joins: "after" },
    branches: [
      { name: "Hurlingham", town: "Nairobi" },
      { name: "Mombasa", town: "Mombasa" },
      { name: "Nakuru", town: "Nakuru" },
    ],
    admins: [
      {
        email: "mombasa.admin@aa.test",
        name: "Rashid Omar",
        branches: ["Mombasa"],
        joins: "before",
      },
      {
        email: "nakuru.admin@aa.test",
        name: "Lucy Wanjiku",
        branches: ["Nakuru"],
        joins: "after",
      },
      // An admin in two schools (AA Hurlingham and Petanns Kisumu).
      {
        email: "wanjiru@schools.test",
        name: "Wanjiru Kamau",
        branches: ["Hurlingham"],
        joins: "before",
      },
      // Added but never signed up: a pending admin invite on the dashboard.
      {
        email: "new.admin@aa.test",
        name: "New Admin",
        branches: ["Hurlingham"],
        joins: "never",
      },
    ],
  },
  {
    slug: "petanns",
    name: "Petanns Driving School",
    sponsorId: "petanns",
    owner: {
      email: "owner@petanns.test",
      name: "Peter Ann Owino",
      joins: "before",
    },
    branches: [
      { name: "Kisumu", town: "Kisumu" },
      { name: "Eldoret", town: "Eldoret" },
    ],
    admins: [
      {
        email: "eldoret.admin@petanns.test",
        name: "Kipchumba Rotich",
        branches: ["Eldoret"],
        joins: "before",
      },
      {
        email: "wanjiru@schools.test",
        name: "Wanjiru Kamau",
        branches: ["Kisumu"],
        joins: "before",
      },
    ],
  },
];
