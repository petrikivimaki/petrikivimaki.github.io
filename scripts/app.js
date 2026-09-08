import {
	dismissStartupAnimation,
	startupAnimation,
	startupConfig,
	startupConfigError
} from "./startup.js";
import { requestJson, requestText } from "./network.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@18.0.4/+esm";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/+esm";
import Prism from "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import {
	bind as bindCuelume,
	play as playCuelume,
	setEnabled as setCuelumeEnabled,
	setVolume as setCuelumeVolume
} from "https://cdn.jsdelivr.net/npm/cuelume@0.2.2/+esm";
import "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/prism-json.min.js";
import "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/plugins/autoloader/prism-autoloader.min.js";
import { getPeriodicTableElementUrl, periodicTableElements } from "./periodic-table.js";

Prism.manual = true;
Prism.plugins.autoloader.languages_path = "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/";

const state = {
	bookmarks: [],
	config: {},
	folderState: {},
	manifest: {},
	notes: [],
	activePath: "",
	activePanel: "files",
	activeView: "home",
	calendarDateIndex: new Map(),
	calendarDate: new Date(),
	contentWidth: 820,
	fontFamily: "modern",
	fontSize: 18,
	lineHeight: 1.68,
	linktreeClockInterval: 0,
	primaryMenuCollapsed: true,
	primaryMenuSide: "left",
	focusTimerDurationMinutes: 5,
	focusTimerEndsAt: 0,
	focusTimerInterval: 0,
	mathJaxPromise: null,
	mapLibrePromise: null,
	maps: [],
	secondaryMenuCollapsed: true,
	settingsOpen: false,
	searchMetadataKeys: new Set(),
	soundEnabled: true,
	qrCodeTimer: 0,
	searchResultIndex: -1,
	selectedText: "",
	selectionRect: null,
	selectionSearchProviders: [],
	articleScrollFrame: 0,
	theme: "light",
	textAlign: "left",
	tocState: {},
	navigationNoticeVisible: false,
	navigationStatusTimer: 0,
	noteRequestId: 0,
	vaultLoadController: null,
	vaultRequestId: 0
};

const bookmarkStorageKey = "papyrus.bookmarks";
const appearanceStorageKey = "papyrus.appearance";
const codeRunnerChannel = "papyrus-code-runner";
const codeRunnerSessions = new Map();
const articleTableStates = new WeakMap();
const noteContentCache = new Map();
const noteLoadPromises = new Map();
const contentManifestSchemaVersion = 1;
const manifestRequestTimeoutMs = 10000;
const articleRequestTimeoutMs = 12000;
const minimumSelectionCharacters = 5;
const maximumQrCodeCharacters = 100;
const maximumInlineSelectionSearchProviders = 2;
const minimumScrollTopOffset = 800;
const maximumUncontrolledTableRows = 6;
const tableTextCollator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base"
});
const qrCodeVisibleMs = 18000;
const soundEffectsVolume = 0.36;
const maximumFeaturedNotes = 3;
const focusTimerDurations = [5, 10, 15, 20];
const mapPropertyNames = ["latitude", "longitude", "zoom", "marker", "grayscale", "label"];
const tickerPropertyNames = ["symbol", "label", "quote", "market", "change"];
const swotPropertyNames = ["strengths", "weaknesses", "opportunities", "threats"];
const ptePropertyNames = ["label", "elements"];
const defaultPeriodicTableLinkTemplate = "https://pubchem.ncbi.nlm.nih.gov/element/{Z}";
const defaultPeriodicTableLinkLabel = "PubChem";
const linktreeServices = [
	{
		id: "amazon",
		icon: "fa-brands fa-amazon",
		domains: ["amazon.com", "amazon.ca", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.nl", "amazon.pl", "amazon.se", "amazon.com.au", "amazon.co.jp", "amazon.in", "amazon.com.br", "amazon.com.mx", "amazon.sg", "amazon.ae", "amazon.sa", "amzn.to"]
	},
	{ id: "behance", icon: "fa-brands fa-behance", domains: ["behance.net"] },
	{ id: "bluesky", icon: "fa-brands fa-bluesky", domains: ["bsky.app", "bluesky.app"] },
	{ id: "codepen", icon: "fa-brands fa-codepen", domains: ["codepen.io"] },
	{ id: "discord", icon: "fa-brands fa-discord", domains: ["discord.com", "discord.gg"] },
	{ id: "dribbble", icon: "fa-brands fa-dribbble", domains: ["dribbble.com"] },
	{ id: "facebook", icon: "fa-brands fa-facebook-f", domains: ["facebook.com", "fb.com", "fb.me", "messenger.com"] },
	{ id: "flickr", icon: "fa-brands fa-flickr", domains: ["flickr.com"] },
	{ id: "github", icon: "fa-brands fa-github", domains: ["github.com"] },
	{ id: "gitlab", icon: "fa-brands fa-gitlab", domains: ["gitlab.com"] },
	{ id: "instagram", icon: "fa-brands fa-instagram", domains: ["instagram.com", "instagr.am"] },
	{ id: "linkedin", icon: "fa-brands fa-linkedin-in", domains: ["linkedin.com", "lnkd.in"] },
	{ id: "mastodon", icon: "fa-brands fa-mastodon", domains: ["mastodon.social", "mastodon.online", "fosstodon.org", "hachyderm.io"] },
	{ id: "medium", icon: "fa-brands fa-medium", domains: ["medium.com"] },
	{ id: "npm", icon: "fa-brands fa-npm", domains: ["npmjs.com", "npmjs.org", "npm.im"] },
	{ id: "patreon", icon: "fa-brands fa-patreon", domains: ["patreon.com"] },
	{ id: "pinterest", icon: "fa-brands fa-pinterest-p", domains: ["pinterest.com", "pin.it"] },
	{ id: "producthunt", icon: "fa-brands fa-product-hunt", domains: ["producthunt.com"] },
	{ id: "reddit", icon: "fa-brands fa-reddit-alien", domains: ["reddit.com"] },
	{ id: "slack", icon: "fa-brands fa-slack", domains: ["slack.com"] },
	{ id: "snapchat", icon: "fa-brands fa-snapchat", domains: ["snapchat.com"] },
	{ id: "soundcloud", icon: "fa-brands fa-soundcloud", domains: ["soundcloud.com"] },
	{ id: "spotify", icon: "fa-brands fa-spotify", domains: ["spotify.com"] },
	{ id: "substack", icon: "fa-regular fa-newspaper", domains: ["substack.com"] },
	{ id: "telegram", icon: "fa-brands fa-telegram", domains: ["t.me", "telegram.me"] },
	{ id: "threads", icon: "fa-brands fa-threads", domains: ["threads.net"] },
	{ id: "tiktok", icon: "fa-brands fa-tiktok", domains: ["tiktok.com"] },
	{ id: "tumblr", icon: "fa-brands fa-tumblr", domains: ["tumblr.com"] },
	{ id: "twitch", icon: "fa-brands fa-twitch", domains: ["twitch.tv"] },
	{ id: "vimeo", icon: "fa-brands fa-vimeo-v", domains: ["vimeo.com"] },
	{ id: "whatsapp", icon: "fa-brands fa-whatsapp", domains: ["wa.me", "whatsapp.com"] },
	{ id: "wikipedia", icon: "fa-brands fa-wikipedia-w", domains: ["wikipedia.org"] },
	{ id: "wordpress", icon: "fa-brands fa-wordpress", domains: ["wordpress.com", "wordpress.org", "wp.com"] },
	{ id: "x", icon: "fa-brands fa-x-twitter", domains: ["x.com", "twitter.com", "t.co"] },
	{ id: "youtube", icon: "fa-brands fa-youtube", domains: ["youtube.com", "youtube-nocookie.com", "youtu.be"] }
];
const calloutTypes = {
	note: { title: "Note" },
	abstract: { title: "Abstract" },
	info: { title: "Info" },
	todo: { title: "Todo" },
	tip: { title: "Tip" },
	success: { title: "Success" },
	question: { title: "Question" },
	warning: { title: "Warning" },
	failure: { title: "Failure" },
	danger: { title: "Danger" },
	bug: { title: "Bug" },
	example: { title: "Example" },
	quote: { title: "Quote" }
};
const calloutTypeAliases = {
	summary: "abstract",
	tldr: "abstract",
	hint: "tip",
	important: "tip",
	check: "success",
	done: "success",
	help: "question",
	faq: "question",
	caution: "warning",
	attention: "warning",
	fail: "failure",
	missing: "failure",
	error: "danger",
	cite: "quote"
};
const periodicTableElementLookup = createPeriodicTableElementLookup();
let codeRunnerSessionCount = 0;
const themes = [
	{ id: "light", label: "Light" },
	{ id: "sand", label: "Sand" },
	{ id: "ocean", label: "Ocean" },
	{ id: "dark", label: "Dark" }
];

const selectors = {
	appShell: ".app-shell",
	article: "[data-article]",
	articleProgress: "[data-article-progress]",
	articleProgressValue: "[data-article-progress-value]",
	backlinkList: "[data-backlink-list]",
	bookmarkButton: "[data-action='toggle-bookmark']",
	bookmarkIcon: "[data-bookmark-icon]",
	bookmarkLabel: "[data-bookmark-label]",
	bookmarksList: "[data-bookmarks-list]",
	calendarDays: "[data-calendar-days]",
	calendarTitle: "[data-calendar-title]",
	calendarWeekdays: "[data-calendar-weekdays]",
	fileTree: "[data-file-tree]",
	fontFamily: "[data-font-family]",
	fontSizeInput: "[data-font-size]",
	fontSizeValue: "[data-font-size-value]",
	insights: "[data-insights]",
	lineHeightInput: "[data-line-height]",
	lineHeightValue: "[data-line-height-value]",
	focusTimerDuration: "[data-timer-duration]",
	contentWidthInput: "[data-content-width]",
	contentWidthValue: "[data-content-width-value]",
	linktreeList: "[data-linktree-list]",
	metadataList: "[data-metadata-list]",
	outgoingList: "[data-outgoing-list]",
	pageLoadLogo: "[data-page-load-logo]",
	pageLoadMask: "[data-page-load-mask]",
	qrCodeBlock: "[data-qr-code-block]",
	qrCodeImage: "[data-qr-code-image]",
	qrCodeSummary: "[data-qr-code-summary]",
	qrSelectionButton: "[data-action='qr-selection']",
	quickSettings: "[data-quick-settings]",
	searchInput: "[data-search-input]",
	searchResults: "[data-search-results]",
	scrollTopButton: "[data-action='scroll-top']",
	selectionCount: "[data-selection-count]",
	selectionMenu: "[data-selection-menu]",
	selectionSearch: "[data-selection-search]",
	selectionSearchDirect: "[data-selection-search-direct]",
	selectionSearchOptions: "[data-selection-search-options]",
	selectionSearchToggle: "[data-action='toggle-selection-search']",
	selectionSearchToggleCount: "[data-selection-search-count]",
	soundChoice: "[data-sound-choice]",
	sourceArticleLink: "[data-source-article-link]",
	sourceDownloadLink: "[data-source-download-link]",
	sourceRepoLink: "[data-source-repo-link]",
	textOrientation: "[data-text-orientation]",
	themeToggle: "[data-theme-toggle]",
	tocList: "[data-toc-list]",
	navigationStatus: "[data-navigation-status]",
	navigationStatusClose: "[data-action='close-focus-timer']",
	navigationStatusIcon: "[data-navigation-status-icon]",
	navigationStatusMessage: "[data-navigation-status-message]",
	vaultNoteCount: "[data-vault-note-count]",
	vaultSource: "[data-vault-source]",
	vaultSourceIcon: "[data-vault-source-icon]",
	vaultTitle: "[data-vault-title]"
};

/**
 * Selects a single element.
 * @param {string} selector
 * @returns {Element}
 */
function select(selector) {
	return document.querySelector(selector);
}

/**
 * Selects many elements.
 * @param {string} selector
 * @returns {NodeListOf<Element>}
 */
function selectAll(selector) {
	return document.querySelectorAll(selector);
}

/**
 * Boots the application.
 * @async
 * @returns {Promise<void>}
 */
async function init() {
	loadBookmarks();
	bindEvents();
	await loadVault();
}

/**
 * Loads config and the manifest-backed vault index.
 * @async
 * @returns {Promise<void>}
 */
async function loadVault() {
	const loadAnimation = startupAnimation;
	const requestId = state.vaultRequestId + 1;
	state.vaultRequestId = requestId;
	state.vaultLoadController?.abort();
	const loadController = new AbortController();
	state.vaultLoadController = loadController;

	try {
		if (startupConfigError) {
			throw startupConfigError;
		}

		if (!startupConfig) {
			throw new Error("Could not load config/app-config.json");
		}

		state.config = startupConfig;
		renderSelectionSearchProviders();
		loadAppearance();
		applySoundSettings();
		bindCuelume();
		applyReaderSettings();
		applyTheme();
		renderReaderControls();
		renderSoundControls();
		renderThemeToggle();
		renderFocusTimerControls();
		document.title = state.config.title || "Papyrus";
		select(selectors.vaultTitle).textContent = state.config.title || "Papyrus";
		state.noteRequestId += 1;
		noteContentCache.clear();
		noteLoadPromises.clear();
		const manifest = await loadManifest({
			config: state.config,
			signal: loadController.signal
		});

		if (requestId !== state.vaultRequestId) {
			return;
		}

		state.manifest = manifest;
		state.notes = indexManifestNotes({ manifest: state.manifest });
		state.calendarDateIndex = createCalendarDateIndex({ notes: state.notes });
		state.searchMetadataKeys = createSearchMetadataKeyIndex({ notes: state.notes });
		const vaultSource = select(selectors.vaultSource);
		const vaultSourceLabel = getVaultSourceLabel({ config: state.config });
		vaultSource.textContent = vaultSourceLabel;
		vaultSource.setAttribute("title", vaultSourceLabel);
		select(selectors.vaultSourceIcon).className = state.config.github?.enabled
			? "fa-brands fa-github"
			: "fa-solid fa-hard-drive";
		renderAll();
		openRouteFromHash();
		await finishPageLoadAnimation({ loadAnimation });

		if (requestId !== state.vaultRequestId) {
			return;
		}

		const loadSource = getVaultLoadSource({ config: state.config });
		showNavigationStatus({ message: `Loaded ${state.notes.length} notes from ${loadSource}` });
	} catch (error) {
		if (requestId !== state.vaultRequestId || error?.name === "AbortError") {
			return;
		}

		renderError({ error });
		await finishPageLoadAnimation({ loadAnimation });
	} finally {
		if (state.vaultLoadController === loadController) {
			state.vaultLoadController = null;
		}
	}
}

/**
 * Finishes the optional page load animation.
 * @param {object} params
 * @param {object|null} params.loadAnimation
 * @returns {Promise<void>}
 */
async function finishPageLoadAnimation({ loadAnimation }) {
	if (!loadAnimation) {
		dismissStartupAnimation();
		return;
	}

	const elapsedMs = performance.now() - loadAnimation.startedAt;
	const remainingMs = Math.max(0, loadAnimation.durationMs - elapsedMs);

	if (remainingMs) {
		await delay(remainingMs);
	}

	loadAnimation.mask.classList.add("is-dimming");
	await delay(Math.max(0, loadAnimation.fadeMs - 120));
	document.documentElement.classList.remove("is-page-loading");
	loadAnimation.mask.classList.add("is-leaving");
	await delay(160);
	dismissStartupAnimation();
}

/**
 * Waits for a number of milliseconds.
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function delay(milliseconds) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, milliseconds);
	});
}

/**
 * Loads a content manifest from GitHub or the local vault.
 * @async
 * @param {object} params
 * @param {object} params.config
 * @param {AbortSignal} params.signal
 * @returns {Promise<object>}
 */
async function loadManifest({ config, signal }) {
	if (config.github?.enabled) {
		return await loadGithubManifest({ github: config.github, signal });
	}

	if (config.localFallback?.enabled) {
		return await loadLocalManifest({
			manifestPath: config.localFallback.manifest,
			signal
		});
	}

	throw new Error("No content source is enabled.");
}

/**
 * Loads a local content manifest.
 * @async
 * @param {object} params
 * @param {string} params.manifestPath
 * @param {AbortSignal} params.signal
 * @returns {Promise<object>}
 */
async function loadLocalManifest({ manifestPath, signal }) {
	const manifest = await requestJson({
		url: manifestPath,
		label: "Local content manifest",
		cache: "no-cache",
		timeoutMs: manifestRequestTimeoutMs,
		signal
	});
	const validated = validateContentManifest({ manifest, requireRevision: false });
	const manifestDirectory = manifestPath.split("/").slice(0, -1).join("/");
	const contentDirectory = joinUrlPath({ rootPath: manifestDirectory, path: validated.contentRoot || "" });

	return {
		...validated,
		manifestUrl: manifestPath,
		sourceType: "local",
		contentBaseUrl: contentDirectory
	};
}

/**
 * Loads a content manifest from a public GitHub repository.
 * @async
 * @param {object} params
 * @param {object} params.github
 * @param {AbortSignal} params.signal
 * @returns {Promise<object>}
 */
async function loadGithubManifest({ github, signal }) {
	const manifestPath = normalizePath(github.manifestPath || "manifest.json");
	const manifestUrl = getGithubRawContentUrl({ github, path: manifestPath, revision: github.branch });

	if (!manifestUrl) {
		throw new Error("The GitHub content source is missing a repository owner, repository name, branch, or manifest path.");
	}

	const manifest = validateContentManifest({
		manifest: await requestJson({
			url: manifestUrl,
			label: "GitHub content manifest",
			cache: "no-cache",
			timeoutMs: manifestRequestTimeoutMs,
			signal
		}),
		requireRevision: true
	});
	const configuredRootPath = normalizePath(github.rootPath || "");
	const manifestRootPath = normalizePath(manifest.contentRoot || "");

	if (configuredRootPath !== manifestRootPath) {
		throw new Error(`The GitHub rootPath (${configuredRootPath || "repository root"}) does not match the manifest contentRoot (${manifestRootPath || "repository root"}).`);
	}

	return {
		...manifest,
		manifestUrl,
		sourceType: "github",
		contentBaseUrl: ""
	};
}

/**
 * Validates the content manifest contract used by the app.
 * @param {object} params
 * @param {object} params.manifest
 * @param {boolean} params.requireRevision
 * @returns {object}
 */
function validateContentManifest({ manifest, requireRevision }) {
	if (!manifest || manifest.schemaVersion !== contentManifestSchemaVersion || !Array.isArray(manifest.files)) {
		throw new Error(`Unsupported content manifest. Expected schemaVersion ${contentManifestSchemaVersion}.`);
	}

	if (typeof manifest.generatedAt !== "string" || Number.isNaN(Date.parse(manifest.generatedAt))) {
		throw new Error("The content manifest has an invalid generatedAt timestamp.");
	}

	if (typeof manifest.contentRoot !== "string" || manifest.contentRoot.startsWith("/") || hasParentPathSegment(manifest.contentRoot)) {
		throw new Error("The content manifest has an invalid contentRoot.");
	}

	const revision = String(manifest.revision || "").trim();

	if (!revision) {
		throw new Error("The content manifest must include a revision.");
	}

	if (requireRevision && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(revision)) {
		throw new Error("The remote content manifest must include a full repository commit revision.");
	}

	const paths = new Set();

	for (let index = 0; index < manifest.files.length; index += 1) {
		const file = manifest.files[index];
		const path = normalizePath(file?.path || "");

		if (!isValidManifestFileRecord({ file, path })) {
			throw new Error(`Invalid content manifest file record at index ${index}.`);
		}

		if (paths.has(path)) {
			throw new Error(`Duplicate content manifest path: ${path}`);
		}

		paths.add(path);
	}

	validateManifestReferences({ files: manifest.files, paths });
	return manifest;
}

/**
 * Checks the structural fields consumed from one manifest file.
 * @param {object} params
 * @param {object} params.file
 * @param {string} params.path
 * @returns {boolean}
 */
function isValidManifestFileRecord({ file, path }) {
	if (!file
		|| typeof file.path !== "string"
		|| file.path.startsWith("/")
		|| !path
		|| hasParentPathSegment(path)
		|| !isMarkdownPath(path)
		|| typeof file.title !== "string"
		|| !file.title.trim()
		|| !file.metadata
		|| typeof file.metadata !== "object"
		|| Array.isArray(file.metadata)
		|| typeof file.excerpt !== "string"
		|| !isNonNegativeInteger(file.wordCount)
		|| !isNonNegativeInteger(file.characterCount)
		|| !isNonNegativeInteger(file.size)
		|| !/^[a-f0-9]{64}$/i.test(String(file.hash || ""))
		|| !Array.isArray(file.outgoingLinks)
		|| !Array.isArray(file.backlinks)) {
		return false;
	}

	for (let index = 0; index < file.outgoingLinks.length; index += 1) {
		if (!isValidManifestLinkRecord(file.outgoingLinks[index])) {
			return false;
		}
	}

	const backlinks = new Set();

	for (let index = 0; index < file.backlinks.length; index += 1) {
		const authoredBacklink = file.backlinks[index];
		const backlink = typeof authoredBacklink === "string"
			? normalizePath(authoredBacklink)
			: "";

		if (!backlink
			|| authoredBacklink.startsWith("/")
			|| !isMarkdownPath(backlink)
			|| hasParentPathSegment(backlink)
			|| backlinks.has(backlink)) {
			return false;
		}

		backlinks.add(backlink);
	}

	return true;
}

/**
 * Checks one outgoing link record.
 * @param {*} link
 * @returns {boolean}
 */
function isValidManifestLinkRecord(link) {
	if (!link
		|| typeof link !== "object"
		|| !["wiki", "markdown"].includes(link.type)
		|| typeof link.target !== "string"
		|| !link.target.trim()) {
		return false;
	}

	if (link.path === null) {
		return true;
	}

	if (typeof link.path !== "string" || link.path.startsWith("/")) {
		return false;
	}

	const path = normalizePath(link.path);
	return Boolean(path) && isMarkdownPath(path) && !hasParentPathSegment(path);
}

/**
 * Checks that link metadata references records in the same manifest.
 * @param {object} params
 * @param {Array<object>} params.files
 * @param {Set<string>} params.paths
 * @returns {void}
 */
function validateManifestReferences({ files, paths }) {
	for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
		const file = files[fileIndex];

		for (let linkIndex = 0; linkIndex < file.outgoingLinks.length; linkIndex += 1) {
			const linkedPath = file.outgoingLinks[linkIndex].path;

			if (linkedPath && !paths.has(normalizePath(linkedPath))) {
				throw new Error(`Manifest link from ${file.path} references missing path: ${linkedPath}`);
			}
		}

		for (let backlinkIndex = 0; backlinkIndex < file.backlinks.length; backlinkIndex += 1) {
			const backlink = file.backlinks[backlinkIndex];

			if (!paths.has(normalizePath(backlink))) {
				throw new Error(`Manifest backlink for ${file.path} references missing path: ${backlink}`);
			}
		}
	}
}

/**
 * Checks for a non-negative integer.
 * @param {*} value
 * @returns {boolean}
 */
function isNonNegativeInteger(value) {
	return Number.isInteger(value) && value >= 0;
}

/**
 * Checks a manifest path for traversal segments.
 * @param {string} path
 * @returns {boolean}
 */
function hasParentPathSegment(path) {
	return normalizePath(path).split("/").includes("..");
}

/**
 * Creates searchable note records from manifest metadata.
 * @param {object} params
 * @param {object} params.manifest
 * @returns {Array<object>}
 */
function indexManifestNotes({ manifest }) {
	const notes = [];

	for (let index = 0; index < manifest.files.length; index += 1) {
		const file = manifest.files[index];
		const path = normalizePath(file.path);
		const name = getFileName(path);
		const metadata = file.metadata || {};
		const title = String(file.title || metadata.title || removeExtension(name));
		const calendarDates = getNoteCalendarDates({ metadata });

		notes.push({
			...file,
			path,
			name,
			title,
			metadata,
			calendarDates,
			body: "",
			visibleBody: "",
			loaded: false,
			sourceUrl: getManifestNoteSourceUrl({ manifest, path }),
			searchText: `${title} ${path} ${file.excerpt || ""} ${getSearchMetadataText({ metadata })}`.toLowerCase()
		});
	}

	return notes;
}

/**
 * Gets normalized published and updated dates from note metadata.
 * @param {object} params
 * @param {object} params.metadata
 * @returns {{published: string, updated: string}}
 */
function getNoteCalendarDates({ metadata }) {
	return {
		published: normalizeCalendarDateValue({ value: getMetadataValue({ metadata, key: "published" }) }),
		updated: normalizeCalendarDateValue({ value: getMetadataValue({ metadata, key: "updated" }) })
	};
}

/**
 * Extracts a valid authored ISO date without applying timezone conversion.
 * @param {object} params
 * @param {unknown} params.value
 * @returns {string}
 */
function normalizeCalendarDateValue({ value }) {
	const match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
	const dateKey = match ? match[1] : "";

	return isValidCalendarDateKey({ dateKey }) ? dateKey : "";
}

/**
 * Checks whether a calendar date key represents a real date.
 * @param {object} params
 * @param {string} params.dateKey
 * @returns {boolean}
 */
function isValidCalendarDateKey({ dateKey }) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
		return false;
	}

	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));

	return date.getUTCFullYear() === year
		&& date.getUTCMonth() === month - 1
		&& date.getUTCDate() === day;
}

/**
 * Creates a lookup of published and updated counts by calendar date.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {Map<string, {published: number, updated: number}>}
 */
function createCalendarDateIndex({ notes }) {
	const dateIndex = new Map();
	const dateTypes = ["published", "updated"];

	for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
		const note = notes[noteIndex];

		for (let typeIndex = 0; typeIndex < dateTypes.length; typeIndex += 1) {
			const type = dateTypes[typeIndex];
			const dateKey = note.calendarDates[type];

			if (!dateKey) {
				continue;
			}

			const entry = dateIndex.get(dateKey) || { published: 0, updated: 0 };
			entry[type] += 1;
			dateIndex.set(dateKey, entry);
		}
	}

	return dateIndex;
}

/**
 * Creates a case-insensitive index of searchable frontmatter property names.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {Set<string>}
 */
function createSearchMetadataKeyIndex({ notes }) {
	const metadataKeys = new Set();

	for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
		const keys = Object.keys(notes[noteIndex].metadata);

		for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
			metadataKeys.add(keys[keyIndex].toLowerCase());
		}
	}

	return metadataKeys;
}

/**
 * Gets a note source URL from the active manifest source.
 * @param {object} params
 * @param {object} params.manifest
 * @param {string} params.path
 * @returns {string}
 */
function getManifestNoteSourceUrl({ manifest, path }) {
	if (manifest.sourceType === "github") {
		return getGithubCdnUrl({ path, revision: manifest.revision, rootPath: manifest.contentRoot || "" });
	}

	return joinUrlPath({ rootPath: manifest.contentBaseUrl || "", path });
}

/**
 * Joins URL path segments without adding a leading slash.
 * @param {object} params
 * @param {string} params.rootPath
 * @param {string} params.path
 * @returns {string}
 */
function joinUrlPath({ rootPath, path }) {
	const root = String(rootPath || "").replace(/\/$/, "");
	const item = String(path || "").replace(/^\//, "");
	return root && item ? `${root}/${item}` : root || item;
}

/**
 * Binds all UI events.
 * @returns {void}
 */
function bindEvents() {
	const panelButtons = selectAll("[data-panel]");

	for (let index = 0; index < panelButtons.length; index += 1) {
		const button = panelButtons[index];
		button.addEventListener("click", handlePanelButtonClick);
	}

	const secondaryMenuButtons = selectAll("[data-action='toggle-secondary-menu']");

	for (let index = 0; index < secondaryMenuButtons.length; index += 1) {
		secondaryMenuButtons[index].addEventListener("click", toggleSecondaryMenu);
	}

	select("[data-action='open-home']").addEventListener("click", openHome);
	select("[data-action='close-primary-menu']").addEventListener("click", closePrimaryMenu);
	select("[data-action='scroll-top']").addEventListener("click", scrollArticleToTop);
	select("[data-action='toggle-settings']").addEventListener("click", toggleQuickSettings);
	select("[data-action='cycle-focus-timer']").addEventListener("click", cycleFocusTimerDuration);
	select("[data-action='start-focus-timer']").addEventListener("click", startFocusTimer);
	select(selectors.navigationStatusClose).addEventListener("click", closeFocusTimer);
	select("[data-action='refresh']").addEventListener("click", loadVault);
	select("[data-action='open-all-folders']").addEventListener("click", openAllFolders);
	select("[data-action='close-all-folders']").addEventListener("click", closeAllFolders);
	select("[data-action='previous-month']").addEventListener("click", showPreviousMonth);
	select("[data-action='next-month']").addEventListener("click", showNextMonth);
	select("[data-action='current-month']").addEventListener("click", showCurrentMonth);
	select("[data-action='toggle-bookmark']").addEventListener("click", toggleActiveBookmark);
	select("[data-action='clear-bookmarks']").addEventListener("click", clearBookmarks);
	select("[data-action='copy-source-url']").addEventListener("click", copyActiveSourceUrl);
	select("[data-action='copy-published-url']").addEventListener("click", copyActivePublishedUrl);
	select("[data-action='copy-article-content']").addEventListener("click", copyActiveArticleContent);
	select("[data-action='open-obsidian']").addEventListener("click", openActiveArticleInObsidian);
	select("[data-action='copy-selection']").addEventListener("click", copySelectedText);
	select("[data-action='qr-selection']").addEventListener("click", createQrCodeFromSelection);
	select(selectors.selectionMenu).addEventListener("click", handleSelectionMenuClick);
	select(selectors.searchInput).addEventListener("input", handleSearchInput);
	select(selectors.searchInput).addEventListener("keydown", handleSearchKeyDown);
	select(selectors.article).addEventListener("click", handleArticleClick);
	select(selectors.article).addEventListener("error", handleArticleImageError, true);
	select(selectors.article).addEventListener("input", handleArticleInput);
	select(selectors.article).addEventListener("change", handleArticleChange);
	select(selectors.article).addEventListener("scroll", handleArticleScroll, { passive: true });
	select(selectors.fontSizeInput).addEventListener("input", handleFontSizeInput);
	select(selectors.lineHeightInput).addEventListener("input", handleLineHeightInput);
	select(selectors.contentWidthInput).addEventListener("input", handleContentWidthInput);
	select(selectors.tocList).addEventListener("click", handleTocClick);
	window.addEventListener("hashchange", openRouteFromHash);
	window.addEventListener("popstate", openRouteFromHash);
	window.addEventListener("message", handleCodeRunnerMessage);
	document.addEventListener("selectionchange", handleSelectionChange);
	document.addEventListener("pointerdown", handleDocumentPointerDown);
	document.addEventListener("click", handleDocumentClick);
	document.addEventListener("keyup", handleDocumentKeyUp);
	document.addEventListener("keydown", handleDocumentKeyDown);
	window.addEventListener("scroll", handleSelectionMenuScroll, true);
	window.addEventListener("resize", hideSelectionMenu);
	window.addEventListener("resize", scheduleArticleScrollState);
	bindTextOrientationControls();
	bindFontFamilyControls();
	bindThemeControls();
	bindSoundControls();
}

/**
 * Binds text orientation controls.
 * @returns {void}
 */
function bindTextOrientationControls() {
	const controls = selectAll(selectors.textOrientation);

	for (let index = 0; index < controls.length; index += 1) {
		controls[index].addEventListener("change", handleTextOrientationChange);
	}
}

/**
 * Binds content typeface controls.
 * @returns {void}
 */
function bindFontFamilyControls() {
	const controls = selectAll(selectors.fontFamily);

	for (let index = 0; index < controls.length; index += 1) {
		controls[index].addEventListener("change", handleFontFamilyChange);
	}
}

/**
 * Binds theme choice controls.
 * @returns {void}
 */
function bindThemeControls() {
	const controls = selectAll("[data-theme-choice]");

	for (let index = 0; index < controls.length; index += 1) {
		controls[index].addEventListener("click", handleThemeChoice);
	}
}

/**
 * Binds sound preference controls.
 * @returns {void}
 */
function bindSoundControls() {
	const controls = selectAll(selectors.soundChoice);

	for (let index = 0; index < controls.length; index += 1) {
		controls[index].addEventListener("click", handleSoundChoice);
	}
}

/**
 * Adds Cuelume feedback to a dynamic navigation control.
 * @param {object} params
 * @param {HTMLElement} params.element
 * @param {string} params.cue
 * @returns {void}
 */
function addNavigationSound({ element, cue }) {
	element.dataset.cuelumeHover = "tick";
	element.dataset.cuelumeToggle = cue;
}

/**
 * Handles primary panel button clicks.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handlePanelButtonClick(event) {
	setPanel({ panel: event.currentTarget.dataset.panel });
}

/**
 * Renders all sidebar panels.
 * @returns {void}
 */
function renderAll() {
	renderFileTree();
	renderSearch();
	renderCalendar();
	renderBookmarks();
	renderInsights();
	renderLinktree();
	renderPanels();
	renderShell();
}

/**
 * Renders the active panel state.
 * @returns {void}
 */
function renderPanels() {
	const views = selectAll("[data-view]");
	const buttons = selectAll("[data-panel]");
	const homeButton = select("[data-action='open-home']");

	for (let index = 0; index < views.length; index += 1) {
		views[index].classList.toggle("is-active", views[index].dataset.view === state.activePanel);
	}

	for (let index = 0; index < buttons.length; index += 1) {
		const isActive = !state.primaryMenuCollapsed && buttons[index].dataset.panel === state.activePanel;
		buttons[index].classList.toggle("is-active", isActive);
	}

	homeButton.classList.remove("is-active");
}

/**
 * Sets the active utility panel.
 * @param {object} params
 * @param {string} params.panel
 * @returns {void}
 */
function setPanel({ panel }) {
	closeQuickSettings();

	if (!state.primaryMenuCollapsed && state.activePanel === panel) {
		state.primaryMenuCollapsed = true;
		renderPanels();
		renderShell();
		return;
	}

	state.activePanel = panel;
	state.primaryMenuCollapsed = false;
	renderPanels();
	renderShell();

	if (panel === "search") {
		select(selectors.searchInput).focus();
	}
}

/**
 * Closes the primary side menu.
 * @returns {void}
 */
function closePrimaryMenu() {
	state.primaryMenuCollapsed = true;
	renderPanels();
	renderShell();
}

/**
 * Renders the markdown file tree.
 * @returns {void}
 */
function renderFileTree() {
	const tree = createTree({ notes: state.notes });
	const container = select(selectors.fileTree);
	const count = state.notes.length;

	select(selectors.vaultNoteCount).textContent = `${formatNumber(count)} ${count === 1 ? "note" : "notes"}`;
	container.replaceChildren(renderTreeNode({ node: tree, depth: 0, path: "" }));
}

/**
 * Filters notes using indexed text and structured frontmatter filters.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @param {{frontmatterFilters: Array<object>, textQuery: string}} params.searchQuery
 * @returns {Array<object>}
 */
function filterNotesBySearchQuery({ notes, searchQuery }) {
	const filtered = [];

	for (let index = 0; index < notes.length; index += 1) {
		const note = notes[index];

		if (searchQuery.textQuery && !note.searchText.includes(searchQuery.textQuery)) {
			continue;
		}

		if (!matchesFrontmatterFilters({ note, frontmatterFilters: searchQuery.frontmatterFilters })) {
			continue;
		}

		filtered.push(note);
	}

	return filtered;
}

/**
 * Parses recognized frontmatter property filters from a search query.
 * @param {object} params
 * @param {string} params.query
 * @param {Set<string>} params.metadataKeys
 * @returns {{frontmatterFilters: Array<{field: string, value: string}>, textQuery: string}}
 */
function parseSearchQuery({ query, metadataKeys }) {
	const frontmatterFilters = [];
	const textQuery = query.replace(
		/(^|\s)([a-z0-9_-]+):(?:"([^"]+)"|'([^']+)'|([^\s]+))(?=\s|$)/g,
		function extractFrontmatterFilter(match, prefix, field, doubleQuotedValue, singleQuotedValue, bareValue) {
			if (!metadataKeys.has(field)) {
				return match;
			}

			const value = doubleQuotedValue || singleQuotedValue || bareValue;
			frontmatterFilters.push({ field, value });
			return prefix;
		}
	).replace(/\s+/g, " ").trim();

	return { frontmatterFilters, textQuery };
}

/**
 * Checks whether a note satisfies every structured frontmatter filter.
 * @param {object} params
 * @param {object} params.note
 * @param {Array<{field: string, value: string}>} params.frontmatterFilters
 * @returns {boolean}
 */
function matchesFrontmatterFilters({ note, frontmatterFilters }) {
	for (let index = 0; index < frontmatterFilters.length; index += 1) {
		const filter = frontmatterFilters[index];
		const entry = getMetadataEntry({ metadata: note.metadata, key: filter.field });

		if (!entry.found || !matchesFrontmatterValue({ value: entry.value, query: filter.value })) {
			return false;
		}
	}

	return true;
}

/**
 * Gets a raw metadata entry case-insensitively without flattening its value.
 * @param {object} params
 * @param {object} params.metadata
 * @param {string} params.key
 * @returns {{found: boolean, value: *}}
 */
function getMetadataEntry({ metadata, key }) {
	const keys = Object.keys(metadata);

	for (let index = 0; index < keys.length; index += 1) {
		if (keys[index].toLowerCase() === key.toLowerCase()) {
			return { found: true, value: metadata[keys[index]] };
		}
	}

	return { found: false, value: undefined };
}

/**
 * Matches a filter using the frontmatter value's original shape.
 * @param {object} params
 * @param {*} params.value
 * @param {string} params.query
 * @returns {boolean}
 */
function matchesFrontmatterValue({ value, query }) {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			if (matchesFrontmatterValue({ value: value[index], query })) {
				return true;
			}
		}

		return false;
	}

	if (typeof value === "string") {
		return value.toLowerCase().includes(query);
	}

	if (typeof value === "boolean") {
		return query === String(value);
	}

	if (typeof value === "number") {
		return /^-?\d+(?:\.\d+)?$/.test(query) && Number(query) === value;
	}

	if (value === null) {
		return query === "null";
	}

	return false;
}

/**
 * Renders a tree node.
 * @param {object} params
 * @param {object} params.node
 * @param {number} params.depth
 * @param {string} params.path
 * @returns {DocumentFragment|HTMLElement}
 */
function renderTreeNode({ node, depth, path }) {
	const fragment = document.createDocumentFragment();
	const folderNames = Object.keys(node.children).sort();

	for (let index = 0; index < folderNames.length; index += 1) {
		const folderName = folderNames[index];
		const folderPath = path ? `${path}/${folderName}` : folderName;
		const expanded = isFolderExpanded({ path: folderPath });
		const group = document.createElement("div");
		const button = document.createElement("button");
		const children = document.createElement("div");

		group.className = "tree-group";
		group.classList.toggle("is-collapsed", !expanded);
		button.className = "tree-folder";
		button.type = "button";
		button.dataset.path = folderPath;
		addNavigationSound({ element: button, cue: "toggle" });
		button.setAttribute("aria-expanded", String(expanded));
		button.innerHTML = `
			<i class="fa-solid fa-caret-${expanded ? "down" : "right"} tree-caret" aria-hidden="true"></i>
			<i class="fa-${expanded ? "regular fa-folder-open" : "solid fa-folder"} tree-folder-icon" aria-hidden="true"></i>
			<span>${escapeHtml(folderName)}</span>
		`;
		button.addEventListener("click", handleFolderButtonClick);
		children.className = "tree-children";
		children.append(renderTreeNode({
			node: node.children[folderName],
			depth: depth + 1,
			path: folderPath
		}));
		group.append(button, children);
		fragment.append(group);
	}

	for (let index = 0; index < node.notes.length; index += 1) {
		fragment.append(createNoteButton({ note: node.notes[index] }));
	}

	return fragment;
}

/**
 * Handles folder expand and collapse.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleFolderButtonClick(event) {
	toggleFolder({ path: event.currentTarget.dataset.path });
}

/**
 * Toggles a folder path.
 * @param {object} params
 * @param {string} params.path
 * @returns {void}
 */
function toggleFolder({ path }) {
	state.folderState[path] = !isFolderExpanded({ path });
	renderFileTree();
}

/**
 * Opens every folder in the file tree.
 * @returns {void}
 */
function openAllFolders() {
	const folderButtons = selectAll(".tree-folder");

	for (let index = 0; index < folderButtons.length; index += 1) {
		state.folderState[folderButtons[index].dataset.path] = true;
	}

	renderFileTree();
}

/**
 * Closes every folder in the file tree.
 * @returns {void}
 */
function closeAllFolders() {
	state.folderState = {};
	renderFileTree();
}

/**
 * Checks folder expansion state.
 * @param {object} params
 * @param {string} params.path
 * @returns {boolean}
 */
function isFolderExpanded({ path }) {
	return state.folderState[path] === true;
}

/**
 * Creates a note tree button.
 * @param {object} params
 * @param {object} params.note
 * @returns {HTMLButtonElement}
 */
function createNoteButton({ note }) {
	const button = document.createElement("button");
	button.className = "note-link";
	button.type = "button";
	button.dataset.path = note.path;
	addNavigationSound({ element: button, cue: "page" });
	button.classList.toggle("is-active", note.path === state.activePath);
	button.innerHTML = `
		<span class="note-link-title">${escapeHtml(note.title)}</span>
		<span class="note-link-path">${escapeHtml(note.path)}</span>
	`;
	button.addEventListener("click", handleNoteButtonClick);
	return button;
}

/**
 * Opens a note from a button data path.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleNoteButtonClick(event) {
	openNote({ path: event.currentTarget.dataset.path });
}

/**
 * Renders bookmarked notes.
 * @returns {void}
 */
function renderBookmarks() {
	const container = select(selectors.bookmarksList);
	const notes = getBookmarkedNotes();

	container.replaceChildren();

	if (!notes.length) {
		container.innerHTML = `<p class="bookmarks-message">No bookmarked notes yet.</p>`;
		return;
	}

	for (let index = 0; index < notes.length; index += 1) {
		container.append(createNoteButton({ note: notes[index] }));
	}
}

/**
 * Gets bookmarked notes that still exist in the loaded vault.
 * @returns {Array<object>}
 */
function getBookmarkedNotes() {
	const notes = [];

	for (let index = 0; index < state.bookmarks.length; index += 1) {
		const note = findNoteByPath({ path: state.bookmarks[index] });

		if (note) {
			notes.push(note);
		}
	}

	return notes;
}

/**
 * Renders the configured Linktree profile, groups, and cards.
 * @returns {void}
 */
function renderLinktree() {
	const container = select(selectors.linktreeList);
	const config = state.config.linktree || {};
	const groups = Array.isArray(config.groups) ? config.groups : [];
	const fragment = document.createDocumentFragment();

	window.clearInterval(state.linktreeClockInterval);
	state.linktreeClockInterval = 0;
	container.replaceChildren();

	if (config.title || config.subtitle) {
		fragment.append(createLinktreeIntro({ config }));
	}

	for (let index = 0; index < groups.length; index += 1) {
		const group = createLinktreeGroup({ group: groups[index] });

		if (group) {
			fragment.append(group);
		}
	}

	container.append(fragment);

	if (!container.querySelector(".linktree-card")) {
		const message = document.createElement("p");
		message.className = "muted linktree-empty";
		message.textContent = "No cards configured.";
		container.append(message);
		return;
	}

	startLinktreeClocks();
}

/**
 * Creates the optional Linktree profile introduction.
 * @param {object} params
 * @param {object} params.config
 * @returns {HTMLElement}
 */
function createLinktreeIntro({ config }) {
	const intro = document.createElement("header");
	const title = String(config.title || "").trim();
	const subtitle = String(config.subtitle || "").trim();

	intro.className = "linktree-intro";
	intro.innerHTML = `
		${title ? `<h2>${escapeHtml(title)}</h2>` : ""}
		${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
	`;

	return intro;
}

/**
 * Creates a titled or untitled Linktree card group.
 * @param {object} params
 * @param {object} params.group
 * @returns {HTMLElement|null}
 */
function createLinktreeGroup({ group }) {
	const cards = Array.isArray(group.cards) ? group.cards : [];
	const section = document.createElement("section");
	const cardList = document.createElement("div");
	const title = String(group.title || "").trim();

	if (!cards.length) {
		return null;
	}

	section.className = title ? "linktree-group" : "linktree-group is-untitled";
	cardList.className = "linktree-cards";

	if (title) {
		const heading = document.createElement("h3");
		heading.textContent = title;
		section.append(heading);
	}

	for (let index = 0; index < cards.length; index += 1) {
		const card = createLinktreeCard({ card: cards[index] });

		if (card) {
			cardList.append(card);
		}
	}

	if (!cardList.childElementCount) {
		return null;
	}

	section.append(cardList);
	return section;
}

/**
 * Creates a configured Linktree card.
 * @param {object} params
 * @param {object} params.card
 * @returns {HTMLElement|null}
 */
function createLinktreeCard({ card }) {
	if (card.timeZone) {
		return createLinktreeClock({ clock: card });
	}

	if (card.url) {
		return createLinktreeLink({ link: card });
	}

	return null;
}

/**
 * Creates a Linktree link with a domain-derived service icon.
 * @param {object} params
 * @param {object} params.link
 * @returns {HTMLAnchorElement}
 */
function createLinktreeLink({ link }) {
	const anchor = document.createElement("a");
	const label = String(link.label || "Link").trim() || "Link";
	const description = String(link.description || "").trim();
	const href = getLinktreeHref({ url: String(link.url || "") });
	const service = getLinktreeService({ href });
	const icon = getLinktreeCardIcon({ icon: link.icon, fallback: service.icon });

	anchor.className = "linktree-card linktree-link";
	anchor.dataset.service = service.id;
	anchor.href = getExternalLinkHref({ href });
	anchor.target = "_blank";
	anchor.rel = "noreferrer";
	anchor.setAttribute("aria-label", `${label} (opens in a new tab)`);
	anchor.innerHTML = `
		<span class="linktree-card-icon" aria-hidden="true"><i class="${escapeAttribute(icon)}"></i></span>
		<span class="linktree-card-copy">
			<strong>${escapeHtml(label)}</strong>
			${description ? `<span>${escapeHtml(description)}</span>` : ""}
		</span>
		<i class="fa-solid fa-arrow-up-right-from-square linktree-external-icon" aria-hidden="true"></i>
	`;

	return anchor;
}

/**
 * Creates a ticking clock card for an IANA timezone.
 * @param {object} params
 * @param {object} params.clock
 * @returns {HTMLElement}
 */
function createLinktreeClock({ clock }) {
	const card = document.createElement("div");
	const label = String(clock.label || "").trim();
	const timeZone = String(clock.timeZone || "").trim();
	const icon = getLinktreeCardIcon({ icon: clock.icon, fallback: "fa-regular fa-clock" });

	card.className = "linktree-card linktree-clock";
	card.dataset.linktreeClock = "";
	card.dataset.timeZone = timeZone;
	card.setAttribute("role", "timer");
	card.setAttribute("aria-label", label ? `Current time in ${label}` : `Current time in ${timeZone}`);
	card.innerHTML = `
		<span class="linktree-card-icon" aria-hidden="true"><i class="${escapeAttribute(icon)}"></i></span>
		<span class="linktree-card-copy">
			<time data-linktree-clock-time>--:--:--</time>
			${label ? `<span>${escapeHtml(label)}</span>` : ""}
		</span>
	`;

	return card;
}

/**
 * Gets a configured Font Awesome icon or its automatic fallback.
 * @param {object} params
 * @param {unknown} params.icon
 * @param {string} params.fallback
 * @returns {string}
 */
function getLinktreeCardIcon({ icon, fallback }) {
	return String(icon || "").trim() || fallback;
}

/**
 * Starts the Linktree clock updates when clock cards are present.
 * @returns {void}
 */
function startLinktreeClocks() {
	const clocks = selectAll("[data-linktree-clock]");

	if (!clocks.length) {
		return;
	}

	updateLinktreeClocks();
	state.linktreeClockInterval = window.setInterval(updateLinktreeClocks, 1000);
}

/**
 * Updates all rendered Linktree clocks.
 * @returns {void}
 */
function updateLinktreeClocks() {
	const clocks = selectAll("[data-linktree-clock]");
	const formatters = new Map();
	const now = new Date();

	for (let index = 0; index < clocks.length; index += 1) {
		const clock = clocks[index];
		const time = clock.querySelector("[data-linktree-clock-time]");
		const timeZone = clock.dataset.timeZone || "";

		try {
			if (!formatters.has(timeZone)) {
				formatters.set(timeZone, new Intl.DateTimeFormat(undefined, {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					timeZone
				}));
			}

			time.textContent = formatters.get(timeZone).format(now);
			time.dateTime = now.toISOString();
			clock.classList.remove("is-invalid");
		} catch (error) {
			time.textContent = "Invalid timezone";
			clock.classList.add("is-invalid");
		}
	}
}

/**
 * Normalizes plain email addresses to mailto links.
 * @param {object} params
 * @param {string} params.url
 * @returns {string}
 */
function getLinktreeHref({ url }) {
	const href = url.trim();
	const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href);

	return isEmail ? `mailto:${href}` : href;
}

/**
 * Gets a service ID and Font Awesome icon from a link destination.
 * @param {object} params
 * @param {string} params.href
 * @returns {{id: string, icon: string}}
 */
function getLinktreeService({ href }) {
	if (href.toLowerCase().startsWith("mailto:")) {
		return { id: "email", icon: "fa-regular fa-envelope" };
	}

	try {
		const hostname = new URL(href, window.location.href).hostname.toLowerCase().replace(/^www\./, "");

		for (let serviceIndex = 0; serviceIndex < linktreeServices.length; serviceIndex += 1) {
			const service = linktreeServices[serviceIndex];

			for (let domainIndex = 0; domainIndex < service.domains.length; domainIndex += 1) {
				const domain = service.domains[domainIndex];

				if (hostname === domain || hostname.endsWith(`.${domain}`)) {
					return { id: service.id, icon: service.icon };
				}
			}
		}
	} catch (error) {
		return { id: "neutral", icon: "fa-solid fa-link" };
	}

	return { id: "neutral", icon: "fa-solid fa-link" };
}

/**
 * Builds a folder tree object.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {object}
 */
function createTree({ notes }) {
	const root = { children: {}, notes: [] };

	for (let index = 0; index < notes.length; index += 1) {
		const note = notes[index];
		const parts = note.path.split("/");
		let node = root;

		for (let partIndex = 0; partIndex < parts.length - 1; partIndex += 1) {
			const part = parts[partIndex];

			if (!node.children[part]) {
				node.children[part] = { children: {}, notes: [] };
			}

			node = node.children[part];
		}

		node.notes.push(note);
	}

	return root;
}

/**
 * Renders search results.
 * @returns {void}
 */
function renderSearch() {
	const input = select(selectors.searchInput);
	const query = input.value.trim().toLowerCase();
	const searchQuery = parseSearchQuery({ query, metadataKeys: state.searchMetadataKeys });
	const container = select(selectors.searchResults);
	const results = query ? filterNotesBySearchQuery({ notes: state.notes, searchQuery }).slice(0, 40) : [];
	const hasResults = results.length > 0;

	input.setAttribute("aria-expanded", String(hasResults));

	if (!query) {
		state.searchResultIndex = -1;
		input.removeAttribute("aria-activedescendant");
		container.innerHTML = `<p class="search-message">Search all note data, or scope frontmatter with <code>tags:value</code>.</p>`;
		return;
	}

	if (!results.length) {
		state.searchResultIndex = -1;
		input.removeAttribute("aria-activedescendant");
		container.innerHTML = `<p class="search-message">No matching notes.</p>`;
		return;
	}

	state.searchResultIndex = Math.min(Math.max(state.searchResultIndex, 0), results.length - 1);
	container.replaceChildren();

	for (let index = 0; index < results.length; index += 1) {
		container.append(createResultButton({
			note: results[index],
			query: searchQuery.textQuery,
			index,
			showCalendarDates: shouldShowCalendarDates({ searchQuery })
		}));
	}

	renderSearchResultSelection();
}

/**
 * Checks whether search results should expose their calendar metadata.
 * @param {object} params
 * @param {{frontmatterFilters: Array<object>, textQuery: string}} params.searchQuery
 * @returns {boolean}
 */
function shouldShowCalendarDates({ searchQuery }) {
	if (isValidCalendarDateKey({ dateKey: searchQuery.textQuery })) {
		return true;
	}

	for (let index = 0; index < searchQuery.frontmatterFilters.length; index += 1) {
		const field = searchQuery.frontmatterFilters[index].field;

		if (field === "published" || field === "updated") {
			return true;
		}
	}

	return false;
}

/**
 * Resets selection when the search query changes.
 * @returns {void}
 */
function handleSearchInput() {
	state.searchResultIndex = 0;
	renderSearch();
}

/**
 * Handles search-result navigation without moving focus from the query input.
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleSearchKeyDown(event) {
	const buttons = selectAll(".result-button");

	if (!buttons.length) {
		return;
	}

	if (event.key === "ArrowDown" || event.key === "ArrowUp") {
		const direction = event.key === "ArrowDown" ? 1 : -1;
		event.preventDefault();
		state.searchResultIndex = (state.searchResultIndex + direction + buttons.length) % buttons.length;
		renderSearchResultSelection();
		buttons[state.searchResultIndex].scrollIntoView({ block: "nearest" });
		return;
	}

	if (event.key === "Enter" && state.searchResultIndex >= 0) {
		event.preventDefault();
		openNote({ path: buttons[state.searchResultIndex].dataset.path });
	}
}

/**
 * Updates the visible and accessible active search result.
 * @returns {void}
 */
function renderSearchResultSelection() {
	const input = select(selectors.searchInput);
	const buttons = selectAll(".result-button");

	for (let index = 0; index < buttons.length; index += 1) {
		const isSelected = index === state.searchResultIndex;
		buttons[index].classList.toggle("is-selected", isSelected);
		buttons[index].setAttribute("aria-selected", String(isSelected));
	}

	if (buttons[state.searchResultIndex]) {
		input.setAttribute("aria-activedescendant", buttons[state.searchResultIndex].id);
	} else {
		input.removeAttribute("aria-activedescendant");
	}
}

/**
 * Renders the monthly calendar panel.
 * @returns {void}
 */
function renderCalendar() {
	const firstDayOfWeek = getFirstDayOfWeek();
	const monthDate = state.calendarDate;
	const today = new Date();
	const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
	const leadingDays = getLeadingCalendarDays({ day: monthStart.getDay(), firstDayOfWeek });
	const calendarWeekCount = Math.ceil((leadingDays + daysInMonth) / 7);
	const weekdays = getWeekdayLabels({ firstDayOfWeek });
	const titleFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
	const title = select(selectors.calendarTitle);
	const weekdayContainer = select(selectors.calendarWeekdays);
	const dayContainer = select(selectors.calendarDays);

	title.textContent = titleFormatter.format(monthStart);
	weekdayContainer.replaceChildren();
	dayContainer.replaceChildren();

	const weekHeading = document.createElement("span");
	weekHeading.className = "calendar-week-heading";
	weekHeading.textContent = "Wk";
	weekdayContainer.append(weekHeading);

	for (let index = 0; index < weekdays.length; index += 1) {
		const weekday = document.createElement("span");
		weekday.textContent = weekdays[index];
		weekdayContainer.append(weekday);
	}

	for (let weekIndex = 0; weekIndex < calendarWeekCount; weekIndex += 1) {
		const firstDayInRow = 1 - leadingDays + (weekIndex * 7);
		const weekStartDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), firstDayInRow);

		dayContainer.append(createCalendarWeekNumber({ weekStartDate, firstDayOfWeek }));

		for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
			const day = firstDayInRow + dayIndex;

			if (day < 1 || day > daysInMonth) {
				dayContainer.append(createCalendarSpacer());
				continue;
			}

			dayContainer.append(createCalendarDay({ day, monthDate, today }));
		}
	}
}

/**
 * Creates an ISO week-number label for a displayed calendar row.
 * @param {object} params
 * @param {Date} params.weekStartDate
 * @param {number} params.firstDayOfWeek
 * @returns {HTMLSpanElement}
 */
function createCalendarWeekNumber({ weekStartDate, firstDayOfWeek }) {
	const mondayOffset = (1 - firstDayOfWeek + 7) % 7;
	const monday = new Date(
		weekStartDate.getFullYear(),
		weekStartDate.getMonth(),
		weekStartDate.getDate() + mondayOffset
	);
	const weekNumber = getIsoWeekNumber({ date: monday });
	const label = document.createElement("span");

	label.className = "calendar-week-number";
	label.textContent = String(weekNumber);
	label.setAttribute("aria-label", `Week ${weekNumber}`);
	label.title = `Week ${weekNumber}`;
	return label;
}

/**
 * Gets the ISO 8601 week number for a date.
 * @param {object} params
 * @param {Date} params.date
 * @returns {number}
 */
function getIsoWeekNumber({ date }) {
	const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const isoWeekday = utcDate.getUTCDay() || 7;

	utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoWeekday);

	const isoYearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
	return Math.ceil((((utcDate.getTime() - isoYearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Creates an empty calendar spacer.
 * @returns {HTMLSpanElement}
 */
function createCalendarSpacer() {
	const spacer = document.createElement("span");
	spacer.className = "calendar-day is-empty";
	spacer.setAttribute("aria-hidden", "true");
	return spacer;
}

/**
 * Creates a calendar day element.
 * @param {object} params
 * @param {number} params.day
 * @param {Date} params.monthDate
 * @param {Date} params.today
 * @returns {HTMLButtonElement}
 */
function createCalendarDay({ day, monthDate, today }) {
	const button = document.createElement("button");
	const isToday = today.getFullYear() === monthDate.getFullYear()
		&& today.getMonth() === monthDate.getMonth()
		&& today.getDate() === day;
	const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
	const dateKey = formatCalendarDateKey({ date });
	const dateEntry = state.calendarDateIndex.get(dateKey);
	const labelFormatter = new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric"
	});

	button.className = "calendar-day";
	button.classList.toggle("is-today", isToday);
	button.type = "button";
	button.disabled = !dateEntry;
	button.dataset.date = dateKey;
	button.append(createCalendarDayNumber({ day }));
	button.setAttribute("aria-label", getCalendarDayLabel({
		dateLabel: labelFormatter.format(date),
		dateEntry
	}));

	if (isToday) {
		button.setAttribute("aria-current", "date");
	}

	if (dateEntry) {
		button.classList.add("has-calendar-notes");
		button.classList.toggle("has-published", dateEntry.published > 0);
		button.classList.toggle("has-updated", dateEntry.updated > 0);
		button.title = getCalendarDateActivityLabel({ dateEntry });
		button.append(createCalendarDateMarkers({ dateEntry }));
		addNavigationSound({ element: button, cue: "toggle" });
		button.addEventListener("click", handleCalendarDayClick);
	}

	return button;
}

/**
 * Creates the visible day number inside a calendar button.
 * @param {object} params
 * @param {number} params.day
 * @returns {HTMLSpanElement}
 */
function createCalendarDayNumber({ day }) {
	const dayNumber = document.createElement("span");

	dayNumber.className = "calendar-day-number";
	dayNumber.textContent = String(day);
	return dayNumber;
}

/**
 * Creates published and updated marker dots for a calendar date.
 * @param {object} params
 * @param {{published: number, updated: number}} params.dateEntry
 * @returns {HTMLSpanElement}
 */
function createCalendarDateMarkers({ dateEntry }) {
	const markers = document.createElement("span");
	const markerTypes = ["published", "updated"];

	markers.className = "calendar-date-markers";
	markers.setAttribute("aria-hidden", "true");

	for (let index = 0; index < markerTypes.length; index += 1) {
		const type = markerTypes[index];

		if (!dateEntry[type]) {
			continue;
		}

		const marker = document.createElement("span");
		marker.className = `calendar-date-marker is-${type}`;
		markers.append(marker);
	}

	return markers;
}

/**
 * Formats a local calendar date as YYYY-MM-DD.
 * @param {object} params
 * @param {Date} params.date
 * @returns {string}
 */
function formatCalendarDateKey({ date }) {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

/**
 * Gets an accessible label for a calendar date.
 * @param {object} params
 * @param {string} params.dateLabel
 * @param {{published: number, updated: number}|undefined} params.dateEntry
 * @returns {string}
 */
function getCalendarDayLabel({ dateLabel, dateEntry }) {
	return dateEntry ? `${dateLabel}; ${getCalendarDateActivityLabel({ dateEntry })}` : dateLabel;
}

/**
 * Describes the published and updated activity on a date.
 * @param {object} params
 * @param {{published: number, updated: number}} params.dateEntry
 * @returns {string}
 */
function getCalendarDateActivityLabel({ dateEntry }) {
	const labels = [];

	if (dateEntry.published) {
		labels.push(`${dateEntry.published} published`);
	}

	if (dateEntry.updated) {
		labels.push(`${dateEntry.updated} updated`);
	}

	return labels.join(", ");
}

/**
 * Searches for every article published or updated on a calendar date.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleCalendarDayClick(event) {
	const dateKey = event.currentTarget.dataset.date;
	const input = select(selectors.searchInput);
	const results = select(selectors.searchResults);

	input.value = dateKey;
	state.searchResultIndex = 0;
	renderSearch();
	results.scrollTop = 0;
	input.focus();
}

/**
 * Gets localized weekday labels for the configured week start.
 * @param {object} params
 * @param {number} params.firstDayOfWeek
 * @returns {Array<string>}
 */
function getWeekdayLabels({ firstDayOfWeek }) {
	const formatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
	const labels = [];

	for (let index = 0; index < 7; index += 1) {
		const day = (firstDayOfWeek + index) % 7;
		const date = new Date(2024, 0, 7 + day);
		labels.push(formatter.format(date));
	}

	return labels;
}

/**
 * Gets the blank cells before the first day.
 * @param {object} params
 * @param {number} params.day
 * @param {number} params.firstDayOfWeek
 * @returns {number}
 */
function getLeadingCalendarDays({ day, firstDayOfWeek }) {
	return (day - firstDayOfWeek + 7) % 7;
}

/**
 * Gets the configured first day of week.
 * @returns {number}
 */
function getFirstDayOfWeek() {
	const configured = Number(state.config.appearance?.firstDayOfWeek);

	if (Number.isInteger(configured) && configured >= 0 && configured <= 6) {
		return configured;
	}

	return 1;
}

/**
 * Moves the calendar to the previous month.
 * @returns {void}
 */
function showPreviousMonth() {
	state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
	renderCalendar();
}

/**
 * Moves the calendar to the next month.
 * @returns {void}
 */
function showNextMonth() {
	state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
	renderCalendar();
}

/**
 * Moves the calendar to the current month.
 * @returns {void}
 */
function showCurrentMonth() {
	const today = new Date();
	state.calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
	renderCalendar();
}

/**
 * Creates a search result button.
 * @param {object} params
 * @param {object} params.note
 * @param {string} params.query
 * @param {number} params.index
 * @param {boolean} params.showCalendarDates
 * @returns {HTMLButtonElement}
 */
function createResultButton({ note, query, index, showCalendarDates }) {
	const button = document.createElement("button");
	const calendarMetadata = showCalendarDates ? createResultCalendarMetadata({ note }) : "";
	button.className = "result-button";
	button.type = "button";
	button.id = `vault-search-result-${index}`;
	button.setAttribute("role", "option");
	button.innerHTML = `
		<span class="result-title">${escapeHtml(note.title)}</span>
		<span class="result-path">${escapeHtml(note.path)}</span>
		${calendarMetadata}
		<span class="result-excerpt">${escapeHtml(getExcerpt({ text: note.excerpt || "", query }))}</span>
	`;
	button.dataset.path = note.path;
	addNavigationSound({ element: button, cue: "page" });
	button.addEventListener("click", handleSearchResultButtonClick);
	return button;
}

/**
 * Creates normalized calendar metadata for a date-search result.
 * @param {object} params
 * @param {object} params.note
 * @returns {string}
 */
function createResultCalendarMetadata({ note }) {
	const labels = [];

	if (note.calendarDates.published) {
		labels.push(`Published ${note.calendarDates.published}`);
	}

	if (note.calendarDates.updated) {
		labels.push(`Updated ${note.calendarDates.updated}`);
	}

	return labels.length
		? `<span class="result-calendar-metadata">${escapeHtml(labels.join(" · "))}</span>`
		: "";
}

/**
 * Opens a search result and restores focus to the query input.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleSearchResultButtonClick(event) {
	openNote({ path: event.currentTarget.dataset.path });
	select(selectors.searchInput).focus();
}

/**
 * Renders a compact vault overview from manifest metadata.
 * @returns {void}
 */
function renderInsights() {
	const container = select(selectors.insights);
	container.replaceChildren();

	if (!state.notes.length) {
		container.innerHTML = `<p class="muted">No notes loaded.</p>`;
		return;
	}

	const insights = createVaultInsights({ notes: state.notes });
	const header = document.createElement("header");
	header.className = "insights-header";
	header.innerHTML = `
		<h2>Insights</h2>
		<p>A quick look at this vault.</p>
	`;

	const metrics = createInsightMetrics({ metrics: insights.metrics });
	const standouts = createInsightStandouts({ standouts: insights.standouts });
	container.append(header, metrics, standouts);
}

/**
 * Creates aggregate vault metrics and ranked note highlights.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {{metrics: Array<object>, standouts: Array<object>}}
 */
function createVaultInsights({ notes }) {
	const notePaths = new Set();
	let totalWords = 0;

	for (let index = 0; index < notes.length; index += 1) {
		notePaths.add(normalizePath(notes[index].path));
		totalWords += Number(notes[index].wordCount || 0);
	}

	const readingMinutes = estimateReadingMinutes({ wordCount: totalWords });
	const metrics = [
		{ label: "Notes", value: formatNumber(notes.length) },
		{ label: "Folders", value: formatNumber(countVaultFolders({ notes })) },
		{ label: "Words", value: formatNumber(totalWords) },
		{ label: "Read time", value: formatVaultReadingTime({ minutes: readingMinutes }) },
		{ label: "Links", value: formatNumber(countResolvedVaultLinks({ notes, notePaths })) },
		{ label: "Tags", value: formatNumber(countVaultTags({ notes })) }
	];

	return {
		metrics,
		standouts: rankVaultStandouts({ notes, notePaths })
	};
}

/**
 * Creates the insight metric grid.
 * @param {object} params
 * @param {Array<object>} params.metrics
 * @returns {HTMLDListElement}
 */
function createInsightMetrics({ metrics }) {
	const list = document.createElement("dl");
	list.className = "insights-metrics";

	for (let index = 0; index < metrics.length; index += 1) {
		const item = document.createElement("div");
		item.className = "insights-metric";
		item.innerHTML = `
			<dt>${escapeHtml(metrics[index].label)}</dt>
			<dd>${escapeHtml(metrics[index].value)}</dd>
		`;
		list.append(item);
	}

	return list;
}

/**
 * Creates the clickable standout-note section.
 * @param {object} params
 * @param {Array<object>} params.standouts
 * @returns {HTMLElement}
 */
function createInsightStandouts({ standouts }) {
	const section = document.createElement("section");
	section.className = "insights-standouts";
	section.innerHTML = `<h3>Standout notes</h3>`;

	for (let index = 0; index < standouts.length; index += 1) {
		section.append(createInsightNoteButton({ standout: standouts[index] }));
	}

	return section;
}

/**
 * Creates a note button for one ranked insight.
 * @param {object} params
 * @param {object} params.standout
 * @returns {HTMLButtonElement}
 */
function createInsightNoteButton({ standout }) {
	const button = document.createElement("button");
	button.className = "insights-note";
	button.type = "button";
	button.dataset.path = standout.note.path;
	button.setAttribute("aria-label", `${standout.label}: ${standout.note.title}, ${standout.value}`);
	button.innerHTML = `
		<span class="insights-note-icon"><i class="${escapeHtml(standout.icon)}" aria-hidden="true"></i></span>
		<span class="insights-note-copy">
			<span class="insights-note-label">${escapeHtml(standout.label)}</span>
			<span class="insights-note-title">${escapeHtml(standout.note.title)}</span>
		</span>
		<span class="insights-note-value">${escapeHtml(standout.value)}</span>
	`;
	addNavigationSound({ element: button, cue: "page" });
	button.addEventListener("click", handleNoteButtonClick);
	return button;
}

/**
 * Counts every unique folder path represented by the vault.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {number}
 */
function countVaultFolders({ notes }) {
	const folders = new Set();

	for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
		const parts = normalizePath(notes[noteIndex].path).split("/").slice(0, -1);
		let folderPath = "";

		for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
			folderPath = folderPath ? `${folderPath}/${parts[partIndex]}` : parts[partIndex];

			if (folderPath) {
				folders.add(folderPath);
			}
		}
	}

	return folders.size;
}

/**
 * Counts unique resolved outgoing-note relationships.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @param {Set<string>} params.notePaths
 * @returns {number}
 */
function countResolvedVaultLinks({ notes, notePaths }) {
	let count = 0;

	for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
		const targets = getResolvedOutgoingPaths({ note: notes[noteIndex], notePaths });
		count += targets.size;
	}

	return count;
}

/**
 * Counts unique tags across supported string and array metadata values.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @returns {number}
 */
function countVaultTags({ notes }) {
	const tags = new Set();

	for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
		const value = getMetadataValue({ metadata: notes[noteIndex].metadata, key: "tags" });
		const noteTags = value.split(",");

		for (let tagIndex = 0; tagIndex < noteTags.length; tagIndex += 1) {
			const tag = noteTags[tagIndex].trim().replace(/^#/, "").toLowerCase();

			if (tag) {
				tags.add(tag);
			}
		}
	}

	return tags.size;
}

/**
 * Creates a normalized set of resolved outgoing note paths.
 * @param {object} params
 * @param {object} params.note
 * @param {Set<string>} params.notePaths
 * @returns {Set<string>}
 */
function getResolvedOutgoingPaths({ note, notePaths }) {
	const paths = new Set();
	const sourcePath = normalizePath(note.path);

	for (let index = 0; index < note.outgoingLinks.length; index += 1) {
		const path = normalizePath(note.outgoingLinks[index].path || "");

		if (path && path !== sourcePath && notePaths.has(path)) {
			paths.add(path);
		}
	}

	return paths;
}

/**
 * Counts unique neighboring notes across incoming and outgoing links.
 * @param {object} params
 * @param {object} params.note
 * @param {Set<string>} params.notePaths
 * @returns {number}
 */
function countNoteNeighbors({ note, notePaths }) {
	const neighbors = getResolvedOutgoingPaths({ note, notePaths });
	const sourcePath = normalizePath(note.path);

	for (let index = 0; index < note.backlinks.length; index += 1) {
		const path = normalizePath(note.backlinks[index]);

		if (path && path !== sourcePath && notePaths.has(path)) {
			neighbors.add(path);
		}
	}

	return neighbors.size;
}

/**
 * Counts unique resolved backlinks for a note.
 * @param {object} params
 * @param {object} params.note
 * @param {Set<string>} params.notePaths
 * @returns {number}
 */
function countNoteBacklinks({ note, notePaths }) {
	const backlinks = new Set();
	const sourcePath = normalizePath(note.path);

	for (let index = 0; index < note.backlinks.length; index += 1) {
		const path = normalizePath(note.backlinks[index]);

		if (path && path !== sourcePath && notePaths.has(path)) {
			backlinks.add(path);
		}
	}

	return backlinks.size;
}

/**
 * Ranks the small set of note-level highlights shown in Insights.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @param {Set<string>} params.notePaths
 * @returns {Array<object>}
 */
function rankVaultStandouts({ notes, notePaths }) {
	let longest = { note: null, score: -1 };
	let referenced = { note: null, score: -1 };
	let connected = { note: null, score: -1 };
	let recent = { note: null, score: -1, date: "" };

	for (let index = 0; index < notes.length; index += 1) {
		const note = notes[index];
		const wordCount = Number(note.wordCount || 0);
		const backlinkCount = countNoteBacklinks({ note, notePaths });
		const neighborCount = countNoteNeighbors({ note, notePaths });
		const activityDate = note.calendarDates.updated || note.calendarDates.published;
		const activityTimestamp = activityDate ? Date.parse(`${activityDate}T00:00:00Z`) : -1;

		longest = selectHigherInsightScore({ candidate: longest, note, score: wordCount });
		referenced = selectHigherInsightScore({ candidate: referenced, note, score: backlinkCount });
		connected = selectHigherInsightScore({ candidate: connected, note, score: neighborCount });

		if (activityTimestamp > recent.score) {
			recent = { note, score: activityTimestamp, date: activityDate };
		}
	}

	const standouts = [];

	if (longest.note && longest.score > 0) {
		standouts.push({
			label: "Longest read",
			note: longest.note,
			value: `${formatNumber(longest.score)} words`,
			icon: "fa-regular fa-file-lines"
		});
	}

	if (referenced.note && referenced.score > 0) {
		standouts.push({
			label: "Most referenced",
			note: referenced.note,
			value: `${formatNumber(referenced.score)} backlinks`,
			icon: "fa-solid fa-arrow-turn-down"
		});
	}

	if (connected.note && connected.score > 0) {
		standouts.push({
			label: "Most connected",
			note: connected.note,
			value: `${formatNumber(connected.score)} neighbors`,
			icon: "fa-solid fa-share-nodes"
		});
	}

	if (recent.note) {
		standouts.push({
			label: "Latest activity",
			note: recent.note,
			value: formatInsightDate({ date: recent.date }),
			icon: "fa-regular fa-clock"
		});
	}

	return standouts;
}

/**
 * Keeps the first note with the highest score, preserving manifest order for ties.
 * @param {object} params
 * @param {object} params.candidate
 * @param {object} params.note
 * @param {number} params.score
 * @returns {object}
 */
function selectHigherInsightScore({ candidate, note, score }) {
	return score > candidate.score ? { note, score } : candidate;
}

/**
 * Formats an aggregate vault reading duration compactly.
 * @param {object} params
 * @param {number} params.minutes
 * @returns {string}
 */
function formatVaultReadingTime({ minutes }) {
	if (minutes < 60) {
		return `${minutes} min`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes ? `${formatNumber(hours)}h ${remainingMinutes}m` : `${formatNumber(hours)}h`;
}

/**
 * Formats an authored ISO date without shifting it across timezones.
 * @param {object} params
 * @param {string} params.date
 * @returns {string}
 */
function formatInsightDate({ date }) {
	const timestamp = Date.parse(`${date}T00:00:00Z`);

	if (!Number.isFinite(timestamp)) {
		return date;
	}

	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric"
	}).format(timestamp);
}

/**
 * Opens the current hash route, or falls back to home.
 * @returns {void}
 */
function openRouteFromHash() {
	if (!isHashRoutingEnabled()) {
		openHome({ updateHash: false });
		return;
	}

	const path = getPathFromHash();
	const note = path ? findNoteByPath({ path }) : null;

	if (note) {
		openNote({ path: note.path, updateHash: false });
		return;
	}

	openHome({ updateHash: false });
}

/**
 * Reads the active note path from the URL hash.
 * @returns {string}
 */
function getPathFromHash() {
	const hash = window.location.hash || "";

	if (!hash.startsWith("#/")) {
		return "";
	}

	try {
		return decodePath(hash.slice(2));
	} catch (error) {
		return "";
	}
}

/**
 * Checks whether hash-based note routing is enabled.
 * @returns {boolean}
 */
function isHashRoutingEnabled() {
	return state.config.site?.hashRouting !== false;
}

/**
 * Gets the hash route for a note path.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getNoteHash({ path }) {
	if (!isHashRoutingEnabled()) {
		return "";
	}

	const notePath = normalizePath(path);

	if (!notePath) {
		return "";
	}

	return `#/${encodePath(notePath)}`;
}

/**
 * Decodes slash-separated URL paths.
 * @param {string} path
 * @returns {string}
 */
function decodePath(path) {
	const parts = normalizePath(path).split("/");

	for (let index = 0; index < parts.length; index += 1) {
		parts[index] = decodeURIComponent(parts[index]);
	}

	return normalizePath(parts.join("/"));
}

/**
 * Updates the browser URL hash without reloading the page.
 * @param {object} params
 * @param {string} params.hash
 * @param {boolean} params.updateHash
 * @returns {void}
 */
function updateLocationHash({ hash, updateHash }) {
	if (!updateHash || !isHashRoutingEnabled()) {
		return;
	}

	const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
	const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

	if (nextUrl !== currentUrl) {
		window.history.pushState(null, "", nextUrl);
	}
}

/**
 * Opens the configured initial note.
 * @returns {void}
 */
function openInitialNote() {
	const defaultFile = state.config.defaultFile || "";
	const note = findNoteByPath({ path: defaultFile }) || state.notes[0];

	if (note) {
		openNote({ path: note.path });
	} else {
		openHome();
	}
}

/**
 * Opens the standalone home screen.
 * @param {object} [params]
 * @param {boolean} [params.updateHash]
 * @returns {void}
 */
function openHome({ updateHash = true } = {}) {
	state.noteRequestId += 1;
	state.activePath = "";
	state.activeView = "home";
	state.primaryMenuCollapsed = true;
	state.secondaryMenuCollapsed = true;
	closeQuickSettings();
	clearQrCodeBlock();
	updateLocationHash({ hash: "", updateHash });
	renderHome();
	renderHomeContext();
	renderFileTree();
	renderBookmarks();
	renderPanels();
	renderShell();
}

/**
 * Opens a markdown note.
 * @param {object} params
 * @param {string} params.path
 * @param {boolean} [params.updateHash]
 * @async
 * @returns {Promise<void>}
 */
async function openNote({ path, updateHash = true }) {
	const note = findNoteByPath({ path });

	if (!note) {
		showNavigationStatus({ message: `Missing note: ${path}` });
		return;
	}

	state.activePath = note.path;
	state.activeView = "note";
	const requestId = state.noteRequestId += 1;
	updateLocationHash({ hash: getNoteHash({ path: note.path }), updateHash });
	renderFileTree();
	renderBookmarks();
	renderPanels();
	renderShell();

	if (note.loaded) {
		renderArticle({ note });
		renderArticleContext({ note });
		return;
	}

	renderArticleLoading({ note });
	renderPendingArticleContext({ note });

	try {
		await loadNoteContent({ note });

		if (requestId !== state.noteRequestId || state.activePath !== note.path) {
			return;
		}

		renderArticle({ note });
		renderArticleContext({ note });
	} catch (error) {
		if (requestId !== state.noteRequestId || state.activePath !== note.path) {
			return;
		}

		renderArticleLoadError({ note, error });
		showNavigationStatus({ message: error.message });
	}
}

/**
 * Loads and caches one note body on first open.
 * @async
 * @param {object} params
 * @param {object} params.note
 * @returns {Promise<object>}
 */
async function loadNoteContent({ note }) {
	const cacheKey = note.sourceUrl || note.path;
	const cached = noteContentCache.get(cacheKey);

	if (cached) {
		Object.assign(note, cached, { loaded: true });
		return note;
	}

	const pending = noteLoadPromises.get(cacheKey);

	if (pending) {
		const loaded = await pending;
		Object.assign(note, loaded, { loaded: true });
		return note;
	}

	const loadPromise = fetchNoteContent({ note });
	noteLoadPromises.set(cacheKey, loadPromise);

	try {
		const loaded = await loadPromise;
		noteContentCache.set(cacheKey, loaded);
		Object.assign(note, loaded, { loaded: true });
		return note;
	} finally {
		if (noteLoadPromises.get(cacheKey) === loadPromise) {
			noteLoadPromises.delete(cacheKey);
		}
	}
}

/**
 * Fetches and parses one Markdown note.
 * @async
 * @param {object} params
 * @param {object} params.note
 * @returns {Promise<object>}
 */
async function fetchNoteContent({ note }) {
	const cache = state.manifest.sourceType === "local" ? "no-cache" : "default";
	const content = await requestText({
		url: note.sourceUrl,
		label: `Article "${note.path}"`,
		cache,
		timeoutMs: articleRequestTimeoutMs
	});
	const parsed = parseFrontmatter(content);

	return {
		body: parsed.body,
		visibleBody: stripObsidianComments({ markdown: parsed.body })
	};
}

/**
 * Renders a loading state while a note body is fetched.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderArticleLoading({ note }) {
	const article = select(selectors.article);
	removeArticleMaps();
	removeArticleCodeRunners();
	article.classList.remove("is-home", "has-header");
	article.setAttribute("aria-busy", "true");
	article.scrollTop = 0;
	article.innerHTML = `
		<div class="article-inner">
			<h1>${escapeHtml(note.title)}</h1>
			<p class="muted">Loading article…</p>
		</div>
	`;
	renderArticleScrollState();
}

/**
 * Renders note context that is already available from the manifest.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderPendingArticleContext({ note }) {
	renderBookmarkControl({ note });
	renderSourceControls({ note });
	renderMetadata({ note });
	select(selectors.tocList).innerHTML = `<p class="muted">Loading article…</p>`;
	renderLinkList({ selector: selectors.backlinkList, notes: getBacklinks({ note }) });
	renderOutgoingLinks({ note });
}

/**
 * Renders a note loading failure without leaving a blank reader.
 * @param {object} params
 * @param {object} params.note
 * @param {Error} params.error
 * @returns {void}
 */
function renderArticleLoadError({ note, error }) {
	const article = select(selectors.article);
	article.removeAttribute("aria-busy");
	article.innerHTML = `
		<div class="article-inner">
			<h1>${escapeHtml(note.title)}</h1>
			<div class="article-load-error" role="alert">
				<p>${escapeHtml(error.message)}</p>
				<button class="empty-state-action" type="button" data-action="retry-note" data-path="${escapeAttribute(note.path)}">Try again</button>
			</div>
		</div>
	`;
	select(selectors.tocList).innerHTML = `<p class="muted">Article unavailable.</p>`;
	renderArticleScrollState();
}

/**
 * Renders the home screen.
 * @returns {void}
 */
function renderHome() {
	const article = select(selectors.article);
	const title = state.config.home?.title || state.config.title || "Papyrus";
	const subtitle = state.config.home?.subtitle || state.config.description || "A client-side markdown knowledge base.";
	const background = getHomeBackground();
	const backgroundClass = getHomeClassName({ background });
	const backgroundImage = background.image;
	const backgroundStyle = backgroundImage ? ` style="--home-background-image: url('${escapeCssUrl(backgroundImage)}');"` : "";
	const ctas = createHomeCtaMarkup();

	removeArticleMaps();
	removeArticleCodeRunners();
	article.removeAttribute("aria-busy");
	article.classList.add("is-home");
	article.classList.remove("has-header");
	article.scrollTop = 0;
	article.innerHTML = `
		<div class="${backgroundClass}"${backgroundStyle}>
			<div class="home-content">
				<h1>${escapeHtml(title)}</h1>
				<p>${escapeHtml(subtitle)}</p>
				${ctas}
			</div>
		</div>
	`;
	renderArticleScrollState();
}

/**
 * Creates home CTA card markup.
 * @returns {string}
 */
function createHomeCtaMarkup() {
	const notes = getFeaturedNotes();

	if (!notes.length) {
		return "";
	}

	let markup = `<div class="home-ctas" aria-label="Featured notes">`;

	for (let index = 0; index < notes.length; index += 1) {
		const note = notes[index];
		const preview = getHomeCtaDescription({ note });
		const description = preview
			? `<span class="home-cta-description">${escapeHtml(preview)}</span>`
			: "";
		const sectionLabel = getHomeCtaSectionLabel({ path: note.path });

		markup += `
			<a class="home-cta" href="${getNoteHash({ path: note.path }) || "#"}" data-note-target="${escapeAttribute(note.path)}">
				<span class="home-cta-copy">
					<span class="home-cta-meta">
						<span>${escapeHtml(sectionLabel)}</span>
					</span>
					<strong>${escapeHtml(note.title)}</strong>
					${description}
				</span>
				<span class="home-cta-action" aria-hidden="true">
					<i class="fa-solid fa-arrow-right"></i>
				</span>
			</a>
		`;
	}

	markup += `</div>`;
	return markup;
}

/**
 * Gets a concise card description without repeating the note title.
 * @param {object} params
 * @param {object} params.note
 * @returns {string}
 */
function getHomeCtaDescription({ note }) {
	const title = String(note.title || "").trim();
	let excerpt = String(note.excerpt || "").trim();

	if (title && excerpt.toLowerCase().startsWith(title.toLowerCase())) {
		excerpt = excerpt.slice(title.length).trim();
	}

	return excerpt ? getExcerpt({ text: excerpt, query: "" }) : "";
}

/**
 * Gets a concise section label from a CTA note path.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getHomeCtaSectionLabel({ path }) {
	const [section = ""] = normalizePath(path).split("/");
	return section && section !== getFileName(path) ? formatMetadataKey(section) : "Featured";
}

/**
 * Gets the first featured notes in manifest order.
 * @returns {Array<object>}
 */
function getFeaturedNotes() {
	const featuredNotes = [];

	for (let index = 0; index < state.notes.length && featuredNotes.length < maximumFeaturedNotes; index += 1) {
		const note = state.notes[index];
		const featured = getMetadataValue({ metadata: note.metadata, key: "featured" });

		if (isTrueMetadataValue(featured)) {
			featuredNotes.push(note);
		}
	}

	return featuredNotes;
}

/**
 * Gets the configured home background.
 * @returns {object}
 */
function getHomeBackground() {
	const background = state.config.home?.background || {};

	if (!background.enabled || !background.image) {
		return { image: "", grayscale: false };
	}

	return {
		image: getCssAssetUrl(String(background.image)),
		grayscale: Boolean(background.grayscale)
	};
}

/**
 * Gets the home view class name.
 * @param {object} params
 * @param {object} params.background
 * @returns {string}
 */
function getHomeClassName({ background }) {
	const classes = ["home-view"];

	if (background.image) {
		classes.push("has-background");
	}

	if (background.grayscale) {
		classes.push("is-grayscale");
	}

	return classes.join(" ");
}

/**
 * Gets a CSS-safe asset URL that resolves from the app root.
 * @param {string} path
 * @returns {string}
 */
function getCssAssetUrl(path) {
	if (/^(https?:|data:|\/)/i.test(path)) {
		return path;
	}

	return `/${normalizePath(path)}`;
}

/**
 * Escapes a URL value for a CSS custom property.
 * @param {string} value
 * @returns {string}
 */
function escapeCssUrl(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Clears note-specific context for the home screen.
 * @returns {void}
 */
function renderHomeContext() {
	clearQrCodeBlock();
	const button = select(selectors.bookmarkButton);
	const icon = select(selectors.bookmarkIcon);
	const label = select(selectors.bookmarkLabel);

	button.disabled = true;
	button.classList.remove("is-bookmarked");
	icon.className = "fa-regular fa-bookmark";
	label.textContent = "Bookmark note";
	renderSourceControls({ note: null });
	select(selectors.metadataList).innerHTML = `<div><dt>Status</dt><dd>No article selected.</dd></div>`;
	select(selectors.tocList).innerHTML = `<p class="muted">No article selected.</p>`;
	select(selectors.backlinkList).innerHTML = `<p class="muted">No linked notes.</p>`;
	select(selectors.outgoingList).innerHTML = `<p class="muted">No linked notes.</p>`;
}

/**
 * Renders the active article.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderArticle({ note }) {
	const article = select(selectors.article);
	const content = renderMarkdown({ markdown: note.body });
	const headerImage = getArticleHeaderImage({ note });
	const header = headerImage ? createArticleHeaderImage({
		src: headerImage,
		grayscale: isArticleHeaderGrayscale({ note })
	}) : "";
	removeArticleMaps();
	removeArticleCodeRunners();
	article.removeAttribute("aria-busy");
	article.classList.remove("is-home");
	article.classList.toggle("has-header", Boolean(headerImage));
	article.scrollTop = 0;
	article.innerHTML = `${header}<div class="article-inner">${content}</div>`;
	initializeArticleMermaidDiagrams();
	initializeArticleCodeBlocks();
	initializeArticleTables();
	highlightArticleCode();
	initializeArticleMaps();
	typesetArticleMath({ markdown: note.visibleBody });
	renderArticleScrollState();
}

/**
 * Creates article header image markup.
 * @param {object} params
 * @param {string} params.src
 * @param {boolean} params.grayscale
 * @returns {string}
 */
function createArticleHeaderImage({ src, grayscale }) {
	const className = grayscale ? "article-header-image is-grayscale" : "article-header-image";

	return `
		<figure class="${className}">
			<img src="${escapeAttribute(src)}" alt="">
		</figure>
	`;
}

/**
 * Replaces failed article images with an orderly fallback.
 * @param {Event} event
 * @returns {void}
 */
function handleArticleImageError(event) {
	const image = event.target;

	if (!(image instanceof HTMLImageElement)) {
		return;
	}

	const article = select(selectors.article);
	const header = image.closest(".article-header-image");

	if (header) {
		header.remove();
		article.classList.remove("has-header");
		renderArticleScrollState();
		return;
	}

	const fallback = document.createElement("span");
	const alt = String(image.getAttribute("alt") || "").trim();
	fallback.className = "article-image-error";
	fallback.setAttribute("role", "img");
	fallback.setAttribute("aria-label", alt || "Image unavailable");
	fallback.textContent = alt ? `${alt} — image unavailable` : "Image unavailable";
	const picture = image.closest("picture");
	(picture || image).replaceWith(fallback);
}

/**
 * Highlights code blocks in the active article.
 * @returns {void}
 */
function highlightArticleCode() {
	Prism.highlightAllUnder(select(selectors.article));
}

/**
 * Replaces Obsidian-style Mermaid code fences and starts diagram rendering.
 * @returns {void}
 */
function initializeArticleMermaidDiagrams() {
	const article = select(selectors.article);
	const blocks = article.querySelectorAll("pre > code.language-mermaid");
	const diagrams = [];

	for (let index = 0; index < blocks.length; index += 1) {
		const code = blocks[index];
		const block = code.parentElement;

		if (!block) {
			continue;
		}

		const embed = document.createElement("figure");
		const diagram = document.createElement("div");
		const source = code.textContent.trim();

		embed.className = "mermaid-embed";
		diagram.className = "mermaid";
		diagram.dataset.mermaidSource = source;
		diagram.textContent = source;
		embed.append(diagram);
		block.replaceWith(embed);
		diagrams.push(diagram);
	}

	renderArticleMermaidDiagrams({ diagrams });
}

/**
 * Renders Mermaid diagram elements with the theme that matches Papyrus.
 * @async
 * @param {object} params
 * @param {Array<HTMLElement>|NodeListOf<HTMLElement>} params.diagrams
 * @returns {Promise<void>}
 */
async function renderArticleMermaidDiagrams({ diagrams }) {
	if (!diagrams.length) {
		return;
	}

	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "strict",
		theme: getMermaidTheme()
	});

	for (let index = 0; index < diagrams.length; index += 1) {
		const diagram = diagrams[index];

		try {
			await mermaid.run({ nodes: [diagram] });
			initializeMermaidInternalLinks({ diagram });
		} catch (error) {
			renderMermaidError({ diagram });
		}
	}
}

/**
 * Gets the Mermaid theme for the active Papyrus color scheme.
 * @returns {"default"|"dark"}
 */
function getMermaidTheme() {
	return state.theme === "dark" || state.theme === "ocean" ? "dark" : "default";
}

/**
 * Re-renders active diagrams after a theme change.
 * @returns {void}
 */
function rerenderArticleMermaidDiagrams() {
	const diagrams = select(selectors.article).querySelectorAll(".mermaid-embed .mermaid");

	for (let index = 0; index < diagrams.length; index += 1) {
		const diagram = diagrams[index];

		diagram.classList.remove("is-error");
		diagram.removeAttribute("aria-live");
		diagram.removeAttribute("data-processed");
		diagram.textContent = diagram.dataset.mermaidSource || "";
	}

	renderArticleMermaidDiagrams({ diagrams });
}

/**
 * Makes Mermaid nodes with Obsidian's internal-link class open vault notes.
 * @param {object} params
 * @param {HTMLElement} params.diagram
 * @returns {void}
 */
function initializeMermaidInternalLinks({ diagram }) {
	const links = diagram.querySelectorAll(".internal-link");

	for (let index = 0; index < links.length; index += 1) {
		const link = links[index];
		const label = (link.querySelector(".nodeLabel")?.textContent || link.textContent || "").trim();
		const note = findNoteByWikiTarget({ target: label }) || findNoteByTitle({ title: label });

		if (!note) {
			link.classList.add("is-missing");
			continue;
		}

		link.dataset.noteTarget = note.path;
		link.setAttribute("aria-label", `Open ${note.title}`);
		link.setAttribute("role", "link");
		link.setAttribute("tabindex", "0");
		link.addEventListener("keydown", handleMermaidInternalLinkKeyDown);
	}
}

/**
 * Finds a note whose configured or derived title matches a diagram label.
 * @param {object} params
 * @param {string} params.title
 * @returns {object|undefined}
 */
function findNoteByTitle({ title }) {
	const normalizedTitle = title.trim().toLowerCase();

	for (let index = 0; index < state.notes.length; index += 1) {
		if (state.notes[index].title.trim().toLowerCase() === normalizedTitle) {
			return state.notes[index];
		}
	}

	return undefined;
}

/**
 * Opens a keyboard-activated internal Mermaid node.
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleMermaidInternalLinkKeyDown(event) {
	if (event.key !== "Enter" && event.key !== " ") {
		return;
	}

	event.preventDefault();
	openNote({ path: event.currentTarget.dataset.noteTarget });
}

/**
 * Replaces a failed diagram with a readable source fallback.
 * @param {object} params
 * @param {HTMLElement} params.diagram
 * @returns {void}
 */
function renderMermaidError({ diagram }) {
	const message = document.createElement("strong");
	const guidance = document.createElement("span");
	const sourceBlock = document.createElement("pre");
	const code = document.createElement("code");

	message.textContent = "Diagram could not be rendered.";
	guidance.textContent = "Check the Mermaid syntax below.";
	code.textContent = diagram.dataset.mermaidSource || "";
	sourceBlock.className = "mermaid-error-source";
	sourceBlock.append(code);
	diagram.classList.add("is-error");
	diagram.setAttribute("aria-live", "polite");
	diagram.replaceChildren(message, guidance, sourceBlock);
}

/**
 * Adds controls and metadata around rendered article code blocks.
 * @returns {void}
 */
function initializeArticleCodeBlocks() {
	const article = select(selectors.article);
	const blocks = article.querySelectorAll("pre");

	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];

		if (!block.querySelector("code") || block.closest(".code-embed")) {
			continue;
		}

		const wrapper = createCodeEmbed({ block });

		block.replaceWith(wrapper);
		wrapper.append(block);
	}
}

/**
 * Creates a controlled code block wrapper.
 * @param {object} params
 * @param {HTMLPreElement} params.block
 * @returns {HTMLElement}
 */
function createCodeEmbed({ block }) {
	const code = block.querySelector("code");
	const wrapper = document.createElement("figure");
	const header = document.createElement("figcaption");
	const summary = document.createElement("span");
	const actions = document.createElement("span");
	const language = getCodeBlockLanguage({ code });
	const lineCount = countCodeLines(code.textContent);

	wrapper.className = "code-embed";
	header.className = "code-header";
	summary.className = "code-summary";
	summary.textContent = `${formatCodeLanguage({ language })} - ${formatNumber(lineCount)} LOC`;
	actions.className = "code-header-actions";

	if (isRunnableCodeLanguage({ language })) {
		actions.append(createCodeActionButton({
			action: "run-code-block",
			icon: "fa-solid fa-play",
			label: "Run",
			disabled: false
		}));
	}

	actions.append(createCodeActionButton({
		action: "toggle-code-wrap",
		icon: "fa-solid fa-arrow-turn-down",
		label: "Wrap",
		disabled: false
	}));
	actions.append(createCodeActionButton({
		action: "copy-code-block",
		icon: "fa-regular fa-copy",
		label: "Copy",
		disabled: false
	}));
	actions.append(createCodeActionButton({
		action: "toggle-code-block",
		icon: "fa-solid fa-chevron-up",
		label: "Collapse",
		disabled: false
	}));
	header.append(summary, actions);
	wrapper.append(header);

	return wrapper;
}

/**
 * Creates a code block action button.
 * @param {object} params
 * @param {string} params.action
 * @param {string} params.icon
 * @param {string} params.label
 * @param {boolean} params.disabled
 * @returns {HTMLButtonElement}
 */
function createCodeActionButton({ action, icon, label, disabled }) {
	const button = document.createElement("button");

	button.className = "code-action";
	button.type = "button";
	button.dataset.action = action;
	button.disabled = disabled;
	button.setAttribute("aria-label", label);
	button.title = label;

	if (action === "toggle-code-block") {
		button.setAttribute("aria-expanded", "true");
	}

	if (action === "toggle-code-wrap") {
		button.setAttribute("aria-label", "Wrap lines");
		button.setAttribute("aria-pressed", "false");
		button.title = "Wrap lines";
	}

	button.innerHTML = `<i class="${escapeAttribute(icon)}" aria-hidden="true"></i><span>${escapeHtml(label)}</span>`;

	return button;
}

/**
 * Gets the declared language for a rendered code block.
 * @param {object} params
 * @param {HTMLElement} params.code
 * @returns {string}
 */
function getCodeBlockLanguage({ code }) {
	const classes = Array.from(code.classList);

	for (let index = 0; index < classes.length; index += 1) {
		const match = classes[index].match(/^language-(.+)$/);

		if (match) {
			return match[1].toLowerCase();
		}
	}

	return "";
}

/**
 * Formats a code language for display.
 * @param {object} params
 * @param {string} params.language
 * @returns {string}
 */
function formatCodeLanguage({ language }) {
	const labels = {
		js: "JavaScript",
		javascript: "JavaScript",
		json: "JSON",
		html: "HTML",
		css: "CSS",
		md: "Markdown",
		markdown: "Markdown"
	};

	return labels[language] || language.toUpperCase() || "Plain text";
}

/**
 * Checks whether a code language should show a run action.
 * @param {object} params
 * @param {string} params.language
 * @returns {boolean}
 */
function isRunnableCodeLanguage({ language }) {
	return language === "javascript" || language === "js";
}

/**
 * Counts lines of code from a code block string.
 * @param {string} code
 * @returns {number}
 */
function countCodeLines(code) {
	const normalized = code.replace(/\r\n/g, "\n").replace(/\n$/, "");

	if (!normalized) {
		return 0;
	}

	return normalized.split("\n").length;
}

/**
 * Typesets math syntax in the active article.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {Promise<void>}
 */
async function typesetArticleMath({ markdown }) {
	if (!hasMathSyntax(markdown)) {
		return;
	}

	try {
		const mathJax = await loadMathJax();
		const article = select(selectors.article);

		if (mathJax.typesetPromise) {
			await mathJax.typesetPromise([article]);
		}
	} catch (error) {
		showNavigationStatus({ message: "Math rendering could not be loaded." });
	}
}

/**
 * Checks whether markdown likely contains MathJax syntax.
 * @param {string} markdown
 * @returns {boolean}
 */
function hasMathSyntax(markdown) {
	return /(^|[^\\])(\$\$[\s\S]+?\$\$|\$[^\n$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/m.test(markdown);
}

/**
 * Loads MathJax only when article content is rendered.
 * @returns {Promise<object>}
 */
async function loadMathJax() {
	if (window.MathJax?.typesetPromise) {
		return window.MathJax;
	}

	if (state.mathJaxPromise) {
		return await state.mathJaxPromise;
	}

	window.MathJax = {
		tex: {
			inlineMath: [["$", "$"], ["\\(", "\\)"]],
			displayMath: [["$$", "$$"], ["\\[", "\\]"]],
			processEscapes: true
		},
		options: {
			skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
		}
	};

	state.mathJaxPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
		script.async = true;
		script.onload = function handleMathJaxLoad() {
			if (window.MathJax?.typesetPromise) {
				resolve(window.MathJax);
			} else {
				reject(new Error("MathJax did not expose a browser global."));
			}
		};
		script.onerror = function handleMathJaxError() {
			reject(new Error("MathJax failed to load."));
		};
		document.head.append(script);
	});

	return await state.mathJaxPromise;
}

/**
 * Removes active MapLibre instances before replacing article content.
 * @returns {void}
 */
function removeArticleMaps() {
	for (let index = 0; index < state.maps.length; index += 1) {
		state.maps[index].remove();
	}

	state.maps = [];
}

/**
 * Initializes maps in the active article.
 * @returns {void}
 */
function initializeArticleMaps() {
	const maps = select(selectors.article).querySelectorAll("[data-map]");

	for (let index = 0; index < maps.length; index += 1) {
		initializeArticleMap({ element: maps[index] });
	}
}

/**
 * Initializes a MapLibre map element.
 * @param {object} params
 * @param {HTMLElement} params.element
 * @returns {void}
 */
function initializeArticleMap({ element }) {
	const latitude = Number(element.dataset.lat);
	const longitude = Number(element.dataset.lon);
	const zoom = Number(element.dataset.zoom);
	const marker = element.dataset.marker === "true";
	const label = element.dataset.label || "";

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(zoom)) {
		element.textContent = "Invalid map coordinates.";
		return;
	}

	loadMapLibre()
		.then((maplibregl) => {
			if (!element.isConnected) {
				return;
			}

			const map = new maplibregl.Map({
				container: element,
				center: [longitude, latitude],
				zoom,
				style: createOpenStreetMapStyle(),
				attributionControl: true
			});

			map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
			addArticleMapMarker({ maplibregl, map, latitude, longitude, marker, label });
			bindArticleMapFooter({ element, map });
			state.maps.push(map);
		})
		.catch(() => {
			element.textContent = "Map could not be loaded.";
		});
}

/**
 * Adds an optional marker at a map's configured coordinates.
 * @param {object} params
 * @param {object} params.maplibregl
 * @param {object} params.map
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {boolean} params.marker
 * @param {string} params.label
 * @returns {void}
 */
function addArticleMapMarker({ maplibregl, map, latitude, longitude, marker, label }) {
	if (!marker) {
		return;
	}

	const mapMarker = new maplibregl.Marker()
		.setLngLat([longitude, latitude])
		.addTo(map);
	const markerElement = mapMarker.getElement();

	if (label) {
		markerElement.setAttribute("aria-label", label);
		markerElement.title = label;
	}
}

/**
 * Binds footer data and controls for a MapLibre map.
 * @param {object} params
 * @param {HTMLElement} params.element
 * @param {object} params.map
 * @returns {void}
 */
function bindArticleMapFooter({ element, map }) {
	const mapEmbed = element.closest(".map-embed");
	const coordinateLabel = mapEmbed?.querySelector("[data-map-coordinates]");
	const zoomLabel = mapEmbed?.querySelector("[data-map-zoom]");
	const googleMapsLink = mapEmbed?.querySelector("[data-map-google]");

	if (!mapEmbed || !coordinateLabel || !zoomLabel || !googleMapsLink) {
		return;
	}

	updateArticleMapFooter({ map, coordinateLabel, zoomLabel, googleMapsLink });
	map.on("move", function handleMapMove() {
		updateArticleMapFooter({ map, coordinateLabel, zoomLabel, googleMapsLink });
	});
}

/**
 * Updates map coordinates, zoom, and external map link.
 * @param {object} params
 * @param {object} params.map
 * @param {Element} params.coordinateLabel
 * @param {Element} params.zoomLabel
 * @param {HTMLAnchorElement} params.googleMapsLink
 * @returns {void}
 */
function updateArticleMapFooter({ map, coordinateLabel, zoomLabel, googleMapsLink }) {
	const center = map.getCenter();
	const latitude = center.lat;
	const longitude = center.lng;

	coordinateLabel.textContent = formatCoordinates({ latitude, longitude });
	zoomLabel.textContent = formatMapZoom(map.getZoom());
	googleMapsLink.href = getGoogleMapsUrl({
		latitude: latitude.toFixed(6),
		longitude: longitude.toFixed(6)
	});
}

/**
 * Gets the active MapLibre instance for an element.
 * @param {object} params
 * @param {HTMLElement} params.element
 * @returns {object|null}
 */
function getArticleMapByElement({ element }) {
	for (let index = 0; index < state.maps.length; index += 1) {
		if (state.maps[index].getContainer() === element) {
			return state.maps[index];
		}
	}

	return null;
}

/**
 * Opens a map canvas in fullscreen mode.
 * @param {object} params
 * @param {HTMLElement} params.mapElement
 * @param {object|null} params.map
 * @returns {void}
 */
function openMapFullscreen({ mapElement, map }) {
	if (!mapElement.requestFullscreen) {
		return;
	}

	mapElement.requestFullscreen()
		.then(function handleMapFullscreenOpen() {
			resizeArticleMap({ map });
		})
		.catch(function handleMapFullscreenError() {
			resizeArticleMap({ map });
		});
}

/**
 * Resizes a MapLibre instance when available.
 * @param {object} params
 * @param {object|null} params.map
 * @returns {void}
 */
function resizeArticleMap({ map }) {
	if (map) {
		map.resize();
	}
}

/**
 * Loads MapLibre only when a map is present.
 * @returns {Promise<object>}
 */
function loadMapLibre() {
	if (window.maplibregl) {
		return Promise.resolve(window.maplibregl);
	}

	if (state.mapLibrePromise) {
		return state.mapLibrePromise;
	}

	state.mapLibrePromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js";
		script.onload = function handleMapLibreLoad() {
			if (window.maplibregl) {
				resolve(window.maplibregl);
			} else {
				reject(new Error("MapLibre did not expose a browser global."));
			}
		};
		script.onerror = function handleMapLibreError() {
			reject(new Error("MapLibre failed to load."));
		};
		document.head.append(script);
	});

	return state.mapLibrePromise;
}

/**
 * Creates a MapLibre style using OpenStreetMap raster tiles.
 * @returns {object}
 */
function createOpenStreetMapStyle() {
	return {
		version: 8,
		sources: {
			openStreetMap: {
				type: "raster",
				tiles: [
					"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
				],
				tileSize: 256,
				attribution: "© OpenStreetMap contributors"
			}
		},
		layers: [
			{
				id: "openStreetMap",
				type: "raster",
				source: "openStreetMap"
			}
		]
	};
}

/**
 * Renders metadata and link context.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderArticleContext({ note }) {
	renderBookmarkControl({ note });
	renderSourceControls({ note });
	renderMetadata({ note });
	renderTableOfContents({ note });
	renderLinkList({ selector: selectors.backlinkList, notes: getBacklinks({ note }) });
	renderOutgoingLinks({ note });
}

/**
 * Renders the bookmark control state.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderBookmarkControl({ note }) {
	const button = select(selectors.bookmarkButton);
	const icon = select(selectors.bookmarkIcon);
	const label = select(selectors.bookmarkLabel);
	const bookmarked = isBookmarked({ path: note.path });

	button.disabled = false;
	button.classList.toggle("is-bookmarked", bookmarked);
	icon.className = bookmarked ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";
	label.textContent = bookmarked ? "Remove bookmark" : "Bookmark note";
}

/**
 * Renders source links and copy controls.
 * @param {object} params
 * @param {object|null} params.note
 * @returns {void}
 */
function renderSourceControls({ note }) {
	const repoLink = select(selectors.sourceRepoLink);
	const articleLink = select(selectors.sourceArticleLink);
	const downloadLink = select(selectors.sourceDownloadLink);
	const copySourceButton = select("[data-action='copy-source-url']");
	const copyPublishedButton = select("[data-action='copy-published-url']");
	const copyContentButton = select("[data-action='copy-article-content']");
	const obsidianButton = select("[data-action='open-obsidian']");
	const repoUrl = getGithubRepoUrl();
	const articleUrl = note ? getGithubArticleUrl({ path: note.path }) : "";
	const publishedUrl = note ? getPublishedArticleUrl({ path: note.path }) : "";
	const downloadUrl = note ? getArticleDownloadUrl({ note }) : "";
	const obsidianUrl = note ? getObsidianArticleUrl({ path: note.path }) : "";

	updateSourceLink({
		link: repoLink,
		href: repoUrl,
		label: repoUrl ? "Repository" : "Repository unavailable"
	});
	updateSourceLink({
		link: articleLink,
		href: articleUrl,
		label: articleUrl ? "Article file" : "Article file unavailable"
	});
	updateSourceLink({
		link: downloadLink,
		href: downloadUrl,
		label: downloadUrl ? "Download article" : "Download unavailable"
	});

	if (downloadUrl && note) {
		downloadLink.download = getFileName(note.path);
	} else {
		downloadLink.removeAttribute("download");
	}

	copySourceButton.disabled = !articleUrl;
	copyPublishedButton.disabled = !publishedUrl;
	copyContentButton.disabled = !note?.loaded;
	obsidianButton.disabled = !obsidianUrl;
}

/**
 * Updates a source link.
 * @param {object} params
 * @param {HTMLAnchorElement} params.link
 * @param {string} params.href
 * @param {string} params.label
 * @returns {void}
 */
function updateSourceLink({ link, href, label }) {
	const labelElement = link.querySelector("span");

	if (labelElement) {
		labelElement.textContent = label;
	}

	link.classList.toggle("is-disabled", !href);

	if (href) {
		link.href = href;
		link.setAttribute("aria-disabled", "false");
	} else {
		link.href = "#";
		link.setAttribute("aria-disabled", "true");
	}
}

/**
 * Renders metadata list.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderMetadata({ note }) {
	const list = select(selectors.metadataList);
	const articleText = note.loaded ? getArticleText({ markdown: note.body }) : "";
	const wordCount = note.loaded ? countWords(articleText) : Number(note.wordCount || 0);
	const characterCount = note.loaded ? countCharacters(articleText) : Number(note.characterCount || 0);
	const entries = [
		["Title", note.title],
		["Path", note.path],
		["Words", formatNumber(wordCount)],
		["Characters", formatNumber(characterCount)],
		["Reading time", formatReadingTime({ minutes: estimateReadingMinutes({ wordCount }) })],
		["Copyright", getArticleRightsValue({ note, key: "copyright" })],
		["License", getArticleRightsValue({ note, key: "license" })]
	];
	const metadataKeys = Object.keys(note.metadata);

	for (let index = 0; index < metadataKeys.length; index += 1) {
		const key = metadataKeys[index];

		if (shouldShowMetadataKey(key)) {
			entries.push([formatMetadataKey(key), formatMetadataValue(note.metadata[key])]);
		}
	}

	list.replaceChildren();

	for (let index = 0; index < entries.length; index += 1) {
		const item = document.createElement("div");
		item.innerHTML = `<dt>${escapeHtml(entries[index][0])}</dt><dd>${escapeHtml(entries[index][1])}</dd>`;
		list.append(item);
	}
}

/**
 * Gets readable article text from markdown.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function getArticleText({ markdown }) {
	return stripMarkdown(stripObsidianComments({ markdown })).replace(/\s+/g, " ").trim();
}

/**
 * Gets the resolved article header image URL.
 * @param {object} params
 * @param {object} params.note
 * @returns {string}
 */
function getArticleHeaderImage({ note }) {
	const image = getMetadataValue({ metadata: note.metadata, key: "image" });

	if (!image) {
		return "";
	}

	return getArticleAssetUrl({ path: image });
}

/**
 * Checks whether an article header image should render in grayscale.
 * @param {object} params
 * @param {object} params.note
 * @returns {boolean}
 */
function isArticleHeaderGrayscale({ note }) {
	const value = getMetadataValue({ metadata: note.metadata, key: "grayscale" });
	return isTrueMetadataValue(value);
}

/**
 * Gets an article asset URL from a configured path.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getArticleAssetUrl({ path }) {
	const assetUrl = String(path || "").trim();

	if (!assetUrl) {
		return "";
	}

	if (isIndependentAssetUrl({ url: assetUrl })) {
		return assetUrl;
	}

	const suffixIndex = assetUrl.search(/[?#]/);
	const pathPart = suffixIndex < 0 ? assetUrl : assetUrl.slice(0, suffixIndex);
	const suffix = suffixIndex < 0 ? "" : assetUrl.slice(suffixIndex);
	const cleanPath = normalizePath(decodeAssetPath({
		path: pathPart.replace(/^(?:\.\/)+/, "")
	}));

	if (!cleanPath || hasParentPathSegment(cleanPath)) {
		return assetUrl;
	}

	if (state.config.github?.enabled) {
		const cdnUrl = getGithubCdnUrl({
			path: cleanPath,
			rootPath: String(state.config.github.assetRootPath || ""),
			revision: state.manifest.revision
		});

		return cdnUrl ? `${cdnUrl}${suffix}` : assetUrl;
	}

	return `/${cleanPath}${suffix}`;
}

/**
 * Checks whether an asset URL should remain as authored.
 * @param {object} params
 * @param {string} params.url
 * @returns {boolean}
 */
function isIndependentAssetUrl({ url }) {
	return /^[a-z][a-z0-9+.-]*:/i.test(url)
		|| url.startsWith("//")
		|| url.startsWith("/")
		|| url.startsWith("#")
		|| url.startsWith("?");
}

/**
 * Decodes authored URL escapes before applying the CDN's path encoding.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function decodeAssetPath({ path }) {
	try {
		return decodeURIComponent(path);
	} catch {
		return path;
	}
}

/**
 * Checks whether a frontmatter key should be displayed.
 * @param {string} key
 * @returns {boolean}
 */
function shouldShowMetadataKey(key) {
	const normalized = key.toLowerCase();
	const allowedKeys = getAllowedMetadataKeys();

	if (normalized === "title" || isContentRightsKey(key)) {
		return false;
	}

	return allowedKeys.includes(normalized);
}

/**
 * Gets configured allowed frontmatter keys.
 * @returns {Array<string>}
 */
function getAllowedMetadataKeys() {
	const configured = Array.isArray(state.config.metadata?.allowedKeys)
		? state.config.metadata.allowedKeys
		: ["title", "tags", "authors", "license", "copyright"];
	const keys = [];

	for (let index = 0; index < configured.length; index += 1) {
		const key = String(configured[index] || "").trim().toLowerCase();

		if (key && !keys.includes(key)) {
			keys.push(key);
		}
	}

	return keys;
}

/**
 * Formats a metadata key for display.
 * @param {string} key
 * @returns {string}
 */
function formatMetadataKey(key) {
	const words = key.replace(/[-_]+/g, " ").split(" ");

	for (let index = 0; index < words.length; index += 1) {
		words[index] = words[index].charAt(0).toUpperCase() + words[index].slice(1);
	}

	return words.join(" ");
}

/**
 * Gets article-level rights metadata with config fallback.
 * @param {object} params
 * @param {object} params.note
 * @param {string} params.key
 * @returns {string}
 */
function getArticleRightsValue({ note, key }) {
	const articleValue = getMetadataValue({ metadata: note.metadata, key });
	const configValue = state.config.contentRights?.[key] || "";

	return articleValue || configValue || "Not specified";
}

/**
 * Gets metadata text for search indexing.
 * @param {object} params
 * @param {object} params.metadata
 * @returns {string}
 */
function getSearchMetadataText({ metadata }) {
	const keys = Object.keys(metadata);
	const parts = [];

	for (let index = 0; index < keys.length; index += 1) {
		parts.push(keys[index], formatMetadataValue(metadata[keys[index]]));
	}

	return parts.join(" ");
}

/**
 * Gets a metadata value case-insensitively.
 * @param {object} params
 * @param {object} params.metadata
 * @param {string} params.key
 * @returns {string}
 */
function getMetadataValue({ metadata, key }) {
	const keys = Object.keys(metadata);

	for (let index = 0; index < keys.length; index += 1) {
		if (keys[index].toLowerCase() === key.toLowerCase()) {
			return formatMetadataValue(metadata[keys[index]]);
		}
	}

	return "";
}

/**
 * Formats a metadata value for display.
 * @param {*} value
 * @returns {string}
 */
function formatMetadataValue(value) {
	if (Array.isArray(value)) {
		return value.map(formatMetadataValue).filter(Boolean).join(", ");
	}

	if (value === undefined || value === null) {
		return "";
	}

	return String(value);
}

/**
 * Checks whether a frontmatter value is true.
 * @param {string} value
 * @returns {boolean}
 */
function isTrueMetadataValue(value) {
	return String(value).trim().toLowerCase() === "true";
}

/**
 * Checks whether a frontmatter key is handled as rights metadata.
 * @param {string} key
 * @returns {boolean}
 */
function isContentRightsKey(key) {
	const normalized = key.toLowerCase();
	return normalized === "copyright" || normalized === "license";
}

/**
 * Renders the active article table of contents.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderTableOfContents({ note }) {
	const container = select(selectors.tocList);
	const headings = extractHeadings({ markdown: note.body });
	const tree = createTocTree({ headings });

	container.replaceChildren();

	if (!headings.length) {
		container.innerHTML = `<p class="muted">No headings found.</p>`;
		return;
	}

	for (let index = 0; index < tree.length; index += 1) {
		container.append(createTocItem({ item: tree[index] }));
	}
}

/**
 * Extracts markdown headings.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {Array<object>}
 */
function extractHeadings({ markdown }) {
	const lines = stripObsidianComments({ markdown }).replace(/\r\n/g, "\n").split("\n");
	const headings = [];
	const slugs = {};
	let inCode = false;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];

		if (line.startsWith("```")) {
			inCode = !inCode;
			continue;
		}

		if (inCode) {
			continue;
		}

		const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);

		if (match) {
			const title = stripMarkdown(match[2]
				.replace(/\^\[[^\]]+\]/g, "")
				.replace(/\[\^[^\]]+\]/g, "")).trim();
			headings.push({
				id: getUniqueSlug({ text: title, slugs }),
				level: match[1].length,
				title
			});
		}
	}

	return headings;
}

/**
 * Creates a nested table of contents tree.
 * @param {object} params
 * @param {Array<object>} params.headings
 * @returns {Array<object>}
 */
function createTocTree({ headings }) {
	const root = [];
	const stack = [];

	for (let index = 0; index < headings.length; index += 1) {
		const item = { ...headings[index], children: [] };

		while (stack.length && stack[stack.length - 1].level >= item.level) {
			stack.pop();
		}

		if (stack.length) {
			stack[stack.length - 1].children.push(item);
		} else {
			root.push(item);
		}

		stack.push(item);
	}

	return root;
}

/**
 * Creates a table of contents item.
 * @param {object} params
 * @param {object} params.item
 * @returns {HTMLElement}
 */
function createTocItem({ item }) {
	const wrapper = document.createElement("div");
	const row = document.createElement("div");
	const toggle = document.createElement("button");
	const link = document.createElement("button");
	const children = document.createElement("div");
	const expanded = isTocExpanded({ id: item.id });

	wrapper.className = "toc-item";
	wrapper.classList.toggle("is-collapsed", !expanded);
	row.className = "toc-row";
	toggle.className = "toc-toggle";
	toggle.type = "button";
	toggle.dataset.tocToggle = item.id;
	toggle.disabled = !item.children.length;
	toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${item.title}`);
	toggle.setAttribute("aria-expanded", String(expanded));
	toggle.innerHTML = item.children.length
		? `<i class="fa-solid fa-caret-${expanded ? "down" : "right"}" aria-hidden="true"></i>`
		: `<span aria-hidden="true"></span>`;
	link.className = "toc-link";
	link.type = "button";
	link.dataset.tocTarget = item.id;
	link.textContent = item.title;
	children.className = "toc-children";

	for (let index = 0; index < item.children.length; index += 1) {
		children.append(createTocItem({ item: item.children[index] }));
	}

	row.append(toggle, link);
	wrapper.append(row, children);
	return wrapper;
}

/**
 * Handles table of contents clicks.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleTocClick(event) {
	const toggle = event.target.closest("[data-toc-toggle]");
	const target = event.target.closest("[data-toc-target]");

	if (toggle && !toggle.disabled) {
		state.tocState[toggle.dataset.tocToggle] = !isTocExpanded({ id: toggle.dataset.tocToggle });
		refreshActiveToc();
		return;
	}

	if (target) {
		scrollToHeading({ id: target.dataset.tocTarget });
	}
}

/**
 * Refreshes the active note table of contents.
 * @returns {void}
 */
function refreshActiveToc() {
	const note = findNoteByPath({ path: state.activePath });

	if (note) {
		renderTableOfContents({ note });
	}
}

/**
 * Checks whether a TOC branch is expanded.
 * @param {object} params
 * @param {string} params.id
 * @returns {boolean}
 */
function isTocExpanded({ id }) {
	return state.tocState[id] !== false;
}

/**
 * Scrolls to an article heading.
 * @param {object} params
 * @param {string} params.id
 * @returns {void}
 */
function scrollToHeading({ id }) {
	const heading = document.getElementById(id);

	if (heading) {
		heading.scrollIntoView({ block: "start", behavior: "smooth" });
	}
}

/**
 * Renders backlink buttons.
 * @param {object} params
 * @param {string} params.selector
 * @param {Array<object>} params.notes
 * @returns {void}
 */
function renderLinkList({ selector, notes }) {
	const container = select(selector);
	container.replaceChildren();

	if (!notes.length) {
		container.innerHTML = `<p class="muted">No linked notes.</p>`;
		return;
	}

	for (let index = 0; index < notes.length; index += 1) {
		container.append(createLinkChip({ note: notes[index] }));
	}
}

/**
 * Renders outgoing wiki links.
 * @param {object} params
 * @param {object} params.note
 * @returns {void}
 */
function renderOutgoingLinks({ note }) {
	const notes = [];

	for (let index = 0; index < note.outgoingLinks.length; index += 1) {
		const path = note.outgoingLinks[index].path;
		const linkedNote = path ? findNoteByPath({ path }) : undefined;

		if (linkedNote && !notes.includes(linkedNote)) {
			notes.push(linkedNote);
		}
	}

	renderLinkList({ selector: selectors.outgoingList, notes });
}

/**
 * Creates a context link chip.
 * @param {object} params
 * @param {object} params.note
 * @returns {HTMLButtonElement}
 */
function createLinkChip({ note }) {
	const button = document.createElement("button");
	button.className = "link-chip";
	button.type = "button";
	button.dataset.path = note.path;
	addNavigationSound({ element: button, cue: "page" });
	button.innerHTML = `<i class="fa-regular fa-file-lines" aria-hidden="true"></i><span>${escapeHtml(note.title)}</span>`;
	button.addEventListener("click", handleNoteButtonClick);
	return button;
}

/**
 * Handles internal article link clicks.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleArticleClick(event) {
	const reloadAction = event.target.closest("[data-action='reload-app']");

	if (reloadAction) {
		event.preventDefault();
		window.location.reload();
		return;
	}

	const retryNoteAction = event.target.closest("[data-action='retry-note']");

	if (retryNoteAction) {
		event.preventDefault();
		openNote({ path: retryNoteAction.dataset.path || "", updateHash: false });
		return;
	}

	const footnoteLink = event.target.closest("[data-footnote-target]");

	if (footnoteLink) {
		event.preventDefault();
		scrollToFootnoteTarget({ id: footnoteLink.dataset.footnoteTarget });
		return;
	}

	const consoleCloseAction = event.target.closest("[data-action='close-code-console']");

	if (consoleCloseAction) {
		event.preventDefault();
		closeCodeConsole({ button: consoleCloseAction });
		return;
	}

	const consoleCopyAction = event.target.closest("[data-action='copy-code-console']");

	if (consoleCopyAction) {
		event.preventDefault();
		copyCodeConsoleOutput({ button: consoleCopyAction });
		return;
	}

	const codeRunAction = event.target.closest("[data-action='run-code-block']");

	if (codeRunAction) {
		event.preventDefault();
		runArticleCodeBlock({ button: codeRunAction });
		return;
	}

	const codeCopyAction = event.target.closest("[data-action='copy-code-block']");

	if (codeCopyAction) {
		event.preventDefault();
		copyArticleCodeBlock({ button: codeCopyAction });
		return;
	}

	const codeWrapAction = event.target.closest("[data-action='toggle-code-wrap']");

	if (codeWrapAction) {
		event.preventDefault();
		toggleArticleCodeWrap({ button: codeWrapAction });
		return;
	}

	const tableToolsAction = event.target.closest("[data-action='toggle-table-tools']");

	if (tableToolsAction) {
		event.preventDefault();
		toggleArticleTableTools({ button: tableToolsAction });
		return;
	}

	const tableSortAction = event.target.closest("[data-action='sort-table-column']");

	if (tableSortAction) {
		event.preventDefault();
		sortArticleTableByColumn({ button: tableSortAction });
		return;
	}

	const tableClearAction = event.target.closest("[data-action='clear-table-tools']");

	if (tableClearAction) {
		event.preventDefault();
		clearArticleTableTools({ button: tableClearAction });
		return;
	}

	const tableCopyAction = event.target.closest("[data-action='copy-table']");

	if (tableCopyAction) {
		event.preventDefault();
		copyArticleTable({ button: tableCopyAction });
		return;
	}

	const tableToggleAction = event.target.closest("[data-action='toggle-table']");

	if (tableToggleAction) {
		event.preventDefault();
		toggleArticleTable({ button: tableToggleAction });
		return;
	}

	const codeToggleAction = event.target.closest("[data-action='toggle-code-block']");

	if (codeToggleAction) {
		event.preventDefault();
		toggleArticleCodeBlock({ button: codeToggleAction });
		return;
	}

	const link = event.target.closest("[data-note-target]");

	if (!link) {
		return;
	}

	event.preventDefault();
	openNote({ path: link.dataset.noteTarget });
}

/**
 * Handles live table filter input.
 * @param {InputEvent} event
 * @returns {void}
 */
function handleArticleInput(event) {
	const input = event.target.closest("[data-action='filter-table']");

	if (!input) {
		return;
	}

	const embed = input.closest(".table-embed");
	const tableState = embed ? articleTableStates.get(embed) : null;

	if (!embed || !tableState) {
		return;
	}

	tableState.filterQuery = input.value;
	applyArticleTableView({ embed, reveal: true });
}

/**
 * Handles table tool select changes.
 * @param {Event} event
 * @returns {void}
 */
function handleArticleChange(event) {
	const control = event.target.closest("[data-action]");

	if (!control) {
		return;
	}

	const embed = control.closest(".table-embed");
	const tableState = embed ? articleTableStates.get(embed) : null;

	if (!embed || !tableState) {
		return;
	}

	if (control.dataset.action === "filter-table-column") {
		tableState.filterColumn = Number(control.value);
		applyArticleTableView({ embed, reveal: true });
		return;
	}

	if (control.dataset.action === "select-table-sort-column") {
		tableState.sortColumn = Number(control.value);
		tableState.sortDirection = tableState.sortColumn >= 0 ? "ascending" : "none";
		applyArticleTableView({ embed, reveal: false });
		return;
	}

	if (control.dataset.action === "select-table-sort-direction" && tableState.sortColumn >= 0) {
		tableState.sortDirection = control.value === "descending" ? "descending" : "ascending";
		applyArticleTableView({ embed, reveal: false });
	}
}

/**
 * Scrolls to a footnote or one of its references without changing the note route.
 * @param {object} params
 * @param {string} params.id
 * @returns {void}
 */
function scrollToFootnoteTarget({ id }) {
	const target = document.getElementById(id);

	if (!target || !select(selectors.article).contains(target)) {
		return;
	}

	target.scrollIntoView({ block: "center", behavior: "smooth" });
	target.focus({ preventScroll: true });
}

/**
 * Runs an article JavaScript block in an isolated iframe sandbox.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {void}
 */
function runArticleCodeBlock({ button }) {
	const wrapper = button.closest(".code-embed");
	const code = wrapper?.querySelector("pre code")?.textContent || "";

	if (!wrapper || !code) {
		return;
	}

	removeCodeRunner({ wrapper });

	const sessionId = `code-runner-${Date.now()}-${codeRunnerSessionCount += 1}`;
	const consoleElement = createCodeConsole();
	const iframe = createCodeRunnerFrame();
	const session = {
		button,
		consoleBody: consoleElement.querySelector(".code-console-body"),
		consoleCopyButton: consoleElement.querySelector("[data-action='copy-code-console']"),
		consoleElement,
		consoleStatus: consoleElement.querySelector(".code-console-status"),
		code,
		iframe,
		lineCount: 0,
		readyTimer: 0,
		sessionId,
		wrapper
	};

	iframe.name = JSON.stringify({
		channel: codeRunnerChannel,
		action: "execute",
		code,
		sessionId
	});
	wrapper.dataset.codeRunnerSession = sessionId;
	wrapper.append(consoleElement, iframe);
	codeRunnerSessions.set(sessionId, session);
	setCodeRunButtonState({ button, running: true });
	iframe.src = new URL("code-runner.html", document.baseURI).href;
	session.readyTimer = window.setTimeout(function handleCodeRunnerReadyTimeout() {
		failCodeRunner({ session, message: "The JavaScript sandbox could not be started." });
	}, 5000);
}

/**
 * Creates the visible console for a runnable code block.
 * @returns {HTMLElement}
 */
function createCodeConsole() {
	const consoleElement = document.createElement("section");
	const header = document.createElement("div");
	const title = document.createElement("span");
	const controls = document.createElement("span");
	const status = document.createElement("span");
	const body = document.createElement("div");
	const copyButton = createCodeConsoleActionButton({
		action: "copy-code-console",
		icon: "fa-regular fa-copy",
		label: "Copy console output",
		disabled: true
	});
	const closeButton = createCodeConsoleActionButton({
		action: "close-code-console",
		icon: "fa-solid fa-xmark",
		label: "Close console",
		disabled: false
	});

	consoleElement.className = "code-console";
	consoleElement.setAttribute("aria-label", "JavaScript console");
	header.className = "code-console-header";
	title.className = "code-console-title";
	title.innerHTML = `<i class="fa-solid fa-terminal" aria-hidden="true"></i><span>Console</span>`;
	controls.className = "code-console-controls";
	status.className = "code-console-status";
	status.textContent = "Running…";
	body.className = "code-console-body";
	body.setAttribute("role", "log");
	body.setAttribute("aria-live", "polite");
	controls.append(status, copyButton, closeButton);
	header.append(title, controls);
	consoleElement.append(header, body);

	return consoleElement;
}

/**
 * Creates an icon action for the JavaScript console header.
 * @param {object} params
 * @param {string} params.action
 * @param {string} params.icon
 * @param {string} params.label
 * @param {boolean} params.disabled
 * @returns {HTMLButtonElement}
 */
function createCodeConsoleActionButton({ action, icon, label, disabled }) {
	const button = document.createElement("button");

	button.className = "code-console-action";
	button.type = "button";
	button.dataset.action = action;
	button.disabled = disabled;
	button.setAttribute("aria-label", label);
	button.title = label;
	button.innerHTML = `<i class="${escapeAttribute(icon)}" aria-hidden="true"></i>`;

	return button;
}

/**
 * Creates the hidden sandbox frame that hosts code execution.
 * @returns {HTMLIFrameElement}
 */
function createCodeRunnerFrame() {
	const iframe = document.createElement("iframe");

	iframe.className = "code-runner-frame";
	iframe.title = "JavaScript code execution sandbox";
	iframe.tabIndex = -1;
	iframe.setAttribute("aria-hidden", "true");
	iframe.setAttribute("sandbox", "allow-scripts");

	return iframe;
}

/**
 * Handles messages from isolated code runner frames.
 * @param {MessageEvent} event
 * @returns {void}
 */
function handleCodeRunnerMessage(event) {
	const data = event.data;

	if (!data || data.channel !== codeRunnerChannel) {
		return;
	}

	const session = findCodeRunnerSession({ source: event.source });

	if (!session || (data.sessionId && data.sessionId !== session.sessionId)) {
		return;
	}

	window.clearTimeout(session.readyTimer);

	if (data.action === "ready") {
		session.consoleStatus.textContent = "Running…";
		session.iframe.contentWindow?.postMessage({
			channel: codeRunnerChannel,
			action: "execute",
			code: session.code,
			sessionId: session.sessionId
		}, "*");
		return;
	}

	if (data.action === "output") {
		appendCodeConsoleLine({
			session,
			level: data.level,
			values: Array.isArray(data.values) ? data.values : []
		});
		return;
	}

	if (data.action === "complete") {
		completeCodeRunner({ session });
		return;
	}

	if (data.action === "failed") {
		failCodeRunner({ session, message: data.message || "JavaScript execution failed." });
	}
}

/**
 * Finds a code runner session by its message source.
 * @param {object} params
 * @param {MessageEventSource|null} params.source
 * @returns {object|null}
 */
function findCodeRunnerSession({ source }) {
	const sessions = Array.from(codeRunnerSessions.values());

	for (let index = 0; index < sessions.length; index += 1) {
		if (sessions[index].iframe.contentWindow === source) {
			return sessions[index];
		}
	}

	return null;
}

/**
 * Appends one captured console call to the visible console.
 * @param {object} params
 * @param {object} params.session
 * @param {string} params.level
 * @param {Array<string>} params.values
 * @returns {void}
 */
function appendCodeConsoleLine({ session, level, values }) {
	const allowedLevels = ["debug", "error", "info", "log", "warn"];
	const normalizedLevel = allowedLevels.includes(level) ? level : "log";
	const line = document.createElement("div");
	const label = document.createElement("span");
	const message = document.createElement("span");

	line.className = `code-console-line is-${normalizedLevel}`;
	label.className = "code-console-level";
	label.textContent = normalizedLevel;
	message.className = "code-console-message";
	message.textContent = values.join(" ");
	line.append(label, message);
	session.consoleBody.append(line);
	session.consoleCopyButton.disabled = false;
	session.lineCount += 1;
}

/**
 * Marks a code runner session as complete.
 * @param {object} params
 * @param {object} params.session
 * @returns {void}
 */
function completeCodeRunner({ session }) {
	session.consoleStatus.textContent = "Completed";
	setCodeRunButtonState({ button: session.button, running: false });

	if (!session.lineCount) {
		appendCodeConsoleLine({
			session,
			level: "log",
			values: ["No console output."]
		});
		session.consoleBody.lastElementChild?.classList.add("is-empty");
	}
}

/**
 * Shows a runner failure in its attached console.
 * @param {object} params
 * @param {object} params.session
 * @param {string} params.message
 * @returns {void}
 */
function failCodeRunner({ session, message }) {
	window.clearTimeout(session.readyTimer);
	session.consoleStatus.textContent = "Failed";
	setCodeRunButtonState({ button: session.button, running: false });
	appendCodeConsoleLine({ session, level: "error", values: [message] });
}

/**
 * Updates a code block run button for execution state.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @param {boolean} params.running
 * @returns {void}
 */
function setCodeRunButtonState({ button, running }) {
	const icon = button.querySelector("i");
	const label = button.querySelector("span");
	const buttonLabel = running ? "Restart" : "Run";

	button.classList.toggle("is-running", running);
	button.setAttribute("aria-label", buttonLabel);
	button.title = buttonLabel;

	if (icon) {
		icon.className = running ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-play";
	}

	if (label) {
		label.textContent = buttonLabel;
	}
}

/**
 * Removes a code runner session from one code block.
 * @param {object} params
 * @param {HTMLElement} params.wrapper
 * @returns {void}
 */
function removeCodeRunner({ wrapper }) {
	const sessionId = wrapper.dataset.codeRunnerSession;
	const session = codeRunnerSessions.get(sessionId);

	if (!session) {
		return;
	}

	window.clearTimeout(session.readyTimer);
	session.consoleElement.remove();
	session.iframe.remove();
	codeRunnerSessions.delete(sessionId);
	delete wrapper.dataset.codeRunnerSession;
}

/**
 * Removes every active article code runner.
 * @returns {void}
 */
function removeArticleCodeRunners() {
	const sessions = Array.from(codeRunnerSessions.values());

	for (let index = 0; index < sessions.length; index += 1) {
		removeCodeRunner({ wrapper: sessions[index].wrapper });
	}
}

/**
 * Closes a code block console and stops its sandbox.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {void}
 */
function closeCodeConsole({ button }) {
	const wrapper = button.closest(".code-embed");

	if (!wrapper) {
		return;
	}

	removeCodeRunner({ wrapper });
	const runButton = wrapper.querySelector("[data-action='run-code-block']");

	if (runButton) {
		setCodeRunButtonState({ button: runButton, running: false });
	}
}

/**
 * Copies the captured output from one code block console.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {Promise<void>}
 */
async function copyCodeConsoleOutput({ button }) {
	const consoleElement = button.closest(".code-console");
	const text = consoleElement ? getCodeConsoleText({ consoleElement }) : "";
	const copied = text ? await copyText({
		text,
		successMessage: "Console output copied."
	}) : false;

	if (copied) {
		showCopyButtonCopiedState({ button });
	}
}

/**
 * Gets plain text from a rendered code console.
 * @param {object} params
 * @param {HTMLElement} params.consoleElement
 * @returns {string}
 */
function getCodeConsoleText({ consoleElement }) {
	const lines = consoleElement.querySelectorAll(".code-console-line");
	const output = [];

	for (let index = 0; index < lines.length; index += 1) {
		const level = lines[index].querySelector(".code-console-level")?.textContent || "log";
		const message = lines[index].querySelector(".code-console-message")?.textContent || "";
		output.push(`[${level}] ${message}`);
	}

	return output.join("\n");
}

/**
 * Copies article code block content.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {Promise<void>}
 */
async function copyArticleCodeBlock({ button }) {
	const wrapper = button.closest(".code-embed");
	const code = wrapper?.querySelector("pre code");
	const text = code?.textContent || "";
	const copied = text ? await copyText({
		text,
		successMessage: "Code copied."
	}) : false;

	if (copied) {
		showCopyButtonCopiedState({ button });
	}
}

/**
 * Toggles soft wrapping for one article code block.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {void}
 */
function toggleArticleCodeWrap({ button }) {
	const wrapper = button.closest(".code-embed");
	const label = button.querySelector("span");

	if (!wrapper) {
		return;
	}

	const wrapped = !wrapper.classList.contains("is-wrapped");
	const accessibleLabel = wrapped ? "Disable line wrapping" : "Wrap lines";

	wrapper.classList.toggle("is-wrapped", wrapped);
	button.classList.toggle("is-active", wrapped);
	button.setAttribute("aria-label", accessibleLabel);
	button.setAttribute("aria-pressed", String(wrapped));
	button.title = accessibleLabel;

	if (label) {
		label.textContent = wrapped ? "Unwrap" : "Wrap";
	}
}

/**
 * Copies a rendered table as tab-separated text.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {Promise<void>}
 */
async function copyArticleTable({ button }) {
	const embed = button.closest(".table-embed");
	const table = embed?.querySelector("table");
	const text = table ? getTableClipboardText({ table }) : "";
	const copied = text ? await copyText({
		text,
		successMessage: "Table copied."
	}) : false;

	if (copied) {
		showCopyButtonCopiedState({ button });
	}
}

/**
 * Gets tab-separated text from a rendered table.
 * @param {object} params
 * @param {HTMLTableElement} params.table
 * @returns {string}
 */
function getTableClipboardText({ table }) {
	const rows = table.querySelectorAll("tr");
	const lines = [];

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		if (rows[rowIndex].hidden) {
			continue;
		}

		const cells = rows[rowIndex].querySelectorAll("th, td");
		const values = [];

		for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
			values.push(normalizeTableCellText(cells[cellIndex].textContent || ""));
		}

		lines.push(values.join("\t"));
	}

	return lines.join("\n");
}

/**
 * Normalizes table cell text for clipboard output.
 * @param {string} text
 * @returns {string}
 */
function normalizeTableCellText(text) {
	return text.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes table text for case-insensitive filtering.
 * @param {string} text
 * @returns {string}
 */
function normalizeTableFilterText(text) {
	return normalizeTableCellText(text)
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase();
}

/**
 * Initializes sorting, filtering, and height controls for rendered tables.
 * @returns {void}
 */
function initializeArticleTables() {
	const article = select(selectors.article);
	const embeds = article.querySelectorAll(".table-embed");

	for (let index = 0; index < embeds.length; index += 1) {
		const embed = embeds[index];
		const scrollContainer = embed.querySelector(".table-scroll");
		const table = scrollContainer?.querySelector("table");
		const actions = embed.querySelector(".table-header-actions");

		if (!scrollContainer || !table || !actions) {
			continue;
		}

		const dimensions = getTableDimensions({ table });
		const tableState = createArticleTableState({
			dimensions,
			embed,
			index,
			scrollContainer,
			table
		});

		if (!tableState) {
			continue;
		}

		articleTableStates.set(embed, tableState);
		createArticleTableSortControls({ tableState });
		createArticleTableTools({ actions, tableState });
		applyArticleTableView({ embed, resetScroll: false, reveal: false });
		initializeArticleTableHeightControl({ actions, tableState });
	}
}

/**
 * Creates cached state for one rendered article table.
 * @param {object} params
 * @param {{ rows: number, columns: number }} params.dimensions
 * @param {HTMLElement} params.embed
 * @param {number} params.index
 * @param {HTMLElement} params.scrollContainer
 * @param {HTMLTableElement} params.table
 * @returns {object|null}
 */
function createArticleTableState({ dimensions, embed, index, scrollContainer, table }) {
	const body = table.tBodies[0];
	const headers = table.querySelectorAll("thead th");

	if (!body) {
		return null;
	}

	const labels = getArticleTableColumnLabels({ headers });
	const rows = getArticleTableRows({ body, columns: labels.length });
	const emptyState = document.createElement("div");
	const scrollId = `article-table-${index + 1}`;

	emptyState.className = "table-empty";
	emptyState.hidden = true;
	emptyState.textContent = "No table rows match the current filter.";
	scrollContainer.id = scrollId;
	scrollContainer.append(emptyState);

	return {
		body,
		columns: dimensions.columns,
		dimensions,
		embed,
		emptyState,
		filterColumn: -1,
		filterInput: null,
		filterQuery: "",
		filterSelect: null,
		headers: Array.from(headers),
		heightButton: null,
		labels,
		rows,
		scrollContainer,
		scrollId,
		sortColumn: -1,
		sortColumnSelect: null,
		sortDirection: "none",
		sortDirectionSelect: null,
		sortTypes: getArticleTableSortTypes({ columns: labels.length, rows }),
		table,
		toolsButton: null,
		toolsClearButton: null,
		toolsPanel: null,
		visibleRows: dimensions.rows
	};
}

/**
 * Gets accessible plain-text labels for table columns.
 * @param {object} params
 * @param {NodeListOf<HTMLTableCellElement>} params.headers
 * @returns {string[]}
 */
function getArticleTableColumnLabels({ headers }) {
	const labels = [];

	for (let index = 0; index < headers.length; index += 1) {
		labels.push(normalizeTableCellText(headers[index].textContent || "") || `Column ${index + 1}`);
	}

	return labels;
}

/**
 * Caches original table rows and their cell values.
 * @param {object} params
 * @param {HTMLTableSectionElement} params.body
 * @param {number} params.columns
 * @returns {object[]}
 */
function getArticleTableRows({ body, columns }) {
	const rows = [];

	for (let rowIndex = 0; rowIndex < body.rows.length; rowIndex += 1) {
		const row = body.rows[rowIndex];
		const values = [];
		const filterValues = [];

		for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
			const value = normalizeTableCellText(row.cells[columnIndex]?.textContent || "");

			values.push(value);
			filterValues.push(normalizeTableFilterText(value));
		}

		rows.push({
			element: row,
			filterValues,
			originalIndex: rowIndex,
			values
		});
	}

	return rows;
}

/**
 * Infers conservative sort types for table columns.
 * @param {object} params
 * @param {number} params.columns
 * @param {object[]} params.rows
 * @returns {string[]}
 */
function getArticleTableSortTypes({ columns, rows }) {
	const types = [];

	for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
		const values = [];

		for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
			if (rows[rowIndex].values[columnIndex]) {
				values.push(rows[rowIndex].values[columnIndex]);
			}
		}

		types.push(inferArticleTableSortType(values));
	}

	return types;
}

/**
 * Infers a number, ISO date, or text comparator for one column.
 * @param {string[]} values
 * @returns {string}
 */
function inferArticleTableSortType(values) {
	if (!values.length) {
		return "text";
	}

	let numbers = true;
	let dates = true;

	for (let index = 0; index < values.length; index += 1) {
		numbers = numbers && parseArticleTableNumber(values[index]) !== null;
		dates = dates && isArticleTableIsoDate(values[index]);
	}

	if (numbers) {
		return "number";
	}

	return dates ? "date" : "text";
}

/**
 * Adds direct sort buttons to table column headings.
 * @param {object} params
 * @param {object} params.tableState
 * @returns {void}
 */
function createArticleTableSortControls({ tableState }) {
	if (tableState.rows.length < 2) {
		return;
	}

	for (let index = 0; index < tableState.headers.length; index += 1) {
		const header = tableState.headers[index];
		const layout = document.createElement("span");
		const content = document.createElement("span");
		const button = document.createElement("button");

		layout.className = "table-heading-layout";
		content.className = "table-heading-content";
		button.className = "table-sort-button";
		button.type = "button";
		button.dataset.action = "sort-table-column";
		button.dataset.column = String(index);
		button.setAttribute("aria-label", `Sort by ${tableState.labels[index]} ascending`);
		button.title = `Sort by ${tableState.labels[index]} ascending`;
		button.innerHTML = `<i class="fa-solid fa-sort" aria-hidden="true"></i>`;

		while (header.firstChild) {
			content.append(header.firstChild);
		}

		layout.append(content, button);
		header.append(layout);
	}
}

/**
 * Adds the scoped filter and responsive sort panel to a long table.
 * @param {object} params
 * @param {HTMLElement} params.actions
 * @param {object} params.tableState
 * @returns {void}
 */
function createArticleTableTools({ actions, tableState }) {
	if (tableState.rows.length <= maximumUncontrolledTableRows || !tableState.labels.length) {
		return;
	}

	const button = document.createElement("button");
	const panel = document.createElement("div");
	const panelId = `${tableState.scrollId}-tools`;
	const columnOptions = createArticleTableColumnOptions({ labels: tableState.labels });

	button.className = "table-action";
	button.type = "button";
	button.dataset.action = "toggle-table-tools";
	button.setAttribute("aria-controls", panelId);
	button.setAttribute("aria-expanded", "false");
	button.setAttribute("aria-label", "Table tools");
	button.title = "Table tools";
	button.innerHTML = `<i class="fa-solid fa-sliders" aria-hidden="true"></i><span>Tools</span>`;

	panel.className = "table-tools";
	panel.id = panelId;
	panel.hidden = true;
	panel.setAttribute("aria-label", "Table tools");
	panel.innerHTML = `
		<label class="table-tools-field table-tools-search">
			<span class="table-tools-label">Filter</span>
			<span class="table-filter-input">
				<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
				<input type="search" placeholder="Filter rows…" autocomplete="off" data-action="filter-table">
			</span>
		</label>
		<label class="table-tools-field">
			<span class="table-tools-label">Filter column</span>
			<select data-action="filter-table-column">
				<option value="-1">All columns</option>
				${columnOptions}
			</select>
		</label>
		<label class="table-tools-field">
			<span class="table-tools-label">Sort by</span>
			<select data-action="select-table-sort-column">
				<option value="-1">Original order</option>
				${columnOptions}
			</select>
		</label>
		<label class="table-tools-field">
			<span class="table-tools-label">Direction</span>
			<select data-action="select-table-sort-direction" disabled>
				<option value="ascending">Ascending</option>
				<option value="descending">Descending</option>
			</select>
		</label>
		<button class="table-tools-clear" type="button" data-action="clear-table-tools" disabled>
			<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
			<span>Reset</span>
		</button>
	`;

	tableState.toolsButton = button;
	tableState.toolsPanel = panel;
	tableState.toolsClearButton = panel.querySelector("[data-action='clear-table-tools']");
	tableState.filterInput = panel.querySelector("[data-action='filter-table']");
	tableState.filterSelect = panel.querySelector("[data-action='filter-table-column']");
	tableState.sortColumnSelect = panel.querySelector("[data-action='select-table-sort-column']");
	tableState.sortDirectionSelect = panel.querySelector("[data-action='select-table-sort-direction']");
	actions.prepend(button);
	tableState.embed.insertBefore(panel, tableState.scrollContainer);
}

/**
 * Creates escaped select options for table columns.
 * @param {object} params
 * @param {string[]} params.labels
 * @returns {string}
 */
function createArticleTableColumnOptions({ labels }) {
	const options = [];

	for (let index = 0; index < labels.length; index += 1) {
		options.push(`<option value="${index}">${escapeHtml(labels[index])}</option>`);
	}

	return options.join("");
}

/**
 * Adds a height control when the original table exceeds the preview area.
 * @param {object} params
 * @param {HTMLElement} params.actions
 * @param {object} params.tableState
 * @returns {void}
 */
function initializeArticleTableHeightControl({ actions, tableState }) {
	tableState.embed.classList.add("is-preview");

	if (tableState.rows.length <= maximumUncontrolledTableRows || tableState.table.offsetHeight <= tableState.scrollContainer.clientHeight + 1) {
		tableState.embed.classList.remove("is-preview");
		return;
	}

	const button = createTableToggleButton({
		scrollId: tableState.scrollId,
		rows: tableState.rows.length
	});

	tableState.embed.dataset.tableState = "preview";
	tableState.heightButton = button;
	actions.append(button);
	updateArticleTableToggle({ embed: tableState.embed, button });
}

/**
 * Creates the state control for a long rendered table.
 * @param {object} params
 * @param {string} params.scrollId
 * @param {number} params.rows
 * @returns {HTMLButtonElement}
 */
function createTableToggleButton({ scrollId, rows }) {
	const button = document.createElement("button");

	button.className = "table-action";
	button.type = "button";
	button.dataset.action = "toggle-table";
	button.dataset.tableRows = String(rows);
	button.setAttribute("aria-controls", scrollId);
	button.innerHTML = `<i class="fa-solid fa-angles-down" aria-hidden="true"></i><span>Show all</span>`;

	return button;
}

/**
 * Opens or closes one table's tools panel.
 * @param {object} params
 * @param {HTMLButtonElement} params.button
 * @returns {void}
 */
function toggleArticleTableTools({ button }) {
	const embed = button.closest(".table-embed");
	const tableState = embed ? articleTableStates.get(embed) : null;

	if (!embed || !tableState?.toolsPanel) {
		return;
	}

	const open = tableState.toolsPanel.hidden;

	setArticleTableToolsOpen({ open, tableState });

	if (open) {
		tableState.filterInput?.focus();
	}
}

/**
 * Sets the visibility and accessibility state of one table tools panel.
 * @param {object} params
 * @param {boolean} params.open
 * @param {object} params.tableState
 * @returns {void}
 */
function setArticleTableToolsOpen({ open, tableState }) {
	tableState.toolsPanel.hidden = !open;
	tableState.toolsButton.classList.toggle("is-open", open);
	tableState.toolsButton.setAttribute("aria-expanded", String(open));
}

/**
 * Restores the original unfiltered and unsorted table view.
 * @param {object} params
 * @param {HTMLButtonElement} params.button
 * @returns {void}
 */
function clearArticleTableTools({ button }) {
	const embed = button.closest(".table-embed");
	const tableState = embed ? articleTableStates.get(embed) : null;

	if (!embed || !tableState) {
		return;
	}

	tableState.filterColumn = -1;
	tableState.filterQuery = "";
	tableState.sortColumn = -1;
	tableState.sortDirection = "none";
	applyArticleTableView({ embed, resetScroll: true, reveal: true });
	tableState.filterInput?.focus();
}

/**
 * Cycles a direct column sort through ascending, descending, and original order.
 * @param {object} params
 * @param {HTMLButtonElement} params.button
 * @returns {void}
 */
function sortArticleTableByColumn({ button }) {
	const embed = button.closest(".table-embed");
	const tableState = embed ? articleTableStates.get(embed) : null;
	const column = Number(button.dataset.column);

	if (!embed || !tableState || !Number.isInteger(column)) {
		return;
	}

	if (tableState.sortColumn !== column) {
		tableState.sortColumn = column;
		tableState.sortDirection = "ascending";
	} else if (tableState.sortDirection === "ascending") {
		tableState.sortDirection = "descending";
	} else {
		tableState.sortColumn = -1;
		tableState.sortDirection = "none";
	}

	applyArticleTableView({ embed, resetScroll: true, reveal: false });
}

/**
 * Applies the current filter and stable sort to a rendered table.
 * @param {object} params
 * @param {HTMLElement} params.embed
 * @param {boolean} params.resetScroll
 * @param {boolean} params.reveal
 * @returns {void}
 */
function applyArticleTableView({ embed, resetScroll, reveal }) {
	const tableState = articleTableStates.get(embed);

	if (!tableState) {
		return;
	}

	const query = normalizeTableFilterText(tableState.filterQuery);
	const orderedRows = tableState.rows.slice();
	const fragment = document.createDocumentFragment();
	let visibleRows = 0;

	if (tableState.sortColumn >= 0 && tableState.sortDirection !== "none") {
		orderedRows.sort(function compareRows(firstRow, secondRow) {
			return compareArticleTableRows({ firstRow, secondRow, tableState });
		});
	}

	for (let index = 0; index < orderedRows.length; index += 1) {
		const row = orderedRows[index];
		const visible = doesArticleTableRowMatch({ query, row, tableState });

		row.element.hidden = !visible;
		row.element.classList.toggle("is-even-row", visible && visibleRows % 2 === 1);

		if (visible) {
			visibleRows += 1;
		}

		fragment.append(row.element);
	}

	tableState.body.append(fragment);
	tableState.visibleRows = visibleRows;
	tableState.table.hidden = visibleRows === 0;
	tableState.emptyState.hidden = visibleRows !== 0;

	if (resetScroll) {
		tableState.scrollContainer.scrollTop = 0;
	}

	if (tableState.heightButton && reveal) {
		setArticleTableState({ embed, stateName: "preview" });
	} else if (tableState.heightButton && visibleRows <= maximumUncontrolledTableRows && embed.dataset.tableState === "expanded") {
		setArticleTableState({ embed, stateName: "preview" });
	}

	updateArticleTableSummary({ tableState });
	updateArticleTableSortControls({ tableState });
	updateArticleTableTools({ tableState });

	if (tableState.heightButton) {
		tableState.heightButton.dataset.tableRows = String(visibleRows);
		updateArticleTableToggle({ embed, button: tableState.heightButton });
	}
}

/**
 * Checks whether one row matches the active scoped filter.
 * @param {object} params
 * @param {string} params.query
 * @param {object} params.row
 * @param {object} params.tableState
 * @returns {boolean}
 */
function doesArticleTableRowMatch({ query, row, tableState }) {
	if (!query) {
		return true;
	}

	if (tableState.filterColumn >= 0) {
		return Boolean(row.filterValues[tableState.filterColumn]?.includes(query));
	}

	for (let index = 0; index < row.filterValues.length; index += 1) {
		if (row.filterValues[index].includes(query)) {
			return true;
		}
	}

	return false;
}

/**
 * Compares two cached rows using the active stable column sort.
 * @param {object} params
 * @param {object} params.firstRow
 * @param {object} params.secondRow
 * @param {object} params.tableState
 * @returns {number}
 */
function compareArticleTableRows({ firstRow, secondRow, tableState }) {
	const column = tableState.sortColumn;
	const firstValue = firstRow.values[column] || "";
	const secondValue = secondRow.values[column] || "";

	if (!firstValue || !secondValue) {
		if (!firstValue && !secondValue) {
			return firstRow.originalIndex - secondRow.originalIndex;
		}

		return firstValue ? -1 : 1;
	}

	const type = tableState.sortTypes[column];
	let comparison = 0;

	if (type === "number") {
		comparison = parseArticleTableNumber(firstValue) - parseArticleTableNumber(secondValue);
	} else if (type === "date") {
		comparison = Date.parse(firstValue) - Date.parse(secondValue);
	} else {
		comparison = tableTextCollator.compare(firstValue, secondValue);
	}

	if (!comparison) {
		return firstRow.originalIndex - secondRow.originalIndex;
	}

	return tableState.sortDirection === "descending" ? comparison * -1 : comparison;
}

/**
 * Parses conservative Markdown-table number formats.
 * @param {string} value
 * @returns {number|null}
 */
function parseArticleTableNumber(value) {
	const normalized = value.replace(/\u00a0/g, " ").trim();

	if (!/^[+-]?(?:\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.\d+)?%?$/.test(normalized)) {
		return null;
	}

	const number = Number(normalized.replace(/[, %]/g, ""));

	return Number.isFinite(number) ? number : null;
}

/**
 * Checks whether a value is an unambiguous ISO date.
 * @param {string} value
 * @returns {boolean}
 */
function isArticleTableIsoDate(value) {
	return /^\d{4}-\d{2}-\d{2}(?:[T ]\S+)?$/.test(value) && Number.isFinite(Date.parse(value));
}

/**
 * Updates the generated table summary for filtered row counts.
 * @param {object} params
 * @param {object} params.tableState
 * @returns {void}
 */
function updateArticleTableSummary({ tableState }) {
	const summary = tableState.embed.querySelector(".table-summary");

	if (!summary) {
		return;
	}

	summary.textContent = formatTableSummary({
		columns: tableState.columns,
		rows: tableState.visibleRows,
		totalRows: tableState.rows.length
	});
}

/**
 * Formats generated table dimension metadata.
 * @param {object} params
 * @param {number} params.columns
 * @param {number} params.rows
 * @param {number} params.totalRows
 * @returns {string}
 */
function formatTableSummary({ columns, rows, totalRows }) {
	const rowLabel = totalRows !== rows
		? `${formatNumber(rows)} of ${formatNumber(totalRows)} rows`
		: `${formatNumber(rows)} ${rows === 1 ? "row" : "rows"}`;

	return `${rowLabel} × ${formatNumber(columns)} ${columns === 1 ? "column" : "columns"}`;
}

/**
 * Synchronizes direct heading sort buttons and accessibility state.
 * @param {object} params
 * @param {object} params.tableState
 * @returns {void}
 */
function updateArticleTableSortControls({ tableState }) {
	for (let index = 0; index < tableState.headers.length; index += 1) {
		const header = tableState.headers[index];
		const button = header.querySelector("[data-action='sort-table-column']");

		if (!button) {
			continue;
		}

		const active = tableState.sortColumn === index;
		const descending = active && tableState.sortDirection === "descending";
		const accessibleLabel = !active
			? `Sort by ${tableState.labels[index]} ascending`
			: descending ? "Restore original table order" : `Sort ${tableState.labels[index]} descending`;
		const icon = button.querySelector("i");

		button.classList.toggle("is-active", active);
		button.setAttribute("aria-label", accessibleLabel);
		button.title = accessibleLabel;

		if (active) {
			header.setAttribute("aria-sort", tableState.sortDirection);
		} else {
			header.removeAttribute("aria-sort");
		}

		if (icon) {
			icon.className = active
				? `fa-solid fa-arrow-${descending ? "down" : "up"}`
				: "fa-solid fa-sort";
		}
	}
}

/**
 * Synchronizes table tool fields and active-state styling.
 * @param {object} params
 * @param {object} params.tableState
 * @returns {void}
 */
function updateArticleTableTools({ tableState }) {
	if (!tableState.toolsPanel) {
		return;
	}

	const active = Boolean(tableState.filterQuery) || tableState.sortColumn >= 0;
	const resettable = active || tableState.filterColumn >= 0;

	if (tableState.filterInput.value !== tableState.filterQuery) {
		tableState.filterInput.value = tableState.filterQuery;
	}

	tableState.filterSelect.value = String(tableState.filterColumn);
	tableState.sortColumnSelect.value = String(tableState.sortColumn);
	tableState.sortDirectionSelect.value = tableState.sortDirection === "descending" ? "descending" : "ascending";
	tableState.sortDirectionSelect.disabled = tableState.sortColumn < 0;
	tableState.toolsClearButton.disabled = !resettable;
	tableState.toolsButton.classList.toggle("is-active", active);
	tableState.toolsButton.setAttribute("aria-label", active ? "Table tools, refinements active" : "Table tools");
	tableState.toolsButton.title = active ? "Table tools, refinements active" : "Table tools";
}

/**
 * Advances a long table from preview to expanded to collapsed.
 * @param {object} params
 * @param {HTMLButtonElement} params.button
 * @returns {void}
 */
function toggleArticleTable({ button }) {
	const embed = button.closest(".table-embed");
	const scrollContainer = embed?.querySelector(".table-scroll");

	if (!embed || !scrollContainer) {
		return;
	}

	const tableState = articleTableStates.get(embed);
	const currentState = embed.dataset.tableState;
	const nextState = currentState === "preview"
		? (tableState?.visibleRows > maximumUncontrolledTableRows ? "expanded" : "collapsed")
		: currentState === "expanded" ? "collapsed" : "preview";
	const previewScrollTop = currentState === "preview" ? scrollContainer.scrollTop : 0;

	setArticleTableState({ embed, stateName: nextState });
	updateArticleTableToggle({ embed, button });

	if (nextState === "expanded" && previewScrollTop > 0) {
		select(selectors.article).scrollTop += previewScrollTop;
	}

	if (nextState === "collapsed") {
		scrollContainer.scrollTo({ left: 0, top: 0 });
	}
}

/**
 * Applies one of the three supported long-table states.
 * @param {object} params
 * @param {HTMLElement} params.embed
 * @param {string} params.stateName
 * @returns {void}
 */
function setArticleTableState({ embed, stateName }) {
	embed.dataset.tableState = stateName;
	embed.classList.toggle("is-preview", stateName === "preview");
	embed.classList.toggle("is-expanded", stateName === "expanded");
	embed.classList.toggle("is-collapsed", stateName === "collapsed");
}

/**
 * Updates the long-table control to describe its next action.
 * @param {object} params
 * @param {HTMLElement} params.embed
 * @param {HTMLButtonElement} params.button
 * @returns {void}
 */
function updateArticleTableToggle({ embed, button }) {
	const icon = button.querySelector("i");
	const label = button.querySelector("span");
	const rows = formatNumber(Number(button.dataset.tableRows));
	const stateName = embed.dataset.tableState;
	const canExpand = Number(button.dataset.tableRows) > maximumUncontrolledTableRows;
	const control = stateName === "preview" && canExpand
		? { label: "Show all", accessibleLabel: `Show all ${rows} table rows`, icon: "fa-solid fa-angles-down" }
		: stateName === "expanded" || stateName === "preview"
			? { label: "Collapse", accessibleLabel: "Collapse table", icon: "fa-solid fa-chevron-up" }
			: { label: "Preview", accessibleLabel: "Preview table", icon: "fa-solid fa-chevron-down" };

	button.setAttribute("aria-expanded", String(stateName !== "collapsed"));
	button.setAttribute("aria-label", control.accessibleLabel);
	button.title = control.accessibleLabel;

	if (icon) {
		icon.className = control.icon;
	}

	if (label) {
		label.textContent = control.label;
	}
}

/**
 * Shows temporary copied state on a copy button.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {void}
 */
function showCopyButtonCopiedState({ button }) {
	const icon = button.querySelector("i");
	const label = button.querySelector("span");
	const activeTimer = Number(button.dataset.copyResetTimer);

	if (!button.dataset.copyOriginalLabel) {
		button.dataset.copyOriginalLabel = label?.textContent || "Copy";
		button.dataset.copyOriginalIcon = icon?.className || "fa-regular fa-copy";
		button.dataset.copyOriginalAriaLabel = button.getAttribute("aria-label") || "";
		button.dataset.copyOriginalTitle = button.title;
	}

	if (Number.isFinite(activeTimer)) {
		window.clearTimeout(activeTimer);
	}

	button.classList.add("is-copied");
	button.setAttribute("aria-label", "Copied");
	button.title = "Copied";

	if (icon) {
		icon.className = "fa-solid fa-check";
	}

	if (label) {
		label.textContent = "Copied";
	}

	const resetTimer = window.setTimeout(function resetCopyButtonState() {
		button.classList.remove("is-copied");
		button.setAttribute("aria-label", button.dataset.copyOriginalAriaLabel);
		button.title = button.dataset.copyOriginalTitle;

		if (icon) {
			icon.className = button.dataset.copyOriginalIcon;
		}

		if (label) {
			label.textContent = button.dataset.copyOriginalLabel;
		}

		delete button.dataset.copyOriginalAriaLabel;
		delete button.dataset.copyOriginalIcon;
		delete button.dataset.copyOriginalLabel;
		delete button.dataset.copyOriginalTitle;
		delete button.dataset.copyResetTimer;
	}, 1800);

	button.dataset.copyResetTimer = String(resetTimer);
}

/**
 * Toggles an article code block body.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {void}
 */
function toggleArticleCodeBlock({ button }) {
	const wrapper = button.closest(".code-embed");
	const icon = button.querySelector("i");
	const label = button.querySelector("span");

	if (!wrapper) {
		return;
	}

	const collapsed = !wrapper.classList.contains("is-collapsed");

	wrapper.classList.toggle("is-collapsed", collapsed);
	button.setAttribute("aria-expanded", String(!collapsed));
	button.setAttribute("aria-label", collapsed ? "Expand" : "Collapse");
	button.title = collapsed ? "Expand" : "Collapse";

	if (icon) {
		icon.className = collapsed ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
	}

	if (label) {
		label.textContent = collapsed ? "Expand" : "Collapse";
	}
}

/**
 * Scrolls the article viewport to the top.
 * @returns {void}
 */
function scrollArticleToTop() {
	select(selectors.article).scrollTo({
		top: 0,
		behavior: "smooth"
	});
}

/**
 * Handles article scrolling.
 * @returns {void}
 */
function handleArticleScroll() {
	scheduleArticleScrollState();
}

/**
 * Schedules article scroll-dependent interface updates.
 * @returns {void}
 */
function scheduleArticleScrollState() {
	if (state.articleScrollFrame) {
		return;
	}

	state.articleScrollFrame = window.requestAnimationFrame(() => {
		state.articleScrollFrame = 0;
		renderArticleScrollState();
	});
}

/**
 * Renders every interface element derived from the article scroll position.
 * @returns {void}
 */
function renderArticleScrollState() {
	renderArticleProgress();
	renderScrollTopButton();
}

/**
 * Updates the article reading progress indicator.
 * @returns {void}
 */
function renderArticleProgress() {
	const article = select(selectors.article);
	const progress = select(selectors.articleProgress);
	const value = select(selectors.articleProgressValue);
	const maximumScroll = Math.max(0, article.scrollHeight - article.clientHeight);
	const readingProgress = maximumScroll
		? Math.min(1, Math.max(0, article.scrollTop / maximumScroll))
		: 1;
	const percentage = Math.round(readingProgress * 100);
	const unavailable = article.hasAttribute("aria-busy")
		|| Boolean(article.querySelector(".article-load-error"));

	progress.hidden = state.activeView !== "note" || unavailable;
	progress.setAttribute("aria-valuenow", String(percentage));
	value.style.transform = `scaleX(${readingProgress})`;
}

/**
 * Shows the scroll-top button after a substantial reading distance.
 * @returns {void}
 */
function renderScrollTopButton() {
	const article = select(selectors.article);
	const button = select(selectors.scrollTopButton);
	const threshold = Math.max(minimumScrollTopOffset, article.clientHeight);
	button.hidden = article.scrollTop < threshold;
}

/**
 * Handles article text selections.
 * @returns {void}
 */
function handleSelectionChange() {
	window.requestAnimationFrame(renderSelectionMenu);
}

/**
 * Renders configured search providers in the selected-text menu.
 * @returns {void}
 */
function renderSelectionSearchProviders() {
	const providers = getSelectionSearchProviders();
	const search = select(selectors.selectionSearch);
	const direct = select(selectors.selectionSearchDirect);
	const options = select(selectors.selectionSearchOptions);
	const toggle = select(selectors.selectionSearchToggle);
	const toggleCount = select(selectors.selectionSearchToggleCount);
	const useDisclosure = providers.length > maximumInlineSelectionSearchProviders;
	const target = useDisclosure ? options : direct;

	state.selectionSearchProviders = providers;
	direct.replaceChildren();
	options.replaceChildren();
	direct.hidden = useDisclosure;
	options.hidden = true;
	toggle.hidden = !useDisclosure;
	toggle.setAttribute("aria-expanded", "false");
	toggleCount.textContent = formatNumber(providers.length);
	search.hidden = !providers.length;
	search.classList.remove("is-expanded");

	for (let index = 0; index < providers.length; index += 1) {
		target.append(createSelectionSearchButton({ provider: providers[index], providerIndex: index }));
	}
}

/**
 * Gets valid selected-text search providers from app config.
 * @returns {Array<object>}
 */
function getSelectionSearchProviders() {
	const configured = state.config.selectionMenu?.searchProviders;
	const providers = [];

	if (!Array.isArray(configured)) {
		return providers;
	}

	for (let index = 0; index < configured.length; index += 1) {
		const provider = configured[index];
		const label = String(provider?.label || "").trim();
		const urlTemplate = String(provider?.urlTemplate || "").trim();
		const configuredIcon = String(provider?.icon || "").trim();
		const icon = /^fa-(solid|regular|brands) fa-[a-z0-9-]+(?: fa-[a-z0-9-]+)*$/.test(configuredIcon)
			? configuredIcon
			: "fa-solid fa-magnifying-glass";

		if (!label || !isSelectionSearchUrlTemplate({ urlTemplate })) {
			continue;
		}

		providers.push({ icon, label, urlTemplate });
	}

	return providers;
}

/**
 * Checks a search URL template before it is exposed as an action.
 * @param {object} params
 * @param {string} params.urlTemplate
 * @returns {boolean}
 */
function isSelectionSearchUrlTemplate({ urlTemplate }) {
	if (!urlTemplate.includes("{selection}")) {
		return false;
	}

	try {
		const url = new URL(urlTemplate.replaceAll("{selection}", "selected-text"));
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (error) {
		return false;
	}
}

/**
 * Creates a configured selected-text search action.
 * @param {object} params
 * @param {object} params.provider
 * @param {number} params.providerIndex
 * @returns {HTMLButtonElement}
 */
function createSelectionSearchButton({ provider, providerIndex }) {
	const button = document.createElement("button");
	const icon = document.createElement("i");
	const label = document.createElement("span");

	button.type = "button";
	button.dataset.selectionSearchProvider = String(providerIndex);
	button.setAttribute("aria-label", `Search selected text with ${provider.label} (opens in a new tab)`);
	addNavigationSound({ element: button, cue: "droplet" });
	icon.className = provider.icon;
	icon.setAttribute("aria-hidden", "true");
	label.textContent = provider.label;
	button.append(icon, label);
	return button;
}

/**
 * Handles delegated selected-text menu actions.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleSelectionMenuClick(event) {
	const target = event.target instanceof Element ? event.target : null;
	const button = target?.closest("button");

	if (!button || !select(selectors.selectionMenu).contains(button)) {
		return;
	}

	if (button.matches(selectors.selectionSearchToggle)) {
		const expanded = button.getAttribute("aria-expanded") !== "true";
		setSelectionSearchExpanded({ expanded });
		return;
	}

	const providerIndex = Number(button.dataset.selectionSearchProvider);

	if (Number.isInteger(providerIndex) && state.selectionSearchProviders[providerIndex]) {
		searchSelectedText({ provider: state.selectionSearchProviders[providerIndex] });
	}
}

/**
 * Expands or collapses the configured provider list.
 * @param {object} params
 * @param {boolean} params.expanded
 * @returns {void}
 */
function setSelectionSearchExpanded({ expanded }) {
	const menu = select(selectors.selectionMenu);
	const search = select(selectors.selectionSearch);
	const options = select(selectors.selectionSearchOptions);
	const toggle = select(selectors.selectionSearchToggle);
	const disclosureIcon = toggle.querySelector(".selection-disclosure-icon");

	toggle.setAttribute("aria-expanded", String(expanded));
	options.hidden = !expanded;
	search.classList.toggle("is-expanded", expanded);
	disclosureIcon.className = expanded
		? "fa-solid fa-chevron-up selection-disclosure-icon"
		: "fa-solid fa-chevron-down selection-disclosure-icon";

	if (!menu.hidden && state.selectionRect) {
		window.requestAnimationFrame(() => {
			positionSelectionMenu({ menu, rect: state.selectionRect });
		});
	}
}

/**
 * Renders the selection tools menu near selected article text.
 * @returns {void}
 */
function renderSelectionMenu() {
	const menu = select(selectors.selectionMenu);
	const selection = window.getSelection();

	if (!menu.hidden && menu.contains(document.activeElement)) {
		return;
	}

	if (!selection || selection.isCollapsed || !state.activePath) {
		hideSelectionMenu();
		return;
	}

	const range = selection.rangeCount ? selection.getRangeAt(0) : null;
	const article = select(selectors.article);
	const selectedText = selection.toString().trim();

	if (
		!range ||
		countCharacters(selectedText) < minimumSelectionCharacters ||
		!isSelectionInsideArticle({ range, article })
	) {
		hideSelectionMenu();
		return;
	}

	const rect = getSelectionRect({ range });

	if (!rect) {
		hideSelectionMenu();
		return;
	}

	if (state.selectedText !== selectedText) {
		setSelectionSearchExpanded({ expanded: false });
	}

	state.selectedText = selectedText;
	state.selectionRect = {
		bottom: rect.bottom,
		left: rect.left,
		top: rect.top,
		width: rect.width
	};
	select(selectors.selectionCount).textContent = getSelectionCountLabel({ text: selectedText });
	select(selectors.qrSelectionButton).hidden = countCharacters(selectedText) > maximumQrCodeCharacters;
	menu.hidden = false;
	menu.style.visibility = "hidden";
	positionSelectionMenu({ menu, rect });
	menu.style.visibility = "";
}

/**
 * Gets the selection count label.
 * @param {object} params
 * @param {string} params.text
 * @returns {string}
 */
function getSelectionCountLabel({ text }) {
	const words = countWords(text);
	const characters = countCharacters(text);
	const wordLabel = words === 1 ? "word" : "words";
	const characterLabel = characters === 1 ? "character" : "characters";
	return `${formatNumber(words)} ${wordLabel}, ${formatNumber(characters)} ${characterLabel}`;
}

/**
 * Checks whether a selection range is inside the article.
 * @param {object} params
 * @param {Range} params.range
 * @param {Element} params.article
 * @returns {boolean}
 */
function isSelectionInsideArticle({ range, article }) {
	const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
		? range.commonAncestorContainer
		: range.commonAncestorContainer.parentElement;

	return Boolean(container && article.contains(container) && container.closest(".article-inner"));
}

/**
 * Gets a usable selection rectangle.
 * @param {object} params
 * @param {Range} params.range
 * @returns {DOMRect|null}
 */
function getSelectionRect({ range }) {
	const rect = range.getBoundingClientRect();

	if (rect.width || rect.height) {
		return rect;
	}

	const rects = range.getClientRects();

	if (rects.length) {
		return rects[0];
	}

	return null;
}

/**
 * Positions the selection menu within the viewport.
 * @param {object} params
 * @param {HTMLElement} params.menu
 * @param {DOMRect} params.rect
 * @returns {void}
 */
function positionSelectionMenu({ menu, rect }) {
	const edge = 12;
	const anchorGap = 14;
	menu.style.removeProperty("max-height");
	const width = menu.offsetWidth || 236;
	const naturalHeight = menu.offsetHeight || 160;
	const spaceAbove = rect.top - edge - anchorGap;
	const spaceBelow = window.innerHeight - rect.bottom - edge - anchorGap;
	const placement = naturalHeight <= spaceAbove || (naturalHeight > spaceBelow && spaceAbove >= spaceBelow)
		? "above"
		: "below";
	const availableHeight = placement === "above" ? spaceAbove : spaceBelow;
	const maximumHeight = Math.min(
		window.innerHeight - edge * 2,
		Math.max(80, availableHeight)
	);
	menu.style.maxHeight = `${Math.floor(maximumHeight)}px`;
	const height = menu.offsetHeight || Math.min(naturalHeight, maximumHeight);
	const preferredTop = placement === "above"
		? rect.top - height - anchorGap
		: rect.bottom + anchorGap;
	const left = Math.min(
		window.innerWidth - width - edge,
		Math.max(edge, rect.left + rect.width / 2 - width / 2)
	);
	const top = Math.min(
		window.innerHeight - height - edge,
		Math.max(edge, preferredTop)
	);
	const arrowLeft = Math.min(width - 18, Math.max(18, rect.left + rect.width / 2 - left));

	menu.dataset.placement = placement;
	menu.style.setProperty("--selection-arrow-left", `${arrowLeft}px`);
	menu.style.left = `${Math.max(edge, left)}px`;
	menu.style.top = `${Math.max(edge, top)}px`;
}

/**
 * Handles pointer presses outside the selection menu.
 * @param {PointerEvent} event
 * @returns {void}
 */
function handleDocumentPointerDown(event) {
	const menu = select(selectors.selectionMenu);
	const settingsWrap = event.target.closest(".floating-navigation-wrap");

	if (!menu.hidden && !menu.contains(event.target)) {
		hideSelectionMenu();
	}

	if (state.settingsOpen && !settingsWrap) {
		closeQuickSettings();
	}
}

/**
 * Hides the selected-text menu for page scrolling while allowing its provider list to scroll.
 * @param {Event} event
 * @returns {void}
 */
function handleSelectionMenuScroll(event) {
	const menu = select(selectors.selectionMenu);
	const target = event.target instanceof Node ? event.target : null;

	if (!target || !menu.contains(target)) {
		hideSelectionMenu();
	}
}

/**
 * Handles document-level clicks for dynamic article controls.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleDocumentClick(event) {
	const mapFullscreenLink = event.target.closest("[data-map-fullscreen]");

	if (mapFullscreenLink) {
		const mapEmbed = mapFullscreenLink.closest(".map-embed");
		const mapElement = mapEmbed?.querySelector("[data-map]");
		const map = mapElement ? getArticleMapByElement({ element: mapElement }) : null;

		event.preventDefault();

		if (mapElement) {
			openMapFullscreen({ mapElement, map });
		}
	}
}

/**
 * Handles keyboard selection changes.
 * @returns {void}
 */
function handleDocumentKeyUp() {
	window.requestAnimationFrame(renderSelectionMenu);
}

/**
 * Handles global keyboard shortcuts.
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleDocumentKeyDown(event) {
	if (event.key !== "Escape") {
		return;
	}

	const selectionMenu = select(selectors.selectionMenu);

	if (!selectionMenu.hidden) {
		const toggle = select(selectors.selectionSearchToggle);

		if (toggle.getAttribute("aria-expanded") === "true") {
			setSelectionSearchExpanded({ expanded: false });
			return;
		}

		hideSelectionMenu();
		return;
	}

	const openTableTools = select(".table-tools:not([hidden])");
	const tableEmbed = openTableTools?.closest(".table-embed");
	const tableState = tableEmbed ? articleTableStates.get(tableEmbed) : null;

	if (tableState) {
		setArticleTableToolsOpen({ open: false, tableState });
		tableState.toolsButton.focus();
		return;
	}

	if (state.settingsOpen) {
		closeQuickSettings();
		select("[data-action='toggle-settings']").focus();
	}
}

/**
 * Hides the selection menu.
 * @returns {void}
 */
function hideSelectionMenu() {
	const menu = select(selectors.selectionMenu);
	menu.hidden = true;
	state.selectedText = "";
	state.selectionRect = null;
	setSelectionSearchExpanded({ expanded: false });
}

/**
 * Renders markdown to HTML.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function renderMarkdown({ markdown }) {
	const visibleMarkdown = stripObsidianComments({ markdown });
	const footnoteResult = replaceFootnoteSyntax({ markdown: visibleMarkdown });
	const articleHtml = marked.parse(replaceWikiLinks({
		markdown: replaceComponentSyntax({ markdown: footnoteResult.markdown })
	}));
	const html = `${articleHtml}${createFootnotesMarkup({ footnotes: footnoteResult.footnotes })}`;
	return resolveRenderedContent({ html });
}

/**
 * Collects Obsidian-style footnotes and replaces their references with linked markers.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {{ markdown: string, footnotes: Array<object> }}
 */
function replaceFootnoteSyntax({ markdown }) {
	const extracted = extractFootnoteDefinitions({ markdown });
	const lines = extracted.markdown.split("\n");
	const output = [];
	const context = {
		definitions: extracted.definitions,
		footnotes: [],
		namedFootnotes: new Map()
	};
	let inlineCodeLength = 0;
	let fence = null;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];

		if (fence) {
			output.push(line);

			if (isClosingFenceLine({ line, marker: fence.marker, minimumLength: fence.length })) {
				fence = null;
			}

			continue;
		}

		if (!inlineCodeLength) {
			const opening = getFenceOpening(line);

			if (opening) {
				fence = opening;
				output.push(line);
				continue;
			}
		}

		const result = replaceFootnoteReferencesFromLine({
			lines,
			lineIndex,
			inlineCodeLength,
			context
		});

		output.push(result.line);
		inlineCodeLength = result.inlineCodeLength;
	}

	return { markdown: output.join("\n"), footnotes: context.footnotes };
}

/**
 * Extracts named footnote definitions outside code into a lookup.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {{ markdown: string, definitions: Map<string, string> }}
 */
function extractFootnoteDefinitions({ markdown }) {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const definitions = new Map();
	const output = [];
	let inlineCodeLength = 0;
	let fence = null;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];

		if (fence) {
			output.push(line);

			if (isClosingFenceLine({ line, marker: fence.marker, minimumLength: fence.length })) {
				fence = null;
			}

			continue;
		}

		if (!inlineCodeLength) {
			const opening = getFenceOpening(line);

			if (opening) {
				fence = opening;
				output.push(line);
				continue;
			}

			const definition = readFootnoteDefinition({ lines, lineIndex });

			if (definition) {
				if (!definitions.has(definition.label)) {
					definitions.set(definition.label, definition.markdown);
				}

				output.push("");
				lineIndex = definition.endIndex;
				continue;
			}
		}

		output.push(line);
		inlineCodeLength = getInlineCodeLengthAfterLine({
			lines,
			lineIndex,
			inlineCodeLength
		});
	}

	return { markdown: output.join("\n"), definitions };
}

/**
 * Reads one named footnote definition and its indented continuation lines.
 * @param {object} params
 * @param {Array<string>} params.lines
 * @param {number} params.lineIndex
 * @returns {object|null}
 */
function readFootnoteDefinition({ lines, lineIndex }) {
	const match = lines[lineIndex].match(/^\[\^([^\]\s]+)\]:[ \t]*(.*)$/);

	if (!match) {
		return null;
	}

	const contentLines = [match[2]];
	let endIndex = lineIndex;
	let candidateIndex = lineIndex + 1;

	while (candidateIndex < lines.length) {
		const continuation = lines[candidateIndex].match(/^(?:\t| {2,4})(.*)$/);

		if (continuation) {
			contentLines.push(continuation[1]);
			endIndex = candidateIndex;
			candidateIndex += 1;
			continue;
		}

		if (!lines[candidateIndex].trim()) {
			let nextContentIndex = candidateIndex + 1;

			while (nextContentIndex < lines.length && !lines[nextContentIndex].trim()) {
				nextContentIndex += 1;
			}

			if (nextContentIndex < lines.length && /^(?:\t| {2,})/.test(lines[nextContentIndex])) {
				while (candidateIndex < nextContentIndex) {
					contentLines.push("");
					candidateIndex += 1;
				}

				continue;
			}
		}

		break;
	}

	return {
		label: match[1],
		markdown: contentLines.join("\n").trim(),
		endIndex
	};
}

/**
 * Tracks inline-code state across one Markdown line.
 * @param {object} params
 * @param {Array<string>} params.lines
 * @param {number} params.lineIndex
 * @param {number} params.inlineCodeLength
 * @returns {number}
 */
function getInlineCodeLengthAfterLine({ lines, lineIndex, inlineCodeLength }) {
	const line = lines[lineIndex];
	let index = 0;

	while (index < line.length) {
		if (line[index] !== "`") {
			index += 1;
			continue;
		}

		const runLength = countCharacterRun({ text: line, startIndex: index, character: "`" });

		if (inlineCodeLength === runLength) {
			inlineCodeLength = 0;
		} else if (!inlineCodeLength && !isEscapedCharacter({ text: line, index }) && hasClosingInlineCodeRun({
			lines,
			lineIndex,
			startIndex: index + runLength,
			runLength
		})) {
			inlineCodeLength = runLength;
		}

		index += runLength;
	}

	return inlineCodeLength;
}

/**
 * Replaces footnote syntax outside inline code on one line.
 * @param {object} params
 * @param {Array<string>} params.lines
 * @param {number} params.lineIndex
 * @param {number} params.inlineCodeLength
 * @param {object} params.context
 * @returns {{ line: string, inlineCodeLength: number }}
 */
function replaceFootnoteReferencesFromLine({ lines, lineIndex, inlineCodeLength, context }) {
	const source = lines[lineIndex];
	let output = "";
	let index = 0;

	while (index < source.length) {
		if (source[index] === "`") {
			const runLength = countCharacterRun({ text: source, startIndex: index, character: "`" });

			output += source.slice(index, index + runLength);

			if (inlineCodeLength === runLength) {
				inlineCodeLength = 0;
			} else if (!inlineCodeLength && !isEscapedCharacter({ text: source, index }) && hasClosingInlineCodeRun({
				lines,
				lineIndex,
				startIndex: index + runLength,
				runLength
			})) {
				inlineCodeLength = runLength;
			}

			index += runLength;
			continue;
		}

		if (!inlineCodeLength && source.startsWith("^[", index) && !isEscapedCharacter({ text: source, index })) {
			const closingIndex = findFootnoteClosingBracket({ text: source, startIndex: index + 2 });
			const content = closingIndex < 0 ? "" : source.slice(index + 2, closingIndex).trim();

			if (content) {
				output += createFootnoteReferenceMarkup({ context, markdown: content });
				index = closingIndex + 1;
				continue;
			}
		}

		if (!inlineCodeLength && source.startsWith("[^", index) && source[index - 1] !== "!" && !isEscapedCharacter({ text: source, index })) {
			const closingIndex = findFootnoteClosingBracket({ text: source, startIndex: index + 2 });
			const label = closingIndex < 0 ? "" : source.slice(index + 2, closingIndex);

			if (label && context.definitions.has(label)) {
				output += createFootnoteReferenceMarkup({
					context,
					label,
					markdown: context.definitions.get(label)
				});
				index = closingIndex + 1;
				continue;
			}
		}

		output += source[index];
		index += 1;
	}

	return { line: output, inlineCodeLength };
}

/**
 * Finds the next unescaped closing bracket for footnote syntax.
 * @param {object} params
 * @param {string} params.text
 * @param {number} params.startIndex
 * @returns {number}
 */
function findFootnoteClosingBracket({ text, startIndex }) {
	for (let index = startIndex; index < text.length; index += 1) {
		if (text[index] === "]" && !isEscapedCharacter({ text, index })) {
			return index;
		}
	}

	return -1;
}

/**
 * Registers a footnote and creates one linked superscript reference.
 * @param {object} params
 * @param {object} params.context
 * @param {string} [params.label]
 * @param {string} params.markdown
 * @returns {string}
 */
function createFootnoteReferenceMarkup({ context, label = "", markdown }) {
	let footnote = label ? context.namedFootnotes.get(label) : null;

	if (!footnote) {
		footnote = {
			number: context.footnotes.length + 1,
			markdown,
			referenceIds: []
		};
		context.footnotes.push(footnote);

		if (label) {
			context.namedFootnotes.set(label, footnote);
		}
	}

	const occurrence = footnote.referenceIds.length + 1;
	const referenceId = `footnote-reference-${footnote.number}${occurrence > 1 ? `-${occurrence}` : ""}`;
	const footnoteId = `footnote-${footnote.number}`;
	footnote.referenceIds.push(referenceId);

	return `<sup class="footnote-reference"><a id="${referenceId}" class="footnote-reference-link" href="#${footnoteId}" data-footnote-target="${footnoteId}" role="doc-noteref" aria-label="Go to footnote ${footnote.number}">${footnote.number}</a></sup>`;
}

/**
 * Creates the collected footnote block appended to the rendered article.
 * @param {object} params
 * @param {Array<object>} params.footnotes
 * @returns {string}
 */
function createFootnotesMarkup({ footnotes }) {
	if (!footnotes.length) {
		return "";
	}

	let items = "";

	for (let index = 0; index < footnotes.length; index += 1) {
		const footnote = footnotes[index];
		const content = marked.parse(replaceWikiLinks({
			markdown: replaceComponentSyntax({ markdown: footnote.markdown })
		}));
		let backlinks = "";

		for (let referenceIndex = 0; referenceIndex < footnote.referenceIds.length; referenceIndex += 1) {
			const referenceId = footnote.referenceIds[referenceIndex];
			const occurrenceLabel = referenceIndex ? `, occurrence ${referenceIndex + 1}` : "";
			backlinks += `<a class="footnote-backlink" href="#${referenceId}" data-footnote-target="${referenceId}" role="doc-backlink" aria-label="Back to reference ${footnote.number}${occurrenceLabel}"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></a>`;
		}

		items += `<li id="footnote-${footnote.number}" class="footnote-item" tabindex="-1" role="doc-endnote"><span class="footnote-number" aria-hidden="true">${footnote.number}</span><div class="footnote-content">${content}</div><span class="footnote-backlinks">${backlinks}</span></li>`;
	}

	return `<section class="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol role="list">${items}</ol></section>`;
}

/**
 * Removes Obsidian comments outside fenced and inline code.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function stripObsidianComments({ markdown }) {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const output = [];
	let inComment = false;
	let inlineCodeLength = 0;
	let fence = null;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];

		if (fence) {
			output.push(line);

			if (isClosingFenceLine({
				line,
				marker: fence.marker,
				minimumLength: fence.length
			})) {
				fence = null;
			}

			continue;
		}

		if (!inComment && !inlineCodeLength) {
			const opening = getFenceOpening(line);

			if (opening) {
				fence = opening;
				output.push(line);
				continue;
			}
		}

		const result = stripObsidianCommentsFromLine({
			lines,
			lineIndex,
			inComment,
			inlineCodeLength
		});

		output.push(result.line);
		inComment = result.inComment;
		inlineCodeLength = result.inlineCodeLength;

		if (!inComment && !inlineCodeLength) {
			fence = getFenceOpening(result.line);
		}
	}

	return output.join("\n");
}

/**
 * Removes comment ranges from one non-fenced Markdown line.
 * @param {object} params
 * @param {Array<string>} params.lines
 * @param {number} params.lineIndex
 * @param {boolean} params.inComment
 * @param {number} params.inlineCodeLength
 * @returns {{ line: string, inComment: boolean, inlineCodeLength: number }}
 */
function stripObsidianCommentsFromLine({ lines, lineIndex, inComment, inlineCodeLength }) {
	const source = lines[lineIndex];
	let output = "";
	let index = 0;

	while (index < source.length) {
		if (inComment) {
			if (source.startsWith("%%", index) && !isEscapedCharacter({ text: source, index })) {
				inComment = false;
				index += 2;
			} else {
				index += 1;
			}

			continue;
		}

		if (!inlineCodeLength && source.startsWith("%%", index) && !isEscapedCharacter({ text: source, index })) {
			inComment = true;
			index += 2;
			continue;
		}

		if (source[index] === "`") {
			const runLength = countCharacterRun({ text: source, startIndex: index, character: "`" });

			output += source.slice(index, index + runLength);

			if (inlineCodeLength === runLength) {
				inlineCodeLength = 0;
			} else if (!inlineCodeLength && !isEscapedCharacter({ text: source, index }) && hasClosingInlineCodeRun({
				lines,
				lineIndex,
				startIndex: index + runLength,
				runLength
			})) {
				inlineCodeLength = runLength;
			}

			index += runLength;
			continue;
		}

		output += source[index];
		index += 1;
	}

	return { line: output, inComment, inlineCodeLength };
}

/**
 * Checks whether an inline-code delimiter has a matching run before a paragraph break.
 * @param {object} params
 * @param {Array<string>} params.lines
 * @param {number} params.lineIndex
 * @param {number} params.startIndex
 * @param {number} params.runLength
 * @returns {boolean}
 */
function hasClosingInlineCodeRun({ lines, lineIndex, startIndex, runLength }) {
	for (let candidateLineIndex = lineIndex; candidateLineIndex < lines.length; candidateLineIndex += 1) {
		const line = lines[candidateLineIndex];
		let index = candidateLineIndex === lineIndex ? startIndex : 0;

		if (candidateLineIndex > lineIndex && !line.trim()) {
			return false;
		}

		while (index < line.length) {
			if (line[index] !== "`") {
				index += 1;
				continue;
			}

			const candidateLength = countCharacterRun({ text: line, startIndex: index, character: "`" });

			if (candidateLength === runLength) {
				return true;
			}

			index += candidateLength;
		}
	}

	return false;
}

/**
 * Counts a consecutive run of one character.
 * @param {object} params
 * @param {string} params.text
 * @param {number} params.startIndex
 * @param {string} params.character
 * @returns {number}
 */
function countCharacterRun({ text, startIndex, character }) {
	let index = startIndex;

	while (text[index] === character) {
		index += 1;
	}

	return index - startIndex;
}

/**
 * Checks whether a character is preceded by an odd number of backslashes.
 * @param {object} params
 * @param {string} params.text
 * @param {number} params.index
 * @returns {boolean}
 */
function isEscapedCharacter({ text, index }) {
	let slashCount = 0;

	for (let slashIndex = index - 1; slashIndex >= 0 && text[slashIndex] === "\\"; slashIndex -= 1) {
		slashCount += 1;
	}

	return slashCount % 2 === 1;
}

/**
 * Replaces supported fenced components before Markdown parsing.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function replaceComponentSyntax({ markdown }) {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const output = [];

	for (let index = 0; index < lines.length; index += 1) {
		const opening = getFenceOpening(lines[index]);

		if (!opening) {
			output.push(lines[index]);
			continue;
		}

		const closingIndex = findClosingFenceIndex({
			lines,
			startIndex: index + 1,
			marker: opening.marker,
			minimumLength: opening.length
		});

		if (closingIndex < 0) {
			output.push(lines.slice(index).join("\n"));
			break;
		}

		const source = lines.slice(index + 1, closingIndex).join("\n");
		const placeholder = createComponentPlaceholder({ type: opening.info, source });

		if (placeholder) {
			output.push(placeholder);
		} else {
			output.push(lines.slice(index, closingIndex + 1).join("\n"));
		}

		index = closingIndex;
	}

	return output.join("\n");
}

/**
 * Creates markup for one supported fenced component.
 * @param {object} params
 * @param {string} params.type
 * @param {string} params.source
 * @returns {string}
 */
function createComponentPlaceholder({ type, source }) {
	if (type === "map" && state.config.maps?.enabled) {
		return createMapPlaceholder({ source });
	}

	if (type === "ticker") {
		return createTickerPlaceholder({ source });
	}

	if (type === "swot") {
		return createSwotPlaceholder({ source });
	}

	if (type === "pte") {
		return createPtePlaceholder({ source });
	}

	return "";
}

/**
 * Gets opening-fence metadata from a Markdown line.
 * @param {string} line
 * @returns {object|null}
 */
function getFenceOpening(line) {
	const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);

	if (!match) {
		return null;
	}

	return {
		marker: match[1][0],
		length: match[1].length,
		info: match[2].trim()
	};
}

/**
 * Checks whether a line closes the active fenced code block.
 * @param {object} params
 * @param {string} params.line
 * @param {string} params.marker
 * @param {number} params.minimumLength
 * @returns {boolean}
 */
function isClosingFenceLine({ line, marker, minimumLength }) {
	const match = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);

	return Boolean(match && match[1][0] === marker && match[1].length >= minimumLength);
}

/**
 * Finds a matching closing Markdown fence.
 * @param {object} params
 * @param {Array<string>} params.lines
 * @param {number} params.startIndex
 * @param {string} params.marker
 * @param {number} params.minimumLength
 * @returns {number}
 */
function findClosingFenceIndex({ lines, startIndex, marker, minimumLength }) {
	for (let index = startIndex; index < lines.length; index += 1) {
		if (isClosingFenceLine({ line: lines[index], marker, minimumLength })) {
			return index;
		}
	}

	return -1;
}

/**
 * Creates map placeholder markup.
 * @param {object} params
 * @param {string} params.source
 * @returns {string}
 */
function createMapPlaceholder({ source }) {
	const properties = parseComponentProperties({ source, allowedKeys: mapPropertyNames });
	const map = getMapValues(properties);
	const className = map.grayscale === "true" ? "map-canvas is-grayscale" : "map-canvas";
	const googleMapsUrl = getGoogleMapsUrl({ latitude: map.latitude, longitude: map.longitude });
	const coordinateLabel = formatCoordinates({ latitude: map.latitude, longitude: map.longitude });
	const labelMarkup = map.label
		? `<strong class="map-label">${escapeHtml(map.label)}</strong>`
		: "";
	const accessibleLabel = map.label || `Map at ${coordinateLabel}`;

	return `<figure class="map-embed"><div class="${className}" data-map data-lat="${escapeAttribute(map.latitude)}" data-lon="${escapeAttribute(map.longitude)}" data-zoom="${escapeAttribute(map.zoom)}" data-marker="${escapeAttribute(map.marker)}" data-grayscale="${escapeAttribute(map.grayscale)}" data-label="${escapeAttribute(map.label)}" aria-label="${escapeAttribute(accessibleLabel)}"></div><figcaption class="map-footer"><span class="map-details">${labelMarkup}<span class="map-data"><span class="map-coordinate-label" data-map-coordinates>${escapeHtml(coordinateLabel)}</span><span class="map-data-separator" aria-hidden="true">&middot;</span><span data-map-zoom>${escapeHtml(formatMapZoom(map.zoom))}</span></span></span><span class="map-footer-actions"><a href="${escapeAttribute(googleMapsUrl)}" target="_blank" rel="noreferrer" data-map-google><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>Google Maps</span></a><button type="button" data-map-fullscreen><i class="fa-solid fa-expand" aria-hidden="true"></i><span data-map-fullscreen-label>Fullscreen</span></button></span></figcaption></figure>`;
}

/**
 * Parses allowed one-property-per-line component source values.
 * @param {object} params
 * @param {string} params.source
 * @param {Array<string>} params.allowedKeys
 * @returns {object}
 */
function parseComponentProperties({ source, allowedKeys }) {
	const properties = {};
	const lines = source.replace(/\r\n/g, "\n").split("\n");

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].trim();
		const separatorIndex = line.indexOf(":");

		if (separatorIndex <= 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim().toLowerCase();
		const value = line.slice(separatorIndex + 1).trim();

		if (allowedKeys.includes(key)) {
			properties[key] = value;
		}
	}

	return properties;
}

/**
 * Creates a linked market ticker card.
 * @param {object} params
 * @param {string} params.source
 * @returns {string}
 */
function createTickerPlaceholder({ source }) {
	const properties = parseComponentProperties({ source, allowedKeys: tickerPropertyNames });
	const ticker = getTickerValues(properties);
	const marketMarkup = `<span class="ticker-market">${escapeHtml(ticker.market || "Market")}</span>`;
	const changeMarkup = ticker.change
		? `<span class="ticker-change ${getTickerChangeClass(ticker.change)}">${escapeHtml(ticker.change)}</span>`
		: "";
	const searchUrl = getTickerSearchUrl({ symbol: ticker.symbol, label: ticker.label });
	const searchTerm = ticker.symbol || ticker.label || "market instrument";
	const accessibleLabel = `${ticker.label}, ${ticker.market || "market"}, ticker ${ticker.symbol || "unavailable"}, quote ${ticker.quote}${ticker.change ? `, change ${ticker.change}` : ""}. Search Google for stock ticker ${searchTerm}`;

	return `<figure class="ticker-embed"><a class="ticker-link" href="${escapeAttribute(searchUrl)}" target="_blank" rel="noreferrer" aria-label="${escapeAttribute(accessibleLabel)}" title="Search Google for stock ticker ${escapeAttribute(searchTerm)}"><span class="ticker-identity">${marketMarkup}<strong class="ticker-label">${escapeHtml(ticker.label)}</strong><span class="ticker-symbol">${escapeHtml(ticker.symbol || "Symbol unavailable")}</span></span><span class="ticker-pricing"><span class="ticker-quote-row"><strong class="ticker-quote">${escapeHtml(ticker.quote)}</strong><i class="fa-solid fa-arrow-up-right-from-square ticker-search-icon" aria-hidden="true"></i></span>${changeMarkup}</span></a></figure>`;
}

/**
 * Creates a four-quadrant SWOT analysis card.
 * @param {object} params
 * @param {string} params.source
 * @returns {string}
 */
function createSwotPlaceholder({ source }) {
	const properties = parseComponentProperties({ source, allowedKeys: swotPropertyNames });
	const factors = getSwotFactors(properties);
	let quadrantMarkup = "";

	for (let index = 0; index < factors.length; index += 1) {
		quadrantMarkup += createSwotQuadrantMarkup(factors[index]);
	}

	return `<figure class="swot-embed" aria-label="SWOT analysis"><dl class="swot-grid">${quadrantMarkup}</dl></figure>`;
}

/**
 * Gets normalized labels and values for the four SWOT factors.
 * @param {object} params
 * @param {string} params.strengths
 * @param {string} params.weaknesses
 * @param {string} params.opportunities
 * @param {string} params.threats
 * @returns {Array<object>}
 */
function getSwotFactors({ strengths, weaknesses, opportunities, threats }) {
	return [
		{ key: "strengths", initial: "S", label: "Strengths", value: String(strengths || "").trim() || "—" },
		{ key: "weaknesses", initial: "W", label: "Weaknesses", value: String(weaknesses || "").trim() || "—" },
		{ key: "opportunities", initial: "O", label: "Opportunities", value: String(opportunities || "").trim() || "—" },
		{ key: "threats", initial: "T", label: "Threats", value: String(threats || "").trim() || "—" }
	];
}

/**
 * Creates one SWOT factor quadrant.
 * @param {object} params
 * @param {string} params.key
 * @param {string} params.initial
 * @param {string} params.label
 * @param {string} params.value
 * @returns {string}
 */
function createSwotQuadrantMarkup({ key, initial, label, value }) {
	return `<div class="swot-quadrant swot-${escapeAttribute(key)}"><dt class="swot-factor"><span class="swot-initial" aria-hidden="true">${escapeHtml(initial)}</span><span>${escapeHtml(label)}</span></dt><dd class="swot-value">${escapeHtml(value)}</dd></div>`;
}

/**
 * Creates a linked periodic table of elements.
 * @param {object} params
 * @param {string} params.source
 * @returns {string}
 */
function createPtePlaceholder({ source }) {
	const properties = parseComponentProperties({ source, allowedKeys: ptePropertyNames });
	const pte = getPteValues(properties);
	const linkConfig = getPeriodicTableLinkConfig();
	const highlightedSymbols = new Set(pte.elements);
	const hasHighlights = highlightedSymbols.size > 0;
	const className = hasHighlights ? "pte-embed has-highlights" : "pte-embed";
	const summary = hasHighlights
		? `${formatNumber(highlightedSymbols.size)} highlighted ${highlightedSymbols.size === 1 ? "element" : "elements"}`
		: `${formatNumber(periodicTableElements.length)} elements`;
	const elementMarkup = [];

	for (let index = 0; index < periodicTableElements.length; index += 1) {
		elementMarkup.push(createPteElementMarkup({
			element: periodicTableElements[index],
			highlightedSymbols,
			linkConfig
		}));
	}

	return `<figure class="${className}"><figcaption class="pte-header"><span class="pte-heading"><strong class="pte-label">${escapeHtml(pte.label)}</strong><span class="pte-summary">${escapeHtml(summary)}</span></span><span class="pte-service"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>${escapeHtml(linkConfig.label)} links</span></span></figcaption><div class="pte-scroll"><div class="pte-grid" aria-label="${escapeAttribute(pte.label)}">${elementMarkup.join("")}</div></div></figure>`;
}

/**
 * Creates one linked element tile.
 * @param {object} params
 * @param {object} params.element
 * @param {Set<string>} params.highlightedSymbols
 * @param {object} params.linkConfig
 * @returns {string}
 */
function createPteElementMarkup({ element, highlightedSymbols, linkConfig }) {
	const isHighlighted = highlightedSymbols.has(element.symbol);
	const className = isHighlighted ? "pte-element is-highlighted" : "pte-element";
	const url = getPeriodicTableElementUrl({ element, template: linkConfig.template });
	const accessibleLabel = `${element.name}, ${element.symbol}, atomic number ${element.atomicNumber}${isHighlighted ? ", highlighted" : ""}. Open in ${linkConfig.label}`;

	return `<a class="${className}" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer" data-column="${element.column}" data-row="${element.row}" aria-label="${escapeAttribute(accessibleLabel)}" title="${escapeAttribute(accessibleLabel)}"><span class="pte-number">${element.atomicNumber}</span><strong class="pte-symbol">${escapeHtml(element.symbol)}</strong><span class="pte-name">${escapeHtml(element.name)}</span></a>`;
}

/**
 * Normalizes periodic-table component values for display.
 * @param {object} params
 * @param {string} params.label
 * @param {string} params.elements
 * @returns {{ label: string, elements: Array<string> }}
 */
function getPteValues({ label, elements }) {
	const tokens = String(elements || "").split(/[\s,;|]+/);
	const symbols = [];

	for (let index = 0; index < tokens.length; index += 1) {
		const element = periodicTableElementLookup.get(tokens[index].trim().toLowerCase());

		if (element && !symbols.includes(element.symbol)) {
			symbols.push(element.symbol);
		}
	}

	return {
		label: String(label || "").trim() || "Periodic table of elements",
		elements: symbols
	};
}

/**
 * Gets the configured periodic-table link service.
 * @returns {{ label: string, template: string }}
 */
function getPeriodicTableLinkConfig() {
	return {
		label: String(state.config.periodicTable?.linkLabel || "").trim() || defaultPeriodicTableLinkLabel,
		template: String(state.config.periodicTable?.linkTemplate || "").trim() || defaultPeriodicTableLinkTemplate
	};
}

/**
 * Creates a case-insensitive element-symbol lookup.
 * @returns {Map<string, object>}
 */
function createPeriodicTableElementLookup() {
	const lookup = new Map();

	for (let index = 0; index < periodicTableElements.length; index += 1) {
		const element = periodicTableElements[index];
		lookup.set(element.symbol.toLowerCase(), element);
	}

	return lookup;
}

/**
 * Normalizes ticker component values for display.
 * @param {object} params
 * @param {string} params.symbol
 * @param {string} params.label
 * @param {string} params.quote
 * @param {string} params.market
 * @param {string} params.change
 * @returns {object}
 */
function getTickerValues({ symbol, label, quote, market, change }) {
	const normalizedSymbol = String(symbol || "").trim();
	const normalizedLabel = String(label || "").trim();

	return {
		symbol: normalizedSymbol,
		label: normalizedLabel || normalizedSymbol || "Market instrument",
		quote: String(quote || "").trim() || "—",
		market: String(market || "").trim(),
		change: String(change || "").trim()
	};
}

/**
 * Gets the visual state for a signed ticker change.
 * @param {string} change
 * @returns {string}
 */
function getTickerChangeClass(change) {
	const normalized = String(change || "").trim();

	if (/^(\+|↑)/.test(normalized)) {
		return "is-positive";
	}

	if (/^(-|−|↓)/.test(normalized)) {
		return "is-negative";
	}

	return "is-neutral";
}

/**
 * Gets a Google search URL for a ticker symbol.
 * @param {object} params
 * @param {string} params.symbol
 * @param {string} params.label
 * @returns {string}
 */
function getTickerSearchUrl({ symbol, label }) {
	const searchTerm = String(symbol || label || "").trim();
	const query = searchTerm ? `stock ticker ${searchTerm}` : "stock ticker";

	return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Formats coordinates for display.
 * @param {object} params
 * @param {string|number} params.latitude
 * @param {string|number} params.longitude
 * @returns {string}
 */
function formatCoordinates({ latitude, longitude }) {
	const lat = Number(latitude);
	const lon = Number(longitude);

	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return "0.000°, 0.000°";
	}

	return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
}

/**
 * Formats a MapLibre zoom value for display.
 * @param {number|string} zoom
 * @returns {string}
 */
function formatMapZoom(zoom) {
	const value = Number(zoom);

	if (!Number.isFinite(value)) {
		return "Zoom 0";
	}

	return `Zoom ${Number(value.toFixed(1))}`;
}

/**
 * Gets a Google Maps URL for explicit map coordinates.
 * @param {object} params
 * @param {string} params.latitude
 * @param {string} params.longitude
 * @returns {string}
 */
function getGoogleMapsUrl({ latitude, longitude }) {
	const hasLatitude = String(latitude || "").trim();
	const hasLongitude = String(longitude || "").trim();
	const lat = Number(latitude);
	const lon = Number(longitude);

	if (hasLatitude && hasLongitude && Number.isFinite(lat) && Number.isFinite(lon)) {
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
	}

	return "https://www.google.com/maps";
}

/**
 * Gets map values with config fallback.
 * @param {object} params
 * @param {string} params.latitude
 * @param {string} params.longitude
 * @param {string} params.zoom
 * @param {string} params.marker
 * @param {string} params.grayscale
 * @param {string} params.label
 * @returns {object}
 */
function getMapValues({ latitude, longitude, zoom, marker, grayscale, label }) {
	const fallback = getMapFallback();

	return {
		latitude: String(getNumberInRange({ value: latitude, fallback: fallback.latitude, minimum: -90, maximum: 90 })),
		longitude: String(getNumberInRange({ value: longitude, fallback: fallback.longitude, minimum: -180, maximum: 180 })),
		zoom: String(getNumberInRange({ value: zoom, fallback: fallback.zoom, minimum: 0, maximum: 22 })),
		marker: String(getBoolean({ value: marker, fallback: false })),
		grayscale: String(getBoolean({ value: grayscale, fallback: Boolean(state.config.maps?.grayscale) })),
		label: String(label || "").trim()
	};
}

/**
 * Gets an in-range number or fallback.
 * @param {object} params
 * @param {number|string} params.value
 * @param {number} params.fallback
 * @param {number} params.minimum
 * @param {number} params.maximum
 * @returns {number}
 */
function getNumberInRange({ value, fallback, minimum, maximum }) {
	const number = getFiniteNumber({ value, fallback });

	return number >= minimum && number <= maximum ? number : fallback;
}

/**
 * Gets a boolean from a boolean-like value or fallback.
 * @param {object} params
 * @param {boolean|string} params.value
 * @param {boolean} params.fallback
 * @returns {boolean}
 */
function getBoolean({ value, fallback }) {
	if (typeof value === "boolean") {
		return value;
	}

	const normalized = String(value || "").trim().toLowerCase();

	if (normalized === "true") {
		return true;
	}

	if (normalized === "false") {
		return false;
	}

	return fallback;
}

/**
 * Gets map fallback settings.
 * @returns {object}
 */
function getMapFallback() {
	const fallback = state.config.maps?.fallback || {};

	return {
		latitude: getFiniteNumber({ value: fallback.latitude, fallback: 0 }),
		longitude: getFiniteNumber({ value: fallback.longitude, fallback: 0 }),
		zoom: getFiniteNumber({ value: fallback.zoom, fallback: 2 })
	};
}

/**
 * Gets a finite number or fallback.
 * @param {object} params
 * @param {number|string} params.value
 * @param {number} params.fallback
 * @returns {number}
 */
function getFiniteNumber({ value, fallback }) {
	if (typeof value === "string" && !value.trim()) {
		return fallback;
	}

	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

/**
 * Replaces Obsidian-style wiki links before Markdown parsing.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function replaceWikiLinks({ markdown }) {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const output = [];

	for (let index = 0; index < lines.length; index += 1) {
		const opening = getFenceOpening(lines[index]);

		if (!opening) {
			output.push(replaceWikiLinksInText(lines[index]));
			continue;
		}

		const closingIndex = findClosingFenceIndex({
			lines,
			startIndex: index + 1,
			marker: opening.marker,
			minimumLength: opening.length
		});

		if (closingIndex < 0) {
			output.push(lines.slice(index).join("\n"));
			break;
		}

		output.push(lines.slice(index, closingIndex + 1).join("\n"));
		index = closingIndex;
	}

	return output.join("\n");
}

/**
 * Replaces wiki links in Markdown text outside fenced code blocks.
 * @param {string} text
 * @returns {string}
 */
function replaceWikiLinksInText(text) {
	return text
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, createWikiLinkWithLabel)
		.replace(/\[\[([^\]]+)\]\]/g, createWikiLink);
}

/**
 * Resolves links and repository-backed media in rendered Markdown.
 * @param {object} params
 * @param {string} params.html
 * @returns {string}
 */
function resolveRenderedContent({ html }) {
	const template = document.createElement("template");
	template.innerHTML = html;

	transformRenderedCallouts({ template });
	addRenderedHeadingIds({ template });
	wrapRenderedTables({ template });
	resolveRenderedMedia({ template });
	const links = template.content.querySelectorAll("a[href]");

	for (let index = 0; index < links.length; index += 1) {
		resolveRenderedLink({ link: links[index] });
	}

	return template.innerHTML;
}

/**
 * Resolves remote repository media through the configured revision-pinned CDN.
 * @param {object} params
 * @param {HTMLTemplateElement} params.template
 * @returns {void}
 */
function resolveRenderedMedia({ template }) {
	if (!state.config.github?.enabled) {
		return;
	}

	const sourceElements = template.content.querySelectorAll(
		"img[src], audio[src], video[src], source[src], track[src]"
	);
	const posterElements = template.content.querySelectorAll("video[poster]");

	for (let index = 0; index < sourceElements.length; index += 1) {
		resolveRenderedMediaAttribute({
			element: sourceElements[index],
			attribute: "src"
		});
	}

	for (let index = 0; index < posterElements.length; index += 1) {
		resolveRenderedMediaAttribute({
			element: posterElements[index],
			attribute: "poster"
		});
	}
}

/**
 * Resolves one rendered media URL attribute.
 * @param {object} params
 * @param {Element} params.element
 * @param {string} params.attribute
 * @returns {void}
 */
function resolveRenderedMediaAttribute({ element, attribute }) {
	const value = element.getAttribute(attribute);

	if (!value) {
		return;
	}

	const resolved = getArticleAssetUrl({ path: value });

	if (resolved && resolved !== value) {
		element.setAttribute(attribute, resolved);
	}

	if (element instanceof HTMLImageElement) {
		element.loading = "lazy";
		element.decoding = "async";
	}
}

/**
 * Transforms rendered Obsidian callout blockquotes into semantic callout elements.
 * @param {object} params
 * @param {HTMLTemplateElement} params.template
 * @returns {void}
 */
function transformRenderedCallouts({ template }) {
	const blockquotes = template.content.querySelectorAll("blockquote");

	for (let index = 0; index < blockquotes.length; index += 1) {
		const blockquote = blockquotes[index];
		const definition = getRenderedCalloutDefinition({ blockquote });

		if (!definition) {
			continue;
		}

		removeRenderedCalloutMarker({ paragraph: definition.paragraph, markerLength: definition.markerLength });
		blockquote.replaceWith(createRenderedCallout({ blockquote, definition, index }));
	}
}

/**
 * Reads a callout definition from the first rendered paragraph in a blockquote.
 * @param {object} params
 * @param {HTMLQuoteElement} params.blockquote
 * @returns {object|null}
 */
function getRenderedCalloutDefinition({ blockquote }) {
	const paragraph = blockquote.firstElementChild;

	if (!paragraph || paragraph.tagName !== "P") {
		return null;
	}

	const source = paragraph.innerHTML;
	const match = source.match(/^\[!([a-z][\w-]*)\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n|$)/i);

	if (!match) {
		return null;
	}

	const requestedType = match[1].toLowerCase();
	const type = Object.hasOwn(calloutTypeAliases, requestedType) ? calloutTypeAliases[requestedType] : requestedType;
	const supportedType = Object.hasOwn(calloutTypes, type) ? type : "note";

	return {
		paragraph,
		markerLength: match[0].length,
		type: supportedType,
		titleMarkup: match[3]?.trim() || escapeHtml(calloutTypes[supportedType].title),
		fold: match[2]
	};
}

/**
 * Removes the callout declaration while keeping content from the same paragraph.
 * @param {object} params
 * @param {HTMLParagraphElement} params.paragraph
 * @param {number} params.markerLength
 * @returns {void}
 */
function removeRenderedCalloutMarker({ paragraph, markerLength }) {
	paragraph.innerHTML = paragraph.innerHTML.slice(markerLength);

	if (!paragraph.textContent.trim() && !paragraph.children.length) {
		paragraph.remove();
	}
}

/**
 * Creates one semantic callout from rendered blockquote content.
 * @param {object} params
 * @param {HTMLQuoteElement} params.blockquote
 * @param {object} params.definition
 * @param {number} params.index
 * @returns {HTMLElement}
 */
function createRenderedCallout({ blockquote, definition, index }) {
	const callout = document.createElement(definition.fold ? "details" : "aside");
	const title = document.createElement(definition.fold ? "summary" : "div");
	const titleText = document.createElement("span");
	const content = document.createElement("div");

	callout.className = `callout callout-${definition.type}`;
	callout.dataset.callout = definition.type;
	callout.classList.toggle("is-foldable", Boolean(definition.fold));
	title.className = "callout-title";
	title.id = `callout-title-${index + 1}`;
	callout.setAttribute("aria-labelledby", title.id);
	titleText.className = "callout-title-text";
	titleText.innerHTML = definition.titleMarkup;
	content.className = "callout-content";
	title.append(titleText);

	if (definition.fold) {
		const foldIcon = document.createElement("span");
		foldIcon.className = "callout-fold-icon";
		foldIcon.setAttribute("aria-hidden", "true");
		foldIcon.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
		title.append(foldIcon);
		callout.open = definition.fold === "+";
	}

	while (blockquote.firstChild) {
		content.append(blockquote.firstChild);
	}

	callout.append(title, content);
	return callout;
}

/**
 * Wraps rendered Markdown tables with generated headers and scroll containers.
 * @param {object} params
 * @param {HTMLTemplateElement} params.template
 * @returns {void}
 */
function wrapRenderedTables({ template }) {
	const tables = template.content.querySelectorAll("table");

	for (let index = 0; index < tables.length; index += 1) {
		const table = tables[index];
		const embed = document.createElement("figure");
		const header = createTableHeader({ table });
		const scrollContainer = document.createElement("div");

		embed.className = "table-embed";
		scrollContainer.className = "table-scroll";
		table.before(embed);
		embed.append(header, scrollContainer);
		scrollContainer.append(table);
	}
}

/**
 * Creates a generated header for a rendered Markdown table.
 * @param {object} params
 * @param {HTMLTableElement} params.table
 * @returns {HTMLElement}
 */
function createTableHeader({ table }) {
	const header = document.createElement("figcaption");
	const summary = document.createElement("span");
	const actions = document.createElement("span");
	const button = document.createElement("button");
	const dimensions = getTableDimensions({ table });

	header.className = "table-header";
	summary.className = "table-summary";
	summary.setAttribute("aria-live", "polite");
	summary.textContent = formatTableSummary({
		columns: dimensions.columns,
		rows: dimensions.rows,
		totalRows: dimensions.rows
	});
	actions.className = "table-header-actions";
	button.className = "table-action";
	button.type = "button";
	button.dataset.action = "copy-table";
	button.setAttribute("aria-label", "Copy table");
	button.title = "Copy table";
	button.innerHTML = `<i class="fa-regular fa-copy" aria-hidden="true"></i><span>Copy</span>`;
	actions.append(button);
	header.append(summary, actions);

	return header;
}

/**
 * Counts the body rows and maximum columns in a rendered table.
 * @param {object} params
 * @param {HTMLTableElement} params.table
 * @returns {{ rows: number, columns: number }}
 */
function getTableDimensions({ table }) {
	const body = table.querySelector("tbody");
	const rows = table.querySelectorAll("tr");
	let columns = 0;

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const cells = rows[rowIndex].querySelectorAll("th, td");
		let rowColumns = 0;

		for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
			rowColumns += cells[cellIndex].colSpan;
		}

		columns = Math.max(columns, rowColumns);
	}

	return {
		rows: body ? body.querySelectorAll("tr").length : rows.length,
		columns
	};
}

/**
 * Adds stable IDs to rendered headings.
 * @param {object} params
 * @param {HTMLTemplateElement} params.template
 * @returns {void}
 */
function addRenderedHeadingIds({ template }) {
	const headings = template.content.querySelectorAll("h1, h2, h3, h4, h5, h6");
	const slugs = {};

	for (let index = 0; index < headings.length; index += 1) {
		const heading = headings[index];
		const headingCopy = heading.cloneNode(true);
		const references = headingCopy.querySelectorAll(".footnote-reference");

		for (let referenceIndex = 0; referenceIndex < references.length; referenceIndex += 1) {
			references[referenceIndex].remove();
		}

		const slug = getUniqueSlug({ text: headingCopy.textContent || "section", slugs });
		heading.id = slug;
	}
}

/**
 * Resolves a rendered link.
 * @param {object} params
 * @param {HTMLAnchorElement} params.link
 * @returns {void}
 */
function resolveRenderedLink({ link }) {
	const href = link.getAttribute("href") || "";

	if (href === "#" || href.startsWith("#")) {
		return;
	}

	if (isMarkdownPath(href)) {
		const note = findNoteByWikiTarget({ target: href });

		if (note) {
			link.setAttribute("href", "#");
			link.dataset.noteTarget = note.path;
			link.removeAttribute("target");
			link.removeAttribute("rel");
			return;
		}
	}

	link.href = getExternalLinkHref({ href });
	link.setAttribute("target", "_blank");
	link.setAttribute("rel", "noreferrer");
}

/**
 * Gets the final external link URL.
 * @param {object} params
 * @param {string} params.href
 * @returns {string}
 */
function getExternalLinkHref({ href }) {
	if (!isUtmEnabled() || !isHttpUrl({ href })) {
		return href;
	}

	try {
		const url = new URL(href, window.location.href);
		const params = state.config.externalLinks?.utm?.params || {};
		const keys = Object.keys(params);

		for (let index = 0; index < keys.length; index += 1) {
			const key = keys[index];

			if (params[key] && !url.searchParams.has(key)) {
				url.searchParams.set(key, params[key]);
			}
		}

		return url.toString();
	} catch (error) {
		return href;
	}
}

/**
 * Checks whether UTM rewriting is enabled.
 * @returns {boolean}
 */
function isUtmEnabled() {
	return Boolean(state.config.externalLinks?.utm?.enabled);
}

/**
 * Gets the configured GitHub repository URL.
 * @returns {string}
 */
function getGithubRepoUrl() {
	const owner = String(state.config.github?.owner || "").trim();
	const repo = String(state.config.github?.repo || "").trim();

	if (!owner || !repo) {
		return "";
	}

	return `https://github.com/${encodePathPart(owner)}/${encodePathPart(repo)}`;
}

/**
 * Gets the GitHub URL for a markdown article.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getGithubArticleUrl({ path }) {
	const repoUrl = getGithubRepoUrl();
	const branch = String(state.config.github?.branch || "main").trim();
	const rootPath = normalizePath(state.manifest.contentRoot || "");
	const notePath = normalizePath(path);
	const fullPath = rootPath ? `${rootPath}/${notePath}` : notePath;

	if (!repoUrl || !branch || !notePath) {
		return "";
	}

	return `${repoUrl}/blob/${encodePathPart(branch)}/${encodePath(fullPath)}`;
}

/**
 * Gets the public site URL for a markdown article.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getPublishedArticleUrl({ path }) {
	const siteUrl = getPublishedSiteUrl();
	const hash = getNoteHash({ path });

	if (!siteUrl) {
		return "";
	}

	return `${siteUrl}${hash}`;
}

/**
 * Gets the configured public site URL.
 * @returns {string}
 */
function getPublishedSiteUrl() {
	const customDomain = String(state.config.site?.customDomain || "").trim();
	const configuredUrl = String(state.config.site?.url || "").trim();
	const fallbackUrl = `${window.location.origin}${window.location.pathname}`;
	const siteUrl = customDomain || configuredUrl || fallbackUrl;
	const cleanUrl = siteUrl.split("#")[0].split("?")[0];

	if (!cleanUrl) {
		return "";
	}

	return cleanUrl.endsWith("/") ? cleanUrl : `${cleanUrl}/`;
}

/**
 * Gets the active article download URL.
 * @param {object} params
 * @param {object} params.note
 * @returns {string}
 */
function getArticleDownloadUrl({ note }) {
	return note.sourceUrl || "";
}

/**
 * Gets a jsDelivr URL for a repository path.
 * @param {object} params
 * @param {string} params.path
 * @param {string} [params.rootPath]
 * @param {string} [params.revision]
 * @returns {string}
 */
function getGithubCdnUrl({ path, rootPath, revision }) {
	const github = state.config.github || {};
	const owner = String(github.owner || "").trim();
	const repo = String(github.repo || "").trim();
	const contentRevision = String(revision || state.manifest.revision || github.branch || "main").trim();
	const resolvedRootPath = normalizePath(rootPath === undefined ? state.manifest.contentRoot || "" : rootPath);
	const articlePath = normalizePath(path);
	const fullPath = joinRepoPath({ rootPath: resolvedRootPath, path: articlePath });

	if (!owner || !repo || !contentRevision || !articlePath) {
		return "";
	}

	return `https://cdn.jsdelivr.net/gh/${encodePathPart(owner)}/${encodePathPart(repo)}@${encodePathPart(contentRevision)}/${encodePath(fullPath)}`;
}

/**
 * Joins a repository root path and item path without duplicating roots.
 * @param {object} params
 * @param {string} params.rootPath
 * @param {string} params.path
 * @returns {string}
 */
function joinRepoPath({ rootPath, path }) {
	if (!rootPath || path === rootPath || path.startsWith(`${rootPath}/`)) {
		return path;
	}

	return `${rootPath}/${path}`;
}

/**
 * Gets a raw GitHub content URL without using the REST API.
 * @param {object} params
 * @param {object} params.github
 * @param {string} params.path
 * @param {string} params.revision
 * @returns {string}
 */
function getGithubRawContentUrl({ github, path, revision }) {
	const owner = String(github.owner || "").trim();
	const repo = String(github.repo || "").trim();
	const contentRevision = String(revision || github.branch || "main").trim();
	const contentPath = normalizePath(path);

	if (!owner || !repo || !contentRevision || !contentPath) {
		return "";
	}

	return `https://raw.githubusercontent.com/${encodePathPart(owner)}/${encodePathPart(repo)}/${encodePathPart(contentRevision)}/${encodePath(contentPath)}`;
}

/**
 * Gets the Obsidian URL for a markdown article.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getObsidianArticleUrl({ path }) {
	const vault = String(state.config.obsidian?.vault || state.config.title || "").trim();
	const rootPath = normalizePath(state.config.obsidian?.rootPath || "");
	const notePath = normalizePath(path);
	const filePath = rootPath ? `${rootPath}/${notePath}` : notePath;

	if (!vault || !notePath) {
		return "";
	}

	return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(filePath)}`;
}

/**
 * Encodes slash-separated URL paths.
 * @param {string} path
 * @returns {string}
 */
function encodePath(path) {
	const parts = normalizePath(path).split("/");

	for (let index = 0; index < parts.length; index += 1) {
		parts[index] = encodePathPart(parts[index]);
	}

	return parts.join("/");
}

/**
 * Encodes one URL path part.
 * @param {string} value
 * @returns {string}
 */
function encodePathPart(value) {
	return encodeURIComponent(value);
}

/**
 * Checks whether a URL is HTTP(S).
 * @param {object} params
 * @param {string} params.href
 * @returns {boolean}
 */
function isHttpUrl({ href }) {
	return /^https?:\/\//i.test(href);
}

/**
 * Creates wiki link markup.
 * @param {string} match
 * @param {string} target
 * @returns {string}
 */
function createWikiLink(match, target) {
	return createWikiLinkMarkup({ target, label: target });
}

/**
 * Creates labeled wiki link markup.
 * @param {string} match
 * @param {string} target
 * @param {string} label
 * @returns {string}
 */
function createWikiLinkWithLabel(match, target, label) {
	return createWikiLinkMarkup({ target, label });
}

/**
 * Creates wiki link HTML.
 * @param {object} params
 * @param {string} params.target
 * @param {string} params.label
 * @returns {string}
 */
function createWikiLinkMarkup({ target, label }) {
	const note = findNoteByWikiTarget({ target });
	const safeLabel = escapeHtml(label);

	if (!note) {
		return `<a class="wiki-link is-missing" href="#" aria-label="Missing note">${safeLabel}</a>`;
	}

	return `<a class="wiki-link" href="#" data-note-target="${escapeAttribute(note.path)}">${safeLabel}</a>`;
}

/**
 * Parses simple YAML-style frontmatter.
 * @param {string} content
 * @returns {object}
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
			metadata[activeListKey].push(trimmed.slice(2).trim());
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

	if (endIndex === -1) {
		return { metadata: {}, body: content };
	}

	return {
		metadata,
		body: lines.slice(endIndex + 1).join("\n").trim()
	};
}

/**
 * Parses an Obsidian frontmatter value.
 * @param {string} value
 * @returns {string|Array<string>}
 */
function parseFrontmatterValue(value) {
	if (value.startsWith("[") && value.endsWith("]")) {
		return value
			.slice(1, -1)
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return value;
}

/**
 * Finds backlinks for a note.
 * @param {object} params
 * @param {object} params.note
 * @returns {Array<object>}
 */
function getBacklinks({ note }) {
	const backlinks = [];

	for (let index = 0; index < note.backlinks.length; index += 1) {
		const candidate = findNoteByPath({ path: note.backlinks[index] });

		if (candidate) {
			backlinks.push(candidate);
		}
	}

	return backlinks;
}

/**
 * Finds a note by exact path.
 * @param {object} params
 * @param {string} params.path
 * @returns {object|undefined}
 */
function findNoteByPath({ path }) {
	const normalized = normalizePath(path);

	for (let index = 0; index < state.notes.length; index += 1) {
		if (normalizePath(state.notes[index].path) === normalized) {
			return state.notes[index];
		}
	}

	return undefined;
}

/**
 * Finds a note from a wiki target.
 * @param {object} params
 * @param {string} params.target
 * @returns {object|undefined}
 */
function findNoteByWikiTarget({ target }) {
	const normalizedTarget = normalizePath(String(target || "").split("#")[0].split("^")[0]);
	const withExtension = isMarkdownPath(normalizedTarget) ? normalizedTarget : `${normalizedTarget}.md`;
	const targetBase = removeExtension(getFileName(normalizedTarget)).toLowerCase();

	for (let index = 0; index < state.notes.length; index += 1) {
		const note = state.notes[index];
		const path = normalizePath(note.path);
		const noteBase = removeExtension(note.name).toLowerCase();

		if (path === normalizedTarget || path === withExtension || noteBase === targetBase) {
			return note;
		}
	}

	return undefined;
}

/**
 * Gets a file name from a path.
 * @param {string} path
 * @returns {string}
 */
function getFileName(path) {
	const parts = path.split("/");
	return parts[parts.length - 1];
}

/**
 * Removes the final extension from a file name.
 * @param {string} fileName
 * @returns {string}
 */
function removeExtension(fileName) {
	return fileName.replace(/\.[^/.]+$/, "");
}

/**
 * Normalizes slash paths.
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
	return path.replace(/^\/+|\/+$/g, "");
}

/**
 * Gets a unique slug for heading text.
 * @param {object} params
 * @param {string} params.text
 * @param {object} params.slugs
 * @returns {string}
 */
function getUniqueSlug({ text, slugs }) {
	const base = stripMarkdown(text)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "") || "section";
	const count = slugs[base] || 0;
	slugs[base] = count + 1;

	return count ? `${base}-${count + 1}` : base;
}

/**
 * Checks whether a path is markdown.
 * @param {string} path
 * @returns {boolean}
 */
function isMarkdownPath(path) {
	return /\.mdx?$/i.test(path);
}

/**
 * Gets a search excerpt.
 * @param {object} params
 * @param {string} params.text
 * @param {string} params.query
 * @returns {string}
 */
function getExcerpt({ text, query }) {
	const normalizedText = stripMarkdown(text).replace(/\s+/g, " ").trim();
	const index = normalizedText.toLowerCase().indexOf(query);
	const roughStart = Math.max(0, index - 36);
	const nextSpace = normalizedText.indexOf(" ", roughStart);
	const start = roughStart === 0 || nextSpace === -1 ? roughStart : nextSpace + 1;
	const excerpt = index === -1 ? normalizedText.slice(0, 110) : normalizedText.slice(start, start + 120);
	const prefix = start > 0 ? "... " : "";
	const suffix = start + 120 < normalizedText.length ? " ..." : "";

	return excerpt ? `${prefix}${excerpt}${suffix}` : "No preview available.";
}

/**
 * Removes common markdown syntax from preview text.
 * @param {string} text
 * @returns {string}
 */
function stripMarkdown(text) {
	return text
		.replace(/^---[\s\S]*?---/, "")
		.replace(/```[\s\S]*?```/g, "")
		.replace(/^\[\^[^\]\s]+\]:[ \t]*/gm, "")
		.replace(/\^\[([^\]]+)\]/g, "$1")
		.replace(/\[\^[^\]\s]+\]/g, "")
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
		.replace(/\[\[([^\]]+)\]\]/g, "$1")
		.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
		.replace(/[#>*_`^-]/g, " ");
}

/**
 * Counts words in text.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Counts characters in text.
 * @param {string} text
 * @returns {number}
 */
function countCharacters(text) {
	return text.length;
}

/**
 * Estimates reading time from a word count.
 * @param {object} params
 * @param {number} params.wordCount
 * @returns {number}
 */
function estimateReadingMinutes({ wordCount }) {
	const wordsPerMinute = getReadingWordsPerMinute();

	if (!wordCount) {
		return 0;
	}

	return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

/**
 * Gets configured reading speed.
 * @returns {number}
 */
function getReadingWordsPerMinute() {
	const wordsPerMinute = Number(state.config.reading?.wordsPerMinute);

	if (Number.isFinite(wordsPerMinute) && wordsPerMinute > 0) {
		return wordsPerMinute;
	}

	return 225;
}

/**
 * Formats reading time for metadata.
 * @param {object} params
 * @param {number} params.minutes
 * @returns {string}
 */
function formatReadingTime({ minutes }) {
	if (!minutes) {
		return "Less than 1 min";
	}

	return `${minutes} min`;
}

/**
 * Formats a number for display.
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
	return new Intl.NumberFormat().format(value);
}

/**
 * Escapes HTML text.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Escapes an HTML attribute.
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
	return escapeHtml(value).replace(/`/g, "&#096;");
}

/**
 * Toggles the secondary menu.
 * @returns {void}
 */
function toggleSecondaryMenu() {
	if (!state.activePath) {
		return;
	}

	state.secondaryMenuCollapsed = !state.secondaryMenuCollapsed;
	renderShell();
}

/**
 * Toggles the anchored content appearance popover.
 * @returns {void}
 */
function toggleQuickSettings() {
	state.settingsOpen = !state.settingsOpen;
	renderQuickSettings();
}

/**
 * Closes the content appearance popover.
 * @returns {void}
 */
function closeQuickSettings() {
	if (!state.settingsOpen) {
		return;
	}

	state.settingsOpen = false;
	renderQuickSettings();
}

/**
 * Renders the quick settings popover state.
 * @returns {void}
 */
function renderQuickSettings() {
	const popover = select(selectors.quickSettings);
	const toggle = select("[data-action='toggle-settings']");
	popover.hidden = !state.settingsOpen;
	toggle.setAttribute("aria-expanded", String(state.settingsOpen));
}

/**
 * Advances to the next supported focus timer duration.
 * @returns {void}
 */
function cycleFocusTimerDuration() {
	const currentIndex = focusTimerDurations.indexOf(state.focusTimerDurationMinutes);
	const nextIndex = (currentIndex + 1) % focusTimerDurations.length;
	state.focusTimerDurationMinutes = focusTimerDurations[nextIndex];
	renderFocusTimerControls();
	playCuelume("tick");
}

/**
 * Renders the selected focus timer duration and start control labels.
 * @returns {void}
 */
function renderFocusTimerControls() {
	const duration = state.focusTimerDurationMinutes;
	const durationButton = select(selectors.focusTimerDuration);
	const startButton = select("[data-action='start-focus-timer']");
	durationButton.textContent = `${duration} min`;
	durationButton.setAttribute("aria-label", `Timer duration: ${duration} minutes`);
	startButton.setAttribute("aria-label", `Start ${duration} minute timer`);
	startButton.title = state.focusTimerEndsAt ? "Restart timer" : "Start timer";
}

/**
 * Starts or restarts the selected focus timer.
 * @returns {void}
 */
function startFocusTimer() {
	window.clearInterval(state.focusTimerInterval);
	window.clearTimeout(state.navigationStatusTimer);
	state.focusTimerEndsAt = Date.now() + state.focusTimerDurationMinutes * 60 * 1000;
	state.navigationNoticeVisible = false;
	state.focusTimerInterval = window.setInterval(updateFocusTimer, 1000);
	closeQuickSettings();
	renderFocusTimerControls();
	renderFocusTimerStatus();
	playCuelume("ready");
}

/**
 * Updates the active timer or completes it when no time remains.
 * @returns {void}
 */
function updateFocusTimer() {
	if (!state.focusTimerEndsAt) {
		return;
	}

	const remainingSeconds = getFocusTimerRemainingSeconds();

	if (remainingSeconds <= 0) {
		completeFocusTimer();
		return;
	}

	if (!state.navigationNoticeVisible) {
		renderFocusTimerStatus();
	}
}

/**
 * Gets the number of whole seconds remaining in the active timer.
 * @returns {number}
 */
function getFocusTimerRemainingSeconds() {
	return Math.max(0, Math.ceil((state.focusTimerEndsAt - Date.now()) / 1000));
}

/**
 * Formats seconds as a compact minute and second countdown.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatFocusTimerTime(totalSeconds) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Renders the active timer in the shared navigation status row.
 * @returns {void}
 */
function renderFocusTimerStatus() {
	const status = select(selectors.navigationStatus);
	const icon = select(selectors.navigationStatusIcon);
	const closeButton = select(selectors.navigationStatusClose);
	const remainingSeconds = getFocusTimerRemainingSeconds();
	icon.className = "fa-regular fa-clock";
	select(selectors.navigationStatusMessage).textContent = `Timer · ${formatFocusTimerTime(remainingSeconds)}`;
	closeButton.hidden = false;
	status.setAttribute("aria-live", "off");
	status.classList.add("is-visible", "is-timer");
}

/**
 * Completes the timer and briefly reports that it finished.
 * @returns {void}
 */
function completeFocusTimer() {
	stopFocusTimer();
	renderFocusTimerControls();
	playCuelume("ready");
	showNavigationStatus({ message: "Timer complete." });
}

/**
 * Closes an active focus timer before it finishes.
 * @returns {void}
 */
function closeFocusTimer() {
	if (!state.focusTimerEndsAt) {
		return;
	}

	stopFocusTimer();
	window.clearTimeout(state.navigationStatusTimer);
	state.navigationNoticeVisible = false;
	renderFocusTimerControls();
	hideNavigationStatus();
	playCuelume("droplet");
}

/**
 * Stops the timer interval and clears its deadline.
 * @returns {void}
 */
function stopFocusTimer() {
	window.clearInterval(state.focusTimerInterval);
	state.focusTimerInterval = 0;
	state.focusTimerEndsAt = 0;
}

/**
 * Renders shell layout state.
 * @returns {void}
 */
function renderShell() {
	const shell = select(selectors.appShell);
	const secondaryMenuToggles = selectAll("[data-action='toggle-secondary-menu']");
	const isLayoutPending = shell.classList.contains("is-menu-layout-pending");
	shell.dataset.primaryMenuSide = state.primaryMenuSide;
	shell.classList.toggle("is-primary-menu-collapsed", state.primaryMenuCollapsed);
	shell.classList.toggle("is-secondary-menu-collapsed", state.secondaryMenuCollapsed);

	if (isLayoutPending) {
		window.requestAnimationFrame(() => shell.classList.remove("is-menu-layout-pending"));
	}

	for (let index = 0; index < secondaryMenuToggles.length; index += 1) {
		secondaryMenuToggles[index].hidden = !state.activePath;
		secondaryMenuToggles[index].classList.toggle("is-active", !state.secondaryMenuCollapsed);
	}

	scheduleArticleScrollState();
}

/**
 * Loads content appearance from local storage and app config.
 * @returns {void}
 */
function loadAppearance() {
	const config = state.config.appearance || {};
	let stored = {};

	try {
		const parsed = JSON.parse(window.localStorage.getItem(appearanceStorageKey) || "{}");
		stored = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch (error) {
		showStorageWarning();
	}

	state.theme = getValidTheme(stored.theme || config.theme || "light") || "light";
	state.primaryMenuSide = getPrimaryMenuSide({ value: config.primaryMenuSide });
	state.soundEnabled = getBooleanPreference({
		storedValue: stored.soundEnabled,
		configuredValue: config.soundEnabled,
		fallback: true
	});
	state.fontFamily = getValidFontFamily(stored.fontFamily || config.fontFamily || "modern");
	state.textAlign = getValidTextAlign(stored.textAlign || config.textAlign || "left");
	state.fontSize = clampNumber({
		value: Number(stored.fontSize ?? config.fontSize ?? 18),
		minimum: 14,
		maximum: 24
	});
	state.lineHeight = clampNumber({
		value: Number(stored.lineHeight ?? config.lineHeight ?? 1.68),
		minimum: 1.2,
		maximum: 2.2
	});
	state.contentWidth = clampNumber({
		value: Number(stored.contentWidth ?? config.contentWidth ?? 820),
		minimum: 560,
		maximum: 960
	});
}

/**
 * Resolves the configured side for the primary menu.
 * @param {object} params
 * @param {*} params.value
 * @returns {"left"|"right"}
 */
function getPrimaryMenuSide({ value }) {
	return value === "right" ? "right" : "left";
}

/**
 * Resolves a stored boolean before a configured default.
 * @param {object} params
 * @param {*} params.storedValue
 * @param {*} params.configuredValue
 * @param {boolean} params.fallback
 * @returns {boolean}
 */
function getBooleanPreference({ storedValue, configuredValue, fallback }) {
	if (typeof storedValue === "boolean") {
		return storedValue;
	}

	if (typeof configuredValue === "boolean") {
		return configuredValue;
	}

	return fallback;
}

/**
 * Saves the current content appearance.
 * @returns {void}
 */
function saveAppearance() {
	try {
		window.localStorage.setItem(appearanceStorageKey, JSON.stringify({
			contentWidth: state.contentWidth,
			fontFamily: state.fontFamily,
			fontSize: state.fontSize,
			lineHeight: state.lineHeight,
			soundEnabled: state.soundEnabled,
			textAlign: state.textAlign,
			theme: state.theme
		}));
	} catch (error) {
		showStorageWarning();
	}
}

/**
 * Applies the active theme to the document.
 * @returns {void}
 */
function applyTheme() {
	document.documentElement.dataset.theme = state.theme;
}

/**
 * Renders the theme toggle label.
 * @returns {void}
 */
function renderThemeToggle() {
	const controls = selectAll("[data-theme-choice]");

	for (let index = 0; index < controls.length; index += 1) {
		controls[index].setAttribute("aria-pressed", String(controls[index].dataset.themeChoice === state.theme));
	}
}

/**
 * Applies the sound preference and shared interaction volume.
 * @returns {void}
 */
function applySoundSettings() {
	setCuelumeVolume(soundEffectsVolume);
	setCuelumeEnabled(state.soundEnabled);
}

/**
 * Renders the active sound preference.
 * @returns {void}
 */
function renderSoundControls() {
	const controls = selectAll(selectors.soundChoice);

	for (let index = 0; index < controls.length; index += 1) {
		const isEnabledChoice = controls[index].dataset.soundChoice === "on";
		controls[index].setAttribute("aria-pressed", String(isEnabledChoice === state.soundEnabled));
	}
}

/**
 * Applies a selected sound preference.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleSoundChoice(event) {
	const soundEnabled = event.currentTarget.dataset.soundChoice === "on";

	if (soundEnabled === state.soundEnabled) {
		return;
	}

	if (!soundEnabled) {
		playCuelume("droplet");
	}

	state.soundEnabled = soundEnabled;
	applySoundSettings();
	renderSoundControls();
	saveAppearance();

	if (soundEnabled) {
		playCuelume("ready");
	}
}

/**
 * Applies a selected theme.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleThemeChoice(event) {
	state.theme = getValidTheme(event.currentTarget.dataset.themeChoice) || "light";
	applyTheme();
	renderThemeToggle();
	saveAppearance();
	rerenderArticleMermaidDiagrams();
}

/**
 * Gets a supported theme value.
 * @param {string} value
 * @returns {string}
 */
function getValidTheme(value) {
	const theme = getThemeById({ id: String(value || "") });
	return theme ? theme.id : "";
}

/**
 * Gets a theme by id.
 * @param {object} params
 * @param {string} params.id
 * @returns {object|null}
 */
function getThemeById({ id }) {
	for (let index = 0; index < themes.length; index += 1) {
		if (themes[index].id === id) {
			return themes[index];
		}
	}

	return null;
}


/**
 * Applies reader settings to CSS variables.
 * @returns {void}
 */
function applyReaderSettings() {
	const fontFamilies = {
		literary: 'Georgia, "Times New Roman", serif',
		modern: 'Arial, Helvetica, sans-serif',
		monospace: '"Courier New", Courier, monospace'
	};
	document.documentElement.style.setProperty("--article-font-size", `${state.fontSize}px`);
	document.documentElement.style.setProperty("--article-line-height", String(state.lineHeight));
	document.documentElement.style.setProperty("--article-text-align", state.textAlign);
	document.documentElement.style.setProperty("--article-font-family", fontFamilies[state.fontFamily]);
	document.documentElement.style.setProperty("--article-measure", `${state.contentWidth}px`);
	scheduleArticleScrollState();
}

/**
 * Renders reader control values.
 * @returns {void}
 */
function renderReaderControls() {
	const orientations = selectAll(selectors.textOrientation);
	const fontFamilies = selectAll(selectors.fontFamily);
	const fontSizeInput = select(selectors.fontSizeInput);
	const fontSizeValue = select(selectors.fontSizeValue);
	const lineHeightInput = select(selectors.lineHeightInput);
	const lineHeightValue = select(selectors.lineHeightValue);
	const contentWidthInput = select(selectors.contentWidthInput);
	const contentWidthValue = select(selectors.contentWidthValue);

	for (let index = 0; index < orientations.length; index += 1) {
		orientations[index].checked = orientations[index].value === state.textAlign;
	}

	for (let index = 0; index < fontFamilies.length; index += 1) {
		fontFamilies[index].checked = fontFamilies[index].value === state.fontFamily;
	}

	fontSizeInput.value = String(state.fontSize);
	fontSizeValue.textContent = `${state.fontSize}px`;
	lineHeightInput.value = String(state.lineHeight);
	lineHeightValue.textContent = state.lineHeight.toFixed(2);
	contentWidthInput.value = String(state.contentWidth);
	contentWidthValue.textContent = `${state.contentWidth}px`;
}

/**
 * Handles font size input.
 * @param {InputEvent} event
 * @returns {void}
 */
function handleFontSizeInput(event) {
	state.fontSize = clampNumber({
		value: Number(event.currentTarget.value),
		minimum: 14,
		maximum: 24
	});
	applyReaderSettings();
	renderReaderControls();
	saveAppearance();
}

/**
 * Handles line height input.
 * @param {InputEvent} event
 * @returns {void}
 */
function handleLineHeightInput(event) {
	state.lineHeight = clampNumber({
		value: Number(event.currentTarget.value),
		minimum: 1.2,
		maximum: 2.2
	});
	applyReaderSettings();
	renderReaderControls();
	saveAppearance();
}

/**
 * Handles content measure input.
 * @param {InputEvent} event
 * @returns {void}
 */
function handleContentWidthInput(event) {
	state.contentWidth = clampNumber({
		value: Number(event.currentTarget.value),
		minimum: 560,
		maximum: 960
	});
	applyReaderSettings();
	renderReaderControls();
	saveAppearance();
}

/**
 * Handles text orientation radio changes.
 * @param {Event} event
 * @returns {void}
 */
function handleTextOrientationChange(event) {
	state.textAlign = getValidTextAlign(event.currentTarget.value);
	applyReaderSettings();
	renderReaderControls();
	saveAppearance();
}

/**
 * Handles content typeface changes.
 * @param {Event} event
 * @returns {void}
 */
function handleFontFamilyChange(event) {
	state.fontFamily = getValidFontFamily(event.currentTarget.value);
	applyReaderSettings();
	renderReaderControls();
	saveAppearance();
}

/**
 * Gets a supported content typeface value.
 * @param {string} value
 * @returns {string}
 */
function getValidFontFamily(value) {
	const validValues = ["literary", "modern", "monospace"];

	for (let index = 0; index < validValues.length; index += 1) {
		if (validValues[index] === value) {
			return value;
		}
	}

	return "modern";
}

/**
 * Gets a supported text alignment value.
 * @param {string} value
 * @returns {string}
 */
function getValidTextAlign(value) {
	const validValues = ["left", "center", "justify", "right"];

	for (let index = 0; index < validValues.length; index += 1) {
		if (validValues[index] === value) {
			return value;
		}
	}

	return "left";
}

/**
 * Clamps a numeric value.
 * @param {object} params
 * @param {number} params.value
 * @param {number} params.minimum
 * @param {number} params.maximum
 * @returns {number}
 */
function clampNumber({ value, minimum, maximum }) {
	if (!Number.isFinite(value)) {
		return minimum;
	}

	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Loads bookmarks from localStorage.
 * @returns {void}
 */
function loadBookmarks() {
	try {
		const stored = window.localStorage.getItem(bookmarkStorageKey);
		const parsed = stored ? JSON.parse(stored) : [];
		state.bookmarks = Array.isArray(parsed) ? normalizeBookmarkPaths({ paths: parsed }) : [];
	} catch (error) {
		state.bookmarks = [];
		showStorageWarning();
	}
}

/**
 * Saves bookmarks to localStorage.
 * @returns {void}
 */
function saveBookmarks() {
	try {
		window.localStorage.setItem(bookmarkStorageKey, JSON.stringify(state.bookmarks));
	} catch (error) {
		showStorageWarning();
	}
}

/**
 * Normalizes and deduplicates bookmark paths.
 * @param {object} params
 * @param {Array<string>} params.paths
 * @returns {Array<string>}
 */
function normalizeBookmarkPaths({ paths }) {
	const normalized = [];

	for (let index = 0; index < paths.length; index += 1) {
		const path = normalizePath(String(paths[index] || ""));

		if (path && !normalized.includes(path)) {
			normalized.push(path);
		}
	}

	return normalized;
}

/**
 * Toggles the current note bookmark.
 * @returns {void}
 */
function toggleActiveBookmark() {
	if (!state.activePath) {
		return;
	}

	if (isBookmarked({ path: state.activePath })) {
		removeBookmark({ path: state.activePath });
		showNavigationStatus({ message: "Bookmark removed." });
	} else {
		addBookmark({ path: state.activePath });
		showNavigationStatus({ message: "Bookmark added." });
	}

	refreshBookmarkUi();
}

/**
 * Adds a bookmark.
 * @param {object} params
 * @param {string} params.path
 * @returns {void}
 */
function addBookmark({ path }) {
	const normalized = normalizePath(path);

	if (!isBookmarked({ path: normalized })) {
		state.bookmarks.push(normalized);
		saveBookmarks();
	}
}

/**
 * Removes a bookmark.
 * @param {object} params
 * @param {string} params.path
 * @returns {void}
 */
function removeBookmark({ path }) {
	const normalized = normalizePath(path);
	const bookmarks = [];

	for (let index = 0; index < state.bookmarks.length; index += 1) {
		if (normalizePath(state.bookmarks[index]) !== normalized) {
			bookmarks.push(state.bookmarks[index]);
		}
	}

	state.bookmarks = bookmarks;
	saveBookmarks();
}

/**
 * Clears all bookmarks.
 * @returns {void}
 */
function clearBookmarks() {
	if (!state.bookmarks.length) {
		showNavigationStatus({ message: "No bookmarks to remove." });
		return;
	}

	state.bookmarks = [];
	saveBookmarks();
	refreshBookmarkUi();
	showNavigationStatus({ message: "All bookmarks removed." });
}

/**
 * Checks whether a note is bookmarked.
 * @param {object} params
 * @param {string} params.path
 * @returns {boolean}
 */
function isBookmarked({ path }) {
	const normalized = normalizePath(path);

	for (let index = 0; index < state.bookmarks.length; index += 1) {
		if (normalizePath(state.bookmarks[index]) === normalized) {
			return true;
		}
	}

	return false;
}

/**
 * Refreshes bookmark-dependent UI.
 * @returns {void}
 */
function refreshBookmarkUi() {
	const note = findNoteByPath({ path: state.activePath });

	if (note) {
		renderBookmarkControl({ note });
	}

	renderBookmarks();
}

/**
 * Copies the active article GitHub URL.
 * @returns {Promise<void>}
 */
async function copyActiveSourceUrl() {
	const url = getGithubArticleUrl({ path: state.activePath });

	if (!url) {
		showNavigationStatus({ message: "Article source URL is unavailable." });
		return;
	}

	await copyText({
		text: url,
		successMessage: "Article URL copied."
	});
}

/**
 * Copies the active article public site URL.
 * @returns {Promise<void>}
 */
async function copyActivePublishedUrl() {
	const url = getPublishedArticleUrl({ path: state.activePath });

	if (!url) {
		showNavigationStatus({ message: "Article site URL is unavailable." });
		return;
	}

	await copyText({
		text: url,
		successMessage: "Article site URL copied."
	});
}

/**
 * Copies the active article markdown content.
 * @returns {Promise<void>}
 */
async function copyActiveArticleContent() {
	const note = findNoteByPath({ path: state.activePath });

	if (!note) {
		showNavigationStatus({ message: "No article selected." });
		return;
	}

	await copyText({
		text: note.body,
		successMessage: "Article content copied."
	});
}

/**
 * Copies the selected article text.
 * @returns {Promise<void>}
 */
async function copySelectedText() {
	const text = state.selectedText;

	if (!text) {
		showNavigationStatus({ message: "No text selected." });
		return;
	}

	await copyText({
		text,
		successMessage: "Selected text copied."
	});
	hideSelectionMenu();
}

/**
 * Creates a QR code from the selected article text.
 * @returns {Promise<void>}
 */
async function createQrCodeFromSelection() {
	const text = state.selectedText;

	if (!text) {
		showNavigationStatus({ message: "No text selected." });
		return;
	}

	if (countCharacters(text) > maximumQrCodeCharacters) {
		showNavigationStatus({ message: "Selection is too long for a QR code." });
		return;
	}

	try {
		const dataUrl = await QRCode.toDataURL(text, {
			errorCorrectionLevel: "M",
			margin: 1,
			width: 240
		});

		showQrCodeBlock({ dataUrl, text });
		hideSelectionMenu();
	} catch (error) {
		showNavigationStatus({ message: "Could not create QR code." });
	}
}

/**
 * Shows a temporary QR code block in the secondary menu.
 * @param {object} params
 * @param {string} params.dataUrl
 * @param {string} params.text
 * @returns {void}
 */
function showQrCodeBlock({ dataUrl, text }) {
	const block = select(selectors.qrCodeBlock);
	const image = select(selectors.qrCodeImage);
	const summary = select(selectors.qrCodeSummary);

	image.src = dataUrl;
	summary.textContent = `${formatNumber(countCharacters(text))} selected characters`;
	block.hidden = false;
	state.secondaryMenuCollapsed = false;
	renderShell();
	window.clearTimeout(state.qrCodeTimer);
	state.qrCodeTimer = window.setTimeout(clearQrCodeBlock, qrCodeVisibleMs);
}

/**
 * Clears the temporary QR code block.
 * @returns {void}
 */
function clearQrCodeBlock() {
	const block = select(selectors.qrCodeBlock);
	const image = select(selectors.qrCodeImage);
	const summary = select(selectors.qrCodeSummary);

	if (!block || !image || !summary) {
		return;
	}

	window.clearTimeout(state.qrCodeTimer);
	state.qrCodeTimer = 0;
	block.hidden = true;
	image.removeAttribute("src");
	summary.textContent = "";
}

/**
 * Opens a configured search query for the selected article text.
 * @param {object} params
 * @param {object} params.provider
 * @returns {void}
 */
function searchSelectedText({ provider }) {
	const text = state.selectedText;

	if (!text) {
		showNavigationStatus({ message: "No text selected." });
		return;
	}

	const url = getSelectionSearchUrl({ provider, text });

	if (!url) {
		showNavigationStatus({ message: "Search provider is unavailable." });
		return;
	}

	window.open(url, "_blank", "noopener,noreferrer");
	hideSelectionMenu();
}

/**
 * Builds a configured search destination with an encoded selection.
 * @param {object} params
 * @param {object} params.provider
 * @param {string} params.text
 * @returns {string}
 */
function getSelectionSearchUrl({ provider, text }) {
	const urlTemplate = String(provider?.urlTemplate || "").trim();

	if (!isSelectionSearchUrlTemplate({ urlTemplate })) {
		return "";
	}

	try {
		const url = new URL(urlTemplate.replaceAll("{selection}", encodeURIComponent(text)));
		return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
	} catch (error) {
		return "";
	}
}

/**
 * Opens the active article in Obsidian.
 * @returns {void}
 */
function openActiveArticleInObsidian() {
	const url = getObsidianArticleUrl({ path: state.activePath });

	if (!url) {
		showNavigationStatus({ message: "Obsidian link is unavailable." });
		return;
	}

	window.location.href = url;
}

/**
 * Copies text to the clipboard.
 * @param {object} params
 * @param {string} params.text
 * @param {string} params.successMessage
 * @returns {Promise<boolean>}
 */
async function copyText({ text, successMessage }) {
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			await navigator.clipboard.writeText(text);
		} else if (!copyTextWithBuffer(text)) {
			throw new Error("Clipboard unavailable.");
		}

		showNavigationStatus({ message: successMessage });
		return true;
	} catch (error) {
		if (copyTextWithBuffer(text)) {
			showNavigationStatus({ message: successMessage });
			return true;
		} else {
			showNavigationStatus({ message: "Could not copy to clipboard." });
			return false;
		}
	}
}

/**
 * Copies text through a temporary text area fallback.
 * @param {string} text
 * @returns {boolean}
 */
function copyTextWithBuffer(text) {
	const buffer = document.createElement("textarea");
	let copied = false;

	buffer.className = "clipboard-buffer";
	buffer.value = text;
	buffer.setAttribute("readonly", "readonly");
	document.body.append(buffer);
	buffer.focus();
	buffer.select();
	copied = document.execCommand("copy");
	buffer.remove();

	return copied;
}

/**
 * Shows a storage warning.
 * @returns {void}
 */
function showStorageWarning() {
	showNavigationStatus({ message: "Browser settings could not be saved." });
}

/**
 * Gets a human source label.
 * @param {object} params
 * @param {object} params.config
 * @returns {string}
 */
function getVaultSourceLabel({ config }) {
	if (config.github?.enabled) {
		return `${config.github.owner}/${config.github.repo}`;
	}

	return "Local vault";
}

/**
 * Gets a human description of the source used to load the active vault.
 * @param {object} params
 * @param {object} params.config
 * @returns {string}
 */
function getVaultLoadSource({ config }) {
	if (config.github?.enabled) {
		return `${config.github.owner}/${config.github.repo} on GitHub`;
	}

	return "local vault";
}

/**
 * Shows a temporary status row attached to the floating navigation.
 * @param {object} params
 * @param {string} params.message
 * @returns {void}
 */
function showNavigationStatus({ message }) {
	const status = select(selectors.navigationStatus);
	const icon = select(selectors.navigationStatusIcon);
	const closeButton = select(selectors.navigationStatusClose);
	state.navigationNoticeVisible = true;
	icon.className = "fa-solid fa-circle-info";
	select(selectors.navigationStatusMessage).textContent = message;
	closeButton.hidden = true;
	status.setAttribute("aria-live", "polite");
	status.classList.remove("is-timer");
	status.classList.add("is-visible");
	window.clearTimeout(state.navigationStatusTimer);
	state.navigationStatusTimer = window.setTimeout(finishNavigationNotice, 2600);
}

/**
 * Ends a temporary notice and restores the timer when one is active.
 * @returns {void}
 */
function finishNavigationNotice() {
	state.navigationNoticeVisible = false;

	if (state.focusTimerEndsAt) {
		renderFocusTimerStatus();
		return;
	}

	hideNavigationStatus();
}

/**
 * Hides the floating navigation status row.
 * @returns {void}
 */
function hideNavigationStatus() {
	const status = select(selectors.navigationStatus);
	select(selectors.navigationStatusClose).hidden = true;
	status.classList.remove("is-visible", "is-timer");
}

/**
 * Renders a fatal load error.
 * @param {object} params
 * @param {Error} params.error
 * @returns {void}
 */
function renderError({ error }) {
	removeArticleCodeRunners();
	select(selectors.articleProgress).hidden = true;
	const article = select(selectors.article);
	article.removeAttribute("aria-busy");
	article.classList.remove("is-home", "has-header");
	article.scrollTop = 0;
	article.innerHTML = `
		<div class="empty-state" role="alert">
			<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
			<h2>Could not load vault</h2>
			<p>${escapeHtml(error.message)}</p>
			<button class="empty-state-action" type="button" data-action="reload-app">Try again</button>
		</div>
	`;
	showNavigationStatus({ message: error.message });
}

try {
	await init();
} finally {
	dismissStartupAnimation();
}
