interface DetailsFormProps {
  form: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsapp: string;
  };
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
}

export default function DetailsForm({
  form,
  onChange,
  onSubmit,
}: DetailsFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="first-name">
            First Name
          </label>
          <input
            id="first-name"
            type="text"
            placeholder="Enter first name"
            value={form.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
            required
            className="input-field"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="last-name">
            Last Name
          </label>
          <input
            id="last-name"
            type="text"
            placeholder="Enter last name"
            value={form.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
            required
            className="input-field"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="email">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={(event) => onChange("email", event.target.value)}
          required
          className="input-field"
        />
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="phone">
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="+91 98765 43210"
          value={form.phone}
          onChange={(event) => {
            onChange("phone", event.target.value);
            onChange("whatsapp", event.target.value);
          }}
          required
          className="input-field"
        />
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="whatsapp">
          WhatsApp Number
        </label>
        <input
          id="whatsapp"
          type="tel"
          placeholder="+91 98765 43210"
          value={form.whatsapp}
          onChange={(event) => onChange("whatsapp", event.target.value)}
          required
          className="input-field"
        />

        <p className="mt-2 text-xs text-text-muted">
          A WhatsApp OTP will be sent to verify this number.
        </p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm text-text-muted">
        <input
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-border"
        />
        <span>
          I agree to the Foundation&apos;s terms and privacy policy.
        </span>
      </label>

      <button type="submit" className="btn-primary mt-7 w-full">
        Continue & Verify
      </button>
    </form>
  );
}