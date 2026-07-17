// Global Workspace State Management Object
const state = {
  activeChatId: null,
  conversations: [],
  models: [],
  isGenerating: false,
};

// --- DOM References ---
const DOM = {
  chatList: document.getElementById("chat-list"),
  newChatBtn: document.getElementById("new-chat-btn"),
  userDisplay: document.getElementById("user-display"),
  logoutBtn: document.getElementById("logout-btn"),
  activeChatTitle: document.getElementById("active-chat-title"),
  modelSelect: document.getElementById("model-select"),
  settingsToggleBtn: document.getElementById("settings-toggle-btn"),
  settingsDrawer: document.getElementById("settings-drawer"),
  tempSlider: document.getElementById("temperature-slider"),
  tempVal: document.getElementById("temp-val"),
  maxTokensSlider: document.getElementById("max-tokens-slider"),
  tokensVal: document.getElementById("tokens-val"),
  messagesLog: document.getElementById("messages-log"),
  chatInput: document.getElementById("chat-input"),
  sendBtn: document.getElementById("send-btn"),
};

// Helper to show non-blocking notification alerts
function showToastNotification(message, isSuccess = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = message;
  toast.className = `toast show ${isSuccess ? "success" : ""}`;
  setTimeout(() => {
    toast.className = toast.className.replace("show", "").trim();
  }, 4000);
}

// Scroll chat viewport log directly to the bottom
function scrollToBottom() {
  DOM.messagesLog.scrollTop = DOM.messagesLog.scrollHeight;
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("username") || "User Profile";
  DOM.userDisplay.innerText = username;

  // Bind Event Listeners
  DOM.newChatBtn.addEventListener("click", handleCreateNewChat);
  DOM.logoutBtn.addEventListener("click", handleLogout);
  DOM.settingsToggleBtn.addEventListener("click", toggleSettingsDrawer);
  
  DOM.tempSlider.addEventListener("input", (e) => {
    DOM.tempVal.innerText = e.target.value;
  });
  DOM.maxTokensSlider.addEventListener("input", (e) => {
    DOM.tokensVal.innerText = e.target.value;
  });

  // Save configs to DB when user finishes sliding values (avoids spams on input)
  DOM.tempSlider.addEventListener("change", handleUpdateConfig);
  DOM.maxTokensSlider.addEventListener("change", handleUpdateConfig);
  
  DOM.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  });
  DOM.sendBtn.addEventListener("click", handleSendPrompt);

  // Initialize data layers
  await fetchModels();
  await loadConversations();
});

// --- API ACTIONS ---

// Fetch installed model lists from Ollama wrapper
async function fetchModels() {
  try {
    const models = await API.getModels();
    state.models = models;
    DOM.modelSelect.innerHTML = "";
    
    if (models.length === 0) {
      DOM.modelSelect.innerHTML = `<option value="">No models installed</option>`;
      showToastNotification("No local Ollama models found. Please pull a model first.");
      return;
    }
    
    models.forEach(model => {
      const option = document.createElement("option");
      option.value = model;
      option.innerText = model;
      DOM.modelSelect.appendChild(option);
    });

    // Save model choice on select trigger
    DOM.modelSelect.addEventListener("change", async (e) => {
      if (state.activeChatId) {
        try {
          await API.updateChat(state.activeChatId, { model_name: e.target.value });
          showToastNotification("Active model updated", true);
        } catch (err) {
          showToastNotification("Failed to update active model");
        }
      }
    });
  } catch (error) {
    DOM.modelSelect.innerHTML = `<option value="">Ollama Connection Error</option>`;
    showToastNotification(error.message || "Failed to reach backend service.");
  }
}

// Load side conversations
async function loadConversations() {
  try {
    const chats = await API.listChats();
    state.conversations = chats;
    renderSidebarChats();
  } catch (error) {
    showToastNotification("Failed to retrieve conversation logs.");
  }
}

// Render conversations inside the sidebar list DOM
function renderSidebarChats() {
  DOM.chatList.innerHTML = "";
  
  if (state.conversations.length === 0) {
    DOM.chatList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding-top: 1rem;">No conversations yet</div>`;
    return;
  }
  
  state.conversations.forEach(chat => {
    const chatItem = document.createElement("div");
    chatItem.className = `chat-item ${state.activeChatId === chat.id ? "active" : ""}`;
    chatItem.dataset.id = chat.id;
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-item-title";
    titleSpan.innerText = chat.title;
    titleSpan.addEventListener("click", () => selectConversation(chat.id));
    chatItem.appendChild(titleSpan);

    const actionContainer = document.createElement("div");
    actionContainer.className = "chat-item-actions";

    // Edit title button action
    const editBtn = document.createElement("button");
    editBtn.className = "chat-action-btn";
    editBtn.title = "Rename Chat";
    editBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      enableChatRename(chatItem, chat.id, chat.title);
    });
    actionContainer.appendChild(editBtn);

    // Delete chat button action
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "chat-action-btn";
    deleteBtn.title = "Delete Chat";
    deleteBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteConversation(chat.id);
    });
    actionContainer.appendChild(deleteBtn);

    chatItem.appendChild(actionContainer);
    DOM.chatList.appendChild(chatItem);
  });
}

// Handle chat title renaming input creation
function enableChatRename(chatItemNode, chatId, currentTitle) {
  const titleSpan = chatItemNode.querySelector(".chat-item-title");
  const actionsDiv = chatItemNode.querySelector(".chat-item-actions");
  
  // Hide standard layout nodes
  titleSpan.style.display = "none";
  actionsDiv.style.display = "none";

  const editInput = document.createElement("input");
  editInput.className = "chat-item-edit-input";
  editInput.value = currentTitle;
  chatItemNode.prepend(editInput);
  editInput.focus();
  editInput.select();

  const saveRename = async () => {
    const newTitle = editInput.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      try {
        await API.updateChat(chatId, { title: newTitle });
        const chatObj = state.conversations.find(c => c.id === chatId);
        if (chatObj) chatObj.title = newTitle;
        if (state.activeChatId === chatId) {
          DOM.activeChatTitle.innerText = newTitle;
        }
        showToastNotification("Chat renamed", true);
      } catch (err) {
        showToastNotification("Failed to rename conversation");
      }
    }
    // Re-render layout
    renderSidebarChats();
  };

  editInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveRename();
    if (e.key === "Escape") renderSidebarChats();
  });

  // Save if click goes outside the input element
  editInput.addEventListener("blur", saveRename);
}

// Select chat log view
async function selectConversation(chatId) {
  if (state.isGenerating) return; // Prevent navigation during active streaming
  
  state.activeChatId = chatId;
  
  // Highlight active element in list
  renderSidebarChats();

  // Reset inputs UI
  DOM.chatInput.disabled = false;
  DOM.sendBtn.disabled = false;
  DOM.chatInput.value = "";
  DOM.chatInput.placeholder = "Type your message...";

  DOM.messagesLog.innerHTML = `
    <div class="shimmer-wrapper" style="padding: 1rem;">
      <div class="shimmer-line" style="width: 40%"></div>
      <div class="shimmer-line" style="width: 85%"></div>
      <div class="shimmer-line" style="width: 60%"></div>
    </div>
  `;

  try {
    const data = await API.getChatHistory(chatId);
    DOM.activeChatTitle.innerText = data.title;
    
    // Bind dropdown selection
    if (state.models.includes(data.model_name)) {
      DOM.modelSelect.value = data.model_name;
    }

    // Set configuration slider states
    DOM.tempSlider.value = data.temperature;
    DOM.tempVal.innerText = data.temperature;
    DOM.maxTokensSlider.value = data.max_tokens;
    DOM.tokensVal.innerText = data.max_tokens;

    // Render message lists
    DOM.messagesLog.innerHTML = "";
    if (data.messages.length === 0) {
      DOM.messagesLog.innerHTML = `
        <div class="empty-chat-state">
          <h3>No messages in this chat</h3>
          <p>Send a prompt in the input below to trigger your local Ollama LLM.</p>
        </div>
      `;
      return;
    }

    data.messages.forEach(message => {
      appendMessageBubble(message.role, message.content);
    });
    scrollToBottom();
  } catch (error) {
    DOM.messagesLog.innerHTML = `<div style="color:#ef4444; padding: 1.5rem; text-align:center;">Failed to load chat history.</div>`;
  }
}

// Append dialogue bubble block to view panel
function appendMessageBubble(role, contentText) {
  // Strip empty placeholders
  const wrapper = DOM.messagesLog.querySelector(".empty-chat-state");
  if (wrapper) wrapper.remove();

  const messageRow = document.createElement("div");
  messageRow.className = `message-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble animate-fade-in";
  
  // Render using marked library if loaded, else fall back to text content
  if (typeof marked !== "undefined") {
    bubble.innerHTML = marked.parse(contentText);
  } else {
    bubble.innerText = contentText;
  }

  messageRow.appendChild(bubble);
  DOM.messagesLog.appendChild(messageRow);
  return bubble;
}

// Create new blank conversation entry
async function handleCreateNewChat() {
  if (state.isGenerating) return;
  if (state.models.length === 0) {
    showToastNotification("No active models detected. Ensure Ollama is running first.");
    return;
  }

  const defaultModel = DOM.modelSelect.value || state.models[0];
  const defaultTemp = parseFloat(DOM.tempSlider.value);
  const defaultTokens = parseInt(DOM.maxTokensSlider.value);

  try {
    const newChat = await API.createChat("New Conversation", defaultModel, defaultTemp, defaultTokens);
    state.conversations.unshift(newChat); // Add to top
    selectConversation(newChat.id);
  } catch (error) {
    showToastNotification("Failed to create new conversation.");
  }
}

// Edit sliders configurations
async function handleUpdateConfig() {
  if (!state.activeChatId) return;
  
  const payload = {
    temperature: parseFloat(DOM.tempSlider.value),
    max_tokens: parseInt(DOM.maxTokensSlider.value),
  };

  try {
    await API.updateChat(state.activeChatId, payload);
    showToastNotification("Parameters updated successfully", true);
  } catch (error) {
    showToastNotification("Failed to update options settings.");
  }
}

// Delete chat logs
async function handleDeleteConversation(chatId) {
  if (state.isGenerating) return;
  if (!confirm("Are you sure you want to permanently delete this conversation and all its messages?")) return;

  try {
    await API.deleteChat(chatId);
    state.conversations = state.conversations.filter(c => c.id !== chatId);
    showToastNotification("Conversation deleted", true);
    
    // Clear screen if deleted conversation was active
    if (state.activeChatId === chatId) {
      state.activeChatId = null;
      DOM.activeChatTitle.innerText = "Local Workspace";
      DOM.chatInput.disabled = true;
      DOM.sendBtn.disabled = true;
      DOM.chatInput.value = "";
      DOM.chatInput.placeholder = "Select or create a chat to begin...";
      DOM.messagesLog.innerHTML = `
        <div class="empty-chat-state">
          <h3>Welcome to Antigravity Local Inference</h3>
          <p>Please select a conversation from the sidebar or click "New Chat" to begin streaming prompts to your local Ollama LLM weight models.</p>
        </div>
      `;
    }
    
    renderSidebarChats();
  } catch (error) {
    showToastNotification("Failed to delete conversation.");
  }
}

// Send Prompt & Drive Stream loops
async function handleSendPrompt() {
  const prompt = DOM.chatInput.value.trim();
  if (!prompt || state.isGenerating || !state.activeChatId) return;

  // Lock UI inputs
  state.isGenerating = true;
  DOM.chatInput.value = "";
  DOM.chatInput.disabled = true;
  DOM.sendBtn.disabled = true;
  DOM.chatInput.placeholder = "AI is computing...";

  // 1. Render User prompt bubble
  appendMessageBubble("user", prompt);
  scrollToBottom();

  // 2. Append Assistant bubble container holding loader elements
  const assistantBubble = appendMessageBubble("assistant", "");
  assistantBubble.innerHTML = `<span class="spinner" id="active-spinner"></span>`;
  scrollToBottom();

  let assistantBuffer = "";
  const spinnerElement = assistantBubble.querySelector("#active-spinner");

  // Call api.js streaming function
  await API.streamPrompt(
    state.activeChatId,
    prompt,
    // onToken Callback
    (token) => {
      if (spinnerElement) spinnerElement.remove();
      assistantBuffer += token;
      
      // Render text markdown buffer + append blinking block cursor
      if (typeof marked !== "undefined") {
        assistantBubble.innerHTML = marked.parse(assistantBuffer) + `<span class="streaming-cursor"></span>`;
      } else {
        assistantBubble.innerText = assistantBuffer;
        const cursor = document.createElement("span");
        cursor.className = "streaming-cursor";
        assistantBubble.appendChild(cursor);
      }
      scrollToBottom();
    },
    // onError Callback
    (errorMsg) => {
      if (spinnerElement) spinnerElement.remove();
      const cursor = assistantBubble.querySelector(".streaming-cursor");
      if (cursor) cursor.remove();
      
      assistantBubble.innerHTML += `<div style="color:#ef4444; font-size:0.875rem; margin-top:0.5rem; font-weight:500;">⚠️ Error: ${errorMsg}</div>`;
      resetInputUI();
    },
    // onDone Callback
    () => {
      // Strip blink block cursor when complete
      const cursor = assistantBubble.querySelector(".streaming-cursor");
      if (cursor) cursor.remove();
      
      // Final parse check
      if (typeof marked !== "undefined") {
        assistantBubble.innerHTML = marked.parse(assistantBuffer);
      }
      resetInputUI();
    }
  );
}

// Reset inputs parameters once streaming closes
function resetInputUI() {
  state.isGenerating = false;
  DOM.chatInput.disabled = false;
  DOM.sendBtn.disabled = false;
  DOM.chatInput.value = "";
  DOM.chatInput.placeholder = "Type your message...";
  DOM.chatInput.focus();
}

// --- UTILITIES ---

function toggleSettingsDrawer() {
  DOM.settingsDrawer.classList.toggle("open");
  DOM.settingsToggleBtn.classList.toggle("active");
}

function handleLogout() {
  if (state.isGenerating) return;
  if (!confirm("Are you sure you want to log out?")) return;
  
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}
