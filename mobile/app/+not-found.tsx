import { Link } from "expo-router";
import { Screen, Title, Muted } from "../src/ui";

export default function NotFound() {
  return (
    <Screen>
      <Title>Screen not found</Title>
      <Muted>That page is not part of the Foundation app.</Muted>
      <Link href="/" style={{ marginTop: 16, fontWeight: "700" }}>
        Return home
      </Link>
    </Screen>
  );
}
