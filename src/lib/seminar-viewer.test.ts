import assert from "node:assert/strict";
import test from "node:test";
import { chooseSeminarViewer, type SeminarUserRow } from "./seminar-viewer";

function row(partial: Partial<SeminarUserRow> & Pick<SeminarUserRow, "id">): SeminarUserRow {
  return {
    email: "doctor@example.com",
    phone: "9000000001",
    whatsapp: null,
    doctor_category: null,
    user_id_string: null,
    role: "doctor",
    user_role: "",
    has_license: false,
    ...partial,
  };
}

test("portal id selects the volunteer even when a staff row shares the email and sorts first", () => {
  const volunteer = row({ id: 20, doctor_category: "volunteer", user_id_string: "100000000020", has_license: true });
  const staff = row({ id: 4, role: "admin", user_role: "staff", has_license: true, user_id_string: "100000000004" });
  const chosen = chooseSeminarViewer([staff, volunteer], "doctor@example.com", "9111111111", "100000000020");
  assert.equal(chosen?.id, 20);
});

test("same email prefers the volunteer with a license over a staff duplicate", () => {
  const staff = row({ id: 2, role: "admin", user_role: "admin" });
  const volunteer = row({ id: 9, doctor_category: "Volunteer", has_license: true, user_id_string: "100000000009" });
  const chosen = chooseSeminarViewer([staff, volunteer], "doctor@example.com", "", "");
  assert.equal(chosen?.id, 9);
});

test("phone fallback does not pick a staff login when a doctor shares that phone", () => {
  const staff = row({ id: 3, email: "office@example.com", role: "staff", user_role: "staff", has_license: true });
  const doctor = row({ id: 11, email: "other@example.com", doctor_category: "volunteer", has_license: true });
  const chosen = chooseSeminarViewer([staff, doctor], "", "9000000001", "");
  assert.equal(chosen?.id, 11);
});
