import { test, expect } from "@playwright/test";

test("dashboard renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CertiWatch Admin")).toBeVisible();
  await expect(page.getByText("New Records")).toBeVisible();
});
