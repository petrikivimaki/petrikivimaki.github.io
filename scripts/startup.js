import { requestJson } from "./network.js";

const configPath = "config/app-config.json";
const minimumStartupRecoveryMs = 30000;
const startupRecoveryBufferMs = 10000;
const startupResult = await loadStartupConfig({ path: configPath });
const startupAnimation = preparePageLoadAnimation({ config: startupResult.config });
let startupRecoveryTimer = scheduleStartupRecovery({ animation: startupAnimation });

/**
 * Loads the central app config before the browser's first render.
 * @async
 * @param {object} params
 * @param {string} params.path
 * @returns {Promise<{config: object|null, error: Error|null}>}
 */
async function loadStartupConfig({ path }) {
	try {
		return {
			config: await requestJson({
				url: path,
				label: "App configuration",
				cache: "no-cache"
			}),
			error: null
		};
	} catch (error) {
		return {
			config: null,
			error: error instanceof Error ? error : new Error(`Could not load ${path}`)
		};
	}
}

/**
 * Prepares the optional mask before rendering is unblocked.
 * @param {object} params
 * @param {object|null} params.config
 * @returns {object|null}
 */
function preparePageLoadAnimation({ config }) {
	const animationConfig = config?.pageLoadAnimation || {};

	if (!animationConfig.enabled) {
		return null;
	}

	const mask = document.querySelector("[data-page-load-mask]");
	const logo = document.querySelector("[data-page-load-logo]");
	const backgroundColor = getAnimationColor({
		value: animationConfig.backgroundColor,
		fallback: "rgb(0,0,0)"
	});
	const durationMs = getAnimationNumber({ value: animationConfig.durationMs, fallback: 1500 });
	const fadeMs = getAnimationNumber({ value: animationConfig.fadeMs, fallback: 420 });

	if (!mask || !logo) {
		return null;
	}

	document.documentElement.style.setProperty("--page-load-background", backgroundColor);
	document.documentElement.classList.add("is-page-loading");
	logo.addEventListener("error", handlePageLoadLogoError, { once: true });
	logo.src = animationConfig.logo || "images/papyrus-mark.png";
	mask.style.setProperty("--page-load-fade-ms", `${fadeMs}ms`);
	mask.classList.add("is-visible");

	return {
		startedAt: performance.now(),
		durationMs,
		fadeMs,
		mask
	};
}

/**
 * Hides an unavailable logo while preserving the background mask.
 * @param {Event} event
 * @returns {void}
 */
function handlePageLoadLogoError(event) {
	if (event.currentTarget instanceof HTMLImageElement) {
		event.currentTarget.hidden = true;
	}
}

/**
 * Schedules a last-resort release if later application code cannot finish startup.
 * @param {object} params
 * @param {object|null} params.animation
 * @returns {number}
 */
function scheduleStartupRecovery({ animation }) {
	if (!animation) {
		return 0;
	}

	const configuredAnimationMs = animation.durationMs + animation.fadeMs + startupRecoveryBufferMs;
	const recoveryMs = Math.max(minimumStartupRecoveryMs, configuredAnimationMs);
	return window.setTimeout(dismissStartupAnimation, recoveryMs);
}

/**
 * Releases the startup mask and cancels its recovery timer.
 * @returns {void}
 */
function dismissStartupAnimation() {
	window.clearTimeout(startupRecoveryTimer);
	startupRecoveryTimer = 0;
	document.documentElement.classList.remove("is-page-loading");

	if (startupAnimation) {
		startupAnimation.mask.classList.remove("is-visible", "is-dimming", "is-leaving");
	}
}

/**
 * Gets a valid CSS color for the animation background.
 * @param {object} params
 * @param {*} params.value
 * @param {string} params.fallback
 * @returns {string}
 */
function getAnimationColor({ value, fallback }) {
	const color = String(value || "").trim();
	return CSS.supports("color", color) ? color : fallback;
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

export const startupConfig = startupResult.config;
export const startupConfigError = startupResult.error;
export { dismissStartupAnimation, startupAnimation };
