import { AgentChat } from "@/app/(app)/_components/agent-chat";

export default function Page() {
  return (
    <AgentChat
      heading="Tailor a CV"
      subheading="Paste a job description and say which language you want the CV in. Your master profile is the only source of facts."
      suggestions={[
        "Tailor my CV to this job description",
        "Which keywords am I missing for this role?",
        "Write the CV in French",
        "Score my last draft against the JD",
      ]}
    />
  );
}
