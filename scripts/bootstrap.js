const applicationModulePath = "./app.js";

try {
	await import(applicationModulePath);
} catch (error) {
	renderStartupFailure({ error });
}

/**
 * Replaces an incomplete shell with a clear startup failure state.
 * @param {object} params
 * @param {*} params.error
 * @returns {void}
 */
function renderStartupFailure({ error }) {
	dismissStartupMask();
	const article = document.querySelector("[data-article]");
	const progress = document.querySelector("[data-article-progress]");
	const detailsButtons = document.querySelectorAll("[data-action='toggle-secondary-menu']");

	if (progress instanceof HTMLElement) {
		progress.hidden = true;
	}

	for (let index = 0; index < detailsButtons.length; index += 1) {
		detailsButtons[index].hidden = true;
	}

	if (article instanceof HTMLElement) {
		article.innerHTML = `
			<div class="empty-state" role="alert">
				<h2>Papyrus could not start</h2>
				<p>A required resource could not be loaded. Check your connection, then try again.</p>
				<button class="empty-state-action" type="button" data-bootstrap-reload>Try again</button>
			</div>
		`;
		article.querySelector("[data-bootstrap-reload]")?.addEventListener("click", reloadApplication);
	}

	document.title = "Could not start · Papyrus";
	console.error("Papyrus could not start.", error);
}

/**
 * Releases the optional startup mask after an application import failure.
 * @returns {void}
 */
function dismissStartupMask() {
	document.documentElement.classList.remove("is-page-loading");
	document.querySelector("[data-page-load-mask]")?.classList.remove("is-visible", "is-dimming", "is-leaving");
}

/**
 * Reloads the application after a startup failure.
 * @returns {void}
 */
function reloadApplication() {
	window.location.reload();
}
