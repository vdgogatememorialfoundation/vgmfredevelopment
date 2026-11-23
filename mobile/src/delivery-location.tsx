import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, Text } from "react-native";
import { rider } from "./delivery-api";
import { Btn, Card, d } from "./delivery-ui";
import { P } from "./portal-ui";

export type LocationState = "checking" | "granted" | "denied" | "off";

/** Asks for location access and, while on duty, sends the rider's position to the server every 30 seconds or 50 metres. */
export function useRiderLocation(onDuty: boolean) {
  const [state, setState] = useState<LocationState>("checking");

  const check = useCallback(async (ask: boolean) => {
    const services = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!services) return setState("off");
    const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    setState(perm.granted ? "granted" : "denied");
  }, []);

  useEffect(() => {
    void check(true);
  }, [check]);

  useEffect(() => {
    if (state !== "granted" || !onDuty) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 30_000, distanceInterval: 50 }, (pos) => {
      void rider.ping(pos.coords.latitude, pos.coords.longitude).catch(() => undefined);
    }).then((s) => {
      if (cancelled) s.remove();
      else sub = s;
    });
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [state, onDuty]);

  return { state, retry: () => check(true) };
}

export function LocationGate({ state, retry }: { state: LocationState; retry: () => void }) {
  const off = state === "off";
  return (
    <ScrollView contentContainerStyle={d.pad}>
      <Card>
        <Ionicons name="location" size={40} color={P.brand} />
        <Text style={d.h2}>{off ? "Turn on your phone's location" : "Allow location access to continue"}</Text>
        <Text style={d.body}>
          VGMF Delivery needs your location during your shift. It is used to confirm that you have arrived at the customer or hub, to show customers where their order is, and to calculate your
          trips and earnings correctly. Your location is shared only while you are on duty.
        </Text>
        <Btn label={off ? "I have turned location on" : "Allow location access"} icon="navigate" onPress={retry} />
        <Btn label="Open phone settings" icon="settings" tone="outline" onPress={() => void Linking.openSettings()} />
      </Card>
    </ScrollView>
  );
}
