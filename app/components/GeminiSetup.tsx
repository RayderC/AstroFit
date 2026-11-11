"use client";

import KeySetup, { type KeyStatus } from "@/app/components/KeySetup";
import { api, useApi } from "@/lib/client";

const ext = (href: string, label: string) => <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;

/** Admin page: the Gemini key for AI coach notes in the builder, with a step-by-step guide to getting one. */
export default function GeminiSetup() {
  const { data, reload } = useApi<{ gemini: KeyStatus }>("/api/admin/integrations");
  return (
    <KeySetup
      title="AI coach notes (Gemini)"
      description={<>Adds written tips to a program built with <b>Base it on me</b>. Google&apos;s Gemini API has a free tier, so this costs nothing. Everything else in the builder works without it.</>}
      guideTitle="How to get a free Gemini key (about 2 minutes)"
      status={data?.gemini}
      fields={[{ id: "apiKey", label: "Gemini API key", placeholder: "Starts with AIza…" }]}
      steps={[
        <>Go to {ext("https://aistudio.google.com/apikey", "aistudio.google.com/apikey")} and sign in with any Google account. Accept the terms if it asks.</>,
        <>Click <b>Create API key</b>. If it asks for a project, let it make a new one. You don&apos;t need a card, and you shouldn&apos;t add one: without billing, the key stays on the free tier and can never be charged.</>,
        <>Copy the key. It&apos;s a long line of letters and numbers that usually starts with <b>AIza</b>.</>,
        <>Paste it below and tap <b>Save</b>, then <b>Test</b>.</>,
        <>In the builder, tick <b>Base it on me</b>, build a program, and tap <b>Get coach notes</b> under it.</>,
      ]}
      onSave={async v => {
        await api("/api/admin/integrations", { method: "PUT", body: { gemini: v ? { apiKey: v.apiKey } : null } });
        await reload();
      }}
      onTest={async () => (await api<{ message: string }>("/api/admin/integrations/test", { method: "POST" })).message}
    />
  );
}
