import "./globals.css";

export const metadata = {
  title: "Football Match Intelligence",
  description: "AI-powered football match intelligence for the hackathon",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}