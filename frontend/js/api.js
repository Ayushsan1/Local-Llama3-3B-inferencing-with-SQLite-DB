const API_BASE_URL = "http://127.0.0.1:8000/api";

// Core request wrapper that automatically attaches the JWT token
async function defRequest(endpoint, options = {}) {
  const token = localStorage.getItem("jwt_token");
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Auto redirect on auth failure
    if (response.status === 401) {
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("username");
      if (!window.location.pathname.includes("login.html") && !window.location.pathname.includes("register.html")) {
        window.location.href = "login.html";
      }
      const errData = await response.json();
      throw new Error(errData.detail || "Unauthorized access");
    }
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "An error occurred during request");
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// Global API object exposing client-side hooks
const API = {
  login: async (username, password) => {
    return await defRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  
  register: async (username, password) => {
    return await defRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  
  listChats: async () => {
    return await defRequest("/chats");
  },
  
  createChat: async (title, modelName, temperature, maxTokens) => {
    return await defRequest("/chats", {
      method: "POST",
      body: JSON.stringify({
        title,
        model_name: modelName,
        temperature,
        max_tokens: maxTokens,
      }),
    });
  },
  
  getChatHistory: async (chatId) => {
    return await defRequest(`/chats/${chatId}`);
  },
  
  updateChat: async (chatId, updateData) => {
    return await defRequest(`/chats/${chatId}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  },
  
  deleteChat: async (chatId) => {
    return await defRequest(`/chats/${chatId}`, {
      method: "DELETE",
    });
  },
  
  getModels: async () => {
    return await defRequest("/models");
  },
  
  // Streaming handler that decodes text/event-stream chunks
  streamPrompt: async (chatId, prompt, onToken, onError, onDone) => {
    const token = localStorage.getItem("jwt_token");
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/chats/${chatId}/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Streaming prompt failed");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        // Decode chunk data string
        buffer += decoder.decode(value, { stream: true });
        
        // Split chunk inputs by SSE protocol boundaries
        const lines = buffer.split("\n\n");
        // Keep the last partial line in buffer
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                onError(data.error);
                return;
              }
              
              const tokenContent = data.message?.content || "";
              onToken(tokenContent);
              
              if (data.done) {
                onDone();
                return;
              }
            } catch (e) {
              console.warn("Failed to parse SSE payload:", line, e);
            }
          }
        }
      }
      
      // End of stream cleanup
      onDone();
    } catch (error) {
      console.error("Stream reader exception:", error);
      onError(error.message);
    }
  }
};
