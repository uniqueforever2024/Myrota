import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const distRoot = join(repoRoot, "dist");

const microsites = [
  {
    source: join(repoRoot, "APF", "APF_NEW", "build"),
    target: join(distRoot, "APF", "APF_NEW", "build"),
  },
  {
    source: join(repoRoot, "APF", "SFTP_NEW"),
    target: join(distRoot, "APF", "SFTP_NEW"),
  },
  {
    source: join(repoRoot, "APF", "DOCUMENTATION_NEW"),
    target: join(distRoot, "APF", "DOCUMENTATION_NEW"),
  },
  {
    source: join(repoRoot, "APF", "CERTIFICATE_NEW", "public"),
    target: join(distRoot, "APF", "CERTIFICATE_NEW", "public"),
  },
];

for (const { source, target } of microsites) {
  if (!existsSync(source)) {
    throw new Error(`Microsite source folder is missing: ${source}`);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

console.log(`Copied ${microsites.length} microsites into ${distRoot}`);
