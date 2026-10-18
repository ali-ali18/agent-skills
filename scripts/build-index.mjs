#!/usr/bin/env node
// Valida skills/ e bots/ e escreve index.json (ordenado e determinístico).
//   node scripts/build-index.mjs           grava index.json
//   node scripts/build-index.mjs --check   valida, varre instruções suspeitas e falha se index.json estiver desatualizado
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanText } from "./scan.mjs";
import { validate } from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const BODY_MAX_BYTES = 16 * 1024;
const DOC_MAX_BYTES = 20 * 1024;
const FILE_MAX_BYTES = 64 * 1024;

const manifestSchema = JSON.parse(readFileSync(join(root, "schema/manifest.schema.json"), "utf8"));
const botSchema = JSON.parse(readFileSync(join(root, "schema/bot.schema.json"), "utf8"));

const errors = [];
const findings = [];
const fail = (where, message) => {
	errors.push(`${where}: ${message}`);
	return null;
};
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const bytes = (text) => Buffer.byteLength(text, "utf8");

function folders(dir) {
	const base = join(root, dir);
	if (!existsSync(base)) return [];
	return readdirSync(base)
		.filter((name) => statSync(join(base, name)).isDirectory())
		.sort();
}

function readJson(path, where) {
	try {
		const text = readFileSync(path, "utf8");
		if (bytes(text) > FILE_MAX_BYTES) return fail(where, "arquivo grande demais");
		return { data: JSON.parse(text), text };
	} catch (error) {
		return fail(where, `JSON inválido (${error instanceof Error ? error.message : "erro"})`);
	}
}

function parseScalar(raw) {
	const value = raw.trim();
	if (value.startsWith('"')) return JSON.parse(value);
	if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
	return value;
}

/** Mesmo formato de packages/shared/src/skill-markdown.ts do app. */
function parseSkillMarkdown(text, where) {
	const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
	if (lines[0]?.trim() !== "---") return fail(where, "o SKILL.md precisa começar com frontmatter (---)");
	const close = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (close === -1) return fail(where, "frontmatter sem fechamento");
	const fields = {};
	for (const line of lines.slice(1, close)) {
		if (!line.trim()) continue;
		const match = /^([A-Za-z_][\w-]*)\s*:(.*)$/.exec(line);
		if (!match) return fail(where, `linha inválida no frontmatter: ${line.slice(0, 40)}`);
		if (!["name", "description", "tools"].includes(match[1])) return fail(where, `chave desconhecida no frontmatter: ${match[1]}`);
		fields[match[1]] = match[2];
	}
	let tools = [];
	if (fields.tools !== undefined) {
		const raw = fields.tools.trim();
		if (!raw.startsWith("[") || !raw.endsWith("]")) return fail(where, "tools deve ser [a, b]");
		const inner = raw.slice(1, -1).trim();
		tools = inner ? inner.split(",").map((item) => parseScalar(item)) : [];
	}
	try {
		return {
			name: parseScalar(fields.name ?? ""),
			description: parseScalar(fields.description ?? ""),
			tools,
			body: lines.slice(close + 1).join("\n").trim(),
		};
	} catch {
		return fail(where, "aspas malformadas no frontmatter");
	}
}

function scan(where, text) {
	for (const finding of scanText(text)) findings.push({ where, ...finding });
}

const skills = [];
const skillSlugs = new Set(folders("skills"));
for (const slug of skillSlugs) {
	const where = `skills/${slug}`;
	const manifestFile = readJson(join(root, where, "manifest.json"), `${where}/manifest.json`);
	const mdPath = join(root, where, "SKILL.md");
	if (!existsSync(mdPath)) fail(where, "falta SKILL.md");
	if (!manifestFile || !existsSync(mdPath)) continue;
	const manifest = manifestFile.data;
	validate(manifestSchema, manifest).forEach((message) => fail(`${where}/manifest.json`, message));
	const markdown = readFileSync(mdPath, "utf8");
	if (bytes(markdown) > DOC_MAX_BYTES) fail(`${where}/SKILL.md`, `passa de ${DOC_MAX_BYTES / 1024} KB`);
	const parsed = parseSkillMarkdown(markdown, `${where}/SKILL.md`);
	if (!parsed) continue;
	if (bytes(parsed.body) > BODY_MAX_BYTES) fail(`${where}/SKILL.md`, "corpo passa de 16 KB");
	if (!parsed.body) fail(`${where}/SKILL.md`, "corpo vazio");
	if (manifest.slug !== slug) fail(where, `slug do manifest (${manifest.slug}) difere da pasta`);
	if (parsed.name !== manifest.slug) fail(`${where}/SKILL.md`, `name (${parsed.name}) difere do slug`);
	if (parsed.description !== manifest.description) fail(`${where}/SKILL.md`, "description difere do manifest.json");
	if ([...parsed.tools].sort().join() !== [...(manifest.tools ?? [])].sort().join()) fail(`${where}/SKILL.md`, "tools difere do manifest.json");
	if (manifest.changelog?.[0]?.version !== manifest.version) fail(`${where}/manifest.json`, "a primeira entrada do changelog deve ser a versão atual");
	scan(`${where}/SKILL.md`, markdown);
	scan(`${where}/manifest.json`, manifestFile.text);
	skills.push({
		slug,
		name: manifest.name,
		description: manifest.description,
		version: manifest.version,
		author: manifest.author,
		category: manifest.category,
		tags: manifest.tags,
		tools: manifest.tools,
		...(manifest.minAppVersion ? { minAppVersion: manifest.minAppVersion } : {}),
		path: where,
		sha256: sha256(markdown),
		manifestSha256: sha256(manifestFile.text),
	});
}

const bots = [];
for (const slug of folders("bots")) {
	const where = `bots/${slug}`;
	const file = readJson(join(root, where, "bot.json"), `${where}/bot.json`);
	if (!existsSync(join(root, where, "README.md"))) fail(where, "falta README.md");
	if (!file) continue;
	const bot = file.data;
	validate(botSchema, bot).forEach((message) => fail(`${where}/bot.json`, message));
	if (bot.slug !== slug) fail(where, `slug do bot (${bot.slug}) difere da pasta`);
	for (const skill of bot.skills ?? []) if (!skillSlugs.has(skill)) fail(`${where}/bot.json`, `skill desconhecida: ${skill}`);
	if (bot.changelog?.[0]?.version !== bot.version) fail(`${where}/bot.json`, "a primeira entrada do changelog deve ser a versão atual");
	scan(`${where}/bot.json`, file.text.replace(/\\n/g, "\n"));
	bots.push({
		slug,
		name: bot.name,
		description: bot.snippet,
		version: bot.version,
		author: bot.author,
		category: bot.category,
		tags: bot.tags,
		skills: bot.skills,
		path: where,
		sha256: sha256(file.text),
	});
}

const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const index = { schemaVersion: 1, skills: skills.sort(bySlug), bots: bots.sort(bySlug) };
const output = `${JSON.stringify(index, null, 2)}\n`;

const blocks = findings.filter((item) => item.severity === "block");
const reviews = findings.filter((item) => item.severity === "review");
for (const item of findings) {
	const level = item.severity === "block" ? "error" : "warning";
	console.log(`::${level} file=${item.where},line=${item.line}::[${item.rule}] ${item.excerpt}`);
}
if (process.env.GITHUB_STEP_SUMMARY && findings.length > 0) {
	const list = findings.map((item) => `- **${item.severity}** \`${item.rule}\` em \`${item.where}:${item.line}\``).join("\n");
	const verdict = blocks.length ? "Há bloqueios: corrija antes de pedir revisão." : "Somente itens para revisão manual.";
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Varredura de instruções suspeitas\n\n${list}\n\n${verdict}\n`);
}

if (check) {
	const current = existsSync(join(root, "index.json")) ? readFileSync(join(root, "index.json"), "utf8") : "";
	if (current !== output) fail("index.json", "desatualizado; rode `node scripts/build-index.mjs` e inclua no PR");
} else if (errors.length === 0) {
	writeFileSync(join(root, "index.json"), output);
}

errors.forEach((message) => console.error(`::error::${message}`));
console.log(`${skills.length} skills, ${bots.length} bots, ${errors.length} erros, ${blocks.length} bloqueios, ${reviews.length} para revisão.`);
process.exit(errors.length > 0 || blocks.length > 0 ? 1 : 0);
