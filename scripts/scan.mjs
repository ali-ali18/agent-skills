// Varredura simples de instruções suspeitas. Mantida igual à do app (packages/shared/src/catalog-scan.ts).
// severity "block" falha o PR; "review" pede revisão manual.

export const HOST_ALLOWLIST = [
	"github.com",
	"raw.githubusercontent.com",
	"api.github.com",
	"objects.githubusercontent.com",
	"codeload.github.com",
	"apis.roblox.com",
	"create.roblox.com",
	"roblox.com",
	"rojo.space",
	"crates.io",
	"static.crates.io",
	"registry.npmjs.org",
	"npmjs.com",
	"pypi.org",
	"files.pythonhosted.org",
	"deb.debian.org",
	"archive.ubuntu.com",
];

const NEGATION = /\b(never|do not|don't|dont|must not|without|nunca|jamais|não|nao|evite|sem)\b/i;

const RULES = [
	{ id: "secret-literal", severity: "block", re: /(\b(?:sk|rk|pk)-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}|\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|x-api-key:\s*[A-Za-z0-9_-]{20,})/, negatable: false },
	{ id: "exfiltrate", severity: "block", re: /\b(exfiltrat\w*|exfiltr\w*)\b/i, negatable: true },
	{ id: "send-to-url", severity: "block", re: /\b(send|post|upload|forward|envie|enviar|mande)\b[^\n]{0,60}\b(secrets?|keys?|tokens?|passwords?|senhas?|credentials?|credenciais|chaves?|cookies?|vault|cofre)\b[^\n]{0,60}\bhttps?:\/\//i, negatable: true },
	{ id: "ignore-previous", severity: "block", re: /\b(ignore|disregard|forget|esque[cç]a|ignore)\b[^\n]{0,20}\b(previous|prior|above|earlier|all)\b[^\n]{0,20}\b(instructions?|rules?|prompts?|instru[cç][õo]es|regras)\b/i, negatable: false },
	{ id: "ignore-previous-pt", severity: "block", re: /\bignore\s+(as\s+)?(instru[cç][õo]es|regras)\s+(anteriores|acima)\b/i, negatable: false },
	{ id: "disable-safety", severity: "block", re: /\b(disable|turn off|bypass|circumvent|skip|override|desativ\w+|desligu?\w*|contorn\w+|burl\w+|pul(?:e|ar|ando))\b[^\n]{0,30}\b(safety|safeguards?|guardrails?|approvals?|confirmations?|permissions?|seguran[cç]a|aprova[cç][õo]es|aprova[cç][aã]o|confirma[cç][õo]es|permiss[õo]es)\b/i, negatable: true },
	{ id: "read-vault", severity: "review", re: /\b(read|dump|list|cat|reveal|show|print|echo|leak|exfiltrate|ler|leia|mostre|exiba|liste|revele)\b[^\n]{0,30}\b(vault|cofre|secrets?|api[ _-]?keys?|tokens?|passwords?|senhas?|segredos?)\b/i, negatable: true },
	{ id: "env-dump", severity: "review", re: /\b(printenv|env\s*\|\s*(curl|nc)|cat\s+\/proc\/\S*environ|cat\s+~?\/?\.ssh|cat\s+\S*\.env\b)/i, negatable: true },
	{ id: "obfuscated-exec", severity: "review", re: /(base64\s+(-d|--decode)[^\n]{0,40}\|\s*(sh|bash)|\|\s*(sh|bash)\s*$|eval\s*\(\s*atob)/im, negatable: false },
];

function hostOf(url) {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

export function hostAllowed(host) {
	return HOST_ALLOWLIST.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** @returns {{rule:string, severity:"block"|"review", line:number, excerpt:string}[]} */
export function scanText(text) {
	const findings = [];
	const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
	lines.forEach((line, index) => {
		const excerpt = line.trim().slice(0, 160);
		for (const rule of RULES) {
			const match = rule.re.exec(line);
			if (!match) continue;
			if (rule.negatable && NEGATION.test(line.slice(Math.max(0, match.index - 60), match.index + match[0].length))) continue;
			// Nunca imprime o trecho de um segredo (logs da CI).
			findings.push({ rule: rule.id, severity: rule.severity, line: index + 1, excerpt: rule.id === "secret-literal" ? "[trecho oculto]" : excerpt });
		}
		if (/\b(curl|wget)\b/.test(line)) {
			for (const url of line.match(/https?:\/\/[^\s"'`)<>\\]+/gi) ?? []) {
				const host = hostOf(url);
				if (host && !hostAllowed(host)) {
					findings.push({ rule: "network-host", severity: "review", line: index + 1, excerpt: `${host} :: ${excerpt}` });
				}
			}
			if (/\b(curl|wget)\b[^\n]*\s(-d|--data|--data-binary|--data-raw|-F|--form|-T)\s*@?\S*(env|secret|\.ssh|passwd|credentials)/i.test(line)) {
				findings.push({ rule: "upload-sensitive-file", severity: "block", line: index + 1, excerpt });
			}
		}
	});
	return findings;
}
