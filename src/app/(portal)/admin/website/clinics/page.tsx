"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideClinic, saveClinic, slugify } from "@/lib/cms";
import { useLiveClinics } from "@/lib/use-cms";
import type { Clinic } from "@/types";

export default function Page() {
  const records = useLiveClinics();
  return (
    <RecordDesk<Clinic>
      heading="Clinics"
      description="Clinic records saved here are the clinics on the public clinics page."
      publicHref="/clinics"
      records={records}
      label={(record) => record.name}
      fields={[
        { key: "name", label: "Clinic name" },
        { key: "doctor", label: "Doctor" },
        { key: "specialization", label: "Specialisation" },
        { key: "city", label: "City" },
        { key: "address", label: "Address" },
        { key: "phone", label: "Phone" },
        { key: "timings", label: "Timings" },
        { key: "consultationFee", label: "Consultation fee" },
        { key: "about", label: "About", kind: "textarea" },
      ]}
      blank={() => ({
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
      })}
      onSave={(record) =>
        saveClinic({
          ...record,
          slug: record.slug || slugify(record.name),
        })
      }
      onHide={hideClinic}
    />
  );
}
