"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SwarmIdClient } from "@snaha/swarm-id";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bird,
  BookOpen,
  Check,
  CircleHelp,
  Copy,
  ExternalLink,
  Feather,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Landscape } from "./landscape";
import { SightingForm } from "./sighting-form";
import {
  addressFor,
  addressReference,
  GATEWAY,
  normalizeOwner,
  sha256,
  type Sighting,
  type SightingDraft,
} from "@/lib/format";
import {
  loadNotebook,
  readAddress,
  readBytes,
  type LoadedNotebook,
} from "@/lib/network";
import { publishSighting, type Connection } from "@/lib/publish";
import { explainError } from "@/lib/errors";

const READER_ORIGIN =
  process.env.NEXT_PUBLIC_READER_URL ||
  "https://fieldnote-reader-hrsh22.vercel.app";
function Photo({ record }: { record: Sighting }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!record.photo) return;
    let disposed = false;
    let objectUrl = "";
    const photo = record.photo;
    const abort = new AbortController();
    void (async () => {
      try {
        const bytes = await readBytes(
          photo.reference,
          photo.bytes,
          abort.signal,
        );
        if (
          bytes.length !== photo.bytes ||
          (await sha256(bytes)) !== photo.sha256
        )
          throw new Error("Photo integrity check failed");
        if (!disposed) {
          objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(bytes).buffer], { type: photo.mediaType }),
          );
          setUrl(objectUrl);
        }
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.photo]);
  if (!record.photo)
    return (
      <div className="record-art">
        <Bird size={44} strokeWidth={1} />
        <span>FIELD OBSERVATION</span>
      </div>
    );
  return (
    <div className="record-photo">
      {url ? (
        <img
          src={url}
          alt={record.photo.caption || record.species.commonName}
        />
      ) : (
        <span>
          {failed ? (
            "Photo unavailable - open details to retry"
          ) : (
            <LoaderCircle className="spin" size={20} />
          )}
        </span>
      )}
    </div>
  );
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function Fieldnote() {
  const client = useRef<SwarmIdClient | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const [connection, setConnection] = useState<Connection>({
    canUpload: false,
  });
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [notebook, setNotebook] = useState<LoadedNotebook | null>(null);
  const [loading, setLoading] = useState(false);
  const [notebookRef, setNotebookRef] = useState("");
  const [demoRef, setDemoRef] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [selected, setSelected] = useState<Sighting | null>(null);
  const [sort, setSort] = useState<"newest" | "species">("newest");
  const [copied, setCopied] = useState(false);
  const [openInput, setOpenInput] = useState("");
  const currentOwner = connection.appKey
    ? normalizeOwner(connection.appKey.address)
    : "";
  const isOwn = Boolean(
    currentOwner && (!notebook || notebook.address.feed.owner === currentOwner),
  );
  const records = notebook?.records ?? [];
  const readerUrl = notebookRef
    ? `${READER_ORIGIN}/#notebook=${notebookRef}`
    : "";

  const openNotebook = useCallback(async (reference: string) => {
    const turn = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const address = await readAddress(reference);
      const loaded = await loadNotebook(address);
      if (turn !== generation.current) return;
      if (!loaded)
        throw new Error(
          "This notebook address has no published sightings yet.",
        );
      setNotebook(loaded);
      setNotebookRef(reference);
    } catch (error) {
      if (turn === generation.current) setError(explainError(error));
    } finally {
      if (turn === generation.current) setLoading(false);
    }
  }, []);
  const loadOwn = useCallback(async (owner: string) => {
    const turn = ++generation.current;
    setLoading(true);
    setError("");
    setNotebook(null);
    setNotebookRef("");
    try {
      const loaded = await loadNotebook(addressFor(owner));
      if (turn !== generation.current) return;
      setNotebook(loaded);
      if (loaded) setNotebookRef(loaded.index.addressReference);
    } catch (error) {
      if (turn === generation.current) setError(explainError(error));
    } finally {
      if (turn === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let disposed = false;
    let instance: SwarmIdClient | null = null;
    void (async () => {
      try {
        const { SwarmIdClient } = await import("@snaha/swarm-id");
        if (disposed) return;
        instance = new SwarmIdClient({
          iframeOrigin: "https://swarm-id.snaha.net",
          subsidisedGatewayUrl: `${GATEWAY}/`,
          timeout: 60000,
          initializationTimeout: 30000,
          metadata: {
            name: "Fieldnote",
            description: "Your birding notebook, readable anywhere.",
          },
          onConnectionChange: (info) => {
            if (disposed) return;
            setConnection(info);
            setConnecting(false);
          },
        });
        client.current = instance;
        await instance.initialize();
        if (disposed) return;
        const frame = instance.getAuthIframe();
        frame.style.cssText =
          "position:fixed;width:1px;height:1px;bottom:0;right:0;border:0;opacity:0;pointer-events:none;";
        frame.setAttribute("aria-hidden", "true");
        frame.tabIndex = -1;
        setConnection(instance.connectionInfo);
        setReady(true);
      } catch (error) {
        if (!disposed)
          setError(`Sign-in could not start. ${explainError(error)}`);
      } finally {
        if (!disposed) setInitializing(false);
      }
    })();
    return () => {
      disposed = true;
      instance?.destroy();
      if (client.current === instance) client.current = null;
    };
  }, []);
  useEffect(() => {
    void fetch("/demo.json")
      .then((r) => r.json())
      .then((value) => {
        if (
          typeof value.addressReference === "string" &&
          /^[a-f0-9]{64}$/.test(value.addressReference)
        )
          setDemoRef(value.addressReference);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (currentOwner) {
      void loadOwn(currentOwner);
    } else if (demoRef) {
      void openNotebook(demoRef);
    } else {
      generation.current++;
      setLoading(false);
      setNotebook(null);
      setNotebookRef("");
    }
  }, [currentOwner, demoRef, loadOwn, openNotebook]);
  async function connect() {
    if (!client.current || !ready) return;
    setConnecting(true);
    setError("");
    try {
      await client.current.connect();
    } catch (e) {
      setError(explainError(e));
    } finally {
      setConnecting(false);
    }
  }
  async function disconnect() {
    if (busyRef.current) return;
    try {
      await client.current?.disconnect();
      setConnection({ canUpload: false });
      setNotice("Signed out. Your published notebook remains readable.");
    } catch (e) {
      setError(explainError(e));
    }
  }
  async function save(
    draft: SightingDraft,
    photo?: { bytes: Uint8Array; caption: string; credit: string },
  ) {
    if (!client.current || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const perform = () =>
        publishSighting({
          client: client.current!,
          draft,
          photo,
          appOrigin: window.location.origin,
          title: `${draft.observerName}'s field notes`,
          progress: setStage,
        });
      const result = navigator.locks
        ? await navigator.locks.request(
            `fieldnote.publish.${currentOwner}`,
            { ifAvailable: true },
            (lock) => {
              if (!lock)
                throw new Error(
                  "Another Fieldnote window is saving. Wait for it to finish, then retry.",
                );
              return perform();
            },
          )
        : await perform();
      // Rebuild the displayed catalogue from the network, including records
      // another session may have added since this page was opened.
      setStage("Refreshing the saved notebook");
      try {
        const refreshed = await loadNotebook(result.address);
        if (!refreshed)
          throw new Error("The saved notebook could not be reloaded yet.");
        if (
          client.current?.connectionInfo.appKey &&
          normalizeOwner(client.current.connectionInfo.appKey.address) ===
            result.address.feed.owner
        ) {
          setNotebookRef(result.addressReference);
          setNotebook(refreshed);
        }
      } catch (refreshError) {
        setError(
          `Your sighting was saved, but the notebook display could not refresh. ${explainError(refreshError)}`,
        );
      }
      setNotice(
        "Sighting saved to Swarm and checked. It is ready in the independent reader.",
      );
      return true;
    } catch (e) {
      setError(explainError(e));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStage("");
    }
  }
  const filtered = records
    .filter(({ sighting: s }) =>
      `${s.species.commonName} ${s.species.scientificName} ${s.place.name} ${s.observer.name} ${s.observed.date} ${s.notes}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "species"
        ? a.sighting.species.commonName.localeCompare(
            b.sighting.species.commonName,
          )
        : `${b.sighting.observed.date} ${b.sighting.observed.time ?? ""}`.localeCompare(
            `${a.sighting.observed.date} ${a.sighting.observed.time ?? ""}`,
          ),
    );
  async function copy() {
    if (!readerUrl) return;
    try {
      await navigator.clipboard.writeText(readerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpenInput(readerUrl);
      setLinkOpen(true);
    }
  }
  function newSighting() {
    setFormOpen(true);
    if (!connection.identity)
      setNotice(
        "You can start a draft now. Sign in before saving it to your notebook.",
      );
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="wordmark" aria-label="Fieldnote home">
          <Feather size={23} strokeWidth={1.7} />
          <span>
            fieldnote<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#notebook" className="nav-active">
            My notebook
          </a>
          <button onClick={() => setAboutOpen(true)}>
            Made to travel <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="account-controls">
          {connection.identity ? (
            <>
              <span className="account-name">
                <span className="avatar">
                  {connection.identity.name.slice(0, 1).toUpperCase()}
                </span>
                {connection.identity.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={disconnect}
                disabled={busy}
                aria-label="Sign out"
              >
                <LogOut />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={connect}
              disabled={!ready || connecting}
            >
              {initializing || connecting ? (
                <LoaderCircle className="spin" />
              ) : (
                <Leaf size={14} />
              )}{" "}
              {connecting
                ? "Complete sign-in"
                : initializing
                  ? "Connecting"
                  : "Sign in with Swarm ID"}
            </Button>
          )}
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-line" />A NOTEBOOK FOR THE OUTSIDE WORLD
            </div>
            <h1>
              A life outdoors.
              <br />
              <em>Kept yours.</em>
            </h1>
            <p>
              The flash of a wing. A familiar call. Keep the things you notice
              in a notebook that goes wherever you do.
            </p>
            <div className="hero-actions">
              <Button onClick={newSighting}>
                <Plus />
                Record a sighting
              </Button>
              <button className="text-link" onClick={() => setAboutOpen(true)}>
                Why your notes stay yours <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className="hero-art">
            <Landscape />
            <div className="illustration-caption">
              <span>01 / A MOMENT OF STILLNESS</span>
              <span>Alcedo atthis</span>
            </div>
          </div>
        </section>
        <section className="notebook-section" id="notebook">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE FIELD JOURNAL</div>
              <h2>
                {notebook?.index.title ||
                  (connection.identity
                    ? `${connection.identity.name}'s field notes`
                    : "Every observation belongs somewhere.")}
              </h2>
              <p>
                {notebook?.records.some((r) => r.sighting.demonstration)
                  ? "Includes clearly marked demonstration records, read from Swarm."
                  : connection.identity
                    ? "Small discoveries, a growing record of the world around you."
                    : "Sign in to start yours, or open a notebook someone shared."}
              </p>
            </div>
            <div className="notebook-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpenInput("");
                  setLinkOpen(true);
                }}
              >
                <BookOpen />
                Open notebook
              </Button>
              {readerUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={readerUrl} target="_blank" rel="noreferrer">
                    Independent reader <ArrowUpRight />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="stats-row">
            <div>
              <Bird />
              <span>
                <strong>{records.length.toString().padStart(2, "0")}</strong>{" "}
                sightings
              </span>
            </div>
            <div>
              <Feather />
              <span>
                <strong>
                  {new Set(
                    records.map(
                      (r) =>
                        r.sighting.species.scientificName ||
                        r.sighting.species.commonName,
                    ),
                  ).size
                    .toString()
                    .padStart(2, "0")}
                </strong>{" "}
                species
              </span>
            </div>
            <div>
              <MapPin />
              <span>
                <strong>
                  {new Set(
                    records.map((r) => r.sighting.place.name.toLowerCase()),
                  ).size
                    .toString()
                    .padStart(2, "0")}
                </strong>{" "}
                places
              </span>
            </div>
            <div className="network-indicator">
              <span className={loading ? "status-dot pulsing" : "status-dot"} />
              <span>
                {loading
                  ? "Reading from Swarm"
                  : notebook
                    ? "Read from Swarm"
                    : "Stored on Swarm when you save"}
              </span>
              {notebook && (
                <button
                  aria-label="Refresh notebook from Swarm"
                  onClick={() =>
                    currentOwner && isOwn
                      ? loadOwn(currentOwner)
                      : notebookRef && openNotebook(notebookRef)
                  }
                  disabled={loading || busy}
                >
                  <RefreshCw size={14} className={loading ? "spin" : ""} />
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="feedback error" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="feedback success" role="status">
              <Check size={17} />
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {connection.identity && !connection.canUpload && (
            <div className="feedback error" role="status">
              <CircleHelp size={18} />
              <span>
                {connection.uploadUnavailableReason === "stamper-failed"
                  ? "Your drive could not prepare uploads. Reconnect or check the drive in Swarm ID."
                  : "You are signed in, but uploads are unavailable. Choose the default network in Swarm ID and reload to use sponsored storage."}
              </span>
            </div>
          )}
          <div className="journal-toolbar">
            <div className="search-input">
              <Search size={17} />
              <Input
                aria-label="Search sightings"
                placeholder="Search species, places, dates or notes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="sort-control">
              <ArrowDownUp size={15} />
              <select
                aria-label="Sort sightings"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="newest">Date spotted</option>
                <option value="species">Species name</option>
              </select>
            </label>
          </div>
          {loading ? (
            <div className="empty-state">
              <LoaderCircle className="spin" size={28} />
              <h3>Opening the field journal...</h3>
              <p>Retrieving the notebook and checking its records on Swarm.</p>
            </div>
          ) : filtered.length ? (
            <div className="record-grid">
              {filtered.map(({ sighting: s }) => (
                <button
                  key={s.id}
                  className="record-card"
                  onClick={() => setSelected(s)}
                >
                  <div className="record-image">
                    <Photo record={s} />
                    <span className="count-chip">{s.count} spotted</span>
                    {s.demonstration && <span className="demo-chip">DEMO</span>}
                  </div>
                  <div className="record-copy">
                    <span className="record-date">
                      {dateLabel(s.observed.date)}
                    </span>
                    <h3>{s.species.commonName}</h3>
                    <p className="scientific-name">
                      {s.species.scientificName ||
                        "Scientific name not recorded"}
                    </p>
                    <div className="record-place">
                      <MapPin size={14} />
                      <span>{s.place.name}</span>
                    </div>
                    <div className="record-bottom">
                      <span>By {s.observer.name}</span>
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                </button>
              ))}
              <button className="add-card" onClick={newSighting}>
                <span className="add-circle">
                  <Plus size={25} />
                </span>
                <h3>What did you notice?</h3>
                <p>
                  There is always room
                  <br />
                  for one more discovery.
                </p>
                <span>
                  Record a sighting <ArrowRight size={14} />
                </span>
              </button>
            </div>
          ) : error && !notebook ? (
            <div className="empty-state">
              <CircleHelp size={30} />
              <h3>The notebook needs another look.</h3>
              <p>
                The request failed. This does not mean your saved sightings are
                gone.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  currentOwner
                    ? loadOwn(currentOwner)
                    : demoRef
                      ? openNotebook(demoRef)
                      : setLinkOpen(true)
                }
              >
                Retry notebook <RefreshCw />
              </Button>
            </div>
          ) : (
            <div className="empty-state">
              <Feather size={36} strokeWidth={1.2} />
              <h3>
                {query
                  ? "No sightings match that search."
                  : "Your next discovery starts here."}
              </h3>
              <p>
                {query
                  ? "Try a species, place or observation date."
                  : "A bird on your morning walk. A visitor at the window. Give that moment a home."}
              </p>
              <Button
                variant="outline"
                onClick={query ? () => setQuery("") : newSighting}
              >
                {query ? "Clear search" : "Record your first sighting"}
                <ArrowRight />
              </Button>
            </div>
          )}
        </section>
        <section className="portability-strip">
          <div className="portable-icon">
            <BookOpen size={27} strokeWidth={1.3} />
            <ArrowUpRight size={18} />
          </div>
          <div>
            <h3>Your notebook. Beyond this app.</h3>
            <p>
              Open the same records in an independent reader. No exports, no
              starting over.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={
              readerUrl
                ? () => window.open(readerUrl, "_blank", "noopener,noreferrer")
                : () => setAboutOpen(true)
            }
          >
            {readerUrl ? "Take a look" : "How it works"}
            <ArrowUpRight />
          </Button>
        </section>
      </main>
      <footer>
        <a href="/" className="wordmark">
          <Feather size={18} />
          <span>fieldnote.</span>
        </a>
        <span>For the things worth noticing.</span>
        <div>
          <button onClick={() => setAboutOpen(true)}>The open format</button>
          <a
            href="https://github.com/hrsh22/fieldnote-sightings"
            target="_blank"
            rel="noreferrer"
          >
            Source <ArrowUpRight size={12} />
          </a>
          <span>BUILT ON SWARM</span>
        </div>
      </footer>
      <SightingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        name={connection.identity?.name ?? ""}
        canUpload={connection.canUpload}
        busy={busy}
        stage={stage}
        onSave={save}
        saveError={error}
        signedIn={Boolean(connection.identity)}
        onConnect={connect}
      />
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="about-dialog">
          <span className="eyebrow">MADE TO TRAVEL</span>
          <DialogTitle asChild>
            <h2>
              A notebook without
              <br />a locked door.
            </h2>
          </DialogTitle>
          <DialogDescription>
            Your sightings are saved directly on Swarm, in a published format
            that other applications can read.
          </DialogDescription>
          <ol className="travel-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Record it once.</h3>
                <p>
                  Your Swarm ID signs your notebook updates. Sponsored storage
                  lets you get started without buying tokens.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Let the meaning travel.</h3>
                <p>
                  Species names, dates, coordinates, observer and photo
                  information live inside the record, with its format and
                  version.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Read it somewhere else.</h3>
                <p>
                  A separate reader follows your notebook link and retrieves
                  everything from Swarm. It does not use Fieldnote's server or
                  code.
                </p>
              </div>
            </li>
          </ol>
          <p className="field-help">
            Published notebooks are public. Sponsored storage is subject to the
            gateway's retention and availability; it is not a promise of
            permanent storage.
          </p>
          <div className="about-links">
            <a
              href="https://github.com/hrsh22/fieldnote-sightings/tree/main/format"
              target="_blank"
              rel="noreferrer"
            >
              Read the format specification <ExternalLink size={14} />
            </a>
            {readerUrl && (
              <a href={readerUrl} target="_blank" rel="noreferrer">
                Open this notebook in the reader <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="small-dialog">
          <DialogTitle asChild>
            <h2>Open a notebook.</h2>
          </DialogTitle>
          <DialogDescription>
            Paste a notebook link someone shared. Fieldnote will read its public
            records directly from Swarm.
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const reference = addressReference(openInput);
                setLinkOpen(false);
                await openNotebook(reference);
              } catch (e) {
                setError(explainError(e));
                setLinkOpen(false);
              }
            }}
          >
            <Input
              aria-label="Notebook link"
              required
              placeholder="Paste a notebook link"
              value={openInput}
              onChange={(e) => setOpenInput(e.target.value)}
            />
            <Button type="submit">
              Open notebook <ArrowRight />
            </Button>
          </form>
          {readerUrl && (
            <Button variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy current notebook link"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="detail-dialog">
          {selected && (
            <>
              <div className="detail-image">
                <Photo record={selected} />
              </div>
              <div className="detail-copy">
                <span className="eyebrow">
                  {selected.demonstration
                    ? "DEMONSTRATION RECORD"
                    : "FIELD OBSERVATION"}
                </span>
                <DialogTitle asChild>
                  <h2>{selected.species.commonName}</h2>
                </DialogTitle>
                <DialogDescription className="scientific-name">
                  {selected.species.scientificName ||
                    "Scientific name not recorded"}
                </DialogDescription>
                <dl className="detail-grid">
                  <div>
                    <dt>Observed</dt>
                    <dd>
                      {dateLabel(selected.observed.date)}
                      {selected.observed.time &&
                        ` at ${selected.observed.time} (UTC${selected.observed.utcOffset})`}
                    </dd>
                  </div>
                  <div>
                    <dt>Observer</dt>
                    <dd>{selected.observer.name}</dd>
                  </div>
                  <div>
                    <dt>Place</dt>
                    <dd>{selected.place.name}</dd>
                  </div>
                  <div>
                    <dt>Count</dt>
                    <dd>{selected.count} spotted</dd>
                  </div>
                </dl>
                <a
                  className="map-link"
                  href={`https://www.openstreetmap.org/?mlat=${selected.place.latitude}&mlon=${selected.place.longitude}#map=14/${selected.place.latitude}/${selected.place.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={15} />
                  {selected.place.latitude.toFixed(5)},{" "}
                  {selected.place.longitude.toFixed(5)}
                  <ArrowUpRight size={14} />
                </a>
                <p className="field-help">
                  WGS84, accuracy radius {selected.place.uncertaintyMeters} m.
                  Location entered{" "}
                  {selected.place.source === "device"
                    ? "using the device"
                    : "manually"}
                  .
                </p>
                {selected.notes && (
                  <p className="detail-notes">{selected.notes}</p>
                )}
                {selected.photo?.credit && (
                  <p className="field-help">Photo: {selected.photo.credit}</p>
                )}
                <div className="detail-proof">
                  <ShieldCheck size={16} />
                  <span>Format v1 - record checksum verified</span>
                  {readerUrl && (
                    <a href={readerUrl} target="_blank" rel="noreferrer">
                      Read elsewhere <ArrowUpRight size={13} />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
