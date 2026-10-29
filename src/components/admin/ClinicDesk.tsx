"use client";

import { useState } from "react";
import Link from "next/link";
import { GalleryField, ImageField } from "@/components/admin/ImageField";
import { hideClinic, saveClinic, slugify } from "@/lib/cms";
import { useLiveClinics } from "@/lib/use-cms";
import type { Clinic, ClinicDoctor, ClinicHours } from "@/types";
import { ClinicLocationField } from "@/components/admin/ClinicLocationField";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700";

function blankClinic(): Clinic {
  return {
    id: `cli-${Date.now()}`,
    name: "",
    slug: "",
    doctor: "",
    specialization: "",
    city: "Pune",
    address: "",
    phone: "",
    timings: "",
    consultationFee: "",
    about: "",
    services: [],
    photos: [],
    doctors: [],
    weeklyHours: defaultHours(),
    appointmentUrl: "",
  };
}

function blankDoctor(): ClinicDoctor {
  return { id: `doc-${Date.now()}`, name: "", qualification: "", specialization: "", experience: "", timings: "", photo: "", bio: "" };
}

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function defaultHours(): ClinicHours[] {
  return WEEK_DAYS.map((day) => ({
    day,
    closed: day === "Sunday",
    from: "10:00",
    to: "18:00",
  }));
}

export default function ClinicDesk() {
  const clinics = useLiveClinics();
  const [editing, setEditing] = useState<Clinic | null>(null);

  if (editing) {
    return <ClinicEditor key={editing.id} initial={editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinics</h1>
          <p className="mt-1 text-sm text-slate-500">Photos, location map, who runs the clinic and doctor profiles all appear on the public clinic page.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/clinics" className={ghost}>View public page</Link>
          <button type="button" className={button} onClick={() => setEditing(blankClinic())}>+ Add clinic</button>
        </div>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {clinics.map((clinic) => (
          <li key={clinic.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {clinic.photos?.[0]?.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinic.photos[0].src} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{clinic.name}</p>
              <p className="text-xs text-slate-500">{clinic.city} · {(clinic.doctors?.length ?? 0) || (clinic.doctor ? 1 : 0)} doctor(s) · {clinic.photos?.length ?? 0} photo(s)</p>
              {clinic.operatedBy && <p className="mt-1 text-xs text-slate-500">Operated by {clinic.operatedBy}</p>}
              <div className="mt-2 flex gap-3 text-sm font-semibold">
                <button type="button" className="text-burgundy" onClick={() => setEditing(clinic)}>Edit</button>
                <Link className="text-slate-500" href={`/clinics/${clinic.slug}`}>View</Link>
                <button type="button" className="text-red-600" onClick={() => { if (window.confirm(`Delete ${clinic.name}?`)) hideClinic(clinic.id); }}>Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClinicEditor({ initial, onDone }: { initial: Clinic; onDone: () => void }) {
  const [draft, setDraft] = useState<Clinic>({ ...initial, doctors: initial.doctors ?? [], photos: initial.photos ?? [] });
  const [services, setServices] = useState((initial.services ?? []).join(", "));
  const [message, setMessage] = useState("");
  const set = (patch: Partial<Clinic>) => setDraft((current) => ({ ...current, ...patch }));
  const doctors = draft.doctors ?? [];
  const setDoctor = (index: number, patch: Partial<ClinicDoctor>) =>
    set({ doctors: doctors.map((doctor, i) => (i === index ? { ...doctor, ...patch } : doctor)) });

  const save = () => {
    if (!draft.name.trim()) {
      setMessage("Add the clinic name.");
      return;
    }
    const cleanDoctors = doctors.filter((doctor) => doctor.name.trim());
    const record: Clinic = {
      ...draft,
      name: draft.name.trim(),
      slug: draft.slug || slugify(draft.name),
      doctors: cleanDoctors,
      doctor: draft.doctor || cleanDoctors[0]?.name || "",
      services: services.split(",").map((item) => item.trim()).filter(Boolean),
      photos: (draft.photos ?? []).filter((photo) => photo.src),
      weeklyHours: draft.weeklyHours?.length ? draft.weeklyHours : defaultHours(),
      appointmentUrl: draft.appointmentUrl?.trim() || undefined,
    };
    try {
      saveClinic(record);
      setDraft(record);
      setMessage("Saved. The clinic page is updated.");
    } catch {
      setMessage("The browser storage is full. Use fewer or smaller photos, or image URLs.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{initial.name ? `Edit ${initial.name}` : "Add clinic"}</h1>
        <div className="flex gap-2">
          {draft.slug && <Link href={`/clinics/${draft.slug}`} className={ghost}>View</Link>}
          <button type="button" className={ghost} onClick={onDone}>Back to clinics</button>
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <h2 className="font-semibold text-slate-900 sm:col-span-2">Clinic information</h2>
        <input className={field} placeholder="Clinic name" value={draft.name} onChange={(event) => set({ name: event.target.value })} />
        <input className={field} placeholder="Operated by (trust, hospital or doctor)" value={draft.operatedBy ?? ""} onChange={(event) => set({ operatedBy: event.target.value })} />
        <input className={field} placeholder="Specialisation" value={draft.specialization} onChange={(event) => set({ specialization: event.target.value })} />
        <input className={field} placeholder="Lead doctor (shown on cards)" value={draft.doctor} onChange={(event) => set({ doctor: event.target.value })} />
        <input className={field} placeholder="Phone" value={draft.phone} onChange={(event) => set({ phone: event.target.value })} />
        <input className={field} placeholder="Email" value={draft.email ?? ""} onChange={(event) => set({ email: event.target.value })} />
        <input className={field} placeholder="Timings summary, e.g. Mon–Sat 10 AM – 6 PM" value={draft.timings} onChange={(event) => set({ timings: event.target.value })} />
        <input className={field} placeholder="Consultation fee" value={draft.consultationFee ?? ""} onChange={(event) => set({ consultationFee: event.target.value })} />
        <input
          className={`${field} sm:col-span-2`}
          placeholder="Appointment booking link (optional) — https://…"
          value={draft.appointmentUrl ?? ""}
          onChange={(event) => set({ appointmentUrl: event.target.value })}
        />
        <input className={`${field} sm:col-span-2`} placeholder="Services, separated by commas" value={services} onChange={(event) => setServices(event.target.value)} />
        <textarea className={`${field} sm:col-span-2`} rows={5} placeholder="About the clinic" value={draft.about ?? ""} onChange={(event) => set({ about: event.target.value })} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Clinic timings</h2>
        <p className="mt-1 text-sm text-slate-500">Set opening hours for each day. Closed days are hidden on the public page.</p>
        <ul className="mt-3 grid gap-2">
          {(draft.weeklyHours?.length ? draft.weeklyHours : defaultHours()).map((row, index) => (
            <li key={row.day} className="grid gap-2 sm:grid-cols-[7rem_auto_7rem_7rem] sm:items-center">
              <span className="text-sm font-medium text-slate-800">{row.day}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!row.closed}
                  onChange={(event) => {
                    const hours = [...(draft.weeklyHours?.length ? draft.weeklyHours : defaultHours())];
                    hours[index] = { ...hours[index], closed: !event.target.checked };
                    set({ weeklyHours: hours });
                  }}
                />
                Open
              </label>
              <input
                className={field}
                type="time"
                disabled={row.closed}
                value={row.from ?? "10:00"}
                onChange={(event) => {
                  const hours = [...(draft.weeklyHours?.length ? draft.weeklyHours : defaultHours())];
                  hours[index] = { ...hours[index], from: event.target.value };
                  set({ weeklyHours: hours });
                }}
              />
              <input
                className={field}
                type="time"
                disabled={row.closed}
                value={row.to ?? "18:00"}
                onChange={(event) => {
                  const hours = [...(draft.weeklyHours?.length ? draft.weeklyHours : defaultHours())];
                  hours[index] = { ...hours[index], to: event.target.value };
                  set({ weeklyHours: hours });
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Location & Google Maps</h2>
        <ClinicLocationField
          address={draft.address}
          city={draft.city}
          mapLink={draft.mapLink}
          placeId={draft.placeId}
          lat={draft.coordinates?.lat}
          lng={draft.coordinates?.lng}
          onChange={(patch) => set(patch)}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <GalleryField label="Clinic photos" images={draft.photos ?? []} onChange={(photos) => set({ photos })} />
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Doctor profiles</h2>
          <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => set({ doctors: [...doctors, blankDoctor()] })}>+ Add doctor</button>
        </div>
        {doctors.length === 0 && <p className="text-sm text-slate-500">No doctor profiles yet.</p>}
        {doctors.map((doctor, index) => (
          <div key={doctor.id} className="grid gap-4 rounded-lg border border-slate-100 p-4 lg:grid-cols-[220px_1fr]">
            <ImageField label="Photo" value={doctor.photo} maxWidth={600} onChange={(photo) => setDoctor(index, { photo })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Name" value={doctor.name} onChange={(event) => setDoctor(index, { name: event.target.value })} />
              <input className={field} placeholder="Qualification, e.g. BAMS, MD (Ayu)" value={doctor.qualification} onChange={(event) => setDoctor(index, { qualification: event.target.value })} />
              <input className={field} placeholder="Specialisation" value={doctor.specialization} onChange={(event) => setDoctor(index, { specialization: event.target.value })} />
              <input className={field} placeholder="Experience, e.g. 15 years" value={doctor.experience ?? ""} onChange={(event) => setDoctor(index, { experience: event.target.value })} />
              <input className={`${field} sm:col-span-2`} placeholder="Consulting timings" value={doctor.timings ?? ""} onChange={(event) => setDoctor(index, { timings: event.target.value })} />
              <textarea className={`${field} sm:col-span-2`} rows={3} placeholder="Short profile" value={doctor.bio ?? ""} onChange={(event) => setDoctor(index, { bio: event.target.value })} />
              <button type="button" className="justify-self-start text-xs font-semibold text-red-600" onClick={() => set({ doctors: doctors.filter((_, i) => i !== index) })}>Remove doctor</button>
            </div>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className={button} onClick={save}>Save clinic</button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    </div>
  );
}
