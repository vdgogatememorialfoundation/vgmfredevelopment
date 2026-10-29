"use client";

import { useState } from "react";
import { addSupportQuery, addTicket } from "@/lib/admin-store";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function ContactForm() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = `${form.firstName} ${form.lastName}`.trim();
    addSupportQuery({
      name,
      email: form.email,
      subject: form.subject,
      message: form.message,
    });
    addTicket({ name, email: form.email, subject: form.subject, body: form.message });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="heading-3">{t("contact.thanks")}</h2>
        <p className="mt-2 text-sm text-text-muted">{t("contact.thanksText")}</p>
        <button type="button" onClick={() => setSent(false)} className="btn-outline mt-6">
          {t("contact.another")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <h2 className="heading-3">{t("contact.formTitle")}</h2>
      <p className="mt-2 text-sm text-text-muted">{t("contact.formHint")}</p>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-first-name">
              {t("contact.firstName")}
            </label>
            <input
              id="contact-first-name"
              type="text"
              className="input-field"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-last-name">
              {t("contact.lastName")}
            </label>
            <input
              id="contact-last-name"
              type="text"
              className="input-field"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-email">
            {t("contact.emailAddress")}
          </label>
          <input
            id="contact-email"
            type="email"
            className="input-field"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-subject">
            {t("contact.subject")}
          </label>
          <select
            id="contact-subject"
            className="input-field"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
          >
            <option value="" disabled>
              {t("contact.selectSubject")}
            </option>
            <option value="events">{t("contact.subjectEvents")}</option>
            <option value="books">{t("contact.subjectBooks")}</option>
            <option value="clinics">{t("contact.subjectClinics")}</option>
            <option value="publications">{t("contact.subjectPublications")}</option>
            <option value="other">{t("contact.subjectOther")}</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-message">
            {t("contact.message")}
          </label>
          <textarea
            id="contact-message"
            rows={5}
            className="input-field resize-y"
            placeholder={t("contact.messagePh")}
            required
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          {t("contact.send")}
        </button>
      </form>
    </div>
  );
}
