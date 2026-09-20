import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const rules = [
  [/\bgh[pousr]_[A-Za-z0-9]{25,}\b/g, "GitHub credential"],
  [/-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/g, "private key"],
  [
    /(?:privateKey|private_key|giftCode|gift_code|password|mnemonic)\s*[:=]\s*["'][^"'\n]{12,}["']/gi,
    "embedded credential",
  ],
  [
    /https?:\/\/[^\s"'<>]+[?&](?:token|api[_-]?key|secret|password|auth|signature)=[^\s"'<>]+/gi,
    "authenticated URL",
  ],
];
const failures = [];
// Match the local test account's exact secrets too, without logging their values.
// This directory is ignored and is absent in clean checkouts and CI.
const localSecrets = [];
for (const name of [
  "swarm-id-test-account.txt",
  "swarm-id-recovery-phrase.txt",
]) {
  const path = `.runtime/private/${name}`;
  if (!existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  if (name.includes("recovery"))
    localSecrets.push(
      ...content
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.split(/\s+/).length >= 12),
    );
  else {
    const match = content.match(/^Password:\s*(.+)$/m);
    if (match) localSecrets.push(match[1].trim());
  }
}
for (const file of files) {
  if (
    file === "scripts/check-secrets.mjs" ||
    /\.(?:png|jpg|jpeg|webp|woff2?|ico)$/.test(file)
  )
    continue;
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of rules) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) failures.push(`${file}: possible ${label}`);
  }
  if (localSecrets.some((secret) => text.includes(secret)))
    failures.push(`${file}: contains a local test-account secret`);
  if (/(?:^|\/)\.env(?!\.example$)/.test(file))
    failures.push(`${file}: environment file must stay untracked`);
}
if (failures.length) throw new Error(failures.join("\n"));
console.log(
  `Secret scan passed for ${files.length} project files. Public Swarm references are permitted.`,
);
