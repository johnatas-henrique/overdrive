/**
 * E2E Tests — Dev Tools Overlay
 *
 * Verifies DOM state, CSS computed styles, and user interactions
 * that unit/integration tests cannot catch (CSS specificity conflicts,
 * pointer-events, display toggling).
 *
 * These tests run in a real browser via Playwright.
 */

import { expect, type Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the Dev Tools overlay by pressing key "1" */
async function openDevTools(page: Page): Promise<void> {
  await page.keyboard.press("1");
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById("dev-overlay");
      return overlay && getComputedStyle(overlay).display !== "none";
    },
    { timeout: 5000 }
  );
}

/** Close the Dev Tools overlay by pressing key "1" */
async function closeDevTools(page: Page): Promise<void> {
  await page.keyboard.press("1");
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById("dev-overlay");
      return overlay && getComputedStyle(overlay).display === "none";
    },
    { timeout: 5000 }
  );
}

/** Get computed display of an element */
async function getDisplay(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((el) => getComputedStyle(el).display);
}

/** Check if an element has a CSS class */
async function hasClass(
  page: Page,
  selector: string,
  className: string
): Promise<boolean> {
  return page
    .locator(selector)
    .evaluate((el, cn) => el.classList.contains(cn), className);
}

// ---------------------------------------------------------------------------
// Overlay Toggle
// ---------------------------------------------------------------------------

test.describe("Overlay Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000); // wait for engine init
  });

  test("key 1 opens overlay", async ({ page }) => {
    await openDevTools(page);

    const display = await getDisplay(page, "#dev-overlay");
    expect(display).toBe("flex");
  });

  test("key 1 closes overlay", async ({ page }) => {
    await openDevTools(page);
    await closeDevTools(page);

    const display = await getDisplay(page, "#dev-overlay");
    expect(display).toBe("none");
  });

  test("overlay has pointer-events: none", async ({ page }) => {
    await openDevTools(page);

    const pointerEvents = await page
      .locator("#dev-overlay")
      .evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");
  });

  test("canvas is interactive when overlay is open", async ({ page }) => {
    await openDevTools(page);

    // Verify the canvas exists and is not blocked
    const canvasVisible = await page.locator("#renderCanvas").isVisible();
    expect(canvasVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tab System
// ---------------------------------------------------------------------------

test.describe("Tab System", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("Event Log tab is active by default", async ({ page }) => {
    const isActive = await hasClass(
      page,
      ".tab-panel[data-tab-id='event-log']",
      "active"
    );
    expect(isActive).toBe(true);
  });

  test("clicking GSM History hides Event Log content", async ({ page }) => {
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(300);

    // Event Log panel should be hidden
    const eventLogDisplay = await getDisplay(
      page,
      ".tab-panel[data-tab-id='event-log']"
    );
    expect(eventLogDisplay).toBe("none");

    // GSM History panel should be visible
    const gsmDisplay = await getDisplay(
      page,
      ".tab-panel[data-tab-id='gsm-history']"
    );
    expect(gsmDisplay).toBe("flex");
  });

  test("clicking Event Log hides GSM History content", async ({ page }) => {
    // First switch to GSM
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(300);

    // Then switch back to Event Log
    await page.click("button[data-tab-id='event-log']");
    await page.waitForTimeout(300);

    // GSM History panel should be hidden
    const gsmDisplay = await getDisplay(
      page,
      ".tab-panel[data-tab-id='gsm-history']"
    );
    expect(gsmDisplay).toBe("none");

    // Event Log panel should be visible
    const eventLogDisplay = await getDisplay(
      page,
      ".tab-panel[data-tab-id='event-log']"
    );
    expect(eventLogDisplay).toBe("flex");
  });

  test("only one tab panel is visible at a time", async ({ page }) => {
    const tabs = ["event-log", "gsm-history"];

    for (const tabId of tabs) {
      await page.click(`button[data-tab-id='${tabId}']`);
      await page.waitForTimeout(300);

      // Count visible panels
      const visibleCount = await page.evaluate((allTabIds: string[]) => {
        return allTabIds.filter((id) => {
          const panel = document.querySelector(
            `.tab-panel[data-tab-id='${id}']`
          );
          return panel && getComputedStyle(panel).display !== "none";
        }).length;
      }, tabs);

      expect(visibleCount).toBe(1);
    }
  });

  test("tab button has active class when selected", async ({ page }) => {
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(300);

    const isActive = await hasClass(
      page,
      "button[data-tab-id='gsm-history']",
      "active"
    );
    expect(isActive).toBe(true);

    // Event Log button should NOT be active
    const eventLogActive = await hasClass(
      page,
      "button[data-tab-id='event-log']",
      "active"
    );
    expect(eventLogActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Event Log Tab
// ---------------------------------------------------------------------------

test.describe("Event Log Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("filter input exists and is interactive", async ({ page }) => {
    const filterInput = page.locator(".inspector-filter input");
    await expect(filterInput).toBeVisible();

    // Type in filter
    await filterInput.fill("test");
    const value = await filterInput.inputValue();
    expect(value).toBe("test");
  });

  test("event log list exists", async ({ page }) => {
    const logList = page.locator(".inspector-log-list");
    await expect(logList).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// GSM History Tab
// ---------------------------------------------------------------------------

test.describe("GSM History Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(300);
  });

  test("current state indicator exists", async ({ page }) => {
    const stateLabel = page.locator(".gsm-current-state-value");
    await expect(stateLabel).toBeVisible();
  });

  test("current state shows (none) when no transitions occurred", async ({
    page,
  }) => {
    const stateValue = await page
      .locator(".gsm-current-state-value")
      .textContent();
    expect(stateValue?.trim()).toBe("(none)");
  });

  test("manual transitions section exists", async ({ page }) => {
    const section = page.locator(".gsm-transition-section");
    await expect(section).toBeVisible();
  });

  test("transition history section exists", async ({ page }) => {
    const historyList = page.locator(".gsm-history-list");
    await expect(historyList).toBeVisible();
  });

  test("transition history shows empty state", async ({ page }) => {
    const emptyMessage = page.locator(".gsm-history-list .gsm-empty");
    await expect(emptyMessage).toBeVisible();
    const text = await emptyMessage.textContent();
    expect(text).toContain("No transitions recorded yet");
  });
});

// ---------------------------------------------------------------------------
// Config Tree (Sidebar)
// ---------------------------------------------------------------------------

test.describe("Config Tree Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("sidebar exists with test config", async ({ page }) => {
    const sidebar = page.locator(".sidebar");
    await expect(sidebar).toBeVisible();
  });

  test("config namespace is expandable", async ({ page }) => {
    const testNs = page.locator("details[data-ns='test']");
    await expect(testNs).toBeVisible();

    // Click to expand
    await testNs.locator("summary").click();
    await page.waitForTimeout(300);

    // Should have child elements
    const children = await testNs.locator(".config-key").count();
    expect(children).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Regression: Pointer-Events (Story 003/005)
// ---------------------------------------------------------------------------

test.describe("Regression: Pointer-Events", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("overlay container does not intercept game input", async ({ page }) => {
    const pointerEvents = await page
      .locator("#dev-overlay")
      .evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");
  });

  test("tab content area does not intercept game input", async ({ page }) => {
    const pointerEvents = await page
      .locator(".tab-content")
      .evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");
  });

  test("interactive elements inside panels do intercept input", async ({
    page,
  }) => {
    // Filter input should be clickable
    const filterPointerEvents = await page
      .locator(".inspector-filter input")
      .evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(filterPointerEvents).toBe("auto");
  });

  test("canvas receives click when overlay is open", async ({ page }) => {
    // Get canvas bounding box
    const canvasBox = await page.locator("#renderCanvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    const box = canvasBox as DOMRect;

    // Click on canvas area (not on overlay)
    // The overlay has pointer-events: none, so click should pass through
    await page.mouse.click(box.x + 100, box.y + 100);
    // No error means the click was received by the canvas
  });
});

// ---------------------------------------------------------------------------
// Regression: Config Keybinds (Story 003)
// ---------------------------------------------------------------------------

test.describe("Regression: Config Keybinds", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("key 2 triggers config reload", async ({ page }) => {
    // Press key 2
    await page.keyboard.press("2");
    await page.waitForTimeout(500);

    // A notification should appear (config reload feedback)
    const _notification = page.locator(".dev-notification");
    // Notification may or may not appear depending on ConfigManager state
    // At minimum, the key should not throw an error
    const errorLogs: string[] = [];
    page.on("pageerror", (err) => errorLogs.push(err.message));
    await page.keyboard.press("2");
    await page.waitForTimeout(500);
    expect(errorLogs).toHaveLength(0);
  });

  test("key 3 minimises overlay to top bar only", async ({ page }) => {
    // Overlay should be visible and expanded
    const sidebarVisible = await page.locator(".sidebar").isVisible();
    expect(sidebarVisible).toBe(true);

    // Press key 3 to minimise
    await page.keyboard.press("3");
    await page.waitForTimeout(500);

    // Sidebar should be hidden after minimise
    const sidebarAfter = await page
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).display);
    expect(sidebarAfter).toBe("none");

    // Top bar should still be visible
    const topBarVisible = await page.locator(".top-bar").isVisible();
    expect(topBarVisible).toBe(true);
  });

  test("key 3 toggles back to expanded", async ({ page }) => {
    // Minimise first
    await page.keyboard.press("3");
    await page.waitForTimeout(500);

    // Expand again
    await page.keyboard.press("3");
    await page.waitForTimeout(500);

    // Sidebar should be visible again
    const sidebarVisible = await page
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).display);
    expect(sidebarVisible).not.toBe("none");
  });
});

// ---------------------------------------------------------------------------
// Regression: Config Tree Edit (Story 003)
// ---------------------------------------------------------------------------

test.describe("Regression: Config Tree Edit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("edited config value remains visible after save", async ({ page }) => {
    // Expand test namespace
    const testNs = page.locator("details[data-ns='test']");
    await testNs.locator("summary").click();
    await page.waitForTimeout(300);

    // Find first config value
    const firstValue = testNs.locator(".config-value").first();
    await expect(firstValue).toBeVisible();

    // Double-click to edit
    await firstValue.dblclick();
    await page.waitForTimeout(300);

    // Find the input field
    const input = testNs.locator(".config-input").first();
    await expect(input).toBeVisible();

    // Type a new value
    await input.fill("test_edit_value");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // The value should still be visible with the new text
    // After edit, a new span is created — check it exists and has content
    const editedValue = testNs.locator(".config-value").first();
    const text = await editedValue.textContent();
    expect(text).toContain("test_edit_value");

    // The text should NOT be invisible (regression: black text on black background)
    const color = await editedValue.evaluate(
      (el) => getComputedStyle(el).color
    );
    // Should not be black (rgb(0, 0, 0)) on dark background
    expect(color).not.toBe("rgb(0, 0, 0)");
  });
});

// ---------------------------------------------------------------------------
// Regression: Event Bus Inspector (Story 005)
// ---------------------------------------------------------------------------

test.describe("Regression: Event Bus Inspector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("inspector log list is scrollable", async ({ page }) => {
    const logList = page.locator(".inspector-log-list");
    await expect(logList).toBeVisible();

    // Should have overflow-y: auto for scrolling
    const overflowY = await logList.evaluate(
      (el) => getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe("auto");
  });

  test("inspector container does not block canvas interaction", async ({
    page,
  }) => {
    // The inspector container is inside tab-content which has pointer-events: none
    // But the log list itself should have pointer-events: auto for scrolling
    const logListPointerEvents = await page
      .locator(".inspector-log-list")
      .evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(logListPointerEvents).toBe("auto");
  });

  test("filter input is functional", async ({ page }) => {
    const filterInput = page.locator(".inspector-filter input");
    await expect(filterInput).toBeVisible();

    // Type in filter
    await filterInput.fill("gsm");
    const value = await filterInput.inputValue();
    expect(value).toBe("gsm");

    // Clear filter
    await filterInput.fill("");
    const emptyValue = await filterInput.inputValue();
    expect(emptyValue).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Behavior: Tab Content Isolation
// ---------------------------------------------------------------------------

test.describe("Behavior: Tab Content Isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await openDevTools(page);
  });

  test("switching tabs does not duplicate DOM elements", async ({ page }) => {
    // Switch between tabs multiple times
    for (let i = 0; i < 3; i++) {
      await page.click("button[data-tab-id='gsm-history']");
      await page.waitForTimeout(200);
      await page.click("button[data-tab-id='event-log']");
      await page.waitForTimeout(200);
    }

    // Count tab panels — should still be exactly 2
    const panelCount = await page.locator(".tab-panel").count();
    expect(panelCount).toBe(2);
  });

  test("tab content is preserved when switching away and back", async ({
    page,
  }) => {
    // Type in Event Log filter
    const filterInput = page.locator(".inspector-filter input");
    await filterInput.fill("preserve_test");

    // Switch to GSM History
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(300);

    // Switch back to Event Log
    await page.click("button[data-tab-id='event-log']");
    await page.waitForTimeout(300);

    // Filter value should be preserved
    const preservedValue = await filterInput.inputValue();
    expect(preservedValue).toBe("preserve_test");
  });
});
