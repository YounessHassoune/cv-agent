import { requireUser } from "@/app/lib/current-user";
import { HomeChat } from "./home-chat";
import { RecentWork } from "./recent-work";

const HEADING = "Tailor a CV";

const SUBHEADING =
  "Paste a job description and say which language(s) you want the CV in. One application covers them all, and your master profile is the only source of facts.";

/** One-tap starters shown while the composer is still empty. */
const SUGGESTIONS = [
  "Tailor my CV to this job description",
  "Tailor my CV in English and French",
  "Which keywords am I missing for this role?",
  "Score my last draft against the JD",
];

export async function HomeView() {
  const user = await requireUser();

  return (
    <HomeChat
      footer={<RecentWork />}
      heading={HEADING}
      // Per user: a shared browser must not reopen someone else's thread.
      storageKey={`applyflow.chat.session.${user.userId}`}
      subheading={SUBHEADING}
      suggestions={SUGGESTIONS}
    />
  );
}
