import assert from "node:assert/strict";
import test from "node:test";
import { customerCourierLabel } from "./courier-label";
import { buildTrackingStages, classifyCourierScan } from "./order-pipeline";
import { shipdayLookupIds, shipdayOrderState } from "./shipday-status";
import type { Order } from "@/types";

test("Shipday already delivered is a delivered scan", () => {
  assert.equal(classifyCourierScan("ALREADY_DELIVERED"), "delivered");
  assert.equal(classifyCourierScan("STARTED"), "out");
  assert.equal(classifyCourierScan("PICKED_UP"), "shipped");
  assert.equal(classifyCourierScan("READY_TO_DELIVER"), "out");
  assert.equal(classifyCourierScan("NOT_ASSIGNED"), "packed");
});

test("Shipday orderStatus object is read from orderState", () => {
  assert.equal(
    shipdayOrderState({ orderStatus: { incomplete: false, accepted: true, orderState: "ALREADY_DELIVERED" } }),
    "ALREADY_DELIVERED"
  );
  assert.deepEqual(shipdayLookupIds("370476101418", "55807136"), ["370476101418", "55807136"]);
});

test("a delivered order does not stay on out for delivery", () => {
  const order = {
    id: "370476101418",
    status: "Delivered",
    date: "2026-11-02T14:52:40.418Z",
    deliveryMode: "delivery",
    deliveryAddress: { city: "Pune", state: "Maharashtra", country: "India" },
    history: [{ at: "2026-11-02T15:10:00.000Z", status: "Delivered" }],
    courierChoice: { provider: "shipday" },
  } as Order;
  const { stages } = buildTrackingStages(order, [{ at: order.date, status: "Shipment booked" }], {
    status: "Booked",
    provider: "shipday",
    note: "Booked on Shipday.",
    generatedAt: order.date,
    courier: "Gogate Products",
    awb: "1",
  });
  const delivered = stages.find((stage) => stage.id === "delivered");
  const out = stages.find((stage) => stage.id === "out");
  assert.equal(delivered?.reached, true);
  assert.equal(out?.partial, false);
});

test("Gogate Products names the desk that carries it", () => {
  assert.equal(customerCourierLabel({ provider: "shipday", courier: "Gogate Products" }), "Gogate Products-Shipday");
  assert.equal(customerCourierLabel({ provider: "tookan", courier: "Gogate Products" }), "Gogate Products-Tookan");
  assert.equal(customerCourierLabel({ provider: "tookan-parcel" }), "Gogate Products-Tookan");
  assert.equal(customerCourierLabel({ provider: "shiprocket", courier: "Ekart" }), "Ekart");
});
