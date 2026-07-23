import type { Metadata } from "next";
import { StatusDashboard } from "./status-dashboard";

export const metadata: Metadata = {
  title: "Service Health | COR3",
  description:
    "Live availability for Microsoft 365, Adobe, 3CX, Cloudflare, PR DRS, and RECOVERY.PR.",
};

export default function Home() {
  return <StatusDashboard />;
}
