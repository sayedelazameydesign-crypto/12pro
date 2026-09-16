/**
 * Example: Browser automation task
 */
export const browserTask = {
  goal: "Open https://github.com and search for AGI-OS",
  steps: [
    { tool: "browser_navigate", url: "https://github.com" },
    { tool: "browser_type", selector: "[data-testid='search']", text: "AGI-OS" },
    { tool: "browser_snapshot" }
  ]
};
