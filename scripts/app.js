import { marked } from "https://cdn.jsdelivr.net/npm/marked@18.0.4/+esm";
import Prism from "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/prism-json.min.js";
import "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/plugins/autoloader/prism-autoloader.min.js";

Prism.manual = true;
Prism.plugins.autoloader.languages_path = "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/";

const state = {
	bookmarks: [],
	config: {},
	files: [],
	folderState: {},
	notes: [],
	activePath: "",
	activePanel: "files",
	activeRail: "home",
	activeView: "home",
	calendarDate: new Date(),
	fontSize: 18,
	lineHeight: 1.68,
	leftCollapsed: true,
	mathJaxPromise: null,
	mapLibrePromise: null,
	maps: [],
	rightCollapsed: true,
	qrCodeTimer: 0,
	selectedText: "",
	theme: "light",
	textAlign: "left",
	tocState: {},
	toastTimer: 0
};

const bookmarkStorageKey = "publisher.bookmarks";
const themeStorageKey = "publisher.theme";
const githubTreeCache = new Map();
const minimumSelectionCharacters = 5;
const maximumQrCodeCharacters = 100;
const qrCodeVisibleMs = 18000;
const scrollUpCharacterThreshold = 2000;
const themes = [
	{ id: "light", label: "Light" },
	{ id: "sand", label: "Sand" },
	{ id: "ocean", label: "Ocean" },
	{ id: "dark", label: "Dark" }
];

const selectors = {
	appShell: ".app-shell",
	article: "[data-article]",
	backlinkList: "[data-backlink-list]",
	bookmarkButton: "[data-action='toggle-bookmark']",
	bookmarkIcon: "[data-bookmark-icon]",
	bookmarkLabel: "[data-bookmark-label]",
	bookmarksList: "[data-bookmarks-list]",
	calendarDays: "[data-calendar-days]",
	calendarTitle: "[data-calendar-title]",
	calendarWeekdays: "[data-calendar-weekdays]",
	fileFilter: "[data-file-filter]",
	fileTree: "[data-file-tree]",
	fontSizeInput: "[data-font-size]",
	fontSizeValue: "[data-font-size-value]",
	graphList: "[data-graph-list]",
	leftPanel: "[data-left-panel]",
	lineHeightInput: "[data-line-height]",
	lineHeightValue: "[data-line-height-value]",
	linktreeList: "[data-linktree-list]",
	metadataList: "[data-metadata-list]",
	outgoingList: "[data-outgoing-list]",
	pageLoadLogo: "[data-page-load-logo]",
	pageLoadMask: "[data-page-load-mask]",
	qrCodeBlock: "[data-qr-code-block]",
	qrCodeImage: "[data-qr-code-image]",
	qrCodeSummary: "[data-qr-code-summary]",
	qrSelectionButton: "[data-action='qr-selection']",
	rightPanel: "[data-right-panel]",
	searchInput: "[data-search-input]",
	searchResults: "[data-search-results]",
	selectionCount: "[data-selection-count]",
	selectionMenu: "[data-selection-menu]",
	sourceArticleLink: "[data-source-article-link]",
	sourceDownloadLink: "[data-source-download-link]",
	sourceRepoLink: "[data-source-repo-link]",
	textOrientation: "[data-text-orientation]",
	themeToggle: "[data-theme-toggle]",
	tocList: "[data-toc-list]",
	toast: "[data-toast]",
	vaultSource: "[data-vault-source]",
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
 * @returns {Promise<void>}
 */
async function init() {
	loadBookmarks();
	bindEvents();
	await loadVault();
}

/**
 * Loads config and markdown content.
 * @returns {Promise<void>}
 */
async function loadVault() {
	let loadAnimation = null;

	try {
		state.config = await fetchJson("config/app-config.json");
		loadAnimation = startPageLoadAnimation();
		state.fontSize = Number(state.config.appearance?.fontSize || 18);
		state.lineHeight = Number(state.config.appearance?.lineHeight || 1.68);
		state.textAlign = getValidTextAlign(state.config.appearance?.textAlign || "left");
		state.theme = getInitialTheme();
		applyReaderSettings();
		applyTheme();
		renderReaderControls();
		renderThemeToggle();
		document.title = state.config.title || "Publisher";
		select(selectors.vaultTitle).textContent = state.config.title || "Publisher";
		state.files = await loadFiles({ config: state.config });
		state.notes = indexNotes({ files: state.files });
		select(selectors.vaultSource).textContent = getVaultSourceLabel({ config: state.config });
		renderAll();
		openRouteFromHash();
		showToast({ message: `Loaded ${state.notes.length} notes.` });
		await finishPageLoadAnimation({ loadAnimation });
	} catch (error) {
		await finishPageLoadAnimation({ loadAnimation });
		renderError({ error });
	}
}

/**
 * Fetches JSON from a path.
 * @param {string} path
 * @returns {Promise<object>}
 */
async function fetchJson(path) {
	const response = await fetch(path, { cache: "no-cache" });

	if (!response.ok) {
		throw new Error(`Could not load ${path}`);
	}

	return await response.json();
}

/**
 * Starts the optional page load animation.
 * @returns {object|null}
 */
function startPageLoadAnimation() {
	const config = state.config.pageLoadAnimation || {};
	const mask = select(selectors.pageLoadMask);
	const logo = select(selectors.pageLoadLogo);
	const durationMs = getAnimationNumber({ value: config.durationMs, fallback: 1500 });
	const fadeMs = getAnimationNumber({ value: config.fadeMs, fallback: 420 });

	if (!config.enabled) {
		return null;
	}

	logo.src = config.logo || "images/logo-white-transparent-1000x1000.png";
	mask.style.setProperty("--page-load-fade-ms", `${fadeMs}ms`);
	mask.classList.remove("is-dimming", "is-leaving");
	mask.classList.add("is-visible");

	return {
		startedAt: performance.now(),
		durationMs,
		fadeMs,
		mask
	};
}

/**
 * Finishes the optional page load animation.
 * @param {object} params
 * @param {object|null} params.loadAnimation
 * @returns {Promise<void>}
 */
async function finishPageLoadAnimation({ loadAnimation }) {
	if (!loadAnimation) {
		return;
	}

	const elapsedMs = performance.now() - loadAnimation.startedAt;
	const remainingMs = Math.max(0, loadAnimation.durationMs - elapsedMs);

	if (remainingMs) {
		await delay(remainingMs);
	}

	loadAnimation.mask.classList.add("is-dimming");
	await delay(Math.max(0, loadAnimation.fadeMs - 120));
	loadAnimation.mask.classList.add("is-leaving");
	await delay(160);
	loadAnimation.mask.classList.remove("is-visible", "is-dimming", "is-leaving");
}

/**
 * Gets a valid animation timing value.
 * @param {object} params
 * @param {number|string} params.value
 * @param {number} params.fallback
 * @returns {number}
 */
function getAnimationNumber({ value, fallback }) {
	const number = Number(value);

	if (Number.isFinite(number) && number >= 0) {
		return number;
	}

	return fallback;
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
 * Loads markdown files from GitHub or local fallback.
 * @param {object} params
 * @param {object} params.config
 * @returns {Promise<Array<object>>}
 */
async function loadFiles({ config }) {
	if (config.github?.enabled) {
		return await loadGithubFiles({ github: config.github });
	}

	if (config.localFallback?.enabled) {
		return await loadLocalFiles({ manifestPath: config.localFallback.manifest });
	}

	return [];
}

/**
 * Loads markdown files listed in a local manifest.
 * @param {object} params
 * @param {string} params.manifestPath
 * @returns {Promise<Array<object>>}
 */
async function loadLocalFiles({ manifestPath }) {
	const manifestResponse = await fetch(manifestPath);

	if (!manifestResponse.ok) {
		return [];
	}

	const manifest = await manifestResponse.json();
	const basePath = manifestPath.split("/").slice(0, -1).join("/");
	const files = [];

	for (let index = 0; index < manifest.files.length; index += 1) {
		const path = manifest.files[index];
		const response = await fetch(`${basePath}/${path}`, { cache: "no-cache" });

		if (response.ok) {
			files.push({
				path,
				name: getFileName(path),
				content: await response.text(),
				sourceUrl: `${basePath}/${path}`
			});
		}
	}

	return files;
}

/**
 * Loads markdown files from a public GitHub repository.
 * @param {object} params
 * @param {object} params.github
 * @returns {Promise<Array<object>>}
 */
async function loadGithubFiles({ github }) {
	const treeData = await loadGithubTree({ github });
	const rootPath = normalizePath(github.rootPath || "");
	const markdownItems = filterMarkdownTree({ tree: treeData.tree || [], rootPath });
	const files = [];

	for (let index = 0; index < markdownItems.length; index += 1) {
		const item = markdownItems[index];
		const rawPath = item.path;
		const displayPath = rootPath ? rawPath.replace(`${rootPath}/`, "") : rawPath;
		const cdnUrl = getGithubCdnUrl({ path: displayPath });
		const response = await fetch(cdnUrl);

		if (response.ok) {
			files.push({
				path: displayPath,
				name: getFileName(displayPath),
				content: await response.text(),
				sourceUrl: cdnUrl
			});
		}
	}

	return files;
}

/**
 * Loads a GitHub repository tree with a page-lifetime cache.
 * @param {object} params
 * @param {object} params.github
 * @returns {Promise<object>}
 */
async function loadGithubTree({ github }) {
	const cached = readGithubTreeCache({ github });

	if (cached) {
		return cached;
	}

	const commit = await fetchGithubBranchCommit({ github });
	const tree = await fetchGithubTree({ github, sha: commit.treeSha });

	writeGithubTreeCache({
		github,
		treeData: {
			commitSha: commit.commitSha,
			treeSha: commit.treeSha,
			tree: tree.tree || []
		}
	});

	return {
		commitSha: commit.commitSha,
		treeSha: commit.treeSha,
		tree: tree.tree || []
	};
}

/**
 * Fetches the latest branch commit metadata.
 * @param {object} params
 * @param {object} params.github
 * @returns {Promise<object>}
 */
async function fetchGithubBranchCommit({ github }) {
	const commitUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/commits/${github.branch}`;
	const response = await fetch(commitUrl);

	if (!response.ok) {
		throw new Error("Could not load the GitHub branch commit.");
	}

	const data = await response.json();
	const treeSha = data.commit?.tree?.sha || "";
	const commitSha = data.sha || "";

	if (!treeSha) {
		throw new Error("The GitHub branch commit did not include a tree SHA.");
	}

	return { commitSha, treeSha };
}

/**
 * Fetches a recursive GitHub tree by SHA.
 * @param {object} params
 * @param {object} params.github
 * @param {string} params.sha
 * @returns {Promise<object>}
 */
async function fetchGithubTree({ github, sha }) {
	const treeUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/git/trees/${sha}?recursive=1`;
	const response = await fetch(treeUrl);

	if (!response.ok) {
		throw new Error("Could not load the GitHub repository tree.");
	}

	return await response.json();
}

/**
 * Reads a cached GitHub tree.
 * @param {object} params
 * @param {object} params.github
 * @returns {object|null}
 */
function readGithubTreeCache({ github }) {
	const cached = githubTreeCache.get(getGithubTreeCacheKey({ github }));

	if (cached && Array.isArray(cached.tree)) {
		return cached;
	}

	return null;
}

/**
 * Writes a GitHub tree cache entry.
 * @param {object} params
 * @param {object} params.github
 * @param {object} params.treeData
 * @returns {void}
 */
function writeGithubTreeCache({ github, treeData }) {
	githubTreeCache.set(getGithubTreeCacheKey({ github }), treeData);
}

/**
 * Gets a GitHub tree cache key.
 * @param {object} params
 * @param {object} params.github
 * @returns {string}
 */
function getGithubTreeCacheKey({ github }) {
	return `${github.owner}/${github.repo}@${github.branch}`;
}

/**
 * Filters GitHub tree entries to markdown files.
 * @param {object} params
 * @param {Array<object>} params.tree
 * @param {string} params.rootPath
 * @returns {Array<object>}
 */
function filterMarkdownTree({ tree, rootPath }) {
	const items = [];

	for (let index = 0; index < tree.length; index += 1) {
		const item = tree[index];
		const inRoot = !rootPath || item.path === rootPath || item.path.startsWith(`${rootPath}/`);

		if (item.type === "blob" && inRoot && isMarkdownPath(item.path)) {
			items.push(item);
		}
	}

	return items.sort(sortTreeItemByPath);
}

/**
 * Creates searchable note records.
 * @param {object} params
 * @param {Array<object>} params.files
 * @returns {Array<object>}
 */
function indexNotes({ files }) {
	const notes = [];

	for (let index = 0; index < files.length; index += 1) {
		const file = files[index];
		const parsed = parseFrontmatter(file.content);
		const title = parsed.metadata.title || getTitleFromMarkdown(parsed.body) || removeExtension(file.name);

		notes.push({
			...file,
			title,
			body: parsed.body,
			metadata: parsed.metadata,
			links: extractWikiLinks(parsed.body),
			searchText: `${title} ${file.path} ${parsed.body} ${getSearchMetadataText({ metadata: parsed.metadata })}`.toLowerCase()
		});
	}

	return notes;
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

	select("[data-action='toggle-right']").addEventListener("click", toggleRightPanel);
	select("[data-action='rotate-theme']").addEventListener("click", rotateTheme);
	select("[data-action='open-home']").addEventListener("click", openHome);
	select("[data-action='refresh']").addEventListener("click", loadVault);
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
	select("[data-action='search-selection-google']").addEventListener("click", searchSelectedTextWithGoogle);
	select("[data-action='search-selection-brave']").addEventListener("click", searchSelectedTextWithBrave);
	select(selectors.fileFilter).addEventListener("input", renderFileTree);
	select(selectors.searchInput).addEventListener("input", renderSearch);
	select(selectors.article).addEventListener("click", handleArticleClick);
	select(selectors.fontSizeInput).addEventListener("input", handleFontSizeInput);
	select(selectors.lineHeightInput).addEventListener("input", handleLineHeightInput);
	select(selectors.tocList).addEventListener("click", handleTocClick);
	window.addEventListener("hashchange", openRouteFromHash);
	window.addEventListener("popstate", openRouteFromHash);
	document.addEventListener("selectionchange", handleSelectionChange);
	document.addEventListener("pointerdown", handleDocumentPointerDown);
	document.addEventListener("click", handleDocumentClick);
	document.addEventListener("keyup", handleDocumentKeyUp);
	window.addEventListener("scroll", hideSelectionMenu, true);
	window.addEventListener("resize", hideSelectionMenu);
	bindTextOrientationControls();
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
 * Sorts GitHub tree items by path.
 * @param {object} first
 * @param {object} second
 * @returns {number}
 */
function sortTreeItemByPath(first, second) {
	return first.path.localeCompare(second.path);
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
	renderGraph();
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
		buttons[index].classList.toggle("is-active", buttons[index].dataset.panel === state.activeRail);
	}

	homeButton.classList.toggle("is-active", state.activeRail === "home");
}

/**
 * Sets the active utility panel.
 * @param {object} params
 * @param {string} params.panel
 * @returns {void}
 */
function setPanel({ panel }) {
	if (!state.leftCollapsed && state.activePanel === panel) {
		state.leftCollapsed = true;
		renderShell();
		return;
	}

	state.activePanel = panel;
	state.activeRail = panel;
	state.leftCollapsed = false;
	renderPanels();
	renderShell();
}

/**
 * Renders the markdown file tree.
 * @returns {void}
 */
function renderFileTree() {
	const filter = select(selectors.fileFilter).value.trim().toLowerCase();
	const filteredNotes = filter ? filterNotesByText({ notes: state.notes, query: filter }) : state.notes;
	const tree = createTree({ notes: filteredNotes });
	const container = select(selectors.fileTree);
	container.replaceChildren(renderTreeNode({ node: tree, depth: 0, path: "", forceExpanded: Boolean(filter) }));
}

/**
 * Filters notes using indexed text.
 * @param {object} params
 * @param {Array<object>} params.notes
 * @param {string} params.query
 * @returns {Array<object>}
 */
function filterNotesByText({ notes, query }) {
	const filtered = [];

	for (let index = 0; index < notes.length; index += 1) {
		if (notes[index].searchText.includes(query)) {
			filtered.push(notes[index]);
		}
	}

	return filtered;
}

/**
 * Renders a tree node.
 * @param {object} params
 * @param {object} params.node
 * @param {number} params.depth
 * @param {string} params.path
 * @param {boolean} params.forceExpanded
 * @returns {DocumentFragment|HTMLElement}
 */
function renderTreeNode({ node, depth, path, forceExpanded }) {
	const fragment = document.createDocumentFragment();
	const folderNames = Object.keys(node.children).sort();

	for (let index = 0; index < folderNames.length; index += 1) {
		const folderName = folderNames[index];
		const folderPath = path ? `${path}/${folderName}` : folderName;
		const expanded = forceExpanded || isFolderExpanded({ path: folderPath });
		const group = document.createElement("div");
		const button = document.createElement("button");
		const children = document.createElement("div");

		group.className = "tree-group";
		group.classList.toggle("is-collapsed", !expanded);
		button.className = "tree-folder";
		button.type = "button";
		button.dataset.path = folderPath;
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
			path: folderPath,
			forceExpanded
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
		container.innerHTML = `<p class="muted">No bookmarked notes yet.</p>`;
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
 * Renders configured Linktree links.
 * @returns {void}
 */
function renderLinktree() {
	const container = select(selectors.linktreeList);
	const links = Array.isArray(state.config.linktree?.links) ? state.config.linktree.links : [];

	container.replaceChildren();

	if (!links.length) {
		container.innerHTML = `<p class="muted">No links configured.</p>`;
		return;
	}

	for (let index = 0; index < links.length; index += 1) {
		container.append(createLinktreeLink({ link: links[index] }));
	}
}

/**
 * Creates a Linktree link.
 * @param {object} params
 * @param {object} params.link
 * @returns {HTMLAnchorElement}
 */
function createLinktreeLink({ link }) {
	const anchor = document.createElement("a");
	const type = normalizeLinkType(String(link.type || ""));
	const icon = getLinktreeIcon({ type });
	const label = String(link.label || "Link");
	const href = String(link.url || "#");

	anchor.className = "linktree-link";
	anchor.href = getExternalLinkHref({ href });
	anchor.target = "_blank";
	anchor.rel = "noreferrer";
	anchor.innerHTML = `
		<i class="${escapeAttribute(icon)}" aria-hidden="true"></i>
		<span>${escapeHtml(label)}</span>
	`;

	return anchor;
}

/**
 * Normalizes a Linktree type.
 * @param {string} type
 * @returns {string}
 */
function normalizeLinkType(type) {
	return type.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
}

/**
 * Gets a Font Awesome icon class for a Linktree type.
 * @param {object} params
 * @param {string} params.type
 * @returns {string}
 */
function getLinktreeIcon({ type }) {
	const icons = {
		bluesky: "fa-brands fa-bluesky",
		discord: "fa-brands fa-discord",
		email: "fa-regular fa-envelope",
		facebook: "fa-brands fa-facebook",
		github: "fa-brands fa-github",
		gitlab: "fa-brands fa-gitlab",
		instagram: "fa-brands fa-instagram",
		linkedin: "fa-brands fa-linkedin",
		mastodon: "fa-brands fa-mastodon",
		medium: "fa-brands fa-medium",
		newsletter: "fa-regular fa-envelope",
		patreon: "fa-brands fa-patreon",
		reddit: "fa-brands fa-reddit",
		rss: "fa-solid fa-rss",
		soundcloud: "fa-brands fa-soundcloud",
		spotify: "fa-brands fa-spotify",
		substack: "fa-regular fa-newspaper",
		telegram: "fa-brands fa-telegram",
		threads: "fa-brands fa-threads",
		tiktok: "fa-brands fa-tiktok",
		twitch: "fa-brands fa-twitch",
		website: "fa-solid fa-globe",
		x: "fa-brands fa-x-twitter",
		twitter: "fa-brands fa-x-twitter",
		youtube: "fa-brands fa-youtube"
	};

	return icons[type] || "fa-solid fa-link";
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
	const query = select(selectors.searchInput).value.trim().toLowerCase();
	const container = select(selectors.searchResults);
	const results = query ? filterNotesByText({ notes: state.notes, query }).slice(0, 40) : [];

	if (!query) {
		container.innerHTML = `<p class="muted">Search titles, paths, tags, and note text.</p>`;
		return;
	}

	if (!results.length) {
		container.innerHTML = `<p class="muted">No matching notes.</p>`;
		return;
	}

	container.replaceChildren();

	for (let index = 0; index < results.length; index += 1) {
		container.append(createResultButton({ note: results[index], query }));
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
	const weekdays = getWeekdayLabels({ firstDayOfWeek });
	const titleFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
	const title = select(selectors.calendarTitle);
	const weekdayContainer = select(selectors.calendarWeekdays);
	const dayContainer = select(selectors.calendarDays);

	title.textContent = titleFormatter.format(monthStart);
	weekdayContainer.replaceChildren();
	dayContainer.replaceChildren();

	for (let index = 0; index < weekdays.length; index += 1) {
		const weekday = document.createElement("span");
		weekday.textContent = weekdays[index];
		weekdayContainer.append(weekday);
	}

	for (let index = 0; index < leadingDays; index += 1) {
		dayContainer.append(createCalendarSpacer());
	}

	for (let day = 1; day <= daysInMonth; day += 1) {
		dayContainer.append(createCalendarDay({ day, monthDate, today }));
	}
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
	const labelFormatter = new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric"
	});

	button.className = "calendar-day";
	button.classList.toggle("is-today", isToday);
	button.type = "button";
	button.textContent = String(day);
	button.setAttribute("aria-label", labelFormatter.format(date));

	if (isToday) {
		button.setAttribute("aria-current", "date");
	}

	return button;
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
 * @returns {HTMLButtonElement}
 */
function createResultButton({ note, query }) {
	const button = document.createElement("button");
	button.className = "result-button";
	button.type = "button";
	button.innerHTML = `
		<span class="result-title">${escapeHtml(note.title)}</span>
		<span class="result-path">${escapeHtml(note.path)}</span>
		<span class="result-excerpt">${escapeHtml(getExcerpt({ text: note.body, query }))}</span>
	`;
	button.dataset.path = note.path;
	button.addEventListener("click", handleNoteButtonClick);
	return button;
}

/**
 * Renders a simple linked-note graph list.
 * @returns {void}
 */
function renderGraph() {
	const container = select(selectors.graphList);
	container.replaceChildren();

	if (!state.notes.length) {
		container.innerHTML = `<p class="muted">No notes loaded.</p>`;
		return;
	}

	for (let index = 0; index < state.notes.length; index += 1) {
		const note = state.notes[index];
		const button = document.createElement("button");
		button.className = "graph-button";
		button.type = "button";
		button.dataset.path = note.path;
		button.innerHTML = `
			<span class="graph-title">${escapeHtml(note.title)}</span>
			<span class="graph-path">${note.links.length} outgoing links</span>
		`;
		button.addEventListener("click", handleNoteButtonClick);
		container.append(button);
	}
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
	state.activePath = "";
	state.activeRail = "home";
	state.activeView = "home";
	state.leftCollapsed = true;
	state.rightCollapsed = true;
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
 * @returns {void}
 */
function openNote({ path, updateHash = true }) {
	const note = findNoteByPath({ path });

	if (!note) {
		showToast({ message: `Missing note: ${path}` });
		return;
	}

	state.activePath = note.path;
	state.activeRail = state.activePanel;
	state.activeView = "note";
	updateLocationHash({ hash: getNoteHash({ path: note.path }), updateHash });
	renderArticle({ note });
	renderArticleContext({ note });
	renderFileTree();
	renderBookmarks();
	renderPanels();
	renderShell();
}

/**
 * Renders the home screen.
 * @returns {void}
 */
function renderHome() {
	const article = select(selectors.article);
	const title = state.config.home?.title || state.config.title || "Publisher";
	const subtitle = state.config.home?.subtitle || state.config.description || "A client-side markdown knowledge base.";
	const background = getHomeBackground();
	const backgroundClass = getHomeClassName({ background });
	const backgroundImage = background.image;
	const backgroundStyle = backgroundImage ? ` style="--home-background-image: url('${escapeCssUrl(backgroundImage)}');"` : "";
	const ctas = createHomeCtaMarkup();

	removeArticleMaps();
	article.classList.add("is-home");
	article.classList.remove("has-header");
	article.innerHTML = `
		<div class="${backgroundClass}"${backgroundStyle}>
			<div class="home-content">
				<h1>${escapeHtml(title)}</h1>
				<p>${escapeHtml(subtitle)}</p>
				${ctas}
			</div>
		</div>
	`;
}

/**
 * Creates home CTA card markup.
 * @returns {string}
 */
function createHomeCtaMarkup() {
	const ctas = getHomeCtas();

	if (!ctas.length) {
		return "";
	}

	let markup = `<div class="home-ctas" aria-label="Featured notes">`;

	for (let index = 0; index < ctas.length; index += 1) {
		const cta = ctas[index];
		const note = findNoteByPath({ path: cta.path });
		const description = cta.description ? `<span>${escapeHtml(cta.description)}</span>` : "";
		const disabledClass = note ? "" : " is-disabled";
		const noteTarget = note ? ` data-note-target="${escapeAttribute(note.path)}"` : "";

		markup += `
			<a class="home-cta${disabledClass}" href="${note ? getNoteHash({ path: note.path }) || "#" : "#"}"${noteTarget}>
				<strong>${escapeHtml(cta.title)}</strong>
				${description}
			</a>
		`;
	}

	markup += `</div>`;
	return markup;
}

/**
 * Gets configured home CTA cards.
 * @returns {Array<object>}
 */
function getHomeCtas() {
	const configured = Array.isArray(state.config.home?.ctas) ? state.config.home.ctas : [];
	const ctas = [];

	for (let index = 0; index < configured.length && ctas.length < 4; index += 1) {
		const cta = configured[index] || {};
		const title = String(cta.title || "").trim();
		const path = normalizePath(String(cta.path || ""));

		if (title && path) {
			ctas.push({
				title,
				path,
				description: String(cta.description || "").trim()
			});
		}
	}

	return ctas;
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
	article.classList.remove("is-home");
	article.classList.toggle("has-header", Boolean(headerImage));
	article.innerHTML = `${header}<div class="article-inner">${content}${createScrollUpMarkup({ note })}</div>`;
	initializeArticleCodeBlocks();
	highlightArticleCode();
	initializeArticleMaps();
	typesetArticleMath({ markdown: note.body });
}

/**
 * Creates a bottom scroll-up control for long notes.
 * @param {object} params
 * @param {object} params.note
 * @returns {string}
 */
function createScrollUpMarkup({ note }) {
	const articleText = getArticleText({ markdown: note.body });

	if (countCharacters(articleText) < scrollUpCharacterThreshold) {
		return "";
	}

	return `
		<div class="scroll-up-wrap">
			<button class="scroll-up-button" type="button" data-action="scroll-article-up">
				<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
				<span>Scroll up</span>
			</button>
		</div>
	`;
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
 * Highlights code blocks in the active article.
 * @returns {void}
 */
function highlightArticleCode() {
	Prism.highlightAllUnder(select(selectors.article));
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
			disabled: true
		}));
	}

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
		showToast({ message: "Math rendering could not be loaded." });
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
			bindArticleMapHeader({ element, map });
			state.maps.push(map);
		})
		.catch(() => {
			element.textContent = "Map could not be loaded.";
		});
}

/**
 * Binds header controls for a MapLibre map.
 * @param {object} params
 * @param {HTMLElement} params.element
 * @param {object} params.map
 * @returns {void}
 */
function bindArticleMapHeader({ element, map }) {
	const mapEmbed = element.closest(".map-embed");
	const coordinateLabel = mapEmbed?.querySelector("[data-map-coordinates]");
	const googleMapsLink = mapEmbed?.querySelector("[data-map-google]");

	if (!mapEmbed || !coordinateLabel || !googleMapsLink) {
		return;
	}

	updateArticleMapHeader({ map, coordinateLabel, googleMapsLink });
	map.on("move", function handleMapMove() {
		updateArticleMapHeader({ map, coordinateLabel, googleMapsLink });
	});
}

/**
 * Updates map coordinates and external map link.
 * @param {object} params
 * @param {object} params.map
 * @param {Element} params.coordinateLabel
 * @param {HTMLAnchorElement} params.googleMapsLink
 * @returns {void}
 */
function updateArticleMapHeader({ map, coordinateLabel, googleMapsLink }) {
	const center = map.getCenter();
	const latitude = center.lat;
	const longitude = center.lng;

	coordinateLabel.textContent = formatCoordinates({ latitude, longitude });
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
	copyContentButton.disabled = !note;
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
	const articleText = getArticleText({ markdown: note.body });
	const wordCount = countWords(articleText);
	const entries = [
		["Title", note.title],
		["Path", note.path],
		["Words", formatNumber(wordCount)],
		["Characters", formatNumber(countCharacters(articleText))],
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
	return stripMarkdown(markdown).replace(/\s+/g, " ").trim();
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
	const cleanPath = normalizePath(path);

	if (!cleanPath) {
		return "";
	}

	if (/^(https?:|data:|\/)/i.test(path)) {
		return path;
	}

	if (state.config.github?.enabled) {
		return getGithubCdnUrl({
			path: cleanPath,
			rootPath: state.config.github.assetRootPath || "images"
		});
	}

	return `/${cleanPath}`;
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
	const values = Object.values(metadata);
	const parts = [];

	for (let index = 0; index < values.length; index += 1) {
		parts.push(formatMetadataValue(values[index]));
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
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
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
			const title = stripMarkdown(match[2]).trim();
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

	for (let index = 0; index < note.links.length; index += 1) {
		const linkedNote = findNoteByWikiTarget({ target: note.links[index].target });

		if (linkedNote) {
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
	const action = event.target.closest("[data-action='scroll-article-up']");

	if (action) {
		event.preventDefault();
		scrollArticleToTop();
		return;
	}

	const codeCopyAction = event.target.closest("[data-action='copy-code-block']");

	if (codeCopyAction) {
		event.preventDefault();
		copyArticleCodeBlock({ button: codeCopyAction });
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
		showCodeCopiedState({ button });
	}
}

/**
 * Shows temporary copied state on a code copy button.
 * @param {object} params
 * @param {HTMLElement} params.button
 * @returns {void}
 */
function showCodeCopiedState({ button }) {
	const icon = button.querySelector("i");
	const label = button.querySelector("span");

	button.classList.add("is-copied");

	if (icon) {
		icon.className = "fa-solid fa-check";
	}

	if (label) {
		label.textContent = "Copied";
	}

	window.setTimeout(function resetCodeCopyState() {
		button.classList.remove("is-copied");

		if (icon) {
			icon.className = "fa-regular fa-copy";
		}

		if (label) {
			label.textContent = "Copy";
		}
	}, 1400);
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
 * Handles article text selections.
 * @returns {void}
 */
function handleSelectionChange() {
	window.requestAnimationFrame(renderSelectionMenu);
}

/**
 * Renders the selection tools menu near selected article text.
 * @returns {void}
 */
function renderSelectionMenu() {
	const menu = select(selectors.selectionMenu);
	const selection = window.getSelection();

	if (!selection || selection.isCollapsed || !state.activePath) {
		hideSelectionMenu();
		return;
	}

	if (menu.contains(document.activeElement)) {
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

	state.selectedText = selectedText;
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
	return `${formatNumber(countWords(text))} words, ${formatNumber(countCharacters(text))} characters`;
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
	const gap = 18;
	const width = menu.offsetWidth || 260;
	const height = menu.offsetHeight || 74;
	const topAbove = rect.top - height - gap;
	const topBelow = rect.bottom + gap;
	const left = Math.min(
		window.innerWidth - width - gap,
		Math.max(gap, rect.left + rect.width / 2 - width / 2)
	);
	const top = topAbove >= gap
		? topAbove
		: Math.min(window.innerHeight - height - gap, topBelow);

	menu.style.left = `${left}px`;
	menu.style.top = `${Math.max(gap, top)}px`;
}

/**
 * Handles pointer presses outside the selection menu.
 * @param {PointerEvent} event
 * @returns {void}
 */
function handleDocumentPointerDown(event) {
	const menu = select(selectors.selectionMenu);

	if (!menu.hidden && !menu.contains(event.target)) {
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
 * Hides the selection menu.
 * @returns {void}
 */
function hideSelectionMenu() {
	select(selectors.selectionMenu).hidden = true;
}

/**
 * Renders markdown to HTML.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function renderMarkdown({ markdown }) {
	const html = marked.parse(replaceMapSyntax({ markdown: replaceWikiLinks({ markdown }) }));
	return resolveRenderedLinks({ html });
}

/**
 * Replaces map syntax before Markdown parsing.
 * @param {object} params
 * @param {string} params.markdown
 * @returns {string}
 */
function replaceMapSyntax({ markdown }) {
	if (!state.config.maps?.enabled) {
		return markdown;
	}

	return markdown.replace(/^map:\[\s*([^\],]*)\s*,?\s*([^\],]*)?\s*,?\s*([^\]]*)?\s*\]\s*$/gm, createMapPlaceholder);
}

/**
 * Creates map placeholder markup.
 * @param {string} match
 * @param {string} latitude
 * @param {string} longitude
 * @param {string} zoom
 * @returns {string}
 */
function createMapPlaceholder(match, latitude, longitude, zoom) {
	const map = getMapValues({ latitude, longitude, zoom });
	const className = state.config.maps?.grayscale ? "map-canvas is-grayscale" : "map-canvas";
	const googleMapsUrl = getGoogleMapsUrl({ latitude: map.latitude, longitude: map.longitude });
	const coordinateLabel = formatCoordinates({ latitude: map.latitude, longitude: map.longitude });

	return `<figure class="map-embed"><figcaption class="map-header"><span class="map-coordinate-label" data-map-coordinates>${escapeHtml(coordinateLabel)}</span><span class="map-header-actions"><a href="${escapeAttribute(googleMapsUrl)}" target="_blank" rel="noreferrer" data-map-google><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>Google Maps</span></a><a href="#" data-map-fullscreen><i class="fa-solid fa-expand" aria-hidden="true"></i><span data-map-fullscreen-label>Fullscreen</span></a></span></figcaption><div class="${className}" data-map data-lat="${escapeAttribute(map.latitude)}" data-lon="${escapeAttribute(map.longitude)}" data-zoom="${escapeAttribute(map.zoom)}"></div></figure>`;
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
 * @returns {object}
 */
function getMapValues({ latitude, longitude, zoom }) {
	const fallback = getMapFallback();

	return {
		latitude: String(getFiniteNumber({ value: latitude, fallback: fallback.latitude })),
		longitude: String(getFiniteNumber({ value: longitude, fallback: fallback.longitude })),
		zoom: String(getFiniteNumber({ value: zoom, fallback: fallback.zoom }))
	};
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
	return markdown
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, createWikiLinkWithLabel)
		.replace(/\[\[([^\]]+)\]\]/g, createWikiLink);
}

/**
 * Resolves rendered Markdown links that point to notes.
 * @param {object} params
 * @param {string} params.html
 * @returns {string}
 */
function resolveRenderedLinks({ html }) {
	const template = document.createElement("template");
	template.innerHTML = html;
	const links = template.content.querySelectorAll("a[href]");

	addRenderedHeadingIds({ template });

	for (let index = 0; index < links.length; index += 1) {
		resolveRenderedLink({ link: links[index] });
	}

	return template.innerHTML;
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
		const slug = getUniqueSlug({ text: heading.textContent || "section", slugs });
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
	const rootPath = normalizePath(state.config.github?.rootPath || "");
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
	if (state.config.github?.enabled) {
		return getGithubCdnUrl({ path: note.path });
	}

	return note.sourceUrl || "";
}

/**
 * Gets a jsDelivr URL for a repository path.
 * @param {object} params
 * @param {string} params.path
 * @param {string} [params.rootPath]
 * @returns {string}
 */
function getGithubCdnUrl({ path, rootPath }) {
	const github = state.config.github || {};
	const owner = String(github.owner || "").trim();
	const repo = String(github.repo || "").trim();
	const branch = String(github.branch || "main").trim();
	const resolvedRootPath = normalizePath(rootPath === undefined ? github.rootPath || "" : rootPath);
	const articlePath = normalizePath(path);
	const fullPath = joinRepoPath({ rootPath: resolvedRootPath, path: articlePath });

	if (!owner || !repo || !branch || !articlePath) {
		return "";
	}

	return `https://cdn.jsdelivr.net/gh/${encodePathPart(owner)}/${encodePathPart(repo)}@${encodePathPart(branch)}/${encodePath(fullPath)}`;
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
 * Gets a raw GitHub URL for a repository path.
 * @param {object} params
 * @param {string} params.path
 * @returns {string}
 */
function getGithubRawUrl({ path }) {
	const github = state.config.github || {};
	const owner = String(github.owner || "").trim();
	const repo = String(github.repo || "").trim();
	const branch = String(github.branch || "main").trim();
	const rootPath = normalizePath(github.rootPath || "");
	const assetPath = normalizePath(path);
	const fullPath = rootPath ? `${rootPath}/${assetPath}` : assetPath;

	if (!owner || !repo || !branch || !assetPath) {
		return "";
	}

	return `https://raw.githubusercontent.com/${encodePathPart(owner)}/${encodePathPart(repo)}/${encodePathPart(branch)}/${encodePath(fullPath)}`;
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
 * Extracts wiki links.
 * @param {string} markdown
 * @returns {Array<object>}
 */
function extractWikiLinks(markdown) {
	const links = [];
	const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
	let match = pattern.exec(markdown);

	while (match) {
		links.push({ target: match[1].trim() });
		match = pattern.exec(markdown);
	}

	return links;
}

/**
 * Finds backlinks for a note.
 * @param {object} params
 * @param {object} params.note
 * @returns {Array<object>}
 */
function getBacklinks({ note }) {
	const backlinks = [];

	for (let index = 0; index < state.notes.length; index += 1) {
		const candidate = state.notes[index];

		if (candidate.path === note.path) {
			continue;
		}

		for (let linkIndex = 0; linkIndex < candidate.links.length; linkIndex += 1) {
			const linkedNote = findNoteByWikiTarget({ target: candidate.links[linkIndex].target });

			if (linkedNote?.path === note.path) {
				backlinks.push(candidate);
				break;
			}
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
	const normalizedTarget = normalizePath(target);
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
 * Gets title from markdown.
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
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
		.replace(/\[\[([^\]]+)\]\]/g, "$1")
		.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
		.replace(/[#>*_`-]/g, " ");
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
 * Toggles the right panel.
 * @returns {void}
 */
function toggleRightPanel() {
	if (!state.activePath) {
		return;
	}

	state.rightCollapsed = !state.rightCollapsed;
	renderShell();
}

/**
 * Renders shell layout state.
 * @returns {void}
 */
function renderShell() {
	const shell = select(selectors.appShell);
	const rightToggle = select("[data-action='toggle-right']");
	shell.classList.toggle("is-left-collapsed", state.leftCollapsed);
	shell.classList.toggle("is-right-collapsed", state.rightCollapsed);
	rightToggle.hidden = !state.activePath;
}

/**
 * Gets the initial theme from storage or app config.
 * @returns {string}
 */
function getInitialTheme() {
	const storedTheme = readStoredTheme();

	if (storedTheme) {
		return storedTheme;
	}

	return getValidTheme(state.config.appearance?.theme || "light") || "light";
}

/**
 * Reads the saved theme.
 * @returns {string}
 */
function readStoredTheme() {
	try {
		return getValidTheme(window.localStorage.getItem(themeStorageKey) || "");
	} catch (error) {
		return "";
	}
}

/**
 * Saves the current theme.
 * @returns {void}
 */
function saveTheme() {
	try {
		window.localStorage.setItem(themeStorageKey, state.theme);
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
	const button = select(selectors.themeToggle);
	const theme = getThemeById({ id: state.theme });
	const label = theme ? theme.label : "Light";

	button.title = `Theme: ${label}`;
	button.setAttribute("aria-label", `Change theme. Current theme: ${label}`);
}

/**
 * Rotates to the next available theme.
 * @returns {void}
 */
function rotateTheme() {
	const currentIndex = getThemeIndex({ id: state.theme });
	const nextIndex = (currentIndex + 1) % themes.length;
	state.theme = themes[nextIndex].id;
	applyTheme();
	renderThemeToggle();
	saveTheme();
	showToast({ message: `Theme: ${themes[nextIndex].label}` });
}

/**
 * Gets a supported theme value.
 * @param {string} value
 * @returns {string}
 */
function getValidTheme(value) {
	const theme = getThemeById({ id: getNormalizedThemeId(value) });
	return theme ? theme.id : "";
}

/**
 * Gets the current theme id for legacy names.
 * @param {string} value
 * @returns {string}
 */
function getNormalizedThemeId(value) {
	const legacyThemes = {
		"sand-light": "sand",
		"blue-dark": "ocean"
	};
	const id = String(value || "");

	return legacyThemes[id] || id;
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
 * Gets a theme index by id.
 * @param {object} params
 * @param {string} params.id
 * @returns {number}
 */
function getThemeIndex({ id }) {
	for (let index = 0; index < themes.length; index += 1) {
		if (themes[index].id === id) {
			return index;
		}
	}

	return 0;
}

/**
 * Applies reader settings to CSS variables.
 * @returns {void}
 */
function applyReaderSettings() {
	document.documentElement.style.setProperty("--article-font-size", `${state.fontSize}px`);
	document.documentElement.style.setProperty("--article-line-height", String(state.lineHeight));
	document.documentElement.style.setProperty("--article-text-align", state.textAlign);
}

/**
 * Renders reader control values.
 * @returns {void}
 */
function renderReaderControls() {
	const orientations = selectAll(selectors.textOrientation);
	const fontSizeInput = select(selectors.fontSizeInput);
	const fontSizeValue = select(selectors.fontSizeValue);
	const lineHeightInput = select(selectors.lineHeightInput);
	const lineHeightValue = select(selectors.lineHeightValue);

	for (let index = 0; index < orientations.length; index += 1) {
		orientations[index].checked = orientations[index].value === state.textAlign;
	}

	fontSizeInput.value = String(state.fontSize);
	fontSizeValue.textContent = `${state.fontSize}px`;
	lineHeightInput.value = String(state.lineHeight);
	lineHeightValue.textContent = state.lineHeight.toFixed(2);
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
		showToast({ message: "Bookmark removed." });
	} else {
		addBookmark({ path: state.activePath });
		showToast({ message: "Bookmark added." });
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
		showToast({ message: "No bookmarks to remove." });
		return;
	}

	state.bookmarks = [];
	saveBookmarks();
	refreshBookmarkUi();
	showToast({ message: "All bookmarks removed." });
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
		showToast({ message: "Article source URL is unavailable." });
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
		showToast({ message: "Article site URL is unavailable." });
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
		showToast({ message: "No article selected." });
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
		showToast({ message: "No text selected." });
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
		showToast({ message: "No text selected." });
		return;
	}

	if (countCharacters(text) > maximumQrCodeCharacters) {
		showToast({ message: "Selection is too long for a QR code." });
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
		showToast({ message: "Could not create QR code." });
	}
}

/**
 * Shows a temporary QR code block in the right panel.
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
	state.rightCollapsed = false;
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
 * Opens a Google search for the selected article text.
 * @returns {void}
 */
function searchSelectedTextWithGoogle() {
	searchSelectedText({ baseUrl: "https://www.google.com/search?q=" });
}

/**
 * Opens a Brave search for the selected article text.
 * @returns {void}
 */
function searchSelectedTextWithBrave() {
	searchSelectedText({ baseUrl: "https://search.brave.com/search?q=" });
}

/**
 * Opens a search engine query for the selected article text.
 * @param {object} params
 * @param {string} params.baseUrl
 * @returns {void}
 */
function searchSelectedText({ baseUrl }) {
	const text = state.selectedText;

	if (!text) {
		showToast({ message: "No text selected." });
		return;
	}

	window.open(`${baseUrl}${encodeURIComponent(text)}`, "_blank", "noreferrer");
	hideSelectionMenu();
}

/**
 * Opens the active article in Obsidian.
 * @returns {void}
 */
function openActiveArticleInObsidian() {
	const url = getObsidianArticleUrl({ path: state.activePath });

	if (!url) {
		showToast({ message: "Obsidian link is unavailable." });
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

		showToast({ message: successMessage });
		return true;
	} catch (error) {
		if (copyTextWithBuffer(text)) {
			showToast({ message: successMessage });
			return true;
		} else {
			showToast({ message: "Could not copy to clipboard." });
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
	showToast({ message: "Browser settings could not be saved." });
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

	return "Local sample vault";
}

/**
 * Shows a toast message.
 * @param {object} params
 * @param {string} params.message
 * @returns {void}
 */
function showToast({ message }) {
	const toast = select(selectors.toast);
	toast.textContent = message;
	toast.classList.add("is-visible");
	window.clearTimeout(state.toastTimer);
	state.toastTimer = window.setTimeout(hideToast, 2600);
}

/**
 * Hides the toast message.
 * @returns {void}
 */
function hideToast() {
	select(selectors.toast).classList.remove("is-visible");
}

/**
 * Renders a fatal load error.
 * @param {object} params
 * @param {Error} params.error
 * @returns {void}
 */
function renderError({ error }) {
	select(selectors.article).innerHTML = `
		<div class="empty-state">
			<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
			<h2>Could not load vault</h2>
			<p>${escapeHtml(error.message)}</p>
		</div>
	`;
	showToast({ message: error.message });
}

await init();
