"use client";
import { useEffect, useState } from "react";
import {
  Camera,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Input, Textarea } from "./ui/input";
import { Button } from "./ui/button";
import { species } from "@/lib/species";
import { MAX_PHOTO_BYTES, type SightingDraft } from "@/lib/format";
import { explainError } from "@/lib/errors";
import { blankDraft, draftKey, restoreDraft } from "@/lib/draft";
export function SightingForm({
  open,
  onOpenChange,
  name,
  owner,
  canUpload,
  busy,
  stage,
  onSave,
  saveError,
  signedIn,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  owner: string;
  canUpload: boolean;
  busy: boolean;
  stage: string;
  saveError: string;
  signedIn: boolean;
  onConnect: () => void;
  onSave: (
    draft: SightingDraft,
    photo?: { bytes: Uint8Array; caption: string; credit: string },
    recordId?: string,
  ) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(blankDraft);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const photoMissing = Boolean(draft.photoName && !photo);
  useEffect(() => {
    try {
      setDraft(restoreDraft(localStorage.getItem(draftKey)));
    } catch {
      setDraftStorageAvailable(false);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftStorageAvailable(true);
      } catch {
        setDraftStorageAvailable(false);
      }
  }, [draft, loaded]);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const set = (key: keyof typeof draft, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));
  async function locate() {
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDraft((d) => ({
          ...d,
          latitude: p.coords.latitude.toFixed(6),
          longitude: p.coords.longitude.toFixed(6),
          uncertainty: String(Math.max(1, Math.ceil(p.coords.accuracy))),
          source: "device",
        }));
        setLocating(false);
      },
      () => {
        setError(
          "Location access was unavailable. You can enter a place and coordinates yourself.",
        );
        setLocating(false);
      },
      { timeout: 15000, enableHighAccuracy: false },
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    try {
      if (photoMissing)
        throw new Error(
          "Choose your draft's photograph again, or choose Continue without photo below.",
        );
      if (draft.publishingOwner && draft.publishingOwner !== owner)
        throw new Error(
          "This draft was sent from another account. Sign in to that account to check its earlier save. To start a different sighting, clear this draft first.",
        );
      if (photo && photo.size > MAX_PHOTO_BYTES)
        throw new Error("Choose a photo smaller than 5 MB.");
      const publishingDraft = { ...draft, publishingOwner: owner };
      setDraft(publishingDraft);
      // Persist before the network write so a reload can reconcile the same ID.
      try {
        localStorage.setItem(draftKey, JSON.stringify(publishingDraft));
      } catch {
        setDraftStorageAvailable(false);
      }
      const observationDate = new Date(
        `${draft.date}T${draft.time || "12:00"}:00`,
      );
      const minutes = -observationDate.getTimezoneOffset();
      const offset = `${minutes < 0 ? "-" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
      const ok = await onSave(
        {
          species: {
            commonName: draft.commonName.trim(),
            scientificName: draft.scientificName.trim(),
          },
          observed: {
            date: draft.date,
            time: draft.time || null,
            utcOffset: draft.time ? offset : null,
            timezone: draft.time
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : null,
            precision: draft.time ? "minute" : "day",
          },
          place: {
            name: draft.place.trim(),
            latitude: Number(draft.latitude),
            longitude: Number(draft.longitude),
            datum: "WGS84",
            uncertaintyMeters: Number(draft.uncertainty),
            source: draft.source,
          },
          count: Number(draft.count),
          notes: draft.notes,
          observerName: draft.observerName.trim() || name,
          demonstration: draft.demonstration,
        },
        photo
          ? {
              bytes: new Uint8Array(await photo.arrayBuffer()),
              caption: draft.caption,
              credit: draft.credit,
            }
          : undefined,
        draft.recordId,
      );
      if (ok) {
        setDraft(blankDraft());
        setPhoto(null);
        setConfirmClear(false);
        onOpenChange(false);
      }
    } catch (e) {
      setError(explainError(e));
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent locked={busy}>
        <form onSubmit={submit}>
          <div className="form-heading">
            <span className="eyebrow">OUT IN THE FIELD</span>
            <DialogTitle asChild>
              <h2>A moment worth keeping.</h2>
            </DialogTitle>
            <DialogDescription>
              Record what you saw. These notes will belong to your notebook,
              wherever you read it.
            </DialogDescription>
          </div>
          <fieldset disabled={busy} className="form-fields">
            <div className="form-row">
              <label className="grow">
                Species
                <Input
                  required
                  autoComplete="off"
                  list="species-list"
                  placeholder="e.g. Common Kingfisher"
                  maxLength={160}
                  value={draft.commonName}
                  onChange={(e) => {
                    const commonName = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      commonName,
                      scientificName:
                        species.find((s) => s[0] === commonName)?.[1] ?? "",
                    }));
                  }}
                />
                <datalist id="species-list">
                  {species.map((s) => (
                    <option key={s[0]} value={s[0]} />
                  ))}
                </datalist>
              </label>
              <label className="count-field">
                Count
                <Input
                  required
                  type="number"
                  min={1}
                  max={100000}
                  value={draft.count}
                  onChange={(e) => set("count", e.target.value)}
                />
              </label>
            </div>
            <label>
              Scientific name <span className="optional">optional</span>
              <Input
                placeholder="e.g. Alcedo atthis"
                maxLength={160}
                value={draft.scientificName}
                onChange={(e) => set("scientificName", e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                Date
                <Input
                  required
                  type="date"
                  value={draft.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </label>
              <label>
                Time <span className="optional">optional</span>
                <Input
                  type="time"
                  value={draft.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </label>
            </div>
            {draft.time && (
              <p className="field-help">
                Time is recorded in{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}, including
                its UTC offset.
              </p>
            )}
            <div className="form-section-label">
              <MapPin size={15} />
              <span>Give this memory a place</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={locate}
                disabled={locating}
              >
                {locating ? <LoaderCircle className="spin" /> : <LocateFixed />}
                Use my location
              </Button>
            </div>
            <label>
              Place
              <Input
                required
                placeholder="e.g. Pashan Lake, Pune"
                maxLength={200}
                value={draft.place}
                onChange={(e) => set("place", e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                Latitude
                <Input
                  required
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  placeholder="18.5362"
                  value={draft.latitude}
                  onChange={(e) => {
                    set("latitude", e.target.value);
                    set("source", "manual");
                  }}
                />
              </label>
              <label>
                Longitude
                <Input
                  required
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  placeholder="73.7858"
                  value={draft.longitude}
                  onChange={(e) => {
                    set("longitude", e.target.value);
                    set("source", "manual");
                  }}
                />
              </label>
              <label>
                Accuracy, metres
                <Input
                  required
                  type="number"
                  min={1}
                  max={500000}
                  value={draft.uncertainty}
                  onChange={(e) => set("uncertainty", e.target.value)}
                />
              </label>
            </div>
            <p className="field-help">
              A place name and coordinates keep the location useful to other
              apps. Use a larger accuracy radius for an approximate spot.
            </p>
            <label>
              Observer
              <Input
                required
                placeholder={name || "Your name"}
                maxLength={120}
                value={draft.observerName || name}
                onChange={(e) => set("observerName", e.target.value)}
              />
            </label>
            <label>
              Field notes <span className="optional">optional</span>
              <Textarea
                placeholder="Perched on a low branch by the water..."
                maxLength={3000}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
            <label className="photo-input">
              <Camera size={21} />
              <span>
                <strong>{photo ? photo.name : "Add a photograph"}</strong>
                <small>JPEG, PNG or WebP, up to 5 MB</small>
              </span>
              <input
                aria-label="Add a photograph"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) {
                    setPhoto(chosen);
                    set("photoName", chosen.name);
                  }
                }}
              />
            </label>
            {photoMissing && (
              <div className="draft-photo-warning" role="alert">
                <strong>
                  Your text draft is back. Its photo needs choosing again.
                </strong>
                <p>
                  Browsers do not keep the selected file after a reload. Choose{" "}
                  {draft.photoName} above so it is included in this sighting.
                </p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => set("photoName", "")}
                >
                  Continue without photo
                </button>
              </div>
            )}
            {photo && (
              <div className="photo-options">
                <img src={preview} alt="Selected sighting photograph" />
                <div>
                  <label>
                    Photo caption
                    <Input
                      maxLength={500}
                      value={draft.caption}
                      onChange={(e) => set("caption", e.target.value)}
                    />
                  </label>
                  <label>
                    Photo credit
                    <Input
                      maxLength={200}
                      value={draft.credit}
                      onChange={(e) => set("credit", e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setPhoto(null);
                      set("photoName", "");
                    }}
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.demonstration}
                onChange={(e) => set("demonstration", e.target.checked)}
              />
              This is a demonstration record, not a field observation.
            </label>
          </fieldset>
          <div className="public-notice">
            <ShieldCheck size={18} />
            <span>
              This notebook is public. Share only photos and locations you want
              others to read. Use an approximate location for sensitive birds;
              accuracy alone does not hide precise coordinates. Published
              sightings cannot be edited or removed here. Photos are uploaded
              unchanged and may contain location metadata.
            </span>
          </div>
          {(error || saveError) && (
            <p role="alert" className="error-message">
              {error || saveError}
            </p>
          )}
          {signedIn && !canUpload && (
            <p className="error-message">
              Uploads are unavailable. In Swarm ID, use the default network for
              sponsored storage, then reload.
            </p>
          )}
          <div className="form-footer">
            <span role="status">
              {busy
                ? stage
                : draftStorageAvailable
                  ? "Your text draft stays on this device until saved."
                  : "This browser cannot keep your draft after a reload. Keep this window open until it is saved."}
            </span>
            {!signedIn ? (
              <Button type="button" onClick={onConnect}>
                Sign in to save
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={busy || !canUpload || photoMissing || !loaded}
              >
                {busy ? <LoaderCircle className="spin" /> : <Plus />}
                {busy ? "Saving sighting" : "Save sighting"}
              </Button>
            )}
          </div>
          {!busy && (
            <div className="draft-actions">
              {confirmClear ? (
                <>
                  <p>
                    Clear only this device's draft? Published sightings stay in
                    your notebook.
                  </p>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setDraft(blankDraft());
                      setPhoto(null);
                      setError("");
                      setConfirmClear(false);
                    }}
                  >
                    Clear draft
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setConfirmClear(false)}
                  >
                    Keep draft
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setConfirmClear(true)}
                >
                  Start a fresh draft
                </button>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
