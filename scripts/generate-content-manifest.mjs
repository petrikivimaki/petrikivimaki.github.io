import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const manifestSchemaVersion = 1;
const defaultContentRoot = "notes";
const defaultOutputPath = "manifest.json";
const excerptLength = 280;

/**
 * Generates a content manifest from a Markdown directory.
 * @async
 * @returns {Promise<void>}
 */
async function main() {
	const options = parseArguments({ argumentsList: process.argv.slice(2) });
	const contentRootPath = resolve(options.contentRoot);
	const outputPath = resolve(options.output);
	const markdownPaths = await collectMarkdownPaths({ directoryPath: contentRootPath });
	const notes = await Promise.all(markdownPaths.map(async function readMarkdownPath(filePath) {
		return await createNoteRecord({ contentRootPath, filePath });
	}));
	const files = createLinkedNoteRecords({ notes });
	const manifest = {
		schemaVersion: manifestSchemaVersion,
		generatedAt: new Date().toISOString(),
		revision: options.revision,
		contentRoot: normalizePath(relative(dirname(outputPath), contentRootPath)),
		files
	};

	await writeFile(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
	process.stdout.write(`Generated ${options.output} with ${files.length} notes.\n`);
}

/**
 * Parses command-line options.
 * @param {object} params
 * @param {Array<string>} params.argumentsList
 * @returns {{ contentRoot: string, output: string, revision: string }}
 */
function parseArguments({ argumentsList }) {
	const options = {
		contentRoot: defaultContentRoot,
		output: defaultOutputPath,
		revision: String(process.env.GITHUB_SHA || "").trim()
	};

	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		const value = argumentsList[index + 1];

		if (argument === "--content-root" && value) {
			options.contentRoot = value;
			index += 1;
			continue;
		}

		if (argument === "--output" && value) {
			options.output = value;
			index += 1;
			continue;
		}

		if (argument === "--revision" && value) {
			options.revision = value;
			index += 1;
			continue;
		}

		throw new Error(`Unknown or incomplete argument: ${argument}`);
	}

	return options;
}

/**
 * Recursively collects Markdown file paths.
 * @async
 * @param {object} params
 * @param {string} params.directoryPath
 * @returns {Promise<Array<string>>}
 */
async function collectMarkdownPaths({ directoryPath }) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const sortedEntries = entries.sort(sortDirectoryEntryByName);
	const nestedPaths = await Promise.all(sortedEntries.map(async function collectEntry(entry) {
		const entryPath = join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			return await collectMarkdownPaths({ directoryPath: entryPath });
		}

		return entry.isFile() && isMarkdownPath(entry.name) ? [entryPath] : [];
	}));

	return nestedPaths.flat();
}

/**
 * Sorts directory entries by name.
 * @param {import("node:fs").Dirent} first
 * @param {import("node:fs").Dirent} second
 * @returns {number}
 */
function sortDirectoryEntryByName(first, second) {
	return first.name.localeCompare(second.name);
}

/**
 * Creates a note record before reverse links are known.
 * @async
 * @param {object} params
 * @param {string} params.contentRootPath
 * @param {string} params.filePath
 * @returns {Promise<object>}
 */
async function createNoteRecord({ contentRootPath, filePath }) {
	const content = await readFile(filePath, "utf8");
	const path = normalizePath(relative(contentRootPath, filePath));
	const parsed = parseFrontmatter(content);
	const visibleBody = stripObsidianComments({ markdown: parsed.body });
	const readableText = getReadableText({ markdown: visibleBody });
	const title = String(parsed.metadata.title || getTitleFromMarkdown(visibleBody) || removeExtension(path.split("/").pop() || path));

	return {
		path,
		title,
		metadata: parsed.metadata,
		outgoingLinks: extractInternalLinks({ markdown: visibleBody }),
		backlinks: [],
		excerpt: createExcerpt({ text: readableText }),
		wordCount: countWords(readableText),
		characterCount: readableText.length,
		size: Buffer.byteLength(content, "utf8"),
		hash: createHash("sha256").update(content).digest("hex")
	};
}

/**
 * Resolves outgoing links and creates reverse backlink lists.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {Array<object>}
 */
function createLinkedNoteRecords({ notes }) {
	const records = notes.map(function cloneNote(note) {
		return {
			...note,
			outgoingLinks: note.outgoingLinks.map(function cloneLink(link) {
				return { ...link };
			}),
			backlinks: []
		};
	});

	for (let noteIndex = 0; noteIndex < records.length; noteIndex += 1) {
		const note = records[noteIndex];

		for (let linkIndex = 0; linkIndex < note.outgoingLinks.length; linkIndex += 1) {
			const link = note.outgoingLinks[linkIndex];
			const target = resolveLinkTarget({ link, notes: records, sourcePath: note.path });
			link.path = target?.path || null;

			if (target && !target.backlinks.includes(note.path)) {
				target.backlinks.push(note.path);
			}
		}
	}

	for (let index = 0; index < records.length; index += 1) {
		records[index].backlinks.sort();
	}

	return records;
}

/**
 * Extracts internal wiki links and Markdown links outside fenced code blocks.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {Array<object>}
 */
function extractInternalLinks({ markdown }) {
	const searchableMarkdown = removeFencedCode({ markdown });
	const links = [];
	const seen = new Set();
	const wikiPattern = /!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
	const markdownPattern = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
	let match = wikiPattern.exec(searchableMarkdown);

	while (match) {
		const target = stripLinkAnchor(match[1]);
		const extension = extname(target).toLowerCase();

		if (!extension || isMarkdownPath(target)) {
			addInternalLink({ links, seen, target: match[1], type: "wiki" });
		}

		match = wikiPattern.exec(searchableMarkdown);
	}

	match = markdownPattern.exec(searchableMarkdown);

	while (match) {
		const target = decodeLinkTarget(match[1]);

		if (!isExternalLinkTarget(target) && isMarkdownPath(stripLinkAnchor(target))) {
			addInternalLink({ links, seen, target, type: "markdown" });
		}

		match = markdownPattern.exec(searchableMarkdown);
	}

	return links;
}

/**
 * Checks whether a Markdown target uses an external URL scheme.
 * @param {string} target
 * @returns {boolean}
 */
function isExternalLinkTarget(target) {
	return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//");
}

/**
 * Adds a unique internal link record.
 * @param {object} params
 * @param {Array<object>} params.links
 * @param {Set<string>} params.seen
 * @param {string} params.target
 * @param {string} params.type
 * @returns {void}
 */
function addInternalLink({ links, seen, target, type }) {
	const cleanTarget = String(target || "").trim();
	const key = `${type}:${cleanTarget}`;

	if (!cleanTarget || seen.has(key)) {
		return;
	}

	seen.add(key);
	links.push({ type, target: cleanTarget, path: null });
}

/**
 * Resolves an extracted link to a manifest note.
 * @param {object} params
 * @param {object} params.link
 * @param {Array<object>} params.notes
 * @param {string} params.sourcePath
 * @returns {object|undefined}
 */
function resolveLinkTarget({ link, notes, sourcePath }) {
	const targetWithoutAnchor = stripLinkAnchor(decodeLinkTarget(link.target));
	const normalizedTarget = normalizePath(targetWithoutAnchor.replace(/^\//, ""));
	const sourceDirectory = normalizePath(dirname(sourcePath));
	const relativeTarget = link.type === "markdown" && !targetWithoutAnchor.startsWith("/")
		? normalizePath(join(sourceDirectory === "." ? "" : sourceDirectory, normalizedTarget))
		: normalizedTarget;
	const candidates = createTargetCandidates({ target: link.type === "markdown" ? relativeTarget : normalizedTarget });
	const targetBase = removeExtension(normalizedTarget.split("/").pop() || normalizedTarget).toLowerCase();

	for (let index = 0; index < notes.length; index += 1) {
		if (candidates.includes(normalizePath(notes[index].path))) {
			return notes[index];
		}
	}

	if (link.type === "wiki") {
		for (let index = 0; index < notes.length; index += 1) {
			const noteBase = removeExtension(notes[index].path.split("/").pop() || notes[index].path).toLowerCase();

			if (noteBase === targetBase) {
				return notes[index];
			}
		}
	}

	return undefined;
}

/**
 * Creates exact Markdown path candidates for a link target.
 * @param {object} params
 * @param {string} params.target
 * @returns {Array<string>}
 */
function createTargetCandidates({ target }) {
	if (isMarkdownPath(target)) {
		return [target];
	}

	return [`${target}.md`, `${target}.mdx`];
}

/**
 * Removes fenced code blocks before link scanning.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function removeFencedCode({ markdown }) {
	return markdown.replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, "\n");
}

/**
 * Decodes a Markdown link target when possible.
 * @param {string} target
 * @returns {string}
 */
function decodeLinkTarget(target) {
	try {
		return decodeURIComponent(target);
	} catch (error) {
		return target;
	}
}

/**
 * Removes a heading or block anchor from an internal link.
 * @param {string} target
 * @returns {string}
 */
function stripLinkAnchor(target) {
	return String(target || "").split("#")[0].split("^")[0].split("?")[0].trim();
}

/**
 * Parses the frontmatter subset supported by Papyrus.
 * @param {string} content
 * @returns {{ metadata: object, body: string }}
 */
function parseFrontmatter(content) {
	if (!content.startsWith("---")) {
		return { metadata: {}, body: content };
	}

	const lines = content.replace(/\r\n/g, "\n").split("\n");
	const metadata = {};
	let endIndex = -1;
	let activeListKey = "";

	for (let index = 1; index < lines.length; index += 1) {
		const line = lines[index];
		const trimmed = line.trim();

		if (trimmed === "---") {
			endIndex = index;
			break;
		}

		if (activeListKey && trimmed.startsWith("- ")) {
			metadata[activeListKey].push(parseFrontmatterScalar(trimmed.slice(2).trim()));
			continue;
		}

		const separatorIndex = line.indexOf(":");

		if (separatorIndex > -1) {
			const key = line.slice(0, separatorIndex).trim();
			const value = line.slice(separatorIndex + 1).trim();

			if (!key) {
				activeListKey = "";
				continue;
			}

			metadata[key] = value ? parseFrontmatterValue(value) : [];
			activeListKey = value ? "" : key;
		} else if (trimmed) {
			activeListKey = "";
		}
	}

	if (endIndex < 0) {
		return { metadata: {}, body: content };
	}

	return {
		metadata,
		body: lines.slice(endIndex + 1).join("\n").trim()
	};
}

/**
 * Parses a frontmatter value.
 * @param {string} value
 * @returns {*}
 */
function parseFrontmatterValue(value) {
	if (value.startsWith("[") && value.endsWith("]")) {
		return value.slice(1, -1).split(",").map(parseFrontmatterScalar).filter(function keepValue(item) {
			return item !== "";
		});
	}

	return parseFrontmatterScalar(value);
}

/**
 * Parses a frontmatter scalar without evaluating arbitrary YAML.
 * @param {string} value
 * @returns {string|number|boolean|null}
 */
function parseFrontmatterScalar(value) {
	const cleanValue = String(value || "").trim().replace(/^(["'])(.*)\1$/, "$2");

	if (cleanValue === "true") {
		return true;
	}

	if (cleanValue === "false") {
		return false;
	}

	if (cleanValue === "null") {
		return null;
	}

	if (/^-?\d+(?:\.\d+)?$/.test(cleanValue)) {
		return Number(cleanValue);
	}

	return cleanValue;
}

/**
 * Removes Obsidian comments.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function stripObsidianComments({ markdown }) {
	return markdown.replace(/%%[\s\S]*?%%/g, "");
}

/**
 * Gets the first level-one heading.
 * @param {string} markdown
 * @returns {string}
 */
function getTitleFromMarkdown(markdown) {
	const lines = markdown.split("\n");

	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(/^#\s+(.+)$/);

		if (match) {
			return match[1].trim();
		}
	}

	return "";
}

/**
 * Converts Markdown to compact searchable text.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function getReadableText({ markdown }) {
	return removeFencedCode({ markdown })
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
		.replace(/\[\[([^\]]+)\]\]/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/^[#>\-*+]+\s*/gm, "")
		.replace(/[`*_~]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Creates a bounded manifest excerpt.
 * @param {object} params
 * @param {string} params.text
 * @returns {string}
 */
function createExcerpt({ text }) {
	if (text.length <= excerptLength) {
		return text;
	}

	return `${text.slice(0, excerptLength - 1).trimEnd()}…`;
}

/**
 * Counts words in readable text.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
	return text ? text.split(/\s+/).length : 0;
}

/**
 * Checks for a supported Markdown extension.
 * @param {string} path
 * @returns {boolean}
 */
function isMarkdownPath(path) {
	const extension = extname(String(path || "")).toLowerCase();
	return extension === ".md" || extension === ".mdx";
}

/**
 * Removes a file extension.
 * @param {string} fileName
 * @returns {string}
 */
function removeExtension(fileName) {
	return fileName.replace(/\.[^/.]+$/, "");
}

/**
 * Normalizes a filesystem path for manifest use.
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
	return String(path || "").split(sep).join("/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
}

await main();
