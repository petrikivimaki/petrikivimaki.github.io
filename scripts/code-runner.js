/**
 * Initializes the sandboxed JavaScript runner.
 * @async
 * @returns {Promise<void>}
 */
(async function initializeCodeRunner() {
	"use strict";

	const channel = "papyrus-code-runner";
	let activeSessionId = "";

	/**
	 * Formats a value emitted by user code.
	 * @param {*} value
	 * @returns {string}
	 */
	function formatConsoleValue(value) {
		if (typeof value === "string") {
			return value;
		}

		if (value instanceof Error) {
			return value.stack || value.message;
		}

		if (value === null || typeof value !== "object") {
			return String(value);
		}

		const seen = new WeakSet();

		try {
			return JSON.stringify(value, function serializeConsoleValue(key, nestedValue) {
				if (typeof nestedValue === "bigint") {
					return `${nestedValue}n`;
				}

				if (typeof nestedValue === "function" || typeof nestedValue === "symbol") {
					return String(nestedValue);
				}

				if (nestedValue && typeof nestedValue === "object") {
					if (seen.has(nestedValue)) {
						return "[Circular]";
					}

					seen.add(nestedValue);
				}

				return nestedValue;
			}, 2);
		} catch (error) {
			return String(value);
		}
	}

	/**
	 * Sends an execution event to the Papyrus document.
	 * @param {object} data
	 * @returns {void}
	 */
	function sendToParent(data) {
		window.parent.postMessage({ channel, ...data }, "*");
	}

	/**
	 * Sends a captured console call to the Papyrus document.
	 * @param {string} level
	 * @param {Array<*>} values
	 * @returns {void}
	 */
	function emitConsole(level, values) {
		const formattedValues = [];

		for (let index = 0; index < values.length; index += 1) {
			formattedValues.push(formatConsoleValue(values[index]));
		}

		sendToParent({
			action: "output",
			level,
			sessionId: activeSessionId,
			values: formattedValues
		});
	}

	const levels = ["debug", "error", "info", "log", "warn"];

	for (let index = 0; index < levels.length; index += 1) {
		const level = levels[index];
		console[level] = function captureConsoleCall(...values) {
			emitConsole(level, values);
		};
	}

	window.addEventListener("error", function handleExecutionError(event) {
		emitConsole("error", [event.error || event.message]);
	});

	window.addEventListener("unhandledrejection", function handleUnhandledRejection(event) {
		emitConsole("error", [event.reason]);
	});

	try {
		const data = JSON.parse(window.name);

		if (data.channel !== channel || data.action !== "execute") {
			throw new Error("The JavaScript sandbox received an invalid request.");
		}

		activeSessionId = data.sessionId;
		sendToParent({ action: "started", sessionId: activeSessionId });

		const AsyncFunction = Object.getPrototypeOf(async function emptyAsyncFunction() {}).constructor;
		const execute = new AsyncFunction(`"use strict";\n${data.code}`);
		await execute();
		sendToParent({ action: "complete", sessionId: activeSessionId });
	} catch (error) {
		sendToParent({
			action: "failed",
			message: formatConsoleValue(error),
			sessionId: activeSessionId
		});
	}
}());
