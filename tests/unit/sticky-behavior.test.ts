/**
 * Unit tests for Sticky Behavior module
 * Tests sticky save button functionality
 */

import {
	setupStickyBehavior,
	removeStickyBehavior,
	updateStickyBehavior,
	isStickyActive,
	forceStickyMode,
	forceNormalMode,
	getStickyState,
	StickyOptions,
} from "../../src/ui/sticky-behavior";

// Mock addEventListener and removeEventListener
const mockAddEventListener = jest.spyOn(window, "addEventListener");
const mockRemoveEventListener = jest.spyOn(window, "removeEventListener");

describe("Sticky Behavior", () => {
	let saveContainer: HTMLElement;
	let fileEditor: HTMLElement;
	let fileIndicator: HTMLElement;

	beforeEach(() => {
		// Create mock DOM structure
		fileEditor = document.createElement("div");
		fileEditor.className = "file-editor";

		saveContainer = document.createElement("div");
		saveContainer.className = "save-container";
		saveContainer.setAttribute("data-file", "test.json");

		fileIndicator = document.createElement("span");
		fileIndicator.className = "save-file-indicator";
		fileIndicator.textContent = "test.json";
		saveContainer.appendChild(fileIndicator);

		fileEditor.appendChild(saveContainer);
		document.body.appendChild(fileEditor);

		// Mock getBoundingClientRect
		saveContainer.getBoundingClientRect = jest.fn().mockReturnValue({
			top: 200,
			bottom: 250,
			left: 0,
			right: 100,
			width: 100,
			height: 50,
		});

		// Clear event listener mocks
		mockAddEventListener.mockClear();
		mockRemoveEventListener.mockClear();
	});

	afterEach(() => {
		document.body.removeChild(fileEditor);

		// Clean up any sticky behavior
		removeStickyBehavior(saveContainer);
	});

	describe("setupStickyBehavior", () => {
		it("should setup scroll event listener", () => {
			setupStickyBehavior(saveContainer, "test.json");

			expect(mockAddEventListener).toHaveBeenCalledWith(
				"scroll",
				expect.any(Function)
			);
		});

		it("should store cleanup function on element", () => {
			setupStickyBehavior(saveContainer, "test.json");

			expect((saveContainer as any).__stickyCleanup).toBeDefined();
			expect(typeof (saveContainer as any).__stickyCleanup).toBe("function");
		});

		it("should store file identifier on element", () => {
			setupStickyBehavior(saveContainer, "test.json");

			expect((saveContainer as any).__fileIdentifier).toBe("test.json");
		});

		it("should use custom options", () => {
			const options: StickyOptions = {
				threshold: 200,
				activeClassName: "custom-sticky",
				offset: 30,
			};

			const state = setupStickyBehavior(saveContainer, "test.json", options);

			expect(state.options.threshold).toBe(200);
			expect(state.options.activeClassName).toBe("custom-sticky");
			expect(state.options.offset).toBe(30);
		});
	});

	describe("removeStickyBehavior", () => {
		it("should call cleanup function and remove event listener", () => {
			setupStickyBehavior(saveContainer, "test.json");

			removeStickyBehavior(saveContainer);

			expect(mockRemoveEventListener).toHaveBeenCalledWith(
				"scroll",
				expect.any(Function)
			);
			expect((saveContainer as any).__stickyCleanup).toBeUndefined();
		});

		it("should handle elements without sticky behavior", () => {
			// Should not throw error
			expect(() => removeStickyBehavior(saveContainer)).not.toThrow();
		});
	});

	describe("updateStickyBehavior", () => {
		it("should remove old behavior and setup new one", () => {
			setupStickyBehavior(saveContainer, "test.json");

			updateStickyBehavior(saveContainer);

			// Should have removed and re-added event listener
			expect(mockRemoveEventListener).toHaveBeenCalledWith(
				"scroll",
				expect.any(Function)
			);
			expect(mockAddEventListener).toHaveBeenCalledTimes(2); // Initial setup + update
		});
	});

	describe("isStickyActive", () => {
		it("should return false for non-sticky element", () => {
			expect(isStickyActive(saveContainer)).toBe(false);
		});

		it("should return true for sticky element", () => {
			forceStickyMode(saveContainer);

			expect(isStickyActive(saveContainer)).toBe(true);
		});
	});

	describe("forceStickyMode", () => {
		it("should activate sticky mode", () => {
			forceStickyMode(saveContainer);

			expect(saveContainer.classList.contains("sticky-active")).toBe(true);
			expect(saveContainer.style.position).toBe("fixed");
			expect(saveContainer.style.bottom).toBe("20px");
			expect(saveContainer.style.right).toBe("20px");
			expect(saveContainer.style.zIndex).toBe("1000");
		});

		it("should show file indicator", () => {
			forceStickyMode(saveContainer);

			expect(fileIndicator.style.display).toBe("inline");
		});

		it("should use custom options", () => {
			const options: StickyOptions = {
				activeClassName: "custom-sticky",
				offset: 50,
			};

			forceStickyMode(saveContainer, options);

			expect(saveContainer.classList.contains("custom-sticky")).toBe(true);
			expect(saveContainer.style.bottom).toBe("50px");
			expect(saveContainer.style.right).toBe("50px");
		});
	});

	describe("forceNormalMode", () => {
		it("should deactivate sticky mode", () => {
			forceStickyMode(saveContainer);
			forceNormalMode(saveContainer);

			expect(saveContainer.classList.contains("sticky-active")).toBe(false);
			expect(saveContainer.style.position).toBe("");
			expect(saveContainer.style.bottom).toBe("");
			expect(saveContainer.style.right).toBe("");
			expect(saveContainer.style.zIndex).toBe("");
		});

		it("should hide file indicator", () => {
			forceStickyMode(saveContainer);
			forceNormalMode(saveContainer);

			expect(fileIndicator.style.display).toBe("none");
		});
	});

	describe("getStickyState", () => {
		it("should return correct state for non-sticky element", () => {
			const state = getStickyState(saveContainer);

			expect(state.isSticky).toBe(false);
			expect(state.hasCleanup).toBe(false);
		});

		it("should return correct state for element with sticky behavior", () => {
			setupStickyBehavior(saveContainer, "test.json");
			const state = getStickyState(saveContainer);

			expect(state.isSticky).toBe(false); // Not sticky until scroll event
			expect(state.hasCleanup).toBe(true);
		});

		it("should return correct state for forced sticky element", () => {
			forceStickyMode(saveContainer);
			const state = getStickyState(saveContainer);

			expect(state.isSticky).toBe(true);
			expect(state.hasCleanup).toBe(false); // No cleanup for forced mode
		});
	});

	describe("scroll behavior", () => {
		let pageYOffsetDescriptor: PropertyDescriptor | undefined;
		let scrollTopDescriptor: PropertyDescriptor | undefined;

		beforeEach(() => {
			// Store original descriptors if they exist
			pageYOffsetDescriptor = Object.getOwnPropertyDescriptor(
				window,
				"pageYOffset"
			);
			scrollTopDescriptor = Object.getOwnPropertyDescriptor(
				document.documentElement,
				"scrollTop"
			);
		});

		afterEach(() => {
			// Restore original descriptors
			if (pageYOffsetDescriptor) {
				Object.defineProperty(window, "pageYOffset", pageYOffsetDescriptor);
			} else {
				delete (window as any).pageYOffset;
			}

			if (scrollTopDescriptor) {
				Object.defineProperty(
					document.documentElement,
					"scrollTop",
					scrollTopDescriptor
				);
			} else {
				delete (document.documentElement as any).scrollTop;
			}
		});

		it("should activate sticky mode when scrolled past threshold", () => {
			// Mock getBoundingClientRect BEFORE setting up sticky behavior
			const mockGetBoundingClientRect = jest.fn().mockReturnValue({
				top: 100, // Element is 100px from top of viewport
				bottom: 150,
				left: 0,
				right: 100,
				width: 100,
				height: 50,
			});
			saveContainer.getBoundingClientRect = mockGetBoundingClientRect;

			// Mock scroll positions to be 0 initially
			Object.defineProperty(window, "pageYOffset", {
				value: 0,
				configurable: true,
				writable: true,
			});
			Object.defineProperty(document.documentElement, "scrollTop", {
				value: 0,
				configurable: true,
				writable: true,
			});

			// Setup with known threshold
			setupStickyBehavior(saveContainer, "test.json", { threshold: 50 });

			// Now change scroll position to trigger sticky mode
			// elementTop = rect.top + scrollTop = 100 + 200 = 300
			// shouldBeSticky = scrollTop > (elementTop - threshold) = 200 > (300 - 50) = 200 > 250 = false
			// Let's try scrollTop = 300: 300 > (300 - 50) = 300 > 250 = true
			Object.defineProperty(window, "pageYOffset", {
				value: 300,
				configurable: true,
				writable: true,
			});
			Object.defineProperty(document.documentElement, "scrollTop", {
				value: 300,
				configurable: true,
				writable: true,
			});

			// Also update the rect for the new scroll position
			mockGetBoundingClientRect.mockReturnValue({
				top: -200, // Element is now above viewport (100 - 300 = -200)
				bottom: -150,
				left: 0,
				right: 100,
				width: 100,
				height: 50,
			});

			// Trigger scroll event
			window.dispatchEvent(new Event("scroll"));

			// Check if sticky behavior was activated
			expect(isStickyActive(saveContainer)).toBe(true);
			expect(saveContainer.classList.contains("sticky-active")).toBe(true);
		});

		it("should deactivate sticky mode when scrolled back up", () => {
			// Mock getBoundingClientRect BEFORE setup
			const mockGetBoundingClientRect = jest.fn().mockReturnValue({
				top: 100,
				bottom: 150,
				left: 0,
				right: 100,
				width: 100,
				height: 50,
			});
			saveContainer.getBoundingClientRect = mockGetBoundingClientRect;

			// Mock initial scroll positions
			Object.defineProperty(window, "pageYOffset", {
				value: 300,
				configurable: true,
				writable: true,
			});
			Object.defineProperty(document.documentElement, "scrollTop", {
				value: 300,
				configurable: true,
				writable: true,
			});

			setupStickyBehavior(saveContainer, "test.json", { threshold: 50 });

			// Start with position that makes it sticky (rect.top should reflect scroll)
			mockGetBoundingClientRect.mockReturnValue({
				top: -200, // Element is above viewport
				bottom: -150,
				left: 0,
				right: 100,
				width: 100,
				height: 50,
			});
			window.dispatchEvent(new Event("scroll"));

			// Verify it's sticky first
			expect(isStickyActive(saveContainer)).toBe(true);

			// Then scroll back up to deactivate
			Object.defineProperty(window, "pageYOffset", {
				value: 50,
				configurable: true,
				writable: true,
			});
			Object.defineProperty(document.documentElement, "scrollTop", {
				value: 50,
				configurable: true,
				writable: true,
			});

			// Update rect for new scroll position (element should be visible again)
			mockGetBoundingClientRect.mockReturnValue({
				top: 50, // Element is 50px from top (100 - 50 = 50)
				bottom: 100,
				left: 0,
				right: 100,
				width: 100,
				height: 50,
			});
			window.dispatchEvent(new Event("scroll"));

			expect(isStickyActive(saveContainer)).toBe(false);
			expect(saveContainer.classList.contains("sticky-active")).toBe(false);
		});
	});
});
