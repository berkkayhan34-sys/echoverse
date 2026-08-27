/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogRoot = path.join(repositoryRoot, "project/packages/contracts/src/localizations");
const sourceRoots = [path.join(repositoryRoot, "project/apps")];
const errors = [];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(catalogRoot, name), "utf8"));
}

function placeholders(value) {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
}

function sourceFiles(root, predicate = (name) => /\.(ts|tsx)$/.test(name)) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "release")
      continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(absolute));
    else if (predicate(entry.name)) files.push(absolute);
  }
  return files;
}

function checkCatalogs() {
  const catalogs = { en: readJson("en.json"), tr: readJson("tr.json") };
  const englishKeys = Object.keys(catalogs.en).sort();
  const turkishKeys = Object.keys(catalogs.tr).sort();
  if (JSON.stringify(englishKeys) !== JSON.stringify(turkishKeys)) {
    errors.push("English and Turkish catalogs must have identical keys");
  }
  for (const key of englishKeys) {
    if (typeof catalogs.en[key] !== "string" || catalogs.en[key].length === 0) {
      errors.push(`en.json: ${key} must have a non-empty string value`);
    }
    if (typeof catalogs.tr[key] !== "string" || catalogs.tr[key].length === 0) {
      errors.push(`tr.json: ${key} must have a non-empty string value`);
    }
    if (
      JSON.stringify(placeholders(catalogs.en[key])) !==
      JSON.stringify(placeholders(catalogs.tr[key]))
    ) {
      errors.push(`${key}: English and Turkish placeholders must match`);
    }
  }
  return new Set(englishKeys);
}

function checkSource(catalogKeys) {
  const userFacingAttributes = new Set(["aria-label", "placeholder", "title", "alt"]);
  for (const file of sourceRoots.flatMap(sourceFiles)) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(repositoryRoot, file);
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    function visit(node) {
      if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, " ").trim();
        if (/[A-Za-zÀ-ž\u4e00-\u9fff]/u.test(text)) {
          errors.push(
            `${relative}:${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1}: raw JSX text must use a catalog key: ${text}`
          );
        }
      }
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const value = node.initializer.text.trim();
        if (
          value &&
          userFacingAttributes.has(node.name.text) &&
          /[A-Za-zÀ-ž\u4e00-\u9fff]/u.test(value)
        ) {
          errors.push(
            `${relative}:${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1}: ${node.name.text} must use a catalog key: ${value}`
          );
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        node.left.getText(sourceFile).endsWith("textContent") &&
        ts.isStringLiteral(node.right) &&
        /[A-Za-zÀ-ž\u4e00-\u9fff]/u.test(node.right.text)
      ) {
        errors.push(
          `${relative}:${sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1}: textContent must use a catalog key: ${node.right.text}`
        );
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(sourceFile) === "t" &&
        node.arguments.length > 0
      ) {
        const key = ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : null;
        if (key && !catalogKeys.has(key)) errors.push(`${relative}: missing catalog key ${key}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  const cssFiles = sourceRoots.flatMap((root) =>
    sourceFiles(root, (name) => name.endsWith(".css"))
  );
  for (const file of cssFiles.filter((candidate) => fs.existsSync(candidate))) {
    const source = fs.readFileSync(file, "utf8");
    if (/content\s*:\s*["'][A-Za-zÀ-ž\u4e00-\u9fff]/u.test(source)) {
      errors.push(
        `${path.relative(repositoryRoot, file)}: CSS generated text must use a catalog-backed DOM node`
      );
    }
  }
}

function checkHtml(catalogKeys) {
  const htmlFiles = sourceRoots.flatMap((root) =>
    sourceFiles(root, (name) => name.endsWith(".html"))
  );
  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(repositoryRoot, file);
    for (const match of source.matchAll(/<title(?:\s[^>]*)?>([^<]*)<\/title>/giu)) {
      if (/[A-Za-zÀ-ž\u4e00-\u9fff]/u.test(match[1])) {
        errors.push(`${relative}: HTML title text must use a catalog key`);
      }
    }
    for (const match of source.matchAll(
      /<(?:meta|title)\b[^>]*data-localization-key=["']([^"']+)["'][^>]*>/giu
    )) {
      if (!catalogKeys.has(match[1])) errors.push(`${relative}: missing catalog key ${match[1]}`);
    }
    const description = source.match(
      /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/iu
    );
    if (description && /[A-Za-zÀ-ž\u4e00-\u9fff]/u.test(description[1])) {
      errors.push(`${relative}: HTML description text must use a catalog key`);
    }
  }
}

const catalogKeys = checkCatalogs();
checkSource(catalogKeys);
checkHtml(catalogKeys);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Localization catalog and visible-text checks passed (${catalogKeys.size} keys)`);
}
