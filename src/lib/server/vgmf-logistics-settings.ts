import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type LogisticsRouteConfig = {
  code: string;
  originHub: string;
  destHub: string;
  transitHours: number;
  dispatchCutoff: string;
  operatingDays: string;
  transportType: "Road" | "Air" | "Rail";
  defaultVehicle?: string;
  active: boolean;
};

export type LogisticsVehicleConfig = {
  id: string;
  regNo: string;
  category: "Motorcycle" | "Scooter" | "Three-Wheeler" | "Mini Van" | "Delivery Van" | "LCV" | "Truck";
  capacityKg: number;
  maxParcels: number;
  driverName?: string;
  driverPhone?: string;
  insuranceExpiry?: string;
  pucExpiry?: string;
  available: boolean;
};

export type ServiceablePincodeConfig = {
  pincode: string;
  city: string;
  state: string;
  primaryHub: string;
  backupHub?: string;
  zone: "Local" | "Regional" | "National" | "Remote";
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  codEnabled: boolean;
  ownLogistics: boolean;
  slaDays: number;
};

export type LogisticsSettingsData = {
  general: {
    companyName: string;
    brandName: string;
    supportEmail: string;
    supportPhone: string;
    country: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    weightUnit: "kg" | "g";
    dimensionUnit: "cm" | "in";
    defaultShipmentMode: "own" | "external";
    defaultPickupHub: string;
    defaultReturnAddress: string;
    ownLogisticsEnabled: boolean;
    thirdPartyCourierEnabled: boolean;
    multiHubEnabled: boolean;
    interHubTransfersEnabled: boolean;
    codEnabled: boolean;
    defaultDeliveryAttempts: number;
  };
  awb: {
    format: "12_digit_numeric" | "prefix_yymm_seq";
    forwardPrefix: string;
    returnPrefix: string;
    barcodeType: "Code128" | "QR";
    qrEnabled: boolean;
    labelSize: "4x6" | "A4";
    showSenderPhone: boolean;
    showReceiverPhone: boolean;
    showOrderNumber: boolean;
    showWeight: boolean;
    showReturnAddress: boolean;
    showFragileMarkings: boolean;
  };
  pickup: {
    autoPickupCreation: boolean;
    assignmentMode: "manual" | "auto";
    requireBarcodeScan: boolean;
    require6DigitSellerOtp: boolean;
    pickupPhotoRequired: boolean;
    maxPickupAttempts: number;
    pickupSlaMinutes: number;
    sellerNotifyOutForPickup: boolean;
    sellerNotifyPickedUp: boolean;
    sellerNotifyFailedAttempt: boolean;
    sellerNotifyInTransit: boolean; // false by default per VGMF rule
  };
  hubRules: {
    inwardScanMandatory: boolean;
    outwardScanMandatory: boolean;
    baggingMandatory: boolean;
    manifestRequired: boolean;
    wrongHubRejection: boolean;
    supervisorBagReopenOnly: boolean;
    reconciliationMandatory: boolean;
    autoHubCode: boolean;
    hubCodePrefix: string;
    googleMapsApiKey: string;
    hubCutoffs: Record<string, { dispatchCutoff: string; maxDailyCapacity: number }>;
  };
  sortingBagging: {
    autoSortMethod: "pincode" | "city" | "hub" | "route";
    bagPrefix: string;
    maxParcelsPerBag: number;
    maxBagWeightKg: number;
    sealMandatory: boolean;
    allowMultiDestBag: boolean;
    allowMixedCodPrepaidBag: boolean;
    racks: string[];
  };
  manifests: {
    pickupPrefix: string;
    inwardPrefix: string;
    bagPrefix: string;
    transferPrefix: string;
    vehiclePrefix: string;
    deliveryPrefix: string;
    returnPrefix: string;
    immutableOnceDispatched: boolean;
    requireDigitalSignature: boolean;
  };
  partners: {
    requireHubSelectionOnSignup: boolean;
    requireHubManagerApproval: boolean;
    maxDailyPickups: number;
    maxDailyDeliveries: number;
    earningsPerPickup: number;
    earningsPerDelivery: number;
    earningsFailedAttempt: number;
    earningsReturnCollection: number;
    payoutCycle: "Weekly" | "Monthly";
  };
  delivery: {
    requireBarcodeScan: boolean;
    require6DigitCustomerOtp: boolean;
    hideAgentLocationFromCustomer: boolean;
    podPhotoRequired: boolean;
    recipientNameRequired: boolean;
    maxAttempts: number;
    ndrReasons: string[];
  };
  finance: {
    maxCodAmount: number;
    partnerCodLimit: number;
    gstPercent: number;
    rateCard: {
      local: { base: number; perKg: number };
      regional: { base: number; perKg: number };
      national: { base: number; perKg: number };
      remote: { base: number; perKg: number };
    };
  };
  automation: {
    agingAlertHours: number;
    bagCapacityAlertPercent: number;
    transferDelayAlertHours: number;
    failedPickupEscalationMinutes: number;
  };
  emergency: {
    pauseNewPickups: boolean;
    pauseBagDispatch: boolean;
    pauseAutoAllocation: boolean;
    emergencyBanner: string;
  };
  kycProviders: {
    manualEnabled: boolean;
    accuraScanEnabled: boolean;
    defaultProvider: "manual" | "accurascan";
    mandatoryBeforeActivation: boolean;
  };
  accuraScan: {
    apiKey: string;
    apiBaseUrl: string;
    countryCode: string;
    minFaceMatchScore: number;
    minLivenessScore: number;
    autoApproveOnPass: boolean;
  };
  routes: LogisticsRouteConfig[];
  vehicles: LogisticsVehicleConfig[];
  pincodes: ServiceablePincodeConfig[];
};

type SettingsStore = {
  current: LogisticsSettingsData;
  updatedAt: string;
  updatedBy: string;
  history: { version: number; at: string; by: string; note: string; snapshot: LogisticsSettingsData }[];
};

const DEFAULT_SETTINGS: LogisticsSettingsData = {
  general: {
    companyName: "Vaidya Gogate Memorial Foundation",
    brandName: "VGMF Logistics",
    supportEmail: "orders@vaidyagogate.org",
    supportPhone: "",
    country: "India",
    currency: "INR",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    weightUnit: "kg",
    dimensionUnit: "cm",
    defaultShipmentMode: "own",
    defaultPickupHub: "",
    defaultReturnAddress: "Vaidya Gogate Memorial Foundation, Pune, Maharashtra 411030",
    ownLogisticsEnabled: true,
    thirdPartyCourierEnabled: true,
    multiHubEnabled: true,
    interHubTransfersEnabled: true,
    codEnabled: true,
    defaultDeliveryAttempts: 3,
  },
  awb: {
    format: "12_digit_numeric",
    forwardPrefix: "88",
    returnPrefix: "89",
    barcodeType: "Code128",
    qrEnabled: true,
    labelSize: "4x6",
    showSenderPhone: true,
    showReceiverPhone: true,
    showOrderNumber: true,
    showWeight: true,
    showReturnAddress: true,
    showFragileMarkings: true,
  },
  pickup: {
    autoPickupCreation: false,
    assignmentMode: "manual",
    requireBarcodeScan: true,
    require6DigitSellerOtp: true,
    pickupPhotoRequired: false,
    maxPickupAttempts: 3,
    pickupSlaMinutes: 180,
    sellerNotifyOutForPickup: true,
    sellerNotifyPickedUp: true,
    sellerNotifyFailedAttempt: true,
    sellerNotifyInTransit: false,
  },
  hubRules: {
    inwardScanMandatory: true,
    outwardScanMandatory: true,
    baggingMandatory: true,
    manifestRequired: true,
    wrongHubRejection: true,
    supervisorBagReopenOnly: true,
    reconciliationMandatory: true,
    autoHubCode: true,
    hubCodePrefix: "VGMF",
    googleMapsApiKey: "",
    hubCutoffs: {},
  },
  sortingBagging: {
    autoSortMethod: "pincode",
    bagPrefix: "BAG-VGMF",
    maxParcelsPerBag: 40,
    maxBagWeightKg: 25,
    sealMandatory: true,
    allowMultiDestBag: false,
    allowMixedCodPrepaidBag: true,
    racks: ["Rack A1", "Rack A2", "Rack B1", "Rack B2", "Bin C1", "Bin C2", "Priority Zone", "COD Zone", "Fragile Rack"],
  },
  manifests: {
    pickupPrefix: "VGMF-PM",
    inwardPrefix: "VGMF-IM",
    bagPrefix: "VGMF-BM",
    transferPrefix: "VGMF-TM",
    vehiclePrefix: "VGMF-VM",
    deliveryPrefix: "VGMF-DM",
    returnPrefix: "VGMF-RM",
    immutableOnceDispatched: true,
    requireDigitalSignature: true,
  },
  partners: {
    requireHubSelectionOnSignup: true,
    requireHubManagerApproval: true,
    maxDailyPickups: 60,
    maxDailyDeliveries: 60,
    earningsPerPickup: 15,
    earningsPerDelivery: 25,
    earningsFailedAttempt: 0,
    earningsReturnCollection: 20,
    payoutCycle: "Weekly",
  },
  delivery: {
    requireBarcodeScan: true,
    require6DigitCustomerOtp: true,
    hideAgentLocationFromCustomer: true,
    podPhotoRequired: false,
    recipientNameRequired: true,
    maxAttempts: 3,
    ndrReasons: [
      "Customer unavailable / phone unreachable",
      "Address incomplete or incorrect",
      "Customer requested reschedule",
      "Customer refused parcel",
      "Premises / shop closed",
    ],
  },
  finance: {
    maxCodAmount: 10000,
    partnerCodLimit: 25000,
    gstPercent: 18,
    rateCard: {
      local: { base: 30, perKg: 10 },
      regional: { base: 50, perKg: 15 },
      national: { base: 80, perKg: 20 },
      remote: { base: 110, perKg: 25 },
    },
  },
  automation: {
    agingAlertHours: 48,
    bagCapacityAlertPercent: 85,
    transferDelayAlertHours: 24,
    failedPickupEscalationMinutes: 120,
  },
  emergency: {
    pauseNewPickups: false,
    pauseBagDispatch: false,
    pauseAutoAllocation: false,
    emergencyBanner: "",
  },
  kycProviders: {
    manualEnabled: true,
    accuraScanEnabled: true,
    defaultProvider: "manual",
    mandatoryBeforeActivation: true,
  },
  accuraScan: {
    apiKey: "",
    apiBaseUrl: "https://api.accurascan.com",
    countryCode: "IND",
    minFaceMatchScore: 70,
    minLivenessScore: 55,
    autoApproveOnPass: true,
  },
  routes: [],
  vehicles: [],
  pincodes: [],
};

function settingsPath() {
  return dataFile("vgmf-logistics-settings.json");
}

export function readLogisticsSettings(): SettingsStore {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), "utf8")) as Partial<SettingsStore>;
    return {
      current: {
        ...DEFAULT_SETTINGS,
        ...(raw.current || {}),
        general: { ...DEFAULT_SETTINGS.general, ...(raw.current?.general || {}) },
        awb: { ...DEFAULT_SETTINGS.awb, ...(raw.current?.awb || {}) },
        pickup: { ...DEFAULT_SETTINGS.pickup, ...(raw.current?.pickup || {}) },
        hubRules: { ...DEFAULT_SETTINGS.hubRules, ...(raw.current?.hubRules || {}) },
        sortingBagging: { ...DEFAULT_SETTINGS.sortingBagging, ...(raw.current?.sortingBagging || {}) },
        manifests: { ...DEFAULT_SETTINGS.manifests, ...(raw.current?.manifests || {}) },
        partners: { ...DEFAULT_SETTINGS.partners, ...(raw.current?.partners || {}) },
        delivery: { ...DEFAULT_SETTINGS.delivery, ...(raw.current?.delivery || {}) },
        finance: { ...DEFAULT_SETTINGS.finance, ...(raw.current?.finance || {}) },
        automation: { ...DEFAULT_SETTINGS.automation, ...(raw.current?.automation || {}) },
        emergency: { ...DEFAULT_SETTINGS.emergency, ...(raw.current?.emergency || {}) },
        kycProviders: { ...DEFAULT_SETTINGS.kycProviders, ...(raw.current?.kycProviders || {}) },
        accuraScan: { ...DEFAULT_SETTINGS.accuraScan, ...(raw.current?.accuraScan || {}) },
        routes: Array.isArray(raw.current?.routes) ? raw.current.routes : [],
        vehicles: Array.isArray(raw.current?.vehicles) ? raw.current.vehicles : [],
        pincodes: Array.isArray(raw.current?.pincodes) ? raw.current.pincodes : [],
      },
      updatedAt: raw.updatedAt || new Date().toISOString(),
      updatedBy: raw.updatedBy || "System Default",
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  } catch {
    return {
      current: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: "System Default",
      history: [],
    };
  }
}

export function saveLogisticsSettings(next: LogisticsSettingsData, by: string, note = "Configuration updated"): SettingsStore {
  const store = readLogisticsStoreOrInit();
  const version = (store.history[0]?.version || 0) + 1;
  const at = new Date().toISOString();
  const updated: SettingsStore = {
    current: next,
    updatedAt: at,
    updatedBy: by,
    history: [{ version, at, by, note, snapshot: store.current }, ...store.history].slice(0, 30),
  };
  const file = settingsPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

function readLogisticsStoreOrInit() {
  return readLogisticsSettings();
}

export function restoreLogisticsSettingsVersion(version: number, by: string): SettingsStore {
  const store = readLogisticsSettings();
  const hit = store.history.find((h) => h.version === version);
  if (!hit) throw new Error(`Settings version v${version} not found.`);
  return saveLogisticsSettings(hit.snapshot, by, `Restored configuration from v${version}`);
}
