import { redirect } from "next/navigation";

/** Weights now live on the Flavors page. */
export default function MixPage() {
  redirect("/chains");
}
