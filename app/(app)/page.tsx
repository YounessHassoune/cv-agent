import { AgentChat } from "@/app/(app)/_components/agent-chat";

export default function Page() {
  return (
    <AgentChat
      heading="Tailor a CV"
      subheading="Paste a job description and say which language(s) you want the CV in — one application covers them all. Your master profile is the only source of facts."
      suggestions={[
        "Tailor my CV to this job description",
        "Tailor my CV in English and French",
        "Which keywords am I missing for this role?",
        "Score my last draft against the JD",
      ]}
    />
  );
}
