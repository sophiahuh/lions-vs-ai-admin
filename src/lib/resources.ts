/** Tables the admin can fully create, read, update, and delete, with their form fields. */

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select";
  required?: boolean;
  placeholder?: string;
  /** For select fields: which table supplies the options. */
  optionsFrom?: { table: string; value: string; label: string };
  lowercase?: boolean;
};

export type Resource = {
  table: string;
  title: string;
  singular: string;
  description: string;
  orderBy: string;
  ascending?: boolean;
  fields: Field[];
};

export const RESOURCES = {
  terms: {
    table: "terms",
    title: "Columbia terms",
    singular: "term",
    description: "Columbia glossary the AI receives as background. Inactive terms are left out of prompts.",
    orderBy: "term",
    ascending: true,
    fields: [
      { name: "term", label: "Term", type: "text", required: true, placeholder: "Butler" },
      { name: "definition", label: "Definition", type: "textarea", required: true },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
  },
  examples: {
    table: "generation_examples",
    title: "Example captions",
    singular: "example",
    description: "Captions the AI learns from. Active examples are added to every prompt.",
    orderBy: "created_at",
    fields: [
      { name: "image_description", label: "Photo description", type: "textarea", required: true },
      { name: "caption", label: "Caption", type: "text", required: true },
      { name: "notes", label: "Why it works", type: "text" },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
  },
  models: {
    table: "llm_models",
    title: "Models & prices",
    singular: "model",
    description: "Models the pipeline tries, lowest priority number first. Inactive models are skipped. Prices feed the cost estimates on the dashboard.",
    orderBy: "priority",
    ascending: true,
    fields: [
      { name: "provider_id", label: "Provider", type: "select", required: true, optionsFrom: { table: "llm_providers", value: "id", label: "name" } },
      { name: "model_id", label: "Model ID", type: "text", required: true, placeholder: "gemini-3.5-flash" },
      { name: "display_name", label: "Display name", type: "text" },
      { name: "priority", label: "Priority", type: "number", required: true },
      { name: "input_usd_per_mtok", label: "Input $ / 1M tokens", type: "number", placeholder: "1.50" },
      { name: "output_usd_per_mtok", label: "Output $ / 1M tokens", type: "number", placeholder: "9.00" },
      { name: "is_active", label: "Active", type: "boolean" },
      { name: "notes", label: "Notes", type: "text" },
    ],
  },
  providers: {
    table: "llm_providers",
    title: "Providers",
    singular: "provider",
    description: "Companies whose models the pipeline can call.",
    orderBy: "name",
    ascending: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Google" },
      { name: "base_url", label: "API base URL", type: "text", placeholder: "https://…" },
      { name: "notes", label: "Notes", type: "text" },
    ],
  },
  domains: {
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    singular: "domain",
    description: "Anyone with an email at these domains can sign in to Lions vs. AI.",
    orderBy: "domain",
    ascending: true,
    fields: [{ name: "domain", label: "Domain", type: "text", required: true, placeholder: "columbia.edu", lowercase: true }],
  },
  emails: {
    table: "whitelisted_emails",
    title: "Allowed emails",
    singular: "email",
    description: "Individual addresses allowed to sign in even if their domain isn't on the list.",
    orderBy: "email",
    ascending: true,
    fields: [
      { name: "email", label: "Email", type: "text", required: true, placeholder: "someone@gmail.com", lowercase: true },
      { name: "note", label: "Note", type: "text" },
    ],
  },
} satisfies Record<string, Resource>;

export type ResourceKey = keyof typeof RESOURCES;

export function getResource(key: string): Resource | null {
  return (RESOURCES as Record<string, Resource>)[key] ?? null;
}
