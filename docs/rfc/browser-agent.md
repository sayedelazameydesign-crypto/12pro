# RFC: Browser Agent

- Status: Draft
- Component: @agi-system/browser

## Summary
Browser automation with DOM grounding and vision.

## Design
- Playwright wrapper
- Screenshot -> LLM grounding
- Tool: browser_navigate, browser_click, browser_type, browser_snapshot

## Security
- Sandbox: browser runs in isolated container
- No access to host filesystem
