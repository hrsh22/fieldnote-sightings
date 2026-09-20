export const draftKey = "fieldnote.unsaved-draft.v1";

export function blankDraft() {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    recordId: crypto.randomUUID(),
    publishingOwner: "",
    photoName: "",
    commonName: "",
    scientificName: "",
    date: today,
    time: "",
    place: "",
    latitude: "",
    longitude: "",
    uncertainty: "100",
    count: "1",
    notes: "",
    observerName: "",
    caption: "",
    credit: "",
    demonstration: false,
    source: "manual" as "manual" | "device",
  };
}

// Only an unsaved form and its retry identity live locally. Published records
// are always loaded from the notebook feed, never from this draft.
export function restoreDraft(raw: string | null) {
  const base = blankDraft();
  if (!raw) return base;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return base;
    const data = value as Record<string, unknown>;
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      if (typeof data[key] === typeof base[key])
        Object.assign(base, { [key]: data[key] });
    }
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        base.recordId,
      )
    )
      base.recordId = crypto.randomUUID();
    if (!/^[a-f0-9]{40}$/.test(base.publishingOwner)) base.publishingOwner = "";
    if (base.source !== "manual" && base.source !== "device")
      base.source = "manual";
    return base;
  } catch {
    return base;
  }
}
