/**
 * One page per Kenyan driving school, under `/driving-schools-kenya/<slug>`,
 * for learners who search a school by name ("<school> driving school fees").
 *
 * Every fact here comes from the school's own website, brochure or official
 * social page, with its source and the date we read it. Third-party fee lists
 * are never stated as fact. A school that publishes no prices gets a page that
 * says so and what to ask, never an estimate. We don't rank schools, and a
 * page here is not a review: sponsors of the board get the same page as
 * anyone else (see `sponsorId`), and being a sponsor never adds a price.
 *
 * Read by the route (`routes/driving-school.tsx`), the sitemap, `/llms.txt`
 * and `title-lengths.test.ts`.
 */
export const DRIVING_SCHOOLS_PATH = "/driving-schools-kenya";

export type SchoolSource = { label: string; url: string };

export type SchoolPrice = {
  /** The course as the school names it, e.g. "B1/B2 Regular". */
  course: string;
  /** As the school writes it, e.g. "KSh 24,900". */
  price: string;
  /** What the school says about NTSA's fees, when it says anything. */
  note?: string;
  source: SchoolSource;
  /** The date on the school's page, or when we read an undated one. */
  asOf: string;
};

export type DrivingSchoolPage = {
  slug: string;
  path: string;
  /** The name as the school writes it. */
  name: string;
  /** Search title, held to 60 characters by `title-lengths.test.ts`. */
  title: string;
  /** Search description, held to 155 characters. */
  description: string;
  /** One line under the heading. */
  lede: string;
  /** Towns and branches as the school lists them. */
  locations: string[];
  website?: string;
  /** Official social pages we could tie to the school. */
  social: SchoolSource[];
  phone?: string;
  /** Licence classes the school says it teaches. */
  classes: string[];
  prices: SchoolPrice[];
  /** Course length, only as the school publishes it. */
  courseLength?: { text: string; source: SchoolSource };
  /** Other things the school says about itself, each with a source. */
  notes: { text: string; source: SchoolSource }[];
  /** The `Sponsor` id in `lib/board/sponsors.ts`, when the school's cars are on our Model Town Board. */
  sponsorId?: string;
  /** Another school shares the name: say so, so learners check the town. */
  nameClash?: string;
  /** When we last checked the school's own pages. */
  checked: string;
  published: string;
};

const CHECKED = "2026-11-24";

const src = (label: string, url: string): SchoolSource => ({ label, url });

const AA_FEES = src(
  "AA Kenya driving school page",
  "https://www.aakenya.co.ke/Driving-School.html",
);
const PETANNS_COURSES = src(
  "Petanns courses page",
  "https://enter.petannsdrivingschool.co.ke/petanns-courses/",
);
const HELTZ_BROCHURE = src(
  "Heltz brochure, Rates 2024 (PDF)",
  "https://heltzdrivingschool.com/wp-content/uploads/2024/03/Heltz-brochure-full-clour-2024-21-feb.pdf",
);
const TOPGEAR_FLIER = src(
  "Top Gear fee flier (PDF)",
  "https://topgeardrivingschool.co.ke/wp-content/uploads/2026/03/flier.pdf",
);
const BADS_SERVICES = src(
  "Blixen Auto Driving School services page",
  "https://www.bads.co.ke/services/",
);
const WINGS_COURSES = src(
  "Wings courses page",
  "https://wings.co.ke/index.php/courses/",
);
const TAAWUN_SITE = src(
  "Taawun Driving School website",
  "https://www.drivingschool.taawun.co.ke/",
);

const ROCKY_COURSES = src(
  "Rocky courses page (updated 16 September 2026)",
  "https://rockydrivingschools.com/courses/",
);
const PRINCE_BROCHURE = src(
  "Prince brochure and fee structure (PDF)",
  "https://www.princeschools.ac.ke/assets/files/Prince-CollegeDrivingschoolBrochureandFeeStructure.pdf",
);
const BUDGET_COURSES = src(
  "Budget Driving School courses page",
  "https://bds.co.ke/courses/",
);

function school(
  page: Omit<DrivingSchoolPage, "path" | "checked" | "published"> & {
    published?: string;
  },
): DrivingSchoolPage {
  return {
    published: CHECKED,
    ...page,
    path: `${DRIVING_SCHOOLS_PATH}/${page.slug}`,
    checked: CHECKED,
  };
}

/** Schools with an official site we could check. Order: most searched first. */
export const DRIVING_SCHOOL_PAGES: readonly DrivingSchoolPage[] = [
  school({
    slug: "petanns-driving-school",
    name: "Petanns Driving School",
    title: "Petanns Driving School fees and contacts",
    description:
      "Petanns Driving School fees as Petanns publishes them: A2 KSh 7,500, B1/B2 KSh 15,000, C1 KSh 14,500. Head office, phone and what to ask before you pay.",
    lede: "The fees Petanns publishes for each licence class, where its head office is, and what to check before you pay.",
    locations: [
      "Head office: Capital House, next to Ambassador Hotel, Moi Avenue, Nairobi",
    ],
    website: "https://enter.petannsdrivingschool.co.ke/",
    social: [
      src("Facebook: Petanns Kenya", "https://www.facebook.com/petannskenya"),
      src("X: @petannsdriving", "https://twitter.com/petannsdriving"),
    ],
    phone: "+254 721 328 383 (also WhatsApp), office 020 221 99 33",
    classes: ["A2", "A3", "B1/B2", "B2/C1", "B3", "C1", "C/E", "D1"],
    prices: [
      {
        course: "A2 (motorcycle)",
        price: "KSh 7,500",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "A3 (tuk-tuk)",
        price: "KSh 8,500",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B1/B2 (car)",
        price: "KSh 15,000",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B2/C1",
        price: "KSh 17,500",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B3",
        price: "KSh 8,000",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "C1 (light truck)",
        price: "KSh 14,500",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "C/E",
        price: "KSh 26,000",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "D1",
        price: "KSh 8,000",
        source: PETANNS_COURSES,
        asOf: CHECKED,
      },
    ],
    notes: [
      {
        text: "Petanns says it is an NTSA accredited institution and claims over 100 branches in over 15 counties, without listing them.",
        source: src(
          "Petanns about page",
          "https://enter.petannsdrivingschool.co.ke/about-us/",
        ),
      },
    ],
    sponsorId: "petanns",
  }),
  school({
    slug: "aa-driving-school",
    name: "AA Driving School",
    title: "AA Driving School fees and branches",
    description:
      "AA Driving School (AA Kenya) fees as AA publishes them: B1/B2 Regular KSh 24,900, Premier KSh 50,000, A2 KSh 5,780, refreshers. Branches and contacts.",
    lede: "AA Kenya's published driving school fees for cars, motorcycles and refreshers, and how to find a branch.",
    locations: [
      "About 40 AA Kenya branches across Nairobi, Mombasa, Central, Eastern and Homa Bay (AA's branch list doesn't say which teach driving)",
    ],
    website: "https://www.aakenya.co.ke/",
    social: [
      src("Facebook: AA Kenya", "https://www.facebook.com/AAKenya"),
      src("Instagram: @aa_kenya_", "https://www.instagram.com/aa_kenya_"),
      src("TikTok: @aa_kenya", "https://www.tiktok.com/@aa_kenya"),
      src("X: @AAKenya", "https://twitter.com/AAKenya"),
      src("AA Kenya branches", "https://www.aakenya.co.ke/Branches.html"),
    ],
    phone: "WhatsApp +254 715 235 176; each branch has its own number",
    classes: ["A2", "A3", "B1", "B2", "B3", "G", "truck and bus endorsements"],
    prices: [
      {
        course: "B1/B2 Regular (car)",
        price: "KSh 24,900",
        note: "tuition",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "B1/B2 Premier (car)",
        price: "KSh 50,000",
        note: "tuition",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "A2 (motorcycle)",
        price: "KSh 5,780",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "A3 (tuk-tuk)",
        price: "KSh 10,000",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "G (forklift)",
        price: "KSh 40,000",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "Refresher B1/B2, Regular",
        price: "KSh 10,000",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "Refresher B1/B2, Premier",
        price: "KSh 20,000",
        source: AA_FEES,
        asOf: CHECKED,
      },
      {
        course: "Assessment, Class B",
        price: "KSh 5,000",
        source: AA_FEES,
        asOf: CHECKED,
      },
    ],
    notes: [],
    sponsorId: "aa",
  }),
  school({
    slug: "rocky-driving-school",
    name: "Rocky Driving School",
    title: "Rocky Driving School fees and branches",
    description:
      "Rocky Driving School fees as Rocky publishes them: B1 or B2 KSh 17,000, both KSh 25,000, motorcycle KSh 11,000. 37 branches listed, Nairobi head office.",
    lede: "Rocky's published fees for every class, how long its courses run, and where its branches are.",
    locations: [
      "Head office: Factory Street, Industrial Area, Nairobi",
      "37 branches listed on its site, 12 in Nairobi and others including Eldoret, Kisumu, Nakuru, Thika, Kitengela, Kisii, Meru and Kakamega",
    ],
    website: "https://rockydrivingschools.com/",
    social: [
      src("Rocky branches", "https://rockydrivingschools.com/branches/"),
    ],
    phone: "0702 552 222 (also WhatsApp), 0700 667 777, 0748 019 811",
    classes: ["A2", "A3", "B1", "B2", "B3", "C1", "CE", "D1", "D2", "F1"],
    prices: [
      {
        course: "B1 automatic car, 15 lessons",
        price: "KSh 17,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "B2 manual car, 15 lessons",
        price: "KSh 17,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "B1 and B2, 20 lessons",
        price: "KSh 25,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "A2 motorcycle, 10 lessons",
        price: "KSh 11,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "A3 tuk-tuk, 10 lessons",
        price: "KSh 12,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "B3",
        price: "KSh 12,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "C1 light truck",
        price: "KSh 18,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "CE, 15 lessons",
        price: "KSh 29,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "D1 or D2",
        price: "KSh 12,000",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
      {
        course: "Refresher, per lesson",
        price: "KSh 1,500 automatic, KSh 1,700 manual",
        source: ROCKY_COURSES,
        asOf: "2026-09-16",
      },
    ],
    courseLength: {
      text: "1 month for each licence course",
      source: ROCKY_COURSES,
    },
    notes: [
      {
        text: "Rocky says its fees may vary by branch, and that NTSA's charges are paid separately through eCitizen.",
        source: src("Rocky FAQ", "https://rockydrivingschools.com/faq/"),
      },
      {
        text: "Rocky's pages don't agree on which of B1 and B2 is manual (its courses page says B1 automatic, B2 manual, as the Traffic Rules 2020 do), so check which car you'll learn in.",
        source: ROCKY_COURSES,
      },
    ],
  }),
  school({
    slug: "prince-driving-school",
    name: "Prince Driving School",
    title: "Prince Driving School fees and branches",
    description:
      "Prince Driving School (Embakasi) fees from its brochure: B1 KSh 13,000, B2 KSh 15,000, including NTSA's PDL and test booking. Branches, length, contacts.",
    lede: "Prince's brochure fees, which include NTSA's PDL and test booking, its Embakasi branches and how long a course takes.",
    locations: [
      "Head office: Embakasi, Nairobi, near AA of Kenya and St. Bakhita Catholic Church",
      "Imara Daima: Imara Digital Centre, Maziwa Matatu Stage",
      "Tassia: Tassia stage, next to Bims Plaza",
      "Pipeline: opposite Pipeline Estate Old Gate",
      "Transami: next to Muindi Mweusi Supermarket",
    ],
    website: "https://www.princeschools.ac.ke/Driving.html",
    social: [
      src(
        "Instagram: @prince_schools",
        "https://www.instagram.com/prince_schools",
      ),
      src("X: @prince_schools", "https://x.com/prince_schools"),
    ],
    phone: "0715 412 217 (also WhatsApp), WhatsApp 0726 944 234",
    classes: ["A2", "A3", "B1", "B2", "B3", "C1", "C2", "D1", "D2", "D3", "CE"],
    prices: [
      {
        course: "B1 automatic car",
        price: "KSh 13,000",
        note: "includes NTSA's PDL and test booking",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "B2 manual and automatic car",
        price: "KSh 15,000",
        note: "includes NTSA's PDL and test booking",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "A2 motorcycle",
        price: "KSh 9,800",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "A3 tuk-tuk",
        price: "KSh 10,800",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "B3",
        price: "KSh 13,000",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "C1 light truck",
        price: "KSh 15,000",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "B and C1",
        price: "KSh 20,000",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
      {
        course: "D1",
        price: "KSh 13,000",
        source: PRINCE_BROCHURE,
        asOf: "2024-08-17",
      },
    ],
    courseLength: {
      text: "4 to 5 weeks, as its brochure puts it",
      source: PRINCE_BROCHURE,
    },
    notes: [
      {
        text: "The brochure says its fees include NTSA's PDL and test booking. The interim licence and Smart DL are paid to NTSA on top. Prince's site says it is accredited by NTSA.",
        source: PRINCE_BROCHURE,
      },
    ],
    nameClash:
      "Other schools called Prince Driving School exist outside Kenya. This page is about the Prince in Embakasi, Nairobi, run by Prince School of Professional Studies.",
  }),
  school({
    slug: "budget-driving-school",
    name: "Budget Driving School",
    title: "Budget Driving School (Mombasa) fees",
    description:
      "Budget Driving School Mombasa fees with NTSA's PDL and test booking included: B1 automatic KSh 15,400, B2 manual KSh 17,400, A2 KSh 9,000. Contacts.",
    lede: "The Mombasa school's published totals for each class, with NTSA's provisional licence and test booking already in them.",
    locations: ["Head office: Narok Road, ahead of Moons Cinema, Mombasa"],
    website: "https://bds.co.ke/",
    social: [
      src(
        "Facebook: Budget Driving School",
        "https://www.facebook.com/officialbudgetdrivingschool",
      ),
      src("Instagram: @budgetmsa", "https://www.instagram.com/budgetmsa"),
    ],
    phone: "0721 393923",
    classes: [
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "C1",
      "BC1",
      "C",
      "CE",
      "D1 to D3",
      "F",
      "G",
    ],
    prices: [
      {
        course: "B1 automatic car",
        price: "KSh 15,400",
        note: "KSh 13,700 tuition plus NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
      {
        course: "B2 manual car",
        price: "KSh 17,400",
        note: "KSh 15,700 tuition plus NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
      {
        course: "A2 motorcycle",
        price: "KSh 9,000",
        note: "with NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
      {
        course: "A3 tuk-tuk",
        price: "KSh 11,000",
        note: "with NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
      {
        course: "C1 light truck",
        price: "KSh 16,700",
        note: "with NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
      {
        course: "BC1",
        price: "KSh 17,700",
        note: "with NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
      {
        course: "CE",
        price: "KSh 31,000",
        note: "with NTSA's PDL and test booking",
        source: BUDGET_COURSES,
        asOf: "2026-05-11",
      },
    ],
    notes: [
      {
        text: "Budget's site says it is an NTSA approved driving school, and also calls itself Budget Driving College.",
        source: src("Budget Driving School website", "https://bds.co.ke/"),
      },
    ],
    nameClash:
      "Schools called Budget Driving School also operate in other towns, such as Bungoma, Nakuru and Eldoret, with their own prices, and we can't confirm they are the same company. This page is about the school at bds.co.ke in Mombasa.",
  }),
  school({
    slug: "heltz-driving-academy",
    name: "Heltz Driving Academy",
    title: "Heltz Driving Academy fees and branches",
    description:
      "Heltz Driving Academy fees from its 2024 brochure: B1 or B2 KSh 14,000, A2 KSh 8,000, C1 KSh 14,000. Its 13 Nairobi branches and contacts.",
    lede: "The fees in Heltz's own brochure, its Nairobi branches, and what to confirm before you pay.",
    locations: [
      "Head office: 1st Floor, Sheikh House, Tom Mboya Street, Nairobi",
      "Branches at Harambee Avenue (City Square), Westlands, Parklands, Industrial Area, Donholm, Embakasi, Umoja, Ruaraka, Ngara, Utawala, South C and South B",
    ],
    website: "https://heltzdrivingschool.com/",
    social: [
      src("Facebook: @heltzdriving", "https://www.facebook.com/heltzdriving"),
      src("Instagram: @heltzdriving", "https://www.instagram.com/heltzdriving"),
      src(
        "TikTok: @heltzdrivingschool",
        "https://www.tiktok.com/@heltzdrivingschool",
      ),
      src("Heltz branches", "https://heltzdrivingschool.com/branches/"),
    ],
    phone: "+254 733 340 082 (WhatsApp), 0743 552 541",
    classes: ["A", "B", "C", "D"],
    prices: [
      {
        course: "A2 (motorcycle)",
        price: "KSh 8,000",
        source: HELTZ_BROCHURE,
        asOf: "2024-02-21",
      },
      {
        course: "B1 (automatic car)",
        price: "KSh 14,000",
        source: HELTZ_BROCHURE,
        asOf: "2024-02-21",
      },
      {
        course: "B2 (manual car)",
        price: "KSh 14,000",
        source: HELTZ_BROCHURE,
        asOf: "2024-02-21",
      },
      {
        course: "C1 (light truck)",
        price: "KSh 14,000",
        source: HELTZ_BROCHURE,
        asOf: "2024-02-21",
      },
      {
        course: "C1 with B1",
        price: "KSh 20,000",
        source: HELTZ_BROCHURE,
        asOf: "2024-02-21",
      },
      {
        course: "VIP Class B",
        price: "KSh 25,000",
        note: "the brochure calls it all inclusive",
        source: HELTZ_BROCHURE,
        asOf: "2024-02-21",
      },
    ],
    notes: [
      {
        text: "Heltz's prices page says its rates do not include NTSA charges. These are 2024 rates, so ask for the current ones.",
        source: src(
          "Heltz prices page",
          "https://heltzdrivingschool.com/prices/",
        ),
      },
    ],
    sponsorId: "heltz",
  }),
  school({
    slug: "top-gear-driving-school",
    name: "Top Gear Driving School",
    title: "Top Gear Driving School fees and branches",
    description:
      "Top Gear Driving School fees from its own flier: full car course KSh 14,000 (manual) to KSh 16,000, motorcycle KSh 10,500, refreshers. Branches, contacts.",
    lede: "The short, half and full course fees on Top Gear's flier, how long a course takes, and where to find it.",
    locations: [
      "Head office: Outering Road, Tena Estate, Nairobi (its website)",
      "City centre: KTDA Plaza, 1st Floor, Tom Mboya and Ronald Ngala Street (its flier)",
      "27 branches listed on its site",
    ],
    website: "https://topgeardrivingschool.co.ke/",
    social: [
      src("Facebook: @topgeartops", "https://www.facebook.com/topgeartops"),
      src(
        "Instagram: @topgear_driving_school",
        "https://www.instagram.com/topgear_driving_school",
      ),
      src(
        "Top Gear branches",
        "https://topgeardrivingschool.co.ke/our-branches/",
      ),
    ],
    phone: "+254 722 784 235",
    classes: [
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
      "C1",
      "C",
      "CE",
      "D1",
      "D2",
      "D3",
      "F",
    ],
    prices: [
      {
        course: "B2 manual car, full course",
        price: "KSh 14,000",
        note: "tuition",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "B1 automatic or B1/B2 car, full course",
        price: "KSh 16,000",
        note: "tuition",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "B1 Executive 4WD, full course",
        price: "KSh 18,000",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "A2/A3 motorcycle or tuk-tuk, full course",
        price: "KSh 10,500",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "C1/C2 truck, full course",
        price: "KSh 15,000",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "CE, full course",
        price: "KSh 25,000",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "D1 to D3, full course",
        price: "KSh 15,000",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "Car, short course (B1, B2 or B3)",
        price: "KSh 6,500",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
      {
        course: "Refresher, B2, 5 lessons",
        price: "KSh 4,000",
        source: TOPGEAR_FLIER,
        asOf: CHECKED,
      },
    ],
    courseLength: {
      text: "1 to 2 months, 1 to 2 hours a day, as its flier puts it",
      source: TOPGEAR_FLIER,
    },
    notes: [
      {
        text: "Top Gear's flier lists NTSA's provisional licence (KSh 650) and test (KSh 1,050) separately from its tuition. Its site says all its instructors are NTSA-licensed.",
        source: TOPGEAR_FLIER,
      },
    ],
    sponsorId: "topgear",
  }),
  school({
    slug: "blixen-auto-driving-school",
    name: "Blixen Auto Driving School",
    title: "Blixen Auto Driving School (BADS) fees",
    description:
      "Blixen Auto Driving School (BADS) fees as it publishes them: B1 or B2 KSh 18,500, both KSh 23,500, motorbike KSh 10,500. Karen and Kilimani branches.",
    lede: "BADS's published packages, from a beginner course to pick-and-drop lessons, and its Karen and Kilimani branches.",
    locations: ["Karen: Rotterdam, Kerarapon", "Kilimani: Shujah Mall"],
    website: "https://www.bads.co.ke/",
    social: [src("X: @AutoBlixen254", "https://x.com/AutoBlixen254")],
    phone: "Karen +254 798 338 023, Kilimani +254 748 625 999",
    classes: ["A1 to A3", "B1 to B3", "C1/C2", "D1/D2"],
    prices: [
      {
        course: "B1 or B2, beginner",
        price: "KSh 18,500",
        note: "plus KSh 500 registration; NTSA fees not included",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "B1 and B2 together, beginner",
        price: "KSh 23,500",
        note: "plus KSh 500 registration",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "Premium, personal instructor (one class)",
        price: "KSh 25,500",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "Golden, pick and drop (one class)",
        price: "KSh 30,500",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "Motorbike (A1 to A3), beginner",
        price: "KSh 10,500",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "PSV (D1/D2)",
        price: "KSh 12,500",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "Medium trucks (C1/C2)",
        price: "KSh 12,500",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
      {
        course: "Refresher, per session (5 sessions minimum)",
        price: "KSh 2,000",
        source: BADS_SERVICES,
        asOf: CHECKED,
      },
    ],
    courseLength: {
      text: "the Premium and Golden packages are 20 practical lessons plus 2 days of defensive driving",
      source: BADS_SERVICES,
    },
    notes: [
      {
        text: "BADS says it is accredited and certified by NTSA, and that a session is at most 2 hours: 1 hour of theory and 1 hour of practical.",
        source: src(
          "Blixen Auto Driving School website",
          "https://www.bads.co.ke/",
        ),
      },
    ],
    sponsorId: "blixen",
  }),
  school({
    slug: "wings-driving-school",
    name: "Wings Driving School",
    title: "Wings Driving School fees and branches",
    description:
      "Wings Driving School fees by lessons: 20 lessons of B2 manual KSh 15,500, B1 automatic KSh 18,500, motorbike KSh 13,500. Six Nairobi branches.",
    lede: "Wings prices its courses by the number of practical lessons. Here they are, with its six Nairobi branches.",
    locations: [
      "Nairobi Central: Pioneer Building, 1st Floor, Tom Mboya Street",
      "Nairobi West: Nairobi West Shopping Centre, Muhoho Avenue",
      "Eastleigh: 1st Avenue, opposite St. Teresa's Catholic Church",
      "Hurlingham: Hurlingham Plaza, Argwings Kodhek Road",
      "Parklands: 2nd Parklands Avenue, Highridge, next to CITAM",
      "Ngara: Village Plaza, Fig Tree Road",
    ],
    website: "https://wings.co.ke/",
    social: [
      src("Facebook: @wingsdriving", "https://www.facebook.com/wingsdriving"),
      src(
        "Instagram: @wings.driving.school",
        "https://www.instagram.com/wings.driving.school/",
      ),
      src("Wings branches", "https://wings.co.ke/index.php/about-us/"),
    ],
    phone: "0722 309 415, WhatsApp +254 796 959 550",
    classes: ["A2", "B1", "B2", "B3", "C1", "CE", "D1", "D2"],
    prices: [
      {
        course: "B2 manual car, 20 lessons",
        price: "KSh 15,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B2 manual car, 10 lessons",
        price: "KSh 11,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B1 automatic car, 20 lessons",
        price: "KSh 18,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B1 automatic car, 10 lessons",
        price: "KSh 15,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "A2 motorcycle, 20 lessons",
        price: "KSh 13,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "C1 light truck, 20 lessons (age 22 and over)",
        price: "KSh 15,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "CE, 10 lessons (age 24 and over)",
        price: "KSh 35,000",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "B3",
        price: "KSh 10,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "D1",
        price: "KSh 13,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
      {
        course: "D2",
        price: "KSh 16,500",
        source: WINGS_COURSES,
        asOf: CHECKED,
      },
    ],
    courseLength: {
      text: "a full course up to 3 months and a half course 1 month, with 1-hour lessons",
      source: WINGS_COURSES,
    },
    notes: [
      {
        text: "Wings also sells packages of 15, 5 and 2 lessons, and says you can pay in instalments.",
        source: WINGS_COURSES,
      },
    ],
  }),
  school({
    slug: "taawun-driving-school",
    name: "Taawun Driving School",
    title: "Taawun Driving School fees and branches",
    description:
      "Taawun Driving School fees as it publishes them: KSh 7,500 for a car course plus KSh 500 registration. Branches in Kibra, Donholm and Lucky Summer.",
    lede: "Taawun's published car course fee, its three Nairobi branches, and how it labels its classes.",
    locations: ["Kibra", "Donholm", "Lucky Summer (all Nairobi)"],
    website: "https://www.drivingschool.taawun.co.ke/",
    social: [src("TikTok: @taawun8", "https://www.tiktok.com/@taawun8")],
    phone: "+254 758 732 789 (also WhatsApp)",
    classes: ["B1", "B2", "B3"],
    prices: [
      {
        course: 'B1, which Taawun labels "Light Vehicle Manual"',
        price: "KSh 7,500",
        note: "plus KSh 500 registration",
        source: TAAWUN_SITE,
        asOf: CHECKED,
      },
      {
        course: 'B2, which Taawun labels "Light Vehicle Automatic"',
        price: "KSh 7,500",
        note: "plus KSh 500 registration",
        source: TAAWUN_SITE,
        asOf: CHECKED,
      },
    ],
    notes: [
      {
        text: "Taawun calls its fee subsidised and says customer care confirms the total at admission. Under the Traffic Rules 2020, B1 is automatic only and B2 covers manual and automatic, so ask which car you'll learn in and which class you'll be licensed for.",
        source: TAAWUN_SITE,
      },
    ],
  }),
];

export function drivingSchoolBySlug(
  slug: string | undefined,
): DrivingSchoolPage | undefined {
  return DRIVING_SCHOOL_PAGES.find((school) => school.slug === slug);
}
