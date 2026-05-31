const selectors = {
	homeLink: "[data-home-link]",
	requestedPath: "[data-requested-path]",
	routeLink: "[data-route-link]"
};

/**
 * Initializes the GitHub Pages 404 fallback page.
 * @returns {void}
 */
function initializeNotFoundPage() {
	const routePath = getRoutePath();
	const homeUrl = getHomeUrl();

	updateHomeLink({ homeUrl });
	updateRequestedPath({ routePath });
	updateRouteLink({ homeUrl, routePath });
}

/**
 * Gets the current path without leading and trailing slashes.
 * @returns {string}
 */
function getRoutePath() {
	const routePath = normalizePath(window.location.pathname);

	if (routePath === "404.html") {
		return "";
	}

	return routePath;
}

/**
 * Gets the static site home URL.
 * @returns {string}
 */
function getHomeUrl() {
	return `${window.location.origin}/`;
}

/**
 * Updates the home link destination.
 * @param {object} params
 * @param {string} params.homeUrl
 * @returns {void}
 */
function updateHomeLink({ homeUrl }) {
	const link = document.querySelector(selectors.homeLink);

	if (!link) {
		return;
	}

	link.href = homeUrl;
}

/**
 * Updates the requested path summary.
 * @param {object} params
 * @param {string} params.routePath
 * @returns {void}
 */
function updateRequestedPath({ routePath }) {
	const element = document.querySelector(selectors.requestedPath);

	if (!element || !routePath) {
		return;
	}

	element.textContent = `No page exists at /${routePath}.`;
}

/**
 * Updates the note route recovery link.
 * @param {object} params
 * @param {string} params.homeUrl
 * @param {string} params.routePath
 * @returns {void}
 */
function updateRouteLink({ homeUrl, routePath }) {
	const link = document.querySelector(selectors.routeLink);

	if (!link || !routePath) {
		return;
	}

	link.href = `${homeUrl}#/${encodePath(routePath)}`;
	link.hidden = false;
}

/**
 * Normalizes a slash-delimited path.
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
	const normalizedPath = path.replace(/^\/+|\/+$/g, "");

	return normalizedPath;
}

/**
 * Encodes each path segment for a hash route.
 * @param {string} path
 * @returns {string}
 */
function encodePath(path) {
	const parts = normalizePath(path).split("/");

	for (let index = 0; index < parts.length; index += 1) {
		parts[index] = encodeURIComponent(parts[index]);
	}

	return parts.join("/");
}

initializeNotFoundPage();
