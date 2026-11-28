/**
 * `/console/schools/:schoolId/profile`: what learners read about the
 * school, its logos and each branch's details. Staff fill these in for a
 * school that is not tech savvy (owner, 2026-11-28); its owner can change
 * them after. The panel and its modals are the owner's own.
 */
import { Outlet } from "react-router";

import { Section } from "~/components/console/shell";
import { ProfilePanel } from "~/components/school/profile-panel";
import { useSchool } from "~/lib/school/use-school";

export default function SchoolProfileTab() {
  const d = useSchool();
  return (
    <Section
      title="Profile"
      description="The school's page on DriveRush. It goes public once it has a logo, a profile and an open branch."
    >
      <ProfilePanel profile={d.profile} logos={d.logos} branches={d.branches} />
      <Outlet />
    </Section>
  );
}
