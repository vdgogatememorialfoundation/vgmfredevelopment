import { AuthProvider } from "@/components/auth/AuthContext";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">{children}</div>
    </AuthProvider>
  );
}