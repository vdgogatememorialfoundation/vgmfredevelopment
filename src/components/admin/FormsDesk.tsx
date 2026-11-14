"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Field, Panel, SelectInput, TextArea, TextInput } from "@/components/admin/AdminUI";

type QuestionType = "rating" | "text" | "textarea" | "choice";
type Question = { id: string; label: string; type: QuestionType; options?: string[]; required?: boolean };
type Audience = "everyone" | "signed-up" | "delivered" | "category";
type Form = {
  id?: string;
  title: string;
  description: string;
  kind: "platform-review" | "custom";
  audience: Audience;
  categories: string[];
  questions: Question[];
  active: boolean;
  lastMailedAt?: string;
  lastMailedCount?: number;
};
type Response = { id: string; formId: string; email: string; name: string; answers: Record<string, string>; createdAt: string };
type Feedback = { orderId: string; email: string; delivery?: { rating: number; comment: string }; products: { title: string; rating: number; comment: string }[]; updatedAt: string };

const AUDIENCE: Record<Audience, string> = {
  everyone: "Anyone (asks for their email)",
  "signed-up": "Signed-up customers",
  delivered: "Signed-up customers with a delivered order",
  category: "Customers with a delivered order from chosen categories",
};

const platformReview = (): Form => ({
  title: "How was your experience with the Foundation?",
  description: "Please take a minute to tell us about the website, app, ordering and delivery.",
  kind: "platform-review",
  audience: "delivered",
  categories: [],
  active: true,
  questions: [
    { id: "overall", label: "Overall rating", type: "rating", required: true },
    { id: "ease", label: "How easy was it to find and order what you needed?", type: "rating" },
    { id: "recommend", label: "Would you recommend us to a colleague?", type: "choice", options: ["Yes", "Maybe", "No"] },
    { id: "comments", label: "Anything we should improve?", type: "textarea" },
  ],
});

const blank = (): Form => ({ title: "", description: "", kind: "custom", audience: "signed-up", categories: [], active: true, questions: [{ id: "q1", label: "", type: "text" }] });

async function api<T>(body?: Record<string, unknown>) {
  const response = await fetch("/api/admin/forms", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

const stars = (value: number) => "★".repeat(value) + "☆".repeat(Math.max(0, 5 - value));

export function FormsDesk() {
  const [tab, setTab] = useState<"forms" | "orders">("forms");
  const [forms, setForms] = useState<Form[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState<Form | null>(null);
  const [viewing, setViewing] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ forms: Form[]; responses: Response[]; feedback: Feedback[]; categories: string[] }>();
    setForms(data.forms);
    setResponses(data.responses);
    setFeedback(data.feedback);
    setCategories(data.categories);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load().catch((error: Error) => setMessage(error.message)), 0);
    const timer = window.setInterval(() => void load().catch(() => undefined), 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  const run = async (task: () => Promise<string>) => {
    setMessage("");
    try {
      setMessage(await task());
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const setQuestion = (index: number, patch: Partial<Question>) =>
    draft && setDraft({ ...draft, questions: draft.questions.map((question, at) => (at === index ? { ...question, ...patch } : question)) });

  const viewed = forms.find((form) => form.id === viewing);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reviews & forms</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a platform review or any form, choose who can see it, show it on the site and app (Feedback & forms page) or email it. Delivery experience and product ratings stay with each order.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["forms", "orders"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === item ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            {item === "forms" ? `Forms (${forms.length})` : `Order ratings (${feedback.length})`}
          </button>
        ))}
      </div>
      {message ? <p className="rounded-lg bg-warm-cream p-3 text-sm">{message}</p> : null}

      {tab === "orders" ? (
        <Panel title="Delivery experience and product ratings" description="Customers rate an order after it is delivered or collected from the store. These show only under that order, never as public reviews.">
          {feedback.length === 0 ? (
            <EmptyState text="No order ratings yet." />
          ) : (
            <div className="space-y-3 text-sm">
              {feedback.map((row) => (
                <div key={row.orderId} className="rounded-lg border border-border p-3">
                  <a className="font-semibold text-burgundy underline" href={`/admin/commerce/orders?order=${encodeURIComponent(row.orderId)}`}>
                    Order {row.orderId}
                  </a>{" "}
                  · {row.email} · {new Date(row.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  {row.delivery ? (
                    <p className="mt-1">
                      Delivery: <span className="text-amber-500">{stars(row.delivery.rating)}</span> {row.delivery.comment}
                    </p>
                  ) : null}
                  {row.products.map((product) => (
                    <p key={product.title}>
                      {product.title}: <span className="text-amber-500">{stars(product.rating)}</span> {product.comment}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDraft(platformReview())}>New platform review form</Button>
            <Button variant="outline" onClick={() => setDraft(blank())}>New custom form</Button>
          </div>

          {draft ? (
            <Panel title={draft.id ? "Edit form" : "New form"}>
              <div className="space-y-4">
                <Field label="Title">
                  <TextInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                </Field>
                <Field label="Description shown at the top and in the email">
                  <TextArea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Who can see and answer it">
                    <SelectInput value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as Audience })}>
                      {Object.entries(AUDIENCE).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
                    Open (shown on the site and app to that audience)
                  </label>
                </div>
                {draft.audience === "category" ? (
                  <div className="flex flex-wrap gap-3 text-sm">
                    {categories.map((category) => (
                      <label key={category} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.categories.includes(category)}
                          onChange={(event) => setDraft({ ...draft, categories: event.target.checked ? [...draft.categories, category] : draft.categories.filter((item) => item !== category) })}
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                ) : null}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Questions</p>
                  {draft.questions.map((question, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[2fr_1fr_auto_auto]">
                      <TextInput placeholder="Question" value={question.label} onChange={(event) => setQuestion(index, { label: event.target.value })} />
                      <SelectInput value={question.type} onChange={(event) => setQuestion(index, { type: event.target.value as QuestionType })}>
                        <option value="rating">Star rating</option>
                        <option value="text">Short answer</option>
                        <option value="textarea">Long answer</option>
                        <option value="choice">Choice</option>
                      </SelectInput>
                      <label className="flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={Boolean(question.required)} onChange={(event) => setQuestion(index, { required: event.target.checked })} />
                        Required
                      </label>
                      <Button variant="ghost" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, at) => at !== index) })}>
                        Remove
                      </Button>
                      {question.type === "choice" ? (
                        <div className="md:col-span-4">
                          <TextInput placeholder="Choices, separated by commas" value={(question.options ?? []).join(", ")} onChange={(event) => setQuestion(index, { options: event.target.value.split(",").map((value) => value.trim()) })} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <Button variant="outline" onClick={() => setDraft({ ...draft, questions: [...draft.questions, { id: `q${Date.now().toString(36)}`, label: "", type: "text" }] })}>
                    Add question
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      run(async () => {
                        await api({ action: "save", form: draft });
                        setDraft(null);
                        return "Form saved. It now shows on the site and app for its audience.";
                      })
                    }
                  >
                    Save form
                  </Button>
                  <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel title="Forms">
            {forms.length === 0 ? (
              <EmptyState text="No forms yet. Start with a platform review form." />
            ) : (
              <div className="space-y-3 text-sm">
                {forms.map((form) => {
                  const count = responses.filter((row) => row.formId === form.id).length;
                  return (
                    <div key={form.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div>
                        <p className="font-semibold">
                          {form.title} {form.active ? "" : "(closed)"}
                        </p>
                        <p className="text-xs text-text-muted">
                          {form.kind === "platform-review" ? "Platform review" : "Custom"} · {AUDIENCE[form.audience]}
                          {form.categories.length ? `: ${form.categories.join(", ")}` : ""} · {count} response{count === 1 ? "" : "s"}
                          {form.lastMailedAt ? ` · emailed to ${form.lastMailedCount ?? 0} on ${new Date(form.lastMailedAt).toLocaleDateString("en-IN")}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setViewing(viewing === form.id ? "" : form.id ?? "")}>Responses</Button>
                        <Button variant="outline" onClick={() => setDraft(form)}>Edit</Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            window.confirm(`Email "${form.title}" to everyone in its audience?`) &&
                            run(async () => {
                              const result = await api<{ recipients: number; sent: number }>({ action: "mail", id: form.id });
                              return `Emailed ${result.sent} of ${result.recipients} customers.`;
                            })
                          }
                        >
                          Email to audience
                        </Button>
                        <a className="self-center text-burgundy underline" href={`/forms/${form.id}`} target="_blank" rel="noreferrer">
                          Open
                        </a>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            window.confirm(`Delete "${form.title}" and its responses?`) &&
                            run(async () => {
                              await api({ action: "delete", id: form.id });
                              return "Form deleted.";
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {viewed ? (
            <Panel title={`Responses: ${viewed.title}`}>
              {responses.filter((row) => row.formId === viewed.id).length === 0 ? (
                <EmptyState text="No responses yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-muted">
                        <th className="p-2">Customer</th>
                        <th className="p-2">Date</th>
                        {viewed.questions.map((question) => (
                          <th key={question.id} className="p-2">
                            {question.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {responses
                        .filter((row) => row.formId === viewed.id)
                        .map((row) => (
                          <tr key={row.id} className="border-t border-border align-top">
                            <td className="p-2">
                              {row.name}
                              <div className="text-xs text-text-muted">{row.email}</div>
                            </td>
                            <td className="p-2 text-xs">{new Date(row.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                            {viewed.questions.map((question) => (
                              <td key={question.id} className="p-2">
                                {question.type === "rating" && row.answers[question.id] ? <span className="text-amber-500">{stars(Number(row.answers[question.id]))}</span> : row.answers[question.id] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
