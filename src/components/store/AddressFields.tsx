"use client";

import { useEffect, useRef, useState } from "react";
import type { DeliveryAddress } from "@/types";
import {
  DEFAULT_COUNTRY,
  countryByCode,
  isIndia,
  statesFor,
} from "@/lib/geo";
import { fetchPostalPlace, postalLooksComplete } from "@/lib/postal-lookup";
import { defaultEnabledCountry } from "@/lib/platform-countries";
import { usePlatformCountries } from "@/lib/use-platform-countries";

export function emptyDeliveryAddress(partial?: Partial<DeliveryAddress>): DeliveryAddress {
  const country = countryByCode(partial?.countryCode || defaultEnabledCountry().code || DEFAULT_COUNTRY);
  return {
    fullName: "",
    phone: "",
    email: "",
    line1: "",
    landmark: "",
    city: "",
    state: isIndia(country.code) ? "Maharashtra" : "",
    pincode: "",
    country: country.name,
    countryCode: country.code,
    ...partial,
  };
}

export function AddressFields({
  value,
  onChange,
  idPrefix = "addr",
  showEmail = false,
}: {
  value: DeliveryAddress;
  onChange: (next: DeliveryAddress) => void;
  idPrefix?: string;
  showEmail?: boolean;
}) {
  const { countries } = usePlatformCountries();
  const countryCode = value.countryCode || countries[0]?.code || DEFAULT_COUNTRY;
  const country = countries.find((item) => item.code === countryCode) ?? countries[0] ?? countryByCode(countryCode);
  const states = statesFor(country.code);
  const postalLabel = isIndia(country.code) ? "Pincode" : "Postal code";

  useEffect(() => {
    if (!countries.length) return;
    if (countries.some((item) => item.code === (value.countryCode || DEFAULT_COUNTRY))) return;
    const next = countries[0];
    onChange({
      ...value,
      countryCode: next.code,
      country: next.name,
      state: statesFor(next.code)[0] || "",
    });
  }, [countries, onChange, value]);

  const set = (patch: Partial<DeliveryAddress>) => onChange({ ...value, ...patch });
  const [lookupNote, setLookupNote] = useState("");
  const lastLookup = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const pin = value.pincode.trim();
    if (!postalLooksComplete(pin, countryCode)) {
      setLookupNote("");
      return;
    }
    const key = `${countryCode}:${pin}`;
    if (lastLookup.current === key) return;
    const timer = window.setTimeout(() => {
      lastLookup.current = key;
      void fetchPostalPlace(pin, countryCode)
        .then((place) => {
          if (!place) {
            setLookupNote("Postal code not found. Enter city, state and country.");
            return;
          }
          if (countries.length && !countries.some((item) => item.code === place.countryCode)) {
            setLookupNote("This postal code is in a country that is not enabled on the platform.");
            return;
          }
          const current = valueRef.current;
          const nextStates = statesFor(place.countryCode);
          lastLookup.current = `${place.countryCode}:${place.pincode || pin}`;
          onChange({
            ...current,
            city: place.city || current.city,
            state: nextStates.includes(place.state) ? place.state : place.state || current.state,
            country: place.country,
            countryCode: place.countryCode,
            pincode: place.pincode || pin,
          });
          setLookupNote(`${place.city}${place.state ? `, ${place.state}` : ""}, ${place.country}`);
        })
        .catch(() => setLookupNote("Could not look up this postal code."));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [countries, countryCode, onChange, value.pincode]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-name`}>
            Full name
          </label>
          <input
            id={`${idPrefix}-name`}
            className="input-field"
            value={value.fullName}
            onChange={(event) => set({ fullName: event.target.value })}
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-phone`}>
            Phone (with country code)
          </label>
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            className="input-field"
            value={value.phone}
            onChange={(event) => set({ phone: event.target.value })}
            placeholder={`${country.dial} 98765 43210`}
          />
        </div>
      </div>

      {showEmail ? (
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-email`}>
            Email
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            className="input-field"
            value={value.email ?? ""}
            onChange={(event) => set({ email: event.target.value })}
          />
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-country`}>
          Country
        </label>
        <select
          id={`${idPrefix}-country`}
          className="input-field"
          value={country.code}
          onChange={(event) => {
            const next = countryByCode(event.target.value);
            const nextStates = statesFor(next.code);
            lastLookup.current = "";
            set({
              countryCode: next.code,
              country: next.name,
              state: nextStates.includes(value.state) ? value.state : nextStates[0] || "",
              pincode: isIndia(next.code) ? value.pincode.replace(/\D/g, "").slice(0, 6) : value.pincode,
            });
          }}
        >
          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} ({item.dial})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-line1`}>
          Address
        </label>
        <input
          id={`${idPrefix}-line1`}
          className="input-field"
          value={value.line1}
          onChange={(event) => set({ line1: event.target.value })}
          placeholder="House number, street, area"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-landmark`}>
          Landmark <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-landmark`}
          className="input-field"
          value={value.landmark ?? ""}
          onChange={(event) => set({ landmark: event.target.value })}
          placeholder="Near…"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-city`}>
            City
          </label>
          <input
            id={`${idPrefix}-city`}
            className="input-field"
            value={value.city}
            onChange={(event) => set({ city: event.target.value })}
            placeholder="City"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-state`}>
            State / region
          </label>
          {states.length ? (
            <select
              id={`${idPrefix}-state`}
              className="input-field"
              value={value.state}
              onChange={(event) => set({ state: event.target.value })}
            >
              <option value="">Select</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${idPrefix}-state`}
              className="input-field"
              value={value.state}
              onChange={(event) => set({ state: event.target.value })}
              placeholder="State or region"
            />
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${idPrefix}-postal`}>
            {postalLabel}
          </label>
          <input
            id={`${idPrefix}-postal`}
            className="input-field"
            value={value.pincode}
            onChange={(event) => {
              lastLookup.current = "";
              set({
                pincode: isIndia(country.code)
                  ? event.target.value.replace(/\D/g, "").slice(0, 6)
                  : event.target.value.slice(0, 12),
              });
            }}
            placeholder={isIndia(country.code) ? "6-digit PIN fills city, state, country" : "Postal code fills city, state, country"}
          />
        </div>
      </div>
      {lookupNote ? <p className="text-xs text-text-muted">{lookupNote}</p> : null}
    </div>
  );
}
