// ================================================================
// Helper AI — Frontend Logic
// ================================================================
// This file is organized into clearly labeled sections:
//   1. Config & state
//   2. DOM references
//   3. Utility helpers (escaping, markdown, time, ids)
//   4. Rendering (messages, typing indicator, toasts)
//   5. Core chat flow (sending a message, calling the backend)
//   6. Conversation / sidebar management
//   7. Event listeners & init
//
// Everything uses plain fetch() + async/await - no frameworks,
// no build step. Open index.html and it just works.
// ================================================================

// ---- 1. Config & state -----------------------------------------

// Where our Express backend lives. Change this if you deploy the
// backend somewhere other than your local machine.
const API_BASE_URL = "http://localhost:5000";

// LocalStorage keys for persistence and backup
const STORAGE_KEY = "my_helper_conversations";
const ACTIVE_ID_KEY = "my_helper_active_id";
const BACKUP_KEY = "my_helper_conversations_backup";

// In-memory store for every conversation started this session.
// Nothing is persisted to a database or localStorage on purpose -
// this keeps the demo simple and avoids storing chat data in the
// browser. Refreshing the page starts fresh.
const state = {
  conversations: {}, // { [id]: { id, title, messages: [{role, content, time}] } }
  activeId: null,
  isWaiting: false, // true while we're waiting on the API
};

// ---- 2. DOM references -------------------------------------------
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const conversationList = document.getElementById("conversationList");

const chatTitle = document.getElementById("chatTitle");
const chatWindow = document.getElementById("chatWindow");
const emptyState = document.getElementById("emptyState");
const typingIndicator = document.getElementById("typingIndicator");

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const toastContainer = document.getElementById("toastContainer");

// ---- 3. Utility helpers -------------------------------------------

/** Generates a short, unique-enough id for conversations/messages. */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns a friendly HH:MM timestamp, e.g. "3:42 PM". */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Escapes HTML special characters to prevent injection when we
 *  render user/AI text. We ALWAYS escape first, then selectively
 *  re-introduce a small set of safe markdown-derived tags. */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A deliberately small Markdown -> HTML renderer covering just what
 * a chat assistant needs: fenced code blocks, inline code, bold,
 * italics, links, and line breaks. We avoid pulling in a full
 * Markdown library to keep the project dependency-free on the
 * frontend, per the "no unnecessary libraries" requirement.
 *
 * Security note: input is escaped BEFORE any tags are introduced,
 * so raw HTML typed by a user (or returned by the model) can never
 * execute in the page.
 */
function renderMarkdown(rawText) {
  const escaped = escapeHtml(rawText);

  // Pull out fenced code blocks first (```lang\ncode\n```) so the
  // simpler inline rules below don't accidentally mangle code.
  const codeBlocks = [];
  let text = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `%%CODEBLOCK_${index}%%`;
  });

  // Inline code: `like this`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text* (after bold, so ** isn't caught here)
  text = text.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");

  // Links: [label](https://...) — only allow http/https targets
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Line breaks -> paragraphs
  text = text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");

  // Re-insert code blocks with a copy button
  text = text.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const { lang, code } = codeBlocks[Number(i)];
    const langLabel = lang ? lang : "text";
    return `<pre><button class="copy-btn" data-copy-target="1">Copy</button><code data-lang="${langLabel}">${code}</code></pre>`;
  });

  return text;
}

// ---- 5. LocalStorage Persistence --------------------------------------------------
/**
 * Serialises the entire conversation state and stores it in localStorage.
 * Before overwriting, the previous value is copied to a backup key.
 */
function saveToLocalStorage() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing !== null) {
      localStorage.setItem(BACKUP_KEY, existing);
    }
    const payload = JSON.stringify({
      conversations: state.conversations,
      activeId: state.activeId,
    });
    localStorage.setItem(STORAGE_KEY, payload);
    localStorage.setItem(ACTIVE_ID_KEY, state.activeId || "");
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
}

/**
 * Loads persisted conversation data (if any) and populates the in‑memory `state`.
 * Returns `true` if data was successfully loaded, otherwise `false`.
 */
function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const { conversations, activeId } = JSON.parse(saved);
    if (typeof conversations === "object" && conversations !== null) {
      state.conversations = conversations;
      state.activeId = activeId;
      // Restore Date objects for message timestamps
      Object.values(state.conversations).forEach(conv => {
        if (Array.isArray(conv.messages)) {
          conv.messages.forEach(msg => {
            if (msg.time && typeof msg.time === "string") {
              const parsed = new Date(msg.time);
              if (!isNaN(parsed)) msg.time = parsed;
            }
          });
        }
      });
      // Render UI based on loaded data
      renderConversationList();
      renderActiveConversation();
      updateSendButtonState();
      return true;
    }
  } catch (e) {
    console.error("Failed to load from localStorage", e);
  }
  return false;
}

// ---- 4. Rendering --------------------------------------------------

/** Shows/hides the "empty state" hero depending on message count. */
function toggleEmptyState() {
  const conv = getActiveConversation();
  const hasMessages = conv && conv.messages.length > 0;
  emptyState.hidden = Boolean(hasMessages);
}

/** Renders a single message bubble into the chat window. */
function appendMessageToDOM({ role, content, time }) {

    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${role}`;
    avatar.textContent = role === "user" ? "You" : "N";

    const col = document.createElement("div");
    col.className = "bubble-col";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = renderMarkdown(content);

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.textContent = formatTime(time);

    col.appendChild(bubble);
    col.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(col);

    chatWindow.appendChild(row);

    // Force the browser to render first
    setTimeout(() => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }, 0);

}

/** Smoothly scrolls the chat log to the newest message. */
function scrollToBottom() {

    setTimeout(() => {

        chatWindow.scrollTop = chatWindow.scrollHeight;

    }, 0);

}

/** Shows a small toast notification (used for errors/info). */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 3200);
}

// ---- 5. Core chat flow ---------------------------------------------

/** Returns the currently active conversation object. */
function getActiveConversation() {
  return state.conversations[state.activeId];
}

/** Enables/disables the send button based on input + waiting state. */
function updateSendButtonState() {
  const hasText = messageInput.value.trim().length > 0;
  sendBtn.disabled = !hasText || state.isWaiting;
}

/** Grows the textarea as the user types, up to a CSS-defined max. */
function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

/** Handles submitting the chat form: validates, renders, and calls the API. */
async function handleSendMessage(event) {
  event.preventDefault();

  const text = messageInput.value.trim();
  // Guard against empty/whitespace-only submissions, and against
  // double-submits while we're already waiting on a reply.
  if (!text || state.isWaiting) return;

  const conv = getActiveConversation();

  // Give the conversation a readable title from its first message.
  if (conv.messages.length === 0) {
    conv.title = text.length > 36 ? `${text.slice(0, 36)}…` : text;
    chatTitle.textContent = conv.title;
    renderConversationList();
  }

  const userMessage = { role: "user", content: text, time: new Date() };
  conv.messages.push(userMessage);
  appendMessageToDOM(userMessage);
  // Persist after adding user message
  saveToLocalStorage();
  toggleEmptyState();

  // Clear + reset the composer immediately for a snappy feel.
  messageInput.value = "";
  autoResizeTextarea();
  updateSendButtonState();

  await requestHelperReply(conv);
}

/** Calls the backend's POST /chat endpoint and renders the reply. */
async function requestHelperReply(conv) {
  setWaiting(true);

  try {
    // Send recent history (minus the message we just added, which
    // the backend appends itself) so Helper has short-term memory
    // during this session. We cap history length to keep payloads
    // small and stay within the model's context window.
    const history = conv.messages
      .slice(0, -1)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: conv.messages[conv.messages.length - 1].content,
        history,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = data.error || `Request failed with status ${response.status}.`;
      throw new Error(errorMessage);
    }

    const assistantMessage = {
      role: "assistant",
      content: data.reply,
      time: new Date()
    };

    conv.messages.push(assistantMessage);
    appendMessageToDOM(assistantMessage);
    // Persist after receiving assistant reply
    saveToLocalStorage();
  } catch (error) {
    // Network failure (backend not running) vs. a handled API error
    // both land here since we throw in both cases above.
    const friendly = error.message.includes("Failed to fetch")
      ? "Can't reach the Helper AI server. Is the backend running on port 5000?"
      : error.message;

    showToast(friendly, "error");

    const errorBubble = {
    role: "assistant",
    content: `⚠️ ${friendly}`,
    time: new Date(),
};

conv.messages.push(errorBubble);
appendMessageToDOM(errorBubble);
  // Persist after adding error message
  saveToLocalStorage();
  } finally {
    setWaiting(false);
  }
}

/** Toggles the "waiting on API" UI state: typing dots + disabled send. */
function setWaiting(isWaiting) {
  state.isWaiting = isWaiting;

  if (isWaiting) {
    typingIndicator.style.display = "flex";
    scrollToBottom();
  } else {
    typingIndicator.style.display = "none";
  }

  updateSendButtonState();
}

// ---- 6. Conversation / sidebar management ---------------------------

/** Creates a brand-new, empty conversation and makes it active. */
function createConversation() {
  const id = generateId();
  state.conversations[id] = { id, title: "New conversation", messages: [] };
  state.activeId = id;
  renderConversationList();
  renderActiveConversation();
  messageInput.focus();
  // Persist new conversation
  saveToLocalStorage();
}

/** Re-renders the full sidebar list of conversations. */
function renderConversationList() {
  conversationList.innerHTML = "";

  // Newest conversations first.
  const ids = Object.keys(state.conversations).reverse();

  ids.forEach((id) => {
    const conv = state.conversations[id];
    const item = document.createElement("button");
    item.className = `conversation-item${id === state.activeId ? " active" : ""}`;
    item.textContent = conv.title;
    item.addEventListener("click", () => {
      state.activeId = id;
      renderConversationList();
      renderActiveConversation();
    });
    conversationList.appendChild(item);
  });
}

/** Clears and redraws the chat window for whichever conversation is active. */
function renderActiveConversation() {
  const conv = getActiveConversation();
  chatTitle.textContent = conv.title;

  // Remove all rendered message rows but keep the empty-state node.
  chatWindow.querySelectorAll(".message-row").forEach((el) => el.remove());

  conv.messages.forEach(appendMessageToDOM);
  toggleEmptyState();
  scrollToBottom();
}

/** Clears every message in the active conversation (keeps the tab). */
function clearActiveConversation() {
  const conv = getActiveConversation();
  conv.messages = [];
  conv.title = "New conversation";
  chatTitle.textContent = conv.title;
  chatWindow.querySelectorAll(".message-row").forEach((el) => el.remove());
  toggleEmptyState();
  renderConversationList();
  // Persist after clearing conversation
  saveToLocalStorage();
  showToast("Chat cleared.");
}

// ---- 7. Event listeners & init ----------------------------------------

// Submit on button click / Enter key (Shift+Enter inserts a newline).
chatForm.addEventListener("submit", handleSendMessage);

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
  if (e.key === "Escape") {
    messageInput.value = "";
    autoResizeTextarea();
    updateSendButtonState();
  }
});

messageInput.addEventListener("input", () => {
  autoResizeTextarea();
  updateSendButtonState();
});

// Suggestion chips pre-fill the composer with a starter prompt.
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    messageInput.value = chip.dataset.prompt;
    autoResizeTextarea();
    updateSendButtonState();
    messageInput.focus();
  });
});

// Copy button inside rendered code blocks (event delegation, since
// code blocks are created dynamically).
chatWindow.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;

  const codeEl = btn.parentElement.querySelector("code");
  try {
    await navigator.clipboard.writeText(codeEl.textContent);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1500);
  } catch {
    showToast("Couldn't copy to clipboard.", "error");
  }
});

// Sidebar controls
newChatBtn.addEventListener("click", createConversation);
clearChatBtn.addEventListener("click", clearActiveConversation);

sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
mobileSidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));

// Keyboard shortcuts: Ctrl/Cmd+K -> new chat
document.addEventListener("keydown", (e) => {
  const isModifier = e.ctrlKey || e.metaKey;
  if (isModifier && e.key.toLowerCase() === "k") {
    e.preventDefault();
    createConversation();
  }
});

// ---- Init ----
if (!loadFromLocalStorage()) {
  createConversation();
}
updateSendButtonState();
