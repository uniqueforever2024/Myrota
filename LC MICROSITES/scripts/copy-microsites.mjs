import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const distRoot = join(repoRoot, "dist");

const directoryCopies = [
  {
    source: join(repoRoot, "APF", "APF_NEW", "build"),
    target: join(distRoot, "APF", "APF_NEW", "build"),
  },
  {
    source: join(repoRoot, "APF", "CERTIFICATE_NEW", "public"),
    target: join(distRoot, "APF", "CERTIFICATE_NEW", "public"),
  },
];

for (const { source, target } of directoryCopies) {
  if (!existsSync(source)) {
    throw new Error(`Microsite source folder is missing: ${source}`);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

const sftpTarget = join(distRoot, "APF", "SFTP_NEW");
rmSync(sftpTarget, { recursive: true, force: true });
mkdirSync(join(sftpTarget, "vendor"), { recursive: true });

const sftpFiles = [
  "index.html",
  "styles.css",
  "app.js",
  join("vendor", "xlsx.full.min.js"),
];

for (const relativePath of sftpFiles) {
  const source = join(repoRoot, "APF", "SFTP_NEW", relativePath);
  const target = join(sftpTarget, relativePath);

  if (!existsSync(source)) {
    throw new Error(`SFTP publish file is missing: ${source}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

const documentationTarget = join(distRoot, "APF", "DOCUMENTATION_NEW");
rmSync(documentationTarget, { recursive: true, force: true });

const documentationFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "favicon.svg",
];

for (const relativePath of documentationFiles) {
  const source = join(repoRoot, "APF", "DOCUMENTATION_NEW", relativePath);
  const target = join(documentationTarget, relativePath);

  if (!existsSync(source)) {
    throw new Error(`Documentation publish file is missing: ${source}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

console.log(`Copied ${directoryCopies.length + 2} microsites into ${distRoot}`);
