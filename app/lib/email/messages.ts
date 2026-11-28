/**
 * The words of DriveRush's own emails, as plain functions (no sending here),
 * so they can be tested and read in one place. Each gives a subject, a text
 * body and a small HTML body with one button. Links use the site the action
 * ran on, so local emails open the local app.
 */
import type { Email } from "./send.server";

type Message = Omit<Email, "to">;

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function message({
  subject,
  lines,
  button,
}: {
  subject: string;
  lines: string[];
  button: { label: string; href: string };
}): Message {
  const text = [
    ...lines,
    "",
    `${button.label}: ${button.href}`,
    "",
    "DriveRush",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16171b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:800;padding-bottom:16px">DriveRush</td></tr>
${lines.map((line) => `<tr><td style="font-size:15px;line-height:1.55;padding-bottom:12px">${escape(line)}</td></tr>`).join("\n")}
<tr><td style="padding:8px 0 4px"><a href="${escape(button.href)}" style="display:inline-block;background:#e5243b;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:8px">${escape(button.label)}</a></td></tr>
</table>
<p style="font-size:12px;color:#6b6d76;margin:16px 0 0">You get this because a driving school or DriveRush added your email.</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Handed a school (or made its new owner). */
export function ownerEmail({
  school,
  result,
  origin,
}: {
  school: string;
  result: "added" | "invited";
  origin: string;
}): Message {
  return message({
    subject: `You now run ${school} on DriveRush`,
    lines: [
      `DriveRush has made you the owner of ${school}.`,
      "From your school's dashboard you add branches and admins, add your students, set your pass price and see what you earn.",
      result === "invited"
        ? "Sign in with this email address, with Google or by creating an account, and the school is yours."
        : "Sign in with this email address to open it.",
    ],
    button: { label: "Open your school", href: `${origin}/school` },
  });
}

/** Added as a branch admin. */
export function adminEmail({
  school,
  branches,
  result,
  origin,
}: {
  school: string;
  branches: string[];
  result: "added" | "invited";
  origin: string;
}): Message {
  const where = branches.length ? ` for ${branches.join(", ")}` : "";
  return message({
    subject: `You are an admin of ${school} on DriveRush`,
    lines: [
      `${school} added you as an admin${where}.`,
      "You can add students to your branches and follow their progress on the Model Town Board course.",
      result === "invited"
        ? "Sign in with this email address, with Google or by creating an account, to start."
        : "Sign in with this email address to open the school's dashboard.",
    ],
    button: { label: "Open the dashboard", href: `${origin}/school` },
  });
}

/** Added as a student. */
export function studentEmail({
  school,
  branch,
  started,
  origin,
}: {
  school: string;
  branch: string | null;
  started: boolean;
  origin: string;
}): Message {
  const at = branch ? ` (${branch})` : "";
  return message({
    subject: `${school} added you on DriveRush`,
    lines: [
      `${school}${at} added you as a student on DriveRush, the Model Town Board course.`,
      started
        ? "You are with them now: your school sees your progress and its cars are on your board."
        : "Sign in with this email address, with Google or by creating an account, then open your account and choose Join.",
    ],
    button: {
      label: started ? "Start practising" : "Sign in and join",
      href: `${origin}/model-town-board`,
    },
  });
}

/** The owner's bank was approved or turned down. */
export function bankDecisionEmail({
  school,
  approved,
  bank,
  note,
  origin,
}: {
  school: string;
  approved: boolean;
  bank: string;
  note: string | null;
  origin: string;
}): Message {
  return approved
    ? message({
        subject: `${school} can take payments now`,
        lines: [
          `DriveRush approved ${bank} for ${school}.`,
          "Learners who pay through your code now pay you: Paystack sends your share to this bank two working days after each payment.",
        ],
        button: { label: "Share your code", href: `${origin}/school` },
      })
    : message({
        subject: `${school}: we could not approve that bank`,
        lines: [
          `DriveRush did not approve ${bank} for ${school}.`,
          note ?? "Check the details and send them again.",
        ],
        button: { label: "Check your bank details", href: `${origin}/school` },
      });
}

/** To DriveRush: an owner sent bank details to check. */
export function bankRequestedEmail({
  school,
  bank,
  accountName,
  origin,
}: {
  school: string;
  bank: string;
  accountName: string;
  origin: string;
}): Message {
  return message({
    subject: `Bank to check: ${school}`,
    lines: [
      `${school} sent ${bank} in the name of ${accountName}.`,
      "Call the school, check it against their bank letter, then approve or turn it down in the console.",
    ],
    button: { label: "Open the console", href: `${origin}/console` },
  });
}
