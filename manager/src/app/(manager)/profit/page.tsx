import { redirect } from "next/navigation";

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const suffix = query.toString();
  redirect(suffix ? `/pnl?${suffix}` : "/pnl");
}
