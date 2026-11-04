/** Couriers used directly (not through an aggregator API). Tracking opens the courier's own page. */
export const DIRECT_COURIERS = [
  { id: "amazon-shipping", label: "Amazon Shipping", url: "https://track.amazon.in/tracking/{awb}" },
  { id: "ekart", label: "Ekart", url: "https://ekartlogistics.com/shipmenttrack/{awb}" },
  { id: "fedex", label: "FedEx", url: "https://www.fedex.com/fedextrack/?trknbr={awb}" },
  { id: "trackon", label: "Trackon", url: "https://trackon.in/data/SingleShipment?awbno={awb}" },
  { id: "india-post", label: "India Post (Speed Post)", url: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment={awb}" },
  { id: "bluedart", label: "Blue Dart", url: "https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo={awb}" },
  { id: "delhivery", label: "Delhivery", url: "https://www.delhivery.com/track-v2/package/{awb}" },
  { id: "dtdc", label: "DTDC", url: "https://www.dtdc.in/trace.asp?strCnno={awb}" },
  { id: "pidge", label: "Pidge", url: "https://track.pidge.in/{awb}" },
  { id: "xpressbees", label: "XpressBees", url: "https://www.xpressbees.com/shipment/tracking?awbNo={awb}" },
  { id: "ecom-express", label: "Ecom Express", url: "https://ecomexpress.in/tracking/?awb_field={awb}" },
  { id: "shadowfax", label: "Shadowfax", url: "https://tracker.shadowfax.in/#/track/{awb}" },
  { id: "professional", label: "The Professional Couriers", url: "https://www.tpcindia.com/Tracking2014.aspx?id={awb}" },
  { id: "gati", label: "Gati", url: "https://www.gati.com/track-by-docket/?docketNo={awb}" },
  { id: "dhl", label: "DHL Express", url: "https://www.dhl.com/in-en/home/tracking.html?tracking-id={awb}" },
  { id: "ups", label: "UPS", url: "https://www.ups.com/track?tracknum={awb}" },
  { id: "aramex", label: "Aramex", url: "https://www.aramex.com/in/en/track/results?ShipmentNumber={awb}" },
  { id: "shree-maruti", label: "Shree Maruti Courier", url: "https://www.shreemaruti.com/track-your-shipment/?awb={awb}" },
  { id: "safexpress", label: "Safexpress", url: "https://www.safexpress.com/track-shipment?waybill={awb}" },
  { id: "porter", label: "Porter", url: "https://porter.in/track-order?crn={awb}" },
  { id: "other", label: "Other courier", url: "" },
] as const;

export type DirectCourierId = (typeof DIRECT_COURIERS)[number]["id"];

export function directCourier(id?: string) {
  return DIRECT_COURIERS.find((item) => item.id === id);
}

export function courierTrackingLink(id?: string, awb?: string) {
  const courier = directCourier(id);
  if (!courier?.url || !awb) return "";
  return courier.url.replace("{awb}", encodeURIComponent(awb.trim()));
}
