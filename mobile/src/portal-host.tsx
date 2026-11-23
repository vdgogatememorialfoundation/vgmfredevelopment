import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { Flavor } from "./flavor";
import { AdminAppShell } from "./portal-admin";
import { loadPortalSession, portalLogout, type PortalSession } from "./portal-api";
import { PosAppShell } from "./portal-pos";
import { ScannerAppShell } from "./portal-scanner";
import { StaffAppShell } from "./portal-staff";
import { P, PortalSignIn } from "./portal-ui";

export function PortalAppHost({ flavor }: { flavor: Flavor }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<PortalSession | null>(null);

  useEffect(() => {
    void loadPortalSession().then((saved) => {
      setSession(saved);
      setReady(true);
    });
  }, []);

  const signOut = () => {
    void portalLogout().then(() => setSession(null));
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: P.white, alignItems: "center", justifyContent: "center", gap: 10 }}>
        <StatusBar style="dark" backgroundColor={P.white} />
        <ActivityIndicator size="large" color={flavor.accent} />
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: P.muted }}>Opening {flavor.displayName}…</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={P.white} />
        <PortalSignIn flavor={flavor} onSignedIn={setSession} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={P.white} />
      {flavor.id === "admin" ? (
        <AdminAppShell session={session} onSignOut={signOut} />
      ) : flavor.id === "scanner" ? (
        <ScannerAppShell session={session} onSignOut={signOut} />
      ) : flavor.id === "pos" ? (
        <PosAppShell session={session} onSignOut={signOut} />
      ) : (
        <StaffAppShell session={session} onSignOut={signOut} />
      )}
    </>
  );
}
