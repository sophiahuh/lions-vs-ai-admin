import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import NewMediaForm from "./NewMediaForm";

export default async function NewMediaPage() {
  const { user } = await requireAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/media" className="text-sm text-muted hover:underline">← AI media</Link>
      <h1 className="mt-3 font-serif text-4xl font-bold">New AI media</h1>
      <p className="mt-1 text-muted">Upload a photo and Gemini writes its AI caption with the same prompt the main app uses.</p>
      <NewMediaForm adminId={user.id} />
    </div>
  );
}
