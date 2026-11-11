import { DiamondLoader } from "@/components/DiamondLoader";

export default function DashboardLoading() {
  return (
    <DiamondLoader
      variant="section"
      label="Loading dashboard"
      sublabel="Preparing your study workspace"
      className="min-h-[28rem]"
    />
  );
}
