"use client";

import { useState } from "react";
import { addSupportQuery, addTicket } from "@/lib/admin-store";
import { submitPublic } from "@/lib/public-submit";

export default function ContactForm() {
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
    void submitPublic("contact-enquiries", {
      name,
      email: form.email,
      subject: form.subject,
      message: form.message,
    });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="heading-3">Thank you — we received your enquiry</h2>
        <p className="mt-2 text-sm text-text-muted">
          Our team typically responds within two working days. A confirmation
          email has also been logged with our support desk.
        </p>
        <button type="button" onClick={() => setSent(false)} className="btn-outline mt-6">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <h2 className="heading-3">Send an Enquiry</h2>
      <p className="mt-2 text-sm text-text-muted">
        We typically respond within two working days.
      </p>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-first-name">
              First Name
            </label>
            <input
              id="contact-first-name"
              type="text"
              className="input-field"
              placeholder="Enter first name"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-last-name">
              Last Name
            </label>
            <input
              id="contact-last-name"
              type="text"
              className="input-field"
              placeholder="Enter last name"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-email">
            Email Address
          </label>
          <input
            id="contact-email"
            type="email"
            className="input-field"
            placeholder="name@example.com"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-subject">
            Subject
          </label>
          <select
            id="contact-subject"
            className="input-field"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
          >
            <option value="" disabled>
              Select a subject
            </option>
            <option value="events">Events & Registration</option>
            <option value="books">Books & Orders</option>
            <option value="clinics">Clinics & Appointments</option>
            <option value="certificates">Certificates</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="contact-message">
            Message
          </label>
          <textarea
            id="contact-message"
            rows={5}
            className="input-field resize-y"
            placeholder="How can we help?"
            required
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          Send Message
        </button>
      </form>
    </div>
  );
}