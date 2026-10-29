import { requireAdmin } from "@/lib/admin";
import MixForm from "./MixForm";

export default async function MixPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("prompt_chain_mix")
    .select("chain_id, weight, chain:prompt_chains(name)")
    .order("chain_id");
  const rows = ((data ?? []) as unknown as { chain_id: number; weight: number; chain: { name: string } | null }[]).map((r) => ({
    chain_id: r.chain_id,
    weight: r.weight,
    name: r.chain?.name ?? `Chain ${r.chain_id}`,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">Pipeline</p>
      <h1 className="mt-1 font-serif text-4xl font-bold">Prompt chain mix</h1>
      <p className="mt-1 text-muted">
        Each new photo picks a chain at random using these weights. Use it to A/B test chains, then compare their AI win
        rates on the Prompt chains page.
      </p>
      <MixForm rows={rows} />
    </div>
  );
}
