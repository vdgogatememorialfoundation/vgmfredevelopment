import RiderJoinClient from "./RiderJoinClient";

export const metadata = { title: "Join as a delivery partner", robots: { index: false } };

export default async function RiderJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RiderJoinClient token={token} />;
}
