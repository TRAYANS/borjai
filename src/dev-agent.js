// BORJAI development is now handled directly from the ChatGPT conversation.
// Keep this module intentionally inert so the legacy in-app AI Developer panel
// is no longer injected into Coach IA.

function addAgentUI() {
  document.getElementById("dev-agent-card")?.remove();
}

const observer = new MutationObserver(addAgentUI);
observer.observe(document.body, { childList: true, subtree: true });
addAgentUI();
