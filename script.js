// ===== CONFIGURACIÓN =====
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
const REQUEST_DELAY_MS = 2000;

// ===== VARIABLES GLOBALES =====
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

// Historial de mensajes - SIN PROMPT (el prompt está en el backend)
const messages = [];

let userState = {
  role: null,
  experience: null,
  testScore: 0,
  currentLevel: null,
  messagesCount: 0,
  phase: "collection"
};

let isRequestInProgress = false;

// ===== FUNCIONES AUXILIARES =====

function addMessage(text, sender = "bot") {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  
  const formattedText = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  div.innerHTML = formattedText;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function callWorker(messages) {
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error HTTP ${response.status}:`, errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || `Error ${response.status}`);
      } catch (e) {
        throw new Error(`Error del servidor: ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.reply) {
      console.error("Respuesta del worker sin campo 'reply':", data);
      throw new Error("Formato de respuesta inesperado del worker");
    }

    return data.reply;
  } catch (error) {
    console.error("Error en callWorker:", error);
    throw error;
  }
}

function getUserRole() {
  return userState.role || "desconocido";
}

function getUserExperience() {
  return userState.experience || "desconocida";
}

function getTestScore() {
  return userState.testScore;
}

function getCurrentLevel() {
  if (userState.testScore <= 2) return "BÁSICO";
  if (userState.testScore <= 4) return "MEDIO";
  return "AVANZADO";
}

function saveProgress() {
  try {
    const progress = {
      role: getUserRole(),
      experience: getUserExperience(),
      testScore: getTestScore(),
      currentLevel: getCurrentLevel(),
      phase: userState.phase,
      messages: messages.slice(Math.max(0, messages.length - 15))
    };
    localStorage.setItem('tutorPRL_progress', JSON.stringify(progress));
  } catch (err) {
    console.error("Error al guardar progreso:", err);
  }
}

function loadProgress() {
  const saved = localStorage.getItem('tutorPRL_progress');
  if (saved) {
    try {
      const progress = JSON.parse(saved);
      
      userState.role = progress.role;
      userState.experience = progress.experience;
      userState.testScore = progress.testScore;
      userState.currentLevel = progress.currentLevel;
      userState.phase = progress.phase;
      
      if (progress.messages && Array.isArray(progress.messages)) {
        progress.messages.forEach(msg => {
          messages.push(msg);
          if (msg.role === 'user') addMessage(msg.content, 'user');
          else if (msg.role === 'assistant') addMessage(msg.content, 'bot');
        });
      }
    } catch (err) {
      console.error("Error al cargar progreso:", err);
    }
  }
}

function clearProgress() {
  localStorage.removeItem('tutorPRL_progress');
  location.reload();
}

// ===== INICIALIZACIÓN =====

loadProgress();

// Mensaje inicial del tutor (solo si es primera vez)
if (messages.length === 0) {
  addMessage("Hola, soy tu tutor de PRL en entorno financiero. ¿Cuál es tu rol en la empresa? (comercial, back-office, IT, etc.)", "bot");
  userState.phase = "collection_role";
}

// ===== EVENT LISTENERS =====

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  if (isRequestInProgress) {
    addMessage("Por favor, espera a que termine la respuesta anterior.", "bot");
    return;
  }

  addMessage(text, "user");
  userInput.value = "";
  const submitButton = chatForm.querySelector("button");
  submitButton.disabled = true;
  isRequestInProgress = true;

  messages.push({ role: "user", content: text });
  
  await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));

  try {
    console.log("Enviando solicitud al worker...");
    const reply = await callWorker(messages);
    
    if (reply && reply.trim()) {
      messages.push({ role: "assistant", content: reply });
      addMessage(reply, "bot");
      saveProgress();
      console.log("Respuesta recibida correctamente");
    } else {
      addMessage("No he podido generar respuesta en este momento. Por favor, intenta de nuevo.", "bot");
      console.warn("Respuesta vacía del worker");
    }
  } catch (err) {
    console.error("Error completo:", err);
    
    let errorMsg = "Ha ocurrido un error al contactar con el tutor.";
    
    if (err.message.includes("Failed to fetch")) {
      errorMsg = "Error de conexión. Verifica que el worker de Cloudflare está activo.";
    } else if (err.message.includes("rate limited")) {
      errorMsg = "El servicio está siendo utilizado mucho en este momento. Por favor, espera unos segundos e intenta de nuevo.";
    } else if (err.message.includes("HTTP")) {
      errorMsg = `Error del servidor: ${err.message}`;
    } else if (err.message.includes("Formato")) {
      errorMsg = "Error en la respuesta del servidor.";
    }
    
    addMessage(errorMsg + " Por favor, intenta de nuevo.", "bot");
  } finally {
    submitButton.disabled = false;
    isRequestInProgress = false;
  }
});

setInterval(saveProgress, 15000);

