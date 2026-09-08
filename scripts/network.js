const defaultRetryCount = 1;
const defaultRetryDelayMs = 350;
const defaultTimeoutMs = 8000;
const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Requests and parses one JSON resource.
 * @async
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.label
 * @param {RequestCache} [params.cache]
 * @param {number} [params.timeoutMs]
 * @param {number} [params.retries]
 * @param {number} [params.retryDelayMs]
 * @param {AbortSignal|null} [params.signal]
 * @returns {Promise<object>}
 */
async function requestJson({
	url,
	label,
	cache = "default",
	timeoutMs = defaultTimeoutMs,
	retries = defaultRetryCount,
	retryDelayMs = defaultRetryDelayMs,
	signal = null
}) {
	return await requestResource({
		url,
		label,
		cache,
		timeoutMs,
		retries,
		retryDelayMs,
		signal,
		responseType: "json"
	});
}

/**
 * Requests one text resource.
 * @async
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.label
 * @param {RequestCache} [params.cache]
 * @param {number} [params.timeoutMs]
 * @param {number} [params.retries]
 * @param {number} [params.retryDelayMs]
 * @param {AbortSignal|null} [params.signal]
 * @returns {Promise<string>}
 */
async function requestText({
	url,
	label,
	cache = "default",
	timeoutMs = defaultTimeoutMs,
	retries = defaultRetryCount,
	retryDelayMs = defaultRetryDelayMs,
	signal = null
}) {
	return await requestResource({
		url,
		label,
		cache,
		timeoutMs,
		retries,
		retryDelayMs,
		signal,
		responseType: "text"
	});
}

/**
 * Requests and consumes one resource with bounded transient retries.
 * @async
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.label
 * @param {RequestCache} params.cache
 * @param {number} params.timeoutMs
 * @param {number} params.retries
 * @param {number} params.retryDelayMs
 * @param {AbortSignal|null} params.signal
 * @param {"json"|"text"} params.responseType
 * @returns {Promise<*>}
 */
async function requestResource({
	url,
	label,
	cache,
	timeoutMs,
	retries,
	retryDelayMs,
	signal,
	responseType
}) {
	const retryCount = getNonNegativeInteger({ value: retries, fallback: defaultRetryCount });
	const requestTimeoutMs = getPositiveNumber({ value: timeoutMs, fallback: defaultTimeoutMs });
	const baseRetryDelayMs = getNonNegativeInteger({ value: retryDelayMs, fallback: defaultRetryDelayMs });

	for (let attempt = 0; attempt <= retryCount; attempt += 1) {
		throwIfAborted({ label, signal });
		const result = await runRequestAttempt({
			url,
			label,
			cache,
			timeoutMs: requestTimeoutMs,
			signal,
			responseType
		});

		if (result.response?.ok && !result.error) {
			return result.value;
		}

		throwIfAborted({ label, signal });

		if (result.invalidJson) {
			throw new Error(`${label} returned invalid JSON.`, { cause: result.error });
		}

		const hasRetry = attempt < retryCount;
		const shouldRetry = Boolean(result.error)
			|| retryableStatusCodes.has(result.response?.status);

		if (hasRetry && shouldRetry) {
			await waitForRetry({
				milliseconds: baseRetryDelayMs * (attempt + 1),
				label,
				signal
			});
			continue;
		}

		if (result.response && !result.response.ok) {
			throw createHttpError({ label, response: result.response });
		}

		if (result.timedOut) {
			throw new Error(`${label} did not respond within ${formatTimeoutSeconds(requestTimeoutMs)}.`);
		}

		throw new Error(`${label} could not be reached. Check your connection and try again.`, {
			cause: result.error
		});
	}

	throw new Error(`${label} could not be loaded.`);
}

/**
 * Runs one timed fetch and body-consumption attempt.
 * @async
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.label
 * @param {RequestCache} params.cache
 * @param {number} params.timeoutMs
 * @param {AbortSignal|null} params.signal
 * @param {"json"|"text"} params.responseType
 * @returns {Promise<{response: Response|null, value: *|null, error: Error|null, timedOut: boolean, invalidJson: boolean}>}
 */
async function runRequestAttempt({ url, label, cache, timeoutMs, signal, responseType }) {
	const controller = new AbortController();
	let timedOut = false;
	let response = null;
	const handleAbort = function handleRequestAbort() {
		controller.abort(signal?.reason);
	};
	const timeoutId = window.setTimeout(function handleRequestTimeout() {
		timedOut = true;
		controller.abort();
	}, timeoutMs);

	if (signal) {
		signal.addEventListener("abort", handleAbort, { once: true });
	}

	try {
		response = await fetch(url, { cache, signal: controller.signal });

		if (!response.ok) {
			return { response, value: null, error: null, timedOut: false, invalidJson: false };
		}

		return {
			response,
			value: responseType === "json" ? await response.json() : await response.text(),
			error: null,
			timedOut: false,
			invalidJson: false
		};
	} catch (error) {
		const requestError = error instanceof Error ? error : new Error(`${label} request failed.`);
		return {
			response,
			value: null,
			error: requestError,
			timedOut,
			invalidJson: responseType === "json" && requestError instanceof SyntaxError
		};
	} finally {
		window.clearTimeout(timeoutId);

		if (signal) {
			signal.removeEventListener("abort", handleAbort);
		}
	}
}

/**
 * Waits between transient request attempts.
 * @async
 * @param {object} params
 * @param {number} params.milliseconds
 * @param {string} params.label
 * @param {AbortSignal|null} params.signal
 * @returns {Promise<void>}
 */
async function waitForRetry({ milliseconds, label, signal }) {
	throwIfAborted({ label, signal });

	if (!milliseconds) {
		return;
	}

	await new Promise((resolve, reject) => {
		let timeoutId = 0;
		const handleAbort = function handleRetryAbort() {
			window.clearTimeout(timeoutId);
			signal?.removeEventListener("abort", handleAbort);
			reject(createAbortError({ label, cause: signal?.reason }));
		};
		timeoutId = window.setTimeout(function finishRetryWait() {
			signal?.removeEventListener("abort", handleAbort);
			resolve();
		}, milliseconds);

		signal?.addEventListener("abort", handleAbort, { once: true });
	});
}

/**
 * Creates a readable HTTP status error.
 * @param {object} params
 * @param {string} params.label
 * @param {Response} params.response
 * @returns {Error}
 */
function createHttpError({ label, response }) {
	const statusText = response.statusText ? ` ${response.statusText}` : "";
	return new Error(`${label} returned HTTP ${response.status}${statusText}.`);
}

/**
 * Stops work when the caller has cancelled a request.
 * @param {object} params
 * @param {string} params.label
 * @param {AbortSignal|null} params.signal
 * @returns {void}
 */
function throwIfAborted({ label, signal }) {
	if (signal?.aborted) {
		throw createAbortError({ label, cause: signal.reason });
	}
}

/**
 * Creates a consistent cancellation error.
 * @param {object} params
 * @param {string} params.label
 * @param {*} params.cause
 * @returns {Error}
 */
function createAbortError({ label, cause }) {
	const error = new Error(`${label} request was cancelled.`, { cause });
	error.name = "AbortError";
	return error;
}

/**
 * Gets a positive finite number.
 * @param {object} params
 * @param {*} params.value
 * @param {number} params.fallback
 * @returns {number}
 */
function getPositiveNumber({ value, fallback }) {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * Gets a non-negative integer.
 * @param {object} params
 * @param {*} params.value
 * @param {number} params.fallback
 * @returns {number}
 */
function getNonNegativeInteger({ value, fallback }) {
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

/**
 * Formats a timeout for a short user-facing error.
 * @param {number} milliseconds
 * @returns {string}
 */
function formatTimeoutSeconds(milliseconds) {
	const seconds = milliseconds / 1000;
	return `${Number(seconds.toFixed(1))} seconds`;
}

export { requestJson, requestText };
