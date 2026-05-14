// @ts-nocheck
/**
 * Detox E2E Test Suite — Intelligent Bistro
 *
 * Tests the full user flow on a real device/emulator:
 * - App launch and initial state
 * - Menu browsing
 * - AI ordering flow
 * - Cart synchronization
 * - Offline behavior
 * - Retry handling
 * - Background/foreground transitions
 *
 * Run with:
 *   npx detox test -c ios.sim.debug
 *   npx detox test -c android.emu.debug
 */

describe("Intelligent Bistro E2E", () => {
  // ── App launch ─────────────────────────────────────────────────────────

  describe("App launch", () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should launch and display the menu screen", async () => {
      await expect(element(by.id("menu-screen"))).toBeVisible();
    });

    it("should display the restaurant name in the header", async () => {
      await expect(element(by.text("The Intelligent Bistro"))).toBeVisible();
    });

    it("should show the menu categories", async () => {
      await expect(element(by.id("category-all"))).toBeVisible();
      await expect(element(by.id("category-starters"))).toBeVisible();
      await expect(element(by.id("category-mains"))).toBeVisible();
      await expect(element(by.id("category-drinks"))).toBeVisible();
    });

    it("should show cart button with 0 items initially", async () => {
      await expect(element(by.id("cart-button"))).toBeVisible();
      await expect(element(by.id("cart-count"))).toHaveText("0");
    });
  });

  // ── Menu browsing ──────────────────────────────────────────────────────

  describe("Menu browsing", () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should filter menu by Starters category", async () => {
      await element(by.id("category-starters")).tap();
      await expect(element(by.id("menu-item-burrata-salad"))).toBeVisible();
      await expect(element(by.id("menu-item-tagliatelle"))).not.toBeVisible();
    });

    it("should filter menu by Mains category", async () => {
      await element(by.id("category-mains")).tap();
      await expect(element(by.id("menu-item-tagliatelle"))).toBeVisible();
      await expect(element(by.id("menu-item-burrata-salad"))).not.toBeVisible();
    });

    it("should filter menu by Drinks category", async () => {
      await element(by.id("category-drinks")).tap();
      await expect(element(by.id("menu-item-yuzu-spritz"))).toBeVisible();
    });

    it("should show all items when All category is selected", async () => {
      await element(by.id("category-starters")).tap();
      await element(by.id("category-all")).tap();
      await expect(element(by.id("menu-item-burrata-salad"))).toBeVisible();
      await expect(element(by.id("menu-item-tagliatelle"))).toBeVisible();
    });

    it("should show item price and description", async () => {
      await expect(element(by.id("menu-item-burrata-salad-price"))).toHaveText("$14");
    });
  });

  // ── AI ordering flow ───────────────────────────────────────────────────

  describe("AI ordering flow", () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should open AI assistant sheet when AI button is tapped", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await expect(element(by.id("ai-assistant-sheet"))).toBeVisible();
    });

    it("should show the AI input field", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await expect(element(by.id("ai-input-field"))).toBeVisible();
    });

    it("should add item to cart via AI message", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add 2 burrata salads");
      await element(by.id("ai-send-button")).tap();

      // Wait for response (AI processing takes time)
      await waitFor(element(by.id("cart-count")))
        .toHaveText("2")
        .withTimeout(15_000);
    });

    it("should show execution log during AI processing", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add a tagliatelle");
      await element(by.id("ai-send-button")).tap();

      // Execution log should appear
      await waitFor(element(by.id("execution-log")))
        .toBeVisible()
        .withTimeout(5_000);
    });

    it("should show AI confirmation message after ordering", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add 1 cold brew");
      await element(by.id("ai-send-button")).tap();

      // AI message should appear in the chat
      await waitFor(element(by.id("ai-message-0")))
        .toBeVisible()
        .withTimeout(15_000);
    });

    it("should show fallback message for items not on menu", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add a pepperoni pizza");
      await element(by.id("ai-send-button")).tap();

      // Should get a "not found" style response
      await waitFor(element(by.id("ai-message-0")))
        .toBeVisible()
        .withTimeout(15_000);

      // Cart should still be empty
      await expect(element(by.id("cart-count"))).toHaveText("0");
    });
  });

  // ── Cart synchronization ───────────────────────────────────────────────

  describe("Cart synchronization", () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should update cart count after AI ordering", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add 3 burrata salads");
      await element(by.id("ai-send-button")).tap();

      await waitFor(element(by.id("cart-count")))
        .toHaveText("3")
        .withTimeout(15_000);
    });

    it("should update cart total price correctly", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add 2 burrata salads");
      await element(by.id("ai-send-button")).tap();

      await waitFor(element(by.id("cart-total")))
        .toHaveText("$28.00")
        .withTimeout(15_000);
    });

    it("should show items in cart sheet", async () => {
      // First add an item via AI
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add a tagliatelle");
      await element(by.id("ai-send-button")).tap();
      await waitFor(element(by.id("cart-count")))
        .not.toHaveText("0")
        .withTimeout(15_000);

      // Open cart
      await element(by.id("cart-button")).tap();
      await expect(element(by.id("cart-item-tagliatelle"))).toBeVisible();
    });
  });

  // ── Offline behavior ───────────────────────────────────────────────────

  describe("Offline behavior", () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    afterAll(async () => {
      // Restore network
      await device.setURLBlacklist([]);
    });

    it("should show offline error when network is unavailable", async () => {
      // Block all network requests
      await device.setURLBlacklist([".*"]);

      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add burrata");
      await element(by.id("ai-send-button")).tap();

      // Should show error state
      await waitFor(element(by.id("ai-error-message")))
        .toBeVisible()
        .withTimeout(10_000);

      // Restore network
      await device.setURLBlacklist([]);
    });
  });

  // ── Retry handling ─────────────────────────────────────────────────────

  describe("Retry handling", () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should show retry button after failed request", async () => {
      // Simulate server error by blocking requests briefly
      await device.setURLBlacklist([".*localhost:3000.*"]);

      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add burrata");
      await element(by.id("ai-send-button")).tap();

      // Restore after triggering error
      await device.setURLBlacklist([]);

      await waitFor(element(by.id("retry-button")))
        .toBeVisible()
        .withTimeout(15_000);
    });
  });

  // ── Background/foreground transitions ─────────────────────────────────

  describe("Background/foreground transitions", () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should preserve cart state after backgrounding and foregrounding", async () => {
      // Add item via AI
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add 2 burrata salads");
      await element(by.id("ai-send-button")).tap();
      await waitFor(element(by.id("cart-count")))
        .toHaveText("2")
        .withTimeout(15_000);

      // Background the app
      await device.sendToHome();
      await device.launchApp({ newInstance: false }); // Foreground

      // Cart count should still be 2
      await expect(element(by.id("cart-count"))).toHaveText("2");
    });

    it("should keep AI sheet closed after background/foreground if it was closed", async () => {
      await device.sendToHome();
      await device.launchApp({ newInstance: false });

      await expect(element(by.id("ai-assistant-sheet"))).not.toBeVisible();
    });
  });

  // ── Rapid user interaction ─────────────────────────────────────────────

  describe("Rapid user interaction", () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it("should not allow double-tap sending (send button disabled during processing)", async () => {
      await element(by.id("ai-assistant-button")).tap();
      await element(by.id("ai-input-field")).typeText("Add burrata");
      await element(by.id("ai-send-button")).tap();

      // Button should be disabled immediately after first tap
      await expect(element(by.id("ai-send-button"))).not.toBeEnabled();
    });
  });
});
