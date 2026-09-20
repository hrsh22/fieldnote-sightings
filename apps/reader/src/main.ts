import { parseLink, type RecordData } from "./model";
import {
  checkedBytes,
  DEFAULT_GATEWAY,
  gatewayOrigin,
  readNotebook,
  readableError,
  type ReadResult,
} from "./network";

const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = get<HTMLInputElement>("notebook"),
  gateway = get<HTMLInputElement>("gateway"),
  status = get("status"),
  button = get<HTMLButtonElement>("open-button");
const search = get<HTMLInputElement>("search"),
  sort = get<HTMLSelectElement>("sort"),
  dialog = get<HTMLDialogElement>("detail");
let result: ReadResult | null = null,
  currentReference = "",
  currentGateway = DEFAULT_GATEWAY,
  loadId = 0,
  photoUrl = "",
  photoAbort: AbortController | null = null;
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function showStatus(message: string, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`;
  status.setAttribute("role", kind === "error" ? "alert" : "status");
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
async function open(reference: string) {
  const turn = ++loadId;
  button.disabled = true;
  get<HTMLButtonElement>("refresh").disabled = true;
  showStatus("Connecting to Swarm...", "loading");
  try {
    const base = gatewayOrigin(gateway.value);
    const loaded = await readNotebook(reference, base, (message) => {
      if (turn === loadId) showStatus(message, "loading");
    });
    if (turn !== loadId) return;
    result = loaded;
    currentReference = reference;
    currentGateway = base;
    input.value = reference;
    history.replaceState(null, "", `#notebook=${reference}`);
    get("notebook-title").textContent = result.index.title;
    get("notebook-description").textContent = result.records.some(
      (r) => r.record.demonstration,
    )
      ? "Includes demonstration observations, explicitly marked below."
      : "Public observations, retrieved and interpreted independently.";
    get("count").textContent = String(result.records.length).padStart(2, "0");
    get("species-count").textContent = String(
      new Set(
        result.records.map(
          (r) => r.record.species.scientificName || r.record.species.commonName,
        ),
      ).size,
    ).padStart(2, "0");
    get("places-count").textContent = String(
      new Set(result.records.map((r) => r.record.place.name.toLowerCase()))
        .size,
    ).padStart(2, "0");
    get("updated").textContent =
      `Latest notebook update\n${new Date(result.index.updatedAt).toLocaleString()}`;
    get("notebook-view").hidden = false;
    get("welcome").hidden = true;
    const failures = get("failures");
    failures.replaceChildren();
    failures.hidden = result.failures.length === 0;
    if (result.failures.length) {
      failures.append(
        element(
          "h3",
          `${result.failures.length} sighting(s) could not be verified`,
        ),
        element(
          "p",
          "This is an incomplete view. Available sightings are shown, and missing ones are listed below.",
        ),
      );
      for (const failure of result.failures) {
        failures.append(element("p", `${failure.entry.id}: ${failure.reason}`));
      }
    }
    const proof = get("proof-data");
    proof.replaceChildren();
    for (const [label, value] of [
      ["Address reference", reference],
      ["Signed feed owner", result.descriptor.feed.owner],
      ["Feed topic", result.descriptor.feed.topic],
      ["Feed index", result.feedIndex],
      ["Current index reference", result.indexReference],
      ["Gateway", base],
      ["Format", `${result.index.format}, version ${result.index.version}`],
    ]) {
      proof.append(element("dt", label), element("dd", value));
    }
    render();
    showStatus(
      result.failures.length
        ? `Incomplete notebook: ${result.records.length} of ${result.index.records.length} sightings verified.`
        : `${result.records.length} sighting${result.records.length === 1 ? "" : "s"} read directly from Swarm. All record checksums verified.`,
      result.failures.length ? "error" : "success",
    );
  } catch (error) {
    if (turn === loadId) {
      showStatus(readableError(error), "error");
      get("notebook-view").hidden = true;
      get("welcome").hidden = false;
      result = null;
    }
  } finally {
    if (turn === loadId) {
      button.disabled = false;
      get<HTMLButtonElement>("refresh").disabled = false;
    }
  }
}
function render() {
  const tbody = get("records");
  tbody.replaceChildren();
  if (!result) return;
  const needle = search.value.trim().toLowerCase();
  const records = result.records
    .filter(({ record: r }) =>
      `${r.species.commonName} ${r.species.scientificName} ${r.place.name} ${r.observer.name} ${r.observed.date} ${r.notes}`
        .toLowerCase()
        .includes(needle),
    )
    .sort((a, b) =>
      sort.value === "species"
        ? a.record.species.commonName.localeCompare(b.record.species.commonName)
        : `${b.record.observed.date}${b.record.observed.time ?? ""}`.localeCompare(
            `${a.record.observed.date}${a.record.observed.time ?? ""}`,
          ),
    );
  get("no-results").hidden = records.length > 0;
  for (const { record: r, entry } of records) {
    const row = element("tr");
    const species = element("td");
    const openButton = element(
      "button",
      r.species.commonName,
      "species-button",
    );
    openButton.onclick = () => showDetails(r, entry.reference);
    species.append(
      openButton,
      element(
        "span",
        r.species.scientificName || "Scientific name not recorded",
        "scientific",
      ),
    );
    if (r.demonstration) species.append(element("span", "DEMO", "demo-label"));
    const place = element("td");
    place.append(
      element("span", r.place.name),
      element(
        "small",
        `${r.place.latitude.toFixed(4)}, ${r.place.longitude.toFixed(4)}`,
      ),
    );
    const arrow = element("td");
    const detailButton = element("button", "↗", "row-arrow");
    detailButton.setAttribute(
      "aria-label",
      `Open ${r.species.commonName} sighting`,
    );
    detailButton.onclick = () => showDetails(r, entry.reference);
    arrow.append(detailButton);
    row.append(
      species,
      element("td", dateLabel(r.observed.date)),
      place,
      element("td", r.observer.name),
      element("td", String(r.count)),
      arrow,
    );
    tbody.append(row);
  }
}
function cleanupPhoto() {
  photoAbort?.abort();
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = "";
  photoAbort = null;
}
function showDetails(record: RecordData, reference: string) {
  cleanupPhoto();
  const body = get("detail-body");
  body.replaceChildren();
  body.append(
    element(
      "p",
      record.demonstration
        ? "DEMONSTRATION OBSERVATION"
        : "PUBLIC FIELD OBSERVATION",
      "kicker",
    ),
    element("h2", record.species.commonName),
    element(
      "p",
      record.species.scientificName || "Scientific name not recorded",
      "scientific detail-scientific",
    ),
  );
  const grid = element("dl", undefined, "detail-grid");
  for (const [label, value] of [
    [
      "Observed",
      `${dateLabel(record.observed.date)}${record.observed.time ? ` at ${record.observed.time} (UTC${record.observed.utcOffset})` : " - date only"}`,
    ],
    ["Observer", record.observer.name],
    ["Place", record.place.name],
    ["Number seen", String(record.count)],
    [
      "Coordinates",
      `${record.place.latitude}, ${record.place.longitude} (WGS84)`,
    ],
    [
      "Location accuracy",
      `${record.place.uncertaintyMeters} metre radius, ${record.place.source}`,
    ],
  ]) {
    const cell = element("div");
    cell.append(element("dt", label), element("dd", value));
    grid.append(cell);
  }
  body.append(grid);
  const map = element("a", "View location on OpenStreetMap ↗", "map-link");
  map.href = `https://www.openstreetmap.org/?mlat=${record.place.latitude}&mlon=${record.place.longitude}#map=14/${record.place.latitude}/${record.place.longitude}`;
  map.target = "_blank";
  map.rel = "noreferrer";
  body.append(map);
  if (record.notes) body.append(element("blockquote", record.notes));
  if (record.photo) {
    const photo = record.photo;
    const figure = element("figure");
    const loading = element(
      "p",
      "Retrieving and verifying the photograph...",
      "photo-status",
    );
    figure.append(loading);
    body.append(figure);
    photoAbort = new AbortController();
    const signal = photoAbort.signal;
    void checkedBytes(currentGateway, photo, signal)
      .then((bytes) => {
        if (signal.aborted) return;
        const img = element("img");
        photoUrl = URL.createObjectURL(
          new Blob([new Uint8Array(bytes).buffer], { type: photo.mediaType }),
        );
        img.src = photoUrl;
        img.alt = photo.caption || record.species.commonName;
        figure.replaceChildren(img);
        const text = [
          photo.caption,
          photo.credit ? `Photo: ${photo.credit}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        if (text) figure.append(element("figcaption", text));
      })
      .catch((error) => {
        if (!signal.aborted) {
          loading.textContent = `Photo unavailable: ${readableError(error)}`;
          loading.className = "photo-status error";
        }
      });
  }
  const evidence = element("details", undefined, "proof");
  evidence.append(element("summary", "Record evidence"));
  const raw = element("a", "View stored JSON ↗");
  raw.href = `${currentGateway}/bytes/${reference}`;
  raw.target = "_blank";
  raw.rel = "noreferrer";
  evidence.append(
    element("p", `${record.format} / version ${record.version}`),
    element("code", reference),
    element("p", `Publishing app key: ${record.publisher.owner}`),
    raw,
  );
  body.append(evidence);
  dialog.showModal();
}
get<HTMLFormElement>("open-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    void open(parseLink(input.value));
  } catch (error) {
    showStatus(readableError(error), "error");
  }
});
get("refresh").onclick = () => {
  if (currentReference) void open(currentReference);
};
search.oninput = render;
sort.onchange = render;
get("close-detail").onclick = () => dialog.close();
dialog.addEventListener("close", cleanupPhoto);
get("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      `${location.origin}${location.pathname}#notebook=${currentReference}`,
    );
    showStatus(
      "Notebook link copied. It points to the live notebook, not an exported snapshot.",
      "success",
    );
  } catch {
    showStatus("Copy the notebook link from this page's address bar.");
  }
};
function openHash() {
  if (location.hash) {
    try {
      void open(parseLink(location.href));
    } catch (error) {
      showStatus(readableError(error), "error");
    }
  }
}
window.addEventListener("hashchange", openHash);
openHash();
void fetch("./demo.json")
  .then((r) => r.json())
  .then((data) => {
    if (
      typeof data.addressReference === "string" &&
      /^[a-f0-9]{64}$/.test(data.addressReference)
    ) {
      get("demo").hidden = false;
      get("demo").onclick = () => void open(data.addressReference);
    }
  })
  .catch(() => {});
