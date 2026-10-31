import { router } from "expo-router";
import { ACCOUNT_SECTIONS } from "../../src/account-nav";
import { useAuth } from "../../src/auth";
import { ChatFab, TopBar } from "../../src/chrome";
import { SITE } from "../../src/site-content";
import { useFeed } from "../../src/feed";
import { useWishlist } from "../../src/wishlist";
import { Button, Card, Heading, ListRow, Loading, Muted, PageHeader, Screen, SiteFooter } from "../../src/ui";
import { View } from "react-native";

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const { session, signOut } = useAuth();
  const wishlist = useWishlist();

  if (loading && !feed) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        <TopBar bag />
        <PageHeader
          kicker="My Account"
          title={session?.name || "Your account"}
          subtitle="The same Foundation account used on the website — email, phone and 12-digit Account ID."
        />
        <Card featured>
          <Heading>{session?.name || "Member"}</Heading>
          <Muted>{session?.email}</Muted>
          {session?.accountId ? <Heading>Account ID {session.accountId}</Heading> : <Muted>Your 12-digit Account ID appears after the first verified sign-in.</Muted>}
          <Button kind="ghost" icon="log-out-outline" label="Sign out" onPress={() => void signOut()} />
        </Card>
        {ACCOUNT_SECTIONS.map((item) => (
          <ListRow
            key={item.id}
            icon={item.id === "wishlist" && wishlist.ids.length ? "heart" : item.icon}
            title={item.title}
            subtitle={item.id === "wishlist" && wishlist.ids.length ? `${wishlist.ids.length} saved` : item.subtitle}
            onPress={() => router.push(item.id === "faq" ? "/faq" : `/account/${item.id}`)}
          />
        ))}
        <ListRow icon="shield-checkmark-outline" title="Privacy" onPress={() => router.push("/policy/privacy")} />
        <ListRow icon="document-text-outline" title="Terms" onPress={() => router.push("/policy/terms")} />
        <Muted>{SITE.name}</Muted>
        <SiteFooter />
      </Screen>
      <ChatFab />
    </View>
  );
}
