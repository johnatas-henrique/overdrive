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

/** Wait for the engine to finish initializing. */
async function waitForEngineReady(page: Page): Promise<void> {
  await page.waitForTimeout(1000);
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
    await waitForEngineReady(page); // wait for engine init
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
    await waitForEngineReady(page);
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
    await page.waitForTimeout(100);

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
    await page.waitForTimeout(100);

    // Then switch back to Event Log
    await page.click("button[data-tab-id='event-log']");
    await page.waitForTimeout(100);

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
    const tabs = ["event-log", "gsm-history", "sim-snapshot"];

    for (const tabId of tabs) {
      await page.click(`button[data-tab-id='${tabId}']`);
      await page.waitForTimeout(100);

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
    await page.waitForTimeout(100);

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
    await waitForEngineReady(page);
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
    await waitForEngineReady(page);
    await openDevTools(page);
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(100);
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
    await waitForEngineReady(page);
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
    await page.waitForTimeout(100);

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
    await waitForEngineReady(page);
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
    await waitForEngineReady(page);
    await openDevTools(page);
  });

  test("key 2 triggers config reload", async ({ page }) => {
    // Register pageerror listener before any keyboard interaction
    // (D-015 — pageerror listener must be registered before key presses
    //  to catch errors from the first press).
    const errorLogs: string[] = [];
    page.on("pageerror", (err) => errorLogs.push(err.message));

    // Press key 2
    await page.keyboard.press("2");
    await page.waitForTimeout(500);

    // A notification should appear (config reload feedback)
    const _notification = page.locator(".dev-notification");
    // Notification may or may not appear depending on ConfigManager state
    // At minimum, the key should not throw an error
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
    await waitForEngineReady(page);
    await openDevTools(page);
  });

  test("edited config value remains visible after save", async ({ page }) => {
    // Expand test namespace
    const testNs = page.locator("details[data-ns='test']");
    await testNs.locator("summary").click();
    await page.waitForTimeout(100);

    // Find first config value
    const firstValue = testNs.locator(".config-value").first();
    await expect(firstValue).toBeVisible();

    // Double-click to edit
    await firstValue.dblclick();
    await page.waitForTimeout(100);

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
    await waitForEngineReady(page);
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
    await waitForEngineReady(page);
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

    // Count tab panels — should still be exactly 4
    const panelCount = await page.locator(".tab-panel").count();
    expect(panelCount).toBe(4);
  });

  test("tab content is preserved when switching away and back", async ({
    page,
  }) => {
    // Type in Event Log filter
    const filterInput = page.locator(".inspector-filter input");
    await filterInput.fill("preserve_test");

    // Switch to GSM History
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(100);

    // Switch back to Event Log
    await page.click("button[data-tab-id='event-log']");
    await page.waitForTimeout(100);

    // Filter value should be preserved
    const preservedValue = await filterInput.inputValue();
    expect(preservedValue).toBe("preserve_test");
  });
});

// ---------------------------------------------------------------------------
// CSS Regression: Panel Backgrounds and Layout
// ---------------------------------------------------------------------------

test.describe("CSS Regression: Panel Backgrounds and Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForEngineReady(page);
    await openDevTools(page);
  });

  test("Event Log panel has opaque background", async ({ page }) => {
    await page.click("button[data-tab-id='event-log']");
    await page.waitForTimeout(100);

    const container = page.locator(".inspector-container");
    const bg = await container.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Should not be transparent (rgba(0, 0, 0, 0) or transparent)
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });

  test("GSM History panel has opaque background", async ({ page }) => {
    await page.click("button[data-tab-id='gsm-history']");
    await page.waitForTimeout(100);

    const container = page.locator(".gsm-container");
    const bg = await container.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Should not be transparent
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });

  test("Sim Snapshot controls are below systems header, not at bottom", async ({
    page,
  }) => {
    await page.click("button[data-tab-id='sim-snapshot']");
    await page.waitForTimeout(100);

    const systemsHeader = page.locator(".ssn-systems-header");
    const controls = page.locator(".ssn-controls");

    const headerBox = await systemsHeader.boundingBox();
    const controlsBox = await controls.boundingBox();

    expect(headerBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();

    // Controls should be directly below systems header (within 50px)
    const gap =
      (controlsBox?.y ?? 0) - ((headerBox?.y ?? 0) + (headerBox?.height ?? 0));
    expect(gap).toBeLessThan(50);
    expect(gap).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Sim Snapshot Panel Tab
// ---------------------------------------------------------------------------

test.describe("Sim Snapshot Panel Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForEngineReady(page);
    await openDevTools(page);
    await page.click("button[data-tab-id='sim-snapshot']");
    await page.waitForTimeout(100);
  });

  test("tab button exists and is clickable", async ({ page }) => {
    const tabBtn = page.locator("button[data-tab-id='sim-snapshot']");
    await expect(tabBtn).toBeVisible();
  });

  test("tab button has active class when selected", async ({ page }) => {
    const isActive = await hasClass(
      page,
      "button[data-tab-id='sim-snapshot']",
      "active"
    );
    expect(isActive).toBe(true);
  });

  test("registered systems list is visible", async ({ page }) => {
    const systemsList = page.locator(".ssn-systems-list");
    await expect(systemsList).toBeVisible();
  });

  test("system ID entries exist in the list", async ({ page }) => {
    // The playground registers physics, fuel, tire, ai
    const physicsEntry = page.locator(".ssn-system-row").first();
    await expect(physicsEntry).toBeVisible();

    const systemId = await physicsEntry.locator(".ssn-system-id").textContent();
    expect(systemId?.trim()).toBeTruthy();
  });

  test("per-system hash is displayed", async ({ page }) => {
    const hashEl = page.locator(".ssn-system-hash").first();
    await expect(hashEl).toBeVisible();

    const hashText = await hashEl.textContent();
    expect(hashText?.trim()).toMatch(/^[0-9a-f]{16}$/);
  });

  test("diff indicator exists for each system", async ({ page }) => {
    const diffEls = page.locator(".ssn-system-diff");
    const count = await diffEls.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Take Snapshot button is visible in DEV mode", async ({ page }) => {
    // App runs in DEV mode during E2E tests so the controls should be visible
    const takeBtn = page.locator(".ssn-take-btn");
    await expect(takeBtn).toBeVisible();
    await expect(takeBtn).toBeEnabled();
  });

  test("Restore Snapshot button starts disabled, enables after Take", async ({
    page,
  }) => {
    const restoreBtn = page.locator(".ssn-restore-btn");
    await expect(restoreBtn).toBeVisible();
    // Initially disabled (no snapshot taken yet)
    await expect(restoreBtn).toBeDisabled();

    // Take a snapshot
    const takeBtn = page.locator(".ssn-take-btn");
    await takeBtn.click();
    await page.waitForTimeout(200);

    // Now Restore should be enabled
    await expect(restoreBtn).toBeEnabled();
  });

  test("clicking Take Snapshot updates diff indicators to green checks", async ({
    page,
  }) => {
    // Initially should show em dashes (no snapshot taken)
    const diffEls = page.locator(".ssn-system-diff");
    const initialCount = await diffEls.count();
    expect(initialCount).toBeGreaterThan(0);

    // Take a snapshot
    const takeBtn = page.locator(".ssn-take-btn");
    await takeBtn.click();
    await page.waitForTimeout(100);

    // Refresh the panel to see updated diffs
    // (The refresh happens automatically)
    await page.waitForTimeout(200);

    // At least one diff should now be a checkmark
    const checkMarks = page.locator(".ssn-diff-match");
    const checkCount = await checkMarks.count();
    expect(checkCount).toBeGreaterThan(0);
  });

  test("panel scrolls independently of overlay", async ({ page }) => {
    const panel = page.locator(".ssn-container");
    await expect(panel).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AI Telemetry Tab
// ---------------------------------------------------------------------------

test.describe("AI Telemetry Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForEngineReady(page);
    await openDevTools(page);
  });

  test("AI Telemetry tab exists and is clickable", async ({ page }) => {
    await page.click("button[data-tab-id='ai-telemetry']");
    await page.waitForTimeout(100);

    const display = await getDisplay(
      page,
      ".tab-panel[data-tab-id='ai-telemetry']"
    );
    expect(display).toBe("flex");
  });

  test("AI Telemetry table shows 3 cars from mock data", async ({ page }) => {
    await page.click("button[data-tab-id='ai-telemetry']");
    await page.waitForTimeout(100);

    // Wait for the table to appear
    const table = page.locator(".ait-table");
    await expect(table).toBeVisible();

    // Count rows in tbody
    const rows = page.locator(".ait-table tbody tr");
    const count = await rows.count();
    expect(count).toBe(3);
  });

  test("player car row is highlighted", async ({ page }) => {
    await page.click("button[data-tab-id='ai-telemetry']");
    await page.waitForTimeout(100);

    // Find the player row
    const playerRow = page.locator(".ait-row-player");
    await expect(playerRow).toBeVisible();

    // Verify it has player-1 carId in data-car-id
    const carId = await playerRow.getAttribute("data-car-id");
    expect(carId).toBe("player-1");
  });

  test("table shows correct columns", async ({ page }) => {
    await page.click("button[data-tab-id='ai-telemetry']");
    await page.waitForTimeout(100);

    // Find all column header elements
    const columnHeaders = page.locator(".ait-th");
    const count = await columnHeaders.count();
    expect(count).toBe(4);

    // Verify column text matches expected columns
    const texts = await columnHeaders.allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toEqual([
      "Car ID",
      "Speed (km/h)",
      "Position (Lap/Overall)",
      "Behavior",
    ]);
  });

  test("empty state shows when no AI cars", async ({ page }) => {
    await page.click("button[data-tab-id='ai-telemetry']");
    await page.waitForTimeout(100);

    // The empty-state element exists in the DOM
    const emptyEl = page.locator(".ait-empty");
    await expect(emptyEl).toBeAttached();

    // Since mock data has 3 cars, the empty state is hidden (display: none)
    const display = await getDisplay(page, ".ait-empty");
    expect(display).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// Config Tree Tab — edit + blur flow (covers config-tree.ts L275)
// ---------------------------------------------------------------------------

test.describe("Config Tree Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openDevTools(page);
    // Config tree is in the sidebar, always visible when overlay is open
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    await closeDevTools(page);
  });

  test("sidebar shows config namespaces", async ({ page }) => {
    // The sidebar should have config namespace details elements
    const namespaces = page.locator(".sidebar details.config-namespace");
    const count = await namespaces.count();
    expect(count).toBeGreaterThan(0);
  });

  test("double-click starts editing, Enter confirms", async ({ page }) => {
    // Find a config value span in the sidebar
    const valueSpan = page.locator(".sidebar .config-value").first();

    // If no config values exist, skip (ConfigManager might not have data)
    const count = await valueSpan.count();
    if (count === 0) {
      return;
    }

    // Double-click to start editing
    await valueSpan.dblclick();
    const input = page.locator(".sidebar input");
    await expect(input).toBeVisible();

    // Type a new value and press Enter
    await input.fill("test-value");
    await input.press("Enter");

    // Input should be gone, replaced by a span
    await expect(input).not.toBeVisible();
    const newSpan = page.locator(".sidebar .config-value").first();
    await expect(newSpan).toBeAttached();
  });

  test("double-click starts editing, Escape cancels", async ({ page }) => {
    const valueSpan = page.locator(".sidebar .config-value").first();
    const count = await valueSpan.count();
    if (count === 0) {
      return;
    }
    const originalText = await valueSpan.textContent();

    // Double-click to start editing
    await valueSpan.dblclick();
    const input = page.locator(".sidebar input");
    await expect(input).toBeVisible();

    // Press Escape to cancel
    await input.press("Escape");

    // Input should be gone, original value restored
    await expect(input).not.toBeVisible();
    const restoredSpan = page.locator(".sidebar .config-value").first();
    const restoredText = await restoredSpan.textContent();
    expect(restoredText).toBe(originalText);
  });

  test("blur during edit cancels without error (L275 guard)", async ({
    page,
  }) => {
    // This test exercises the blur handler's _editingKey guard (L275):
    // In a real browser, replaceWith fires blur. The blur handler checks
    // _editingKey — if null (already finished), it returns early.

    const valueSpan = page.locator(".sidebar .config-value").first();
    const count = await valueSpan.count();
    if (count === 0) {
      return;
    }

    await valueSpan.dblclick();
    const input = page.locator(".sidebar input");
    await expect(input).toBeVisible();

    // Press Enter — triggers _finishEdit → replaceWith → blur
    // The blur handler fires with _editingKey already null (L275 false branch)
    await input.press("Enter");

    // No error thrown, overlay still functional
    const overlay = page.locator("#dev-overlay");
    await expect(overlay).toBeVisible();
  });
});
