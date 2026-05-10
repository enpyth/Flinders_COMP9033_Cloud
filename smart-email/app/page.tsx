"use client";

import { FormEvent, useState } from "react";

type Payload = {
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
};

type Analysis = {
  category: "complaint" | "enquiry" | "feedback";
  priority: "high" | "normal";
  summary: string;
};

type SupportEmailResponse = {
  success: boolean;
  messageId: string;
  category: Analysis["category"];
  urgency: Analysis["priority"];
  assignedTeam: string;
  status: string;
};

const emptyPayload: Payload = {
  customerName: "",
  customerEmail: "",
  subject: "",
  message: "",
};

const sampleRecords: Array<{
  id: string;
  label: string;
  hint: string;
  payload: Payload;
}> = [
  {
    id: "complaint-high",
    label: "Urgent Complaint",
    hint: "Damaged order and urgent replacement request.",
    payload: {
      customerName: "Amelia Wong",
      customerEmail: "amelia.wong@example.com",
      subject: "Order arrived damaged and I need a replacement",
      message:
        "Hello support team, my package arrived this morning with a broken screen and cracked casing. I need a replacement urgently because this item is for a client presentation tomorrow. Please advise on the fastest solution.",
    },
  },
  {
    id: "enquiry-normal",
    label: "General Enquiry",
    hint: "Standard shipping and account question.",
    payload: {
      customerName: "Daniel Reed",
      customerEmail: "daniel.reed@example.com",
      subject: "Can you confirm delivery time for my order?",
      message:
        "Hi team, I placed an order yesterday and would like to know the expected delivery window. I also want to confirm whether I can update the shipping address before dispatch.",
    },
  },
  {
    id: "feedback-normal",
    label: "Positive Feedback",
    hint: "Complimentary message for service quality.",
    payload: {
      customerName: "Priya Nair",
      customerEmail: "priya.nair@example.com",
      subject: "Great support experience with your team",
      message:
        "Hello, I just wanted to share some positive feedback. Your support staff resolved my issue quickly and the follow-up communication was great. Thanks for the excellent service.",
    },
  },
  {
    id: "complaint-normal",
    label: "Refund Complaint",
    hint: "Complaint without urgency escalation.",
    payload: {
      customerName: "Marcus Hill",
      customerEmail: "marcus.hill@example.com",
      subject: "Refund still not processed",
      message:
        "Hi, I contacted support last week about a refund for a returned item, but I still have not received confirmation. This delay is frustrating and I need an update on the case.",
    },
  },
];

function analyzeMessage(payload: Payload): Analysis {
  const text = `${payload.subject} ${payload.message}`.toLowerCase();
  let category: Analysis["category"] = "enquiry";
  let priority: Analysis["priority"] = "normal";
  let summary =
    "This message appears to be a general enquiry and can enter the regular support queue.";

  if (/(broken|damaged|refund|complaint|issue|failed|bad service)/.test(text)) {
    category = "complaint";
    summary =
      "This message is likely a complaint and should be reviewed by the support team with a structured follow-up response.";
  } else if (/(thanks|love|great|suggestion|feedback)/.test(text)) {
    category = "feedback";
    summary =
      "This message looks like customer feedback and can be stored for service improvement and acknowledgement.";
  }

  if (/(urgent|asap|immediately|tomorrow|broken|critical|replacement)/.test(text)) {
    priority = "high";
    summary =
      "This message contains urgency signals and should be escalated quickly after AI verification in Node-RED.";
  }

  return { category, priority, summary };
}

export default function Home() {
  const [payload, setPayload] = useState<Payload>(emptyPayload);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<SupportEmailResponse | null>(null);

  function updateField<K extends keyof Payload>(field: K, value: Payload[K]) {
    setRequestError(null);
    setResponseData(null);
    setPayload((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function buildSummary(response: SupportEmailResponse) {
    const urgencyText =
      response.urgency === "high" ? "high urgency" : "normal urgency";

    return `Node-RED stored this email as a ${response.category} case with ${urgencyText}, routed it to ${response.assignedTeam}, and returned status ${response.status}.`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveSampleId(null);
    setRequestError(null);
    setResponseData(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/support-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as SupportEmailResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "Failed to submit support email.",
        );
      }

      const submittedResult = result as SupportEmailResponse;

      setResponseData(submittedResult);
      setAnalysis({
        category: submittedResult.category,
        priority: submittedResult.urgency,
        summary: buildSummary(submittedResult),
      });
    } catch (error) {
      setAnalysis(analyzeMessage(payload));
      setRequestError(
        error instanceof Error ? error.message : "Failed to submit support email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSampleLoad(sampleId: string) {
    const sample = sampleRecords.find((item) => item.id === sampleId);
    if (!sample) return;

    setRequestError(null);
    setResponseData(null);
    setActiveSampleId(sample.id);
    setPayload(sample.payload);
    setAnalysis(analyzeMessage(sample.payload));
  }

  return (
    <main className="relative z-10">
      <section className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
          <nav className="mb-14 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 rounded-full bg-[linear-gradient(135deg,#0fa67a,#7ef0c7)] shadow-[0_0_0_8px_rgba(15,166,122,0.12)]" />
              <span className="text-sm font-extrabold tracking-[0.02em]">
                Support Triage Console
              </span>
            </div>
            <div className="text-sm font-bold tracking-[0.02em] text-muted">
              Next.js frontend for Vercel deployment
            </div>
          </nav>

          <div className="grid items-end gap-7 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="rise-in py-8">
              <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.12em] text-accent-deep">
                Smart Customer Support Email Management System
              </p>
              <h1 className="max-w-[11ch] text-5xl leading-none font-bold sm:text-7xl lg:text-[6.4rem]">
                Route customer emails before they become customer problems.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted sm:text-lg">
                Submit a support email, switch across built-in sample cases, and
                preview how Node-RED, OpenAI, Resend, and Azure SQL Database fit
                together in one triage flow.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#workspace"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-foreground px-5 text-sm font-extrabold text-background transition-transform hover:-translate-y-0.5"
                >
                  Open Workspace
                </a>
                <a
                  href="#flow"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-extrabold text-foreground transition-transform hover:-translate-y-0.5"
                >
                  View Process
                </a>
              </div>
            </section>

            <aside className="surface rise-in rounded-[28px] p-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_8px_rgba(15,166,122,0.12)]" />
                English-only workflow
              </div>
              <div className="mt-7 grid gap-5">
                <div>
                  <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-accent-deep">
                    AI Tasks
                  </span>
                  <strong className="mt-1 block text-xl">Classification + urgency</strong>
                </div>
                <div>
                  <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-accent-deep">
                    Delivery
                  </span>
                  <strong className="mt-1 block text-xl">Resend notifications</strong>
                </div>
                <div>
                  <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-accent-deep">
                    Storage
                  </span>
                  <strong className="mt-1 block text-xl">Azure SQL Database</strong>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="workspace" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-7">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-accent-deep">
              Workspace
            </p>
            <h2 className="max-w-[14ch] text-4xl leading-none font-bold sm:text-6xl">
              Submit a live test email or explore multiple sample cases.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="surface rounded-[28px] p-7">
              <div className="mb-6">
                <h3 className="text-2xl font-bold">Email Intake Form</h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Manual entry for demo and front-end validation.
                </p>
              </div>

              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-2.5 font-bold">
                  <span>Customer Name</span>
                  <input
                    className="min-h-13 rounded-[18px] border border-line bg-white/85 px-4 py-3 outline-none transition focus:border-accent/60 focus:ring-4 focus:ring-accent/12"
                    value={payload.customerName}
                    onChange={(event) => updateField("customerName", event.target.value)}
                    placeholder="e.g. Amelia Wong"
                    required
                  />
                </label>

                <label className="grid gap-2.5 font-bold">
                  <span>Customer Email</span>
                  <input
                    className="min-h-13 rounded-[18px] border border-line bg-white/85 px-4 py-3 outline-none transition focus:border-accent/60 focus:ring-4 focus:ring-accent/12"
                    type="email"
                    value={payload.customerEmail}
                    onChange={(event) => updateField("customerEmail", event.target.value)}
                    placeholder="amelia@example.com"
                    required
                  />
                </label>

                <label className="grid gap-2.5 font-bold">
                  <span>Subject</span>
                  <input
                    className="min-h-13 rounded-[18px] border border-line bg-white/85 px-4 py-3 outline-none transition focus:border-accent/60 focus:ring-4 focus:ring-accent/12"
                    value={payload.subject}
                    onChange={(event) => updateField("subject", event.target.value)}
                    placeholder="Order arrived damaged"
                    required
                  />
                </label>

                <label className="grid gap-2.5 font-bold">
                  <span>Message</span>
                  <textarea
                    className="min-h-48 rounded-[18px] border border-line bg-white/85 px-4 py-3 outline-none transition focus:border-accent/60 focus:ring-4 focus:ring-accent/12"
                    value={payload.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    placeholder="Write the customer email content in English..."
                    required
                  />
                </label>

                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-foreground px-5 text-sm font-extrabold text-background transition-transform hover:-translate-y-0.5"
                  >
                    {isSubmitting ? "Sending Request..." : "Simulate Analysis"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSampleLoad(sampleRecords[0].id)}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-extrabold transition-transform hover:-translate-y-0.5"
                  >
                    Load Default Sample
                  </button>
                </div>
              </form>
            </section>

            <section className="surface rounded-[28px] p-7">
              <div className="mb-6">
                <h3 className="text-2xl font-bold">Sample Library</h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Use built-in records to demonstrate different classification and
                  urgency outcomes.
                </p>
              </div>

              <div className="grid gap-5">
                <p className="text-sm leading-7 text-muted">
                  Each sample fills the form and triggers a different result path for
                  the preview panel.
                </p>

                <div className="grid gap-3">
                  {sampleRecords.map((sample) => {
                    const isActive = sample.id === activeSampleId;

                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSampleLoad(sample.id)}
                        className={`rounded-[22px] border px-4 py-4 text-left transition ${
                          isActive
                            ? "border-accent bg-accent-soft shadow-[0_16px_36px_rgba(15,166,122,0.12)]"
                            : "border-line bg-white/70 hover:-translate-y-0.5"
                        }`}
                      >
                        <span className="block text-sm font-extrabold tracking-[0.02em]">
                          {sample.label}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-muted">
                          {sample.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section id="results" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-7">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-accent-deep">
              Preview
            </p>
            <h2 className="max-w-[14ch] text-4xl leading-none font-bold sm:text-6xl">
              Front-end result state for the later Node-RED response.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <article className="surface rounded-[28px] p-7">
              <div className="mb-5 flex flex-wrap gap-2.5">
                <span className="inline-flex min-h-9 items-center rounded-full bg-accent-soft px-3 text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-accent-deep">
                  {analysis?.category ?? "Awaiting input"}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-full bg-black/8 px-3 text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-muted">
                  {analysis?.priority === "high" ? "High priority" : "Priority not set"}
                </span>
              </div>
              <h3 className="text-3xl leading-none font-bold sm:text-4xl">
                {payload.subject || "No email submitted yet"}
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
                {analysis?.summary ??
                  "Submit the form to preview classification, urgency, and the structured payload that will later come back from Node-RED."}
              </p>
              {requestError ? (
                <p className="mt-4 rounded-[18px] border border-[#d9b8b1] bg-[#fff1ee] px-4 py-3 text-sm font-bold text-[#8a392c]">
                  {requestError}
                </p>
              ) : null}
            </article>

            <article className="surface rounded-[28px] p-7">
              <div className="mb-6">
                <h3 className="text-2xl font-bold">Request / Response Preview</h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Outgoing payload plus the latest response returned by Node-RED.
                </p>
              </div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-accent-deep">
                Request Body
              </p>
              <pre className="overflow-auto rounded-[20px] bg-[#14221c] p-5 font-mono text-sm leading-7 text-[#dbece2]">
                {JSON.stringify(payload, null, 2)}
              </pre>
              <p className="mb-3 mt-6 text-xs font-extrabold uppercase tracking-[0.12em] text-accent-deep">
                API Response
              </p>
              <pre className="overflow-auto rounded-[20px] bg-[#14221c] p-5 font-mono text-sm leading-7 text-[#dbece2]">
                {JSON.stringify(
                  responseData ?? {
                    status: "idle",
                    message: "Submit the form to send the POST request.",
                  },
                  null,
                  2,
                )}
              </pre>
            </article>
          </div>
        </div>
      </section>

      <section id="flow" className="px-4 pb-18 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-7">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-accent-deep">
              System Flow
            </p>
            <h2 className="max-w-[14ch] text-4xl leading-none font-bold sm:text-6xl">
              One page, one intake path, one backend chain.
            </h2>
          </div>

          <div className="grid gap-3">
            {[
              "Customer email is entered manually or loaded from the built-in sample library.",
              "The frontend prepares a JSON payload for the Node-RED HTTP endpoint.",
              "OpenAI classifies the message and estimates urgency.",
              "Node-RED stores the record in Azure SQL Database and triggers Resend.",
            ].map((step, index) => (
              <div
                key={step}
                className="grid gap-4 border-t border-line px-1 py-5 sm:grid-cols-[72px_1fr] sm:items-center"
              >
                <span className="font-display text-4xl font-bold text-black/25">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-8 text-muted">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
