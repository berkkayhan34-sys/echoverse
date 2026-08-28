/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsRoot = path.join(repositoryRoot, "DOCS");
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    errors.push(`${relativePath}: unable to read (${error.message})`);
    return "";
  }
}

function parseMetadata(block, label, requiredFields = ["id", "type", "status", "evidence"]) {
  const metadata = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (match) metadata[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  for (const field of requiredFields) {
    if (!(field in metadata)) errors.push(`${label}: missing metadata field ${field}`);
  }
  return metadata;
}

function assertPathInsideDocs(relativePath, label) {
  if (!relativePath || relativePath === "null") return;
  const absolutePath = path.resolve(docsRoot, relativePath);
  if (absolutePath !== docsRoot && !absolutePath.startsWith(`${docsRoot}${path.sep}`)) {
    errors.push(`${label}: path escapes DOCS: ${relativePath}`);
    return;
  }
  if (!fs.existsSync(absolutePath)) errors.push(`${label}: missing evidence path ${relativePath}`);
}

function validateEvidenceRecord(relativePath, expectedId, label) {
  if (!relativePath || relativePath === "null") {
    errors.push(`${label}: completed child requires an evidence path`);
    return;
  }
  const absolutePath = path.resolve(docsRoot, relativePath);
  assertPathInsideDocs(relativePath, label);
  if (!fs.existsSync(absolutePath)) return;
  const evidence = fs.readFileSync(absolutePath, "utf8");
  const metadataMatch = evidence.match(/```yaml\n([\s\S]*?)\n```/);
  if (!metadataMatch) {
    errors.push(`${label}: evidence record lacks a YAML metadata block`);
    return;
  }
  const metadata = parseMetadata(metadataMatch[1], label, ["id", "status"]);
  if (metadata.id !== expectedId)
    errors.push(`${label}: evidence ID ${metadata.id} does not match ${expectedId}`);
  if (metadata.status !== "complete") errors.push(`${label}: evidence status must be complete`);
}

function validateRoadmap() {
  const roadmap = read("DOCS/roadmap.md");
  const headingMatches = [...roadmap.matchAll(/^### ([^\n]+)$/gm)];
  const children = [];
  const statuses = new Set(["incomplete", "in_progress", "deferred", "complete"]);
  const checkboxStatuses = { " ": "incomplete", "-": "in_progress", x: "complete" };
  let deferredSeen = false;

  if (headingMatches.length === 0) errors.push("DOCS/roadmap.md: no roadmap children found");

  for (let index = 0; index < headingMatches.length; index += 1) {
    const heading = headingMatches[index];
    const nextHeading = headingMatches[index + 1];
    const body = roadmap.slice(
      heading.index + heading[0].length,
      nextHeading?.index ?? roadmap.length
    );
    const metadataBlocks = [...body.matchAll(/```yaml\n([\s\S]*?)\n```/g)];
    const checkboxes = [...body.matchAll(/^\[([ x-])\]\s+/gm)];
    const label = `roadmap child ${heading[1]}`;

    if (metadataBlocks.length !== 1) {
      errors.push(`${label}: expected exactly one YAML metadata block`);
      continue;
    }
    if (checkboxes.length !== 1) {
      errors.push(`${label}: expected exactly one status checkbox`);
      continue;
    }

    const metadata = parseMetadata(metadataBlocks[0][1], label);
    const checkboxStatus = checkboxStatuses[checkboxes[0][1]];
    if (!metadata.id) errors.push(`${label}: empty id`);
    if (metadata.id && children.some((child) => child.id === metadata.id)) {
      errors.push(`${label}: duplicate id ${metadata.id}`);
    }
    if (!statuses.has(metadata.status)) errors.push(`${label}: invalid status ${metadata.status}`);
    const checkboxMatchesStatus =
      metadata.status === "deferred"
        ? checkboxStatus === "incomplete"
        : metadata.status === checkboxStatus;
    if (!checkboxMatchesStatus) {
      errors.push(`${label}: checkbox implies ${checkboxStatus}, metadata says ${metadata.status}`);
    }
    if (metadata.status === "complete") {
      validateEvidenceRecord(metadata.evidence, metadata.id, `${label} ${metadata.id}`);
    } else if (metadata.evidence && metadata.evidence !== "null") {
      assertPathInsideDocs(metadata.evidence, `${label} ${metadata.id}`);
    }
    if (metadata.status === "deferred") {
      deferredSeen = true;
    } else if (deferredSeen) {
      errors.push(`${label}: deferred children must be the final roadmap children`);
    }
    children.push({ id: metadata.id, status: metadata.status });
  }

  const activeIndex = children.findIndex(
    (child) => child.status === "incomplete" || child.status === "in_progress"
  );
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.status === "in_progress" && index !== activeIndex) {
      errors.push(`roadmap child ${child.id}: only the first incomplete child may be in_progress`);
    }
    if (activeIndex >= 0 && index < activeIndex && child.status !== "complete") {
      errors.push(`roadmap child ${child.id}: precedes the active child but is not complete`);
    }
  }
}

function markdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => path.join(directory, entry.name));
}

function validateAuditDirectory(directory, expectedStatus, requireArchiveFields) {
  const audits = [];
  for (const filePath of markdownFiles(directory)) {
    const relativePath = path.relative(repositoryRoot, filePath);
    const metadataMatch = read(relativePath).match(/```yaml\n([\s\S]*?)\n```/);
    if (!metadataMatch) {
      errors.push(`${relativePath}: expected one YAML metadata block`);
      continue;
    }
    const metadata = parseMetadata(metadataMatch[1], relativePath, ["id", "status", "evidence"]);
    if (metadata.status !== expectedStatus) {
      errors.push(`${relativePath}: expected status ${expectedStatus}, found ${metadata.status}`);
    }
    if (requireArchiveFields && !metadata.archived_from) {
      errors.push(`${relativePath}: archived audit requires archived_from`);
    }
    if (
      requireArchiveFields &&
      metadata.archived_from &&
      !/^audits\/[^/]+\.md$/.test(metadata.archived_from)
    ) {
      errors.push(`${relativePath}: archived_from must use audits/<filename>.md`);
    }
    if (metadata.evidence && metadata.evidence !== "null")
      assertPathInsideDocs(metadata.evidence, relativePath);
    audits.push(metadata.id);
  }
  return audits;
}

function validateAuditLifecycle() {
  const activeIds = validateAuditDirectory(path.join(docsRoot, "audits"), "active", false);
  const archivedIds = validateAuditDirectory(
    path.join(docsRoot, "historic", "audits"),
    "archived",
    true
  );
  const allIds = [...activeIds, ...archivedIds];
  for (const id of new Set(allIds)) {
    if (allIds.filter((candidate) => candidate === id).length > 1) {
      errors.push(`audit lifecycle: duplicate audit id ${id}`);
    }
  }
}

function validateDocumentationIndex() {
  const index = read("DOCS/README.md");
  const requiredLinks = [
    "architecture.md",
    "architecture/repository-structure.md",
    "security-policy.md",
    "testing-policy.md",
    "development.md",
    "release.md",
    "governance.md",
    "roadmap.md",
    "command-reference.md",
    "decisions/README.md",
    "decisions/unresolved.md",
    "evidence/README.md",
    "audits/README.md",
    "historic/README.md",
    "historic/audits/README.md"
  ];
  for (const link of requiredLinks) {
    if (!index.includes(`](${link})`))
      errors.push(`DOCS/README.md: missing navigation link ${link}`);
  }
  const links = [...index.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^[a-z]+:\/\//i.test(link)) continue;
    const target = path.resolve(docsRoot, link);
    if (!fs.existsSync(target)) errors.push(`DOCS/README.md: broken link ${link}`);
  }
}

function extractManifestField(content, field) {
  const match = content.match(new RegExp(`^\\s{4}${field}:\\s*(.+)$`, "m"));
  return match?.[1].trim();
}

function validateRenderManifestPolicy() {
  const authoritativePath = "project/apps/server/render.yaml";
  const mirrorPath = "project/render.yaml";
  const authoritative = read(authoritativePath);
  const mirror = read(mirrorPath);
  const sharedFields = ["name", "runtime", "rootDir", "buildCommand", "startCommand", "autoDeploy"];

  for (const field of sharedFields) {
    const authoritativeValue = extractManifestField(authoritative, field);
    const mirrorValue = extractManifestField(mirror, field);
    if (!authoritativeValue || !mirrorValue) {
      errors.push(`Render manifest policy: missing shared field ${field}`);
    } else if (authoritativeValue !== mirrorValue) {
      errors.push(
        `Render manifest policy: ${field} differs between ${authoritativePath} and ${mirrorPath}`
      );
    }
  }
  if (!/key:\s*JWT_SECRET[\s\S]{0,100}generateValue:\s*true/.test(authoritative)) {
    errors.push(`${authoritativePath}: required generated JWT_SECRET declaration is missing`);
  }
  if (/key:\s*JWT_SECRET/.test(mirror)) {
    errors.push(`${mirrorPath}: secret configuration must remain in the authoritative manifest`);
  }
}

function validateToolingPolicy() {
  const packageJson = JSON.parse(read("package.json"));
  const requiredScripts = [
    "coverage",
    "test:db",
    "format:check",
    "lint",
    "dependency:check",
    "reuse:check",
    "secret-scan"
  ];
  for (const script of requiredScripts) {
    if (!packageJson.scripts?.[script])
      errors.push(`package.json: missing tooling script ${script}`);
  }

  const requiredPinnedDependencies = {
    "@eslint/js": "10.0.1",
    "@vitest/coverage-v8": "3.2.7",
    eslint: "10.9.1",
    globals: "17.11.0",
    prettier: "3.9.6",
    "typescript-eslint": "8.68.0",
    vitest: "3.2.7"
  };
  for (const [dependency, version] of Object.entries(requiredPinnedDependencies)) {
    if (packageJson.devDependencies?.[dependency] !== version) {
      errors.push(`package.json: ${dependency} must be pinned to ${version}`);
    }
  }

  const developmentRequirements = read("requirements-dev.txt");
  if (!/^reuse==6\.2\.0$/m.test(developmentRequirements)) {
    errors.push("requirements-dev.txt: REUSE must be pinned to 6.2.0");
  }
  if (!/^charset-normalizer==3\.4\.3$/m.test(developmentRequirements)) {
    errors.push("requirements-dev.txt: charset-normalizer must be pinned to 3.4.3");
  }

  const desktopPackage = JSON.parse(read("project/apps/desktop/package.json"));
  for (const [name, command] of Object.entries(desktopPackage.scripts ?? {})) {
    if (/^(dist|release):/.test(name) && !command.includes("--publish never")) {
      errors.push(
        `project/apps/desktop/package.json: ${name} must disable publication with --publish never`
      );
    }
  }

  const windowsBuildScript = read("project/apps/desktop/BUILD-WINDOWS.ps1");
  if (/\bnpm install\b/.test(windowsBuildScript)) {
    errors.push(
      "project/apps/desktop/BUILD-WINDOWS.ps1: use root-workspace npm ci instead of npm install"
    );
  }
  if (!/\bnpm ci\b/.test(windowsBuildScript)) {
    errors.push("project/apps/desktop/BUILD-WINDOWS.ps1: canonical npm ci install is missing");
  }
  if (!/nodeMajor\s*-ne\s*22/.test(windowsBuildScript)) {
    errors.push("project/apps/desktop/BUILD-WINDOWS.ps1: Node.js 22 enforcement is missing");
  }

  const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
  let qualityWorkflow;
  for (const entry of fs.readdirSync(workflowsDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yml")) continue;
    const relativePath = path.join(".github", "workflows", entry.name);
    const workflow = read(relativePath);
    if (entry.name === "quality.yml") qualityWorkflow = workflow;
    for (const match of workflow.matchAll(/node-version:\s*["']?([^"'\s]+)["']?/g)) {
      if (match[1] !== "22")
        errors.push(`${relativePath}: Node.js ${match[1]} is not the required Node.js 22 LTS`);
    }
    if (/run:\s*npm install\s*$/m.test(workflow)) {
      errors.push(`${relativePath}: use root-workspace npm ci instead of npm install`);
    }
  }

  if (!qualityWorkflow) {
    errors.push(".github/workflows/quality.yml: quality workflow is missing");
  } else {
    const requiredQualitySteps = [
      "make tooling-check",
      "npm run format:check",
      "npm run lint",
      "npm run dependency:check",
      "npm run coverage",
      "npm run test:e2e",
      "npm run test:db",
      "playwright install --with-deps chromium",
      "actions/upload-artifact@v7"
    ];
    for (const step of requiredQualitySteps) {
      if (!qualityWorkflow.includes(step)) {
        errors.push(`.github/workflows/quality.yml: missing quality step ${step}`);
      }
    }
    if (!qualityWorkflow.includes("fsfe/reuse-action@676e2d560c9a403aa252096d99fcab3e1132b0f5")) {
      errors.push(
        ".github/workflows/quality.yml: REUSE action must use the approved immutable pin"
      );
    }
    if (
      !qualityWorkflow.includes("gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e")
    ) {
      errors.push(
        ".github/workflows/quality.yml: Gitleaks action must use the approved immutable pin"
      );
    }
  }
}

validateRoadmap();
validateAuditLifecycle();
validateDocumentationIndex();
validateRenderManifestPolicy();
validateToolingPolicy();

if (errors.length > 0) {
  console.error(`Roadmap validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    "Roadmap status, evidence links, documentation navigation, audit lifecycle, Render manifest policy, and tooling policy verified"
  );
}
