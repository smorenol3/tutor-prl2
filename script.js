// ===== CONFIGURACIÓN =====
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
const REQUEST_DELAY_MS = 1000;

// ===== VARIABLES GLOBALES =====
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

const messages = [];

let userState = {
  questionsAsked: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  currentLevel: 'BÁSICO',
  phase: 'question',
  role: null,
  experience: null,
};

let isRequestInProgress = false;
let currentOptions = null;
let isFirstMessage = true;

// ===== FUNCIONES AUXILIARES =====

function addMessage(text, sender = "bot", metadata = {}) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  
  const formattedText = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  div.innerHTML = formattedText;
  
  // Añadir opciones si existen
  if (metadata.options && Object.keys(metadata.options).length > 0) {
    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("options-container");
    
    Object.entries(metadata.options).forEach(([key, value]) => {
      const button = document.createElement("button");
      button.classList.add("option-button");
      button.type = "button"; // Importante: no es submit
      button.textContent = `${key}. ${value}`;
      button.onclick = (e) => {
        e.preventDefault();
        selectOption(key);
      };
      optionsDiv.appendChild(button);
    });
    
    div.appendChild(optionsDiv);
    currentOptions = metadata.options;
  }
  
  // Añadir progreso si existe
  if (metadata.progress) {
    const progressDiv = document.createElement("div");
    progressDiv.classList.add("progress-indicator");
    progressDiv.innerHTML = `
      <strong>📊 Progreso:</strong> 
      ${metadata.progress.correctAnswers}/${metadata.progress.questionsAsked} correctas | 
      Nivel: <span class="level-badge ${metadata.progress.currentLevel}">${metadata.progress.currentLevel}</span>
    `;
    div.appendChild(progressDiv);
  }
  
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function selectOption(option) {
  if (isRequestInProgress) {
    console.log("Solicitud en progreso, ignorando click");
    return;
  }
  
  console.log("Opción seleccionada:", option);
  userInput.value = option.toUpperCase();
  
  // Simular envío del formulario
  const event = new Event('submit', { bubbles: true });
  chatForm.dispatchEvent(event);
}

async function callWorker(message) {
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message,
        userState 
      })
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
    return data;
  } catch (error) {
    console.error("Error en callWorker:", error);
    throw error;
  }
}

function updateProgress() {
  const totalAnswered = userState.correctAnswers + userState.incorrectAnswers;
  
  if (totalAnswered > 0) {
    const successRate = (userState.correctAnswers / totalAnswered) * 100;
    
    if (successRate >= 80 && userState.currentLevel === 'BÁSICO') {
      userState.currentLevel = 'MEDIO';
      return true; // Cambio de nivel
    } else if (successRate >= 80 && userState.currentLevel === 'MEDIO') {
      userState.currentLevel = 'AVANZADO';
      return true; // Cambio de nivel
    } else if (successRate < 50 && userState.currentLevel === 'AVANZADO') {
      userState.currentLevel = 'MEDIO';
      return true; // Cambio de nivel
    } else if (successRate < 50 && userState.currentLevel === 'MEDIO') {
      userState.currentLevel = 'BÁSICO';
      return true; // Cambio de nivel
    }
  }
  
  return false; // Sin cambio de nivel
}

function saveProgress() {
  try {
    const progress = {
      questionsAsked: userState.questionsAsked,
      correctAnswers: userState.correctAnswers,
      incorrectAnswers: userState.incorrectAnswers,
      currentLevel: userState.currentLevel,
      phase: userState.phase,
      role: userState.role,
      experience: userState.experience,
      messages: messages.slice(Math.max(0, messages.length - 20))
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
      
      userState.questionsAsked = progress.questionsAsked || 0;
      userState.correctAnswers = progress.correctAnswers || 0;
      userState.incorrectAnswers = progress.incorrectAnswers || 0;
      userState.currentLevel = progress.currentLevel || 'BÁSICO';
      userState.phase = progress.phase || 'question';
      userState.role = progress.role || null;
      userState.experience = progress.experience || null;
      
      if (progress.messages && Array.isArray(progress.messages)) {
        progress.messages.forEach(msg => {
          messages.push(msg);
          if (msg.role === 'user') addMessage(msg.content, 'user');
          else if (msg.role === 'assistant') addMessage(msg.content, 'bot', msg.metadata);
        });
        isFirstMessage = false;
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

if (messages.length === 0) {
  addMessage("Hola, soy tu tutor adaptativo de PRL. Vamos a trabajar con preguntas tipo test que se adaptarán a tu nivel de conocimiento.\n\n¿Cuál es tu rol en la empresa? (comercial, back-office, IT, etc.)", "bot");
}

// ===== EVENT LISTENERS =====

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  let text = userInput.value.trim();
  
  if (!text) return;

  // Si es la primera pregunta (rol), permitir cualquier texto
  if (isFirstMessage) {
    addMessage(text, "user");
    userInput.value = "";
    const submitButton = chatForm.querySelector("button");
    submitButton.disabled = true;
    isRequestInProgress = true;

    messages.push({ role: "user", content: text });
    
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));

    try {
      console.log("Enviando rol al tutor...");
      const result = await callWorker(text);
      
      if (result.type === 'initial') {
        userState.role = text;
        addMessage(result.content, "bot");
        isFirstMessage = false;
        
        // Esperar un poco y luego pedir la primera pregunta
        setTimeout(() => {
          addMessage("Ahora vamos a comenzar. Responde con A, B, C o D.", "bot");
          callWorker("Genera la primera pregunta de nivel BÁSICO sobre PRL").then(firstQuestion => {
            if (firstQuestion.type === 'evaluation') {
              addMessage(firstQuestion.nextQuestion, "bot", { 
                options: firstQuestion.options,
                progress: {
                  questionsAsked: 0,
                  correctAnswers: 0,
                  currentLevel: 'BÁSICO'
                }
              });
            }
          });
        }, 1000);
      }
      
      messages.push({ 
        role: "assistant", 
        content: result.content,
        metadata: {}
      });
      
      saveProgress();
      
    } catch (err) {
      console.error("Error completo:", err);
      addMessage("Ha ocurrido un error. Por favor, intenta de nuevo.", "bot");
    } finally {
      submitButton.disabled = false;
      isRequestInProgress = false;
    }
    return;
  }

  // Para preguntas posteriores, validar que sea A, B, C o D
  text = text.toUpperCase();
  if (!/^[A-D]$/.test(text)) {
    addMessage("Por favor, responde con A, B, C o D", "bot");
    userInput.value = "";
    return;
  }

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
    console.log("Enviando respuesta al tutor...");
    const result = await callWorker(text);
    
    if (result.type === 'evaluation') {
      userState.questionsAsked++;
      
      if (result.isCorrect) {
        userState.correctAnswers++;
        const feedback = `✅ ¡Correcto! ${result.feedback}`;
        addMessage(feedback, "bot");
      } else {
        userState.incorrectAnswers++;
        const feedback = `❌ Incorrecto. ${result.feedback}\n\n**Respuesta correcta:** ${result.correctAnswer}\n\n**Justificación:** ${result.justification}`;
        addMessage(feedback, "bot");
      }
      
      // Verificar cambio de nivel
      const levelChanged = updateProgress();
      
      if (levelChanged) {
        // Si hay cambio de nivel, mostrar mensaje y luego pedir explicación
        const newLevel = userState.currentLevel;
        const levelMessages = {
          'BÁSICO': "ℹ️ Vamos a volver a nivel BÁSICO para reforzar fundamentos.",
          'MEDIO': "🎉 ¡Felicidades! Has subido a nivel MEDIO. Las preguntas serán más desafiantes.",
          'AVANZADO': "🏆 ¡Excelente! Has alcanzado nivel AVANZADO. Prepárate para preguntas complejas."
        };
        
        addMessage(levelMessages[newLevel], "bot");
        
        // Después del cambio de nivel, pedir explicación
        setTimeout(() => {
          console.log("Pidiendo explicación después de cambio de nivel...");
          callWorker("Proporciona una explicación educativa sobre PRL para consolidar conocimientos").then(explanation => {
            if (explanation.type === 'explanation') {
              addMessage(explanation.content, "bot");
              
              // Después de la explicación, pedir nueva pregunta
              setTimeout(() => {
                callWorker(`Genera una nueva pregunta de nivel ${userState.currentLevel} sobre PRL`).then(nextQ => {
                  if (nextQ.type === 'evaluation') {
                    addMessage(nextQ.nextQuestion, "bot", { 
                      options: nextQ.options,
                      progress: {
                        questionsAsked: userState.questionsAsked,
                        correctAnswers: userState.correctAnswers,
                        currentLevel: userState.currentLevel
                      }
                    });
                  }
                });
              }, 1000);
            }
          });
        }, 1500);
      } else {
        // Sin cambio de nivel, mostrar siguiente pregunta directamente
        setTimeout(() => {
          addMessage(result.nextQuestion, "bot", { 
            options: result.options,
            progress: {
              questionsAsked: userState.questionsAsked,
              correctAnswers: userState.correctAnswers,
              currentLevel: userState.currentLevel
            }
          });
        }, 1000);
      }
      
    } else if (result.type === 'explanation') {
      addMessage(result.content, "bot");
      userState.phase = 'question';
      
    } else if (result.type === 'text') {
      addMessage(result.content, "bot");
    }
    
    messages.push({ 
      role: "assistant", 
      content: result.content || result.nextQuestion || result.feedback,
      metadata: {}
    });
    
    saveProgress();
    console.log(`Progreso: ${userState.correctAnswers}/${userState.questionsAsked} correctas`);
    
  } catch (err) {
    console.error("Error completo:", err);
    
    let errorMsg = "Ha ocurrido un error al contactar con el tutor.";
    
    if (err.message.includes("Failed to fetch")) {
      errorMsg = "Error de conexión. Verifica que el worker de Cloudflare está activo.";
    } else if (err.message.includes("rate limited")) {
      errorMsg = "El servicio está siendo utilizado mucho en este momento. Por favor, espera unos segundos e intenta de nuevo.";
    } else if (err.message.includes("HTTP")) {
      errorMsg = `Error del servidor: ${err.message}`;
    }
    
    addMessage(errorMsg + " Por favor, intenta de nuevo.", "bot");
  } finally {
    submitButton.disabled = false;
    isRequestInProgress = false;
  }
});

setInterval(saveProgress, 15000);
