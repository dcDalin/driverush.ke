/**
 * Two big schools and one being set up by DriveRush, so the console and the
 * school dashboard can be tried at the size real chains reach (owner,
 * 2026-11-28: "a few schools have so many branches/students"). Made from a
 * fixed list and a seeded shuffle, so every run gives the same people.
 *
 * Emails end in `.test` (they never reach a real inbox) and none uses the
 * tests' own domains, so the test clean-up leaves them alone.
 */
export type BigSchoolSpec = {
  slug: string;
  name: string;
  owner: { email: string; name: string };
  branches: { name: string; town: string }[];
  /** Admins: how many, and how many have signed up (the rest are invited). */
  admins: { count: number; signedUp: number };
  /** Students: how many with an account (with the school now), how many waiting. */
  students: { withAccount: number; waiting: number };
};

const PLACES: [string, string][] = [
  ["Nairobi CBD", "Nairobi"],
  ["Westlands", "Nairobi"],
  ["Kasarani", "Nairobi"],
  ["Rongai", "Kajiado"],
  ["Kitengela", "Kajiado"],
  ["Ngong", "Kajiado"],
  ["Thika", "Kiambu"],
  ["Ruiru", "Kiambu"],
  ["Juja", "Kiambu"],
  ["Kikuyu", "Kiambu"],
  ["Limuru", "Kiambu"],
  ["Machakos", "Machakos"],
  ["Athi River", "Machakos"],
  ["Nakuru", "Nakuru"],
  ["Naivasha", "Nakuru"],
  ["Eldoret", "Uasin Gishu"],
  ["Kisumu", "Kisumu"],
  ["Kakamega", "Kakamega"],
  ["Bungoma", "Bungoma"],
  ["Kericho", "Kericho"],
  ["Nyeri", "Nyeri"],
  ["Meru", "Meru"],
  ["Embu", "Embu"],
  ["Kitui", "Kitui"],
  ["Mombasa Nyali", "Mombasa"],
  ["Mombasa Likoni", "Mombasa"],
  ["Malindi", "Kilifi"],
  ["Kisii", "Kisii"],
];

export const FIRST = [
  "Achieng",
  "Akinyi",
  "Amani",
  "Baraka",
  "Brian",
  "Chebet",
  "Cherono",
  "Daniel",
  "Esther",
  "Faith",
  "Grace",
  "Hassan",
  "Ian",
  "Jabari",
  "Jane",
  "Joy",
  "Kamau",
  "Kevin",
  "Kibet",
  "Lilian",
  "Mercy",
  "Mohamed",
  "Mwangi",
  "Naliaka",
  "Neema",
  "Njeri",
  "Odhiambo",
  "Omondi",
  "Otieno",
  "Purity",
  "Rehema",
  "Ruth",
  "Salim",
  "Sharon",
  "Tabitha",
  "Wafula",
  "Wairimu",
  "Wanjiku",
  "Wekesa",
  "Zawadi",
];
export const LAST = [
  "Kariuki",
  "Ochieng",
  "Mutua",
  "Wambui",
  "Kiprono",
  "Njoroge",
  "Onyango",
  "Mwende",
  "Kimani",
  "Owino",
  "Cheruiyot",
  "Nyambura",
  "Barasa",
  "Musyoka",
  "Gathoni",
  "Juma",
  "Rotich",
  "Wanyama",
  "Atieno",
  "Maina",
];

export const BIG_SCHOOLS: BigSchoolSpec[] = [
  {
    slug: "kenya-driving-academy",
    name: "Kenya Driving Academy",
    owner: { email: "owner@kda.test", name: "Wanjiku Maina" },
    branches: PLACES.map(([name, town]) => ({ name, town })),
    admins: { count: 42, signedUp: 18 },
    students: { withAccount: 160, waiting: 340 },
  },
  {
    slug: "rocky-driving-school",
    name: "Rocky Driving School",
    owner: { email: "owner@rocky.test", name: "Otieno Barasa" },
    branches: PLACES.slice(0, 14).map(([name, town]) => ({ name, town })),
    admins: { count: 20, signedUp: 8 },
    students: { withAccount: 80, waiting: 170 },
  },
];

/**
 * Being set up by DriveRush, not handed over yet: a profile, branches and
 * admins staff added, no owner. Its admins are not emailed until the
 * hand-over. Shows the console's guided set-up half done.
 */
export const SETUP_SCHOOL = {
  slug: "upendo-driving-school",
  name: "Upendo Driving School",
  tagline: "Patient lessons in Ruiru and Juja",
  about:
    "A family school in Kiambu since 2009. Lessons in English and Kiswahili, weekday and Saturday classes.",
  branches: [
    { name: "Ruiru", town: "Kiambu" },
    { name: "Juja", town: "Kiambu" },
  ],
  admins: [
    { email: "ruiru.admin@upendo.test", branches: ["Ruiru"] },
    { email: "juja.admin@upendo.test", branches: ["Juja"] },
  ],
} as const;
