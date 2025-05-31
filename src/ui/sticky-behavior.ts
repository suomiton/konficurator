/**
 * Sticky Behavior Module - Pure functions for managing sticky save button behavior
 * Separates sticky behavior logic from DOM creation and other concerns
 */

export interface StickyOptions {
	threshold?: number;
	className?: string;
	activeClassName?: string;
	offset?: number;
}

export interface StickyState {
	isSticky: boolean;
	originalPosition: number;
	element: HTMLElement;
	container: HTMLElement;
	options: Required<StickyOptions>;
}

const DEFAULT_OPTIONS: Required<StickyOptions> = {
	threshold: 100,
	className: "save-container",
	activeClassName: "sticky-active",
	offset: 20,
};

/**
 * Sets up sticky behavior for a save container
 */
export function setupStickyBehavior(
	saveContainer: HTMLElement,
	fileIdentifier: string,
	options: StickyOptions = {}
): StickyState {
	const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

	const state: StickyState = {
		isSticky: false,
		originalPosition: 0,
		element: saveContainer,
		container:
			(saveContainer.closest(".file-editor") as HTMLElement) ||
			saveContainer.parentElement!,
		options: mergedOptions,
	};

	// Store original position
	state.originalPosition = getElementPosition(saveContainer);

	// Create scroll handler
	const scrollHandler = createScrollHandler(state);

	// Add scroll listener
	window.addEventListener("scroll", scrollHandler);

	// Store cleanup function on the element for later removal
	// Also store the file identifier for reference
	(saveContainer as any).__stickyCleanup = () => {
		window.removeEventListener("scroll", scrollHandler);
		resetStickyState(state);
	};
	(saveContainer as any).__fileIdentifier = fileIdentifier;

	return state;
}

/**
 * Creates a scroll handler function for the sticky behavior
 */
function createScrollHandler(state: StickyState): () => void {
	return () => {
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		const elementTop = getElementPosition(state.element);
		const shouldBeSticky = scrollTop > elementTop - state.options.threshold;

		if (shouldBeSticky !== state.isSticky) {
			state.isSticky = shouldBeSticky;
			updateStickyState(state);
		}
	};
}

/**
 * Updates the sticky state of the element
 */
function updateStickyState(state: StickyState): void {
	if (state.isSticky) {
		activateStickyMode(state);
	} else {
		deactivateStickyMode(state);
	}
}

/**
 * Activates sticky mode for the element
 */
function activateStickyMode(state: StickyState): void {
	const { element, options } = state;

	element.classList.add(options.activeClassName);
	element.style.position = "fixed";
	element.style.bottom = `${options.offset}px`;
	element.style.right = `${options.offset}px`;
	element.style.zIndex = "1000";
	element.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";

	// Show file indicator when sticky
	const fileIndicator = element.querySelector(".save-file-indicator");
	if (fileIndicator) {
		(fileIndicator as HTMLElement).style.display = "inline";
	}
}

/**
 * Deactivates sticky mode for the element
 */
function deactivateStickyMode(state: StickyState): void {
	const { element, options } = state;

	element.classList.remove(options.activeClassName);
	element.style.position = "";
	element.style.bottom = "";
	element.style.right = "";
	element.style.zIndex = "";
	element.style.boxShadow = "";

	// Hide file indicator when not sticky
	const fileIndicator = element.querySelector(".save-file-indicator");
	if (fileIndicator) {
		(fileIndicator as HTMLElement).style.display = "none";
	}
}

/**
 * Resets sticky state to default
 */
function resetStickyState(state: StickyState): void {
	state.isSticky = false;
	deactivateStickyMode(state);
}

/**
 * Gets the current position of an element relative to the document
 */
function getElementPosition(element: HTMLElement): number {
	const rect = element.getBoundingClientRect();
	const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
	return rect.top + scrollTop;
}

/**
 * Removes sticky behavior from an element
 */
export function removeStickyBehavior(saveContainer: HTMLElement): void {
	const cleanup = (saveContainer as any).__stickyCleanup;
	if (typeof cleanup === "function") {
		cleanup();
		delete (saveContainer as any).__stickyCleanup;
	}
}

/**
 * Updates sticky behavior when content changes (e.g., form fields added/removed)
 */
export function updateStickyBehavior(saveContainer: HTMLElement): void {
	// Remove existing behavior
	removeStickyBehavior(saveContainer);

	// Re-setup behavior with updated positions
	const fileAttr = saveContainer.getAttribute("data-file");
	if (fileAttr) {
		setupStickyBehavior(saveContainer, fileAttr);
	}
}

/**
 * Checks if an element currently has sticky behavior active
 */
export function isStickyActive(saveContainer: HTMLElement): boolean {
	return saveContainer.classList.contains(DEFAULT_OPTIONS.activeClassName);
}

/**
 * Forces sticky mode on (useful for testing)
 */
export function forceStickyMode(
	saveContainer: HTMLElement,
	options: StickyOptions = {}
): void {
	const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
	const state: StickyState = {
		isSticky: true,
		originalPosition: 0,
		element: saveContainer,
		container:
			(saveContainer.closest(".file-editor") as HTMLElement) ||
			saveContainer.parentElement!,
		options: mergedOptions,
	};

	activateStickyMode(state);
}

/**
 * Forces sticky mode off (useful for testing)
 */
export function forceNormalMode(
	saveContainer: HTMLElement,
	options: StickyOptions = {}
): void {
	const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
	const state: StickyState = {
		isSticky: false,
		originalPosition: 0,
		element: saveContainer,
		container:
			(saveContainer.closest(".file-editor") as HTMLElement) ||
			saveContainer.parentElement!,
		options: mergedOptions,
	};

	deactivateStickyMode(state);
}

/**
 * Gets current sticky state information (useful for testing and debugging)
 */
export function getStickyState(saveContainer: HTMLElement): {
	isSticky: boolean;
	hasCleanup: boolean;
} {
	return {
		isSticky: isStickyActive(saveContainer),
		hasCleanup: typeof (saveContainer as any).__stickyCleanup === "function",
	};
}
