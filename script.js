// ===== CONFIGURACIÓN =====
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
const REQUEST_DELAY_MS = 1000;

// ===== VARIABLES GLOBALES =====
const chatContainer = document.getElementById("chat-container" );
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

const messages = [];

let userState = {
  questionsAsked: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  currentLevel: 'BÁSICO',
  phase: 'role',
  role: null,
};

let currentQuestion = null;
let isRequestInProgress = false;

// ===== FUNCIONES AUXILIARES =====

function addMessage(text, sender = "bot", metadata = {}) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  
  const formattedText = text
    .replace(/\n/g, '  
')
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
      button.type = "button";
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
  if (isRequestInProgress) return;
  userInput.value = option.toUpperCase();
  const event = new Event('submit', { bubbles: true });
  chatForm.dispatchEvent(event);
}

async function callWorker(message, includeCurrentQuestion = false) {
  try {
    const payload = { message, userState };
    if (includeCurrentQuestion && currentQuestion) {
      payload.currentQuestion = currentQuestion;
    }
    
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error en callWorker:", error);
    throw error;
  }
}

function updateProgress() {
  const total = userState.correctAnswers + userState.incorrectAnswers;
  if (total === 0) return false;
  
  const rate = (userState.correctAnswers / total) * 100;
  const oldLevel = userState.currentLevel;
  
  if (rate >= 80 && userState.currentLevel === 'BÁSICO') {
    userState.currentLevel = 'MEDIO';
  } else if (rate >= 80 && userState.currentLevel === 'MEDIO') {
    userState.currentLevel = 'AVANZADO';
  } else if (rate < 50 && userState.currentLevel === 'AVANZADO') {
    userState.currentLevel = 'MEDIO';
  } else if (rate < 50 && userState.currentLevel === 'MEDIO') {
    userState.currentLevel = 'BÁSICO';
  }
  
  return oldLevel !== userState.currentLevel;
}

function saveProgress() {
  try {
    localStorage.setItem('tutorPRL_progress', JSON.stringify({
      questionsAsked: userState.questionsAsked,
      correctAnswers: userState.correctAnswers,
      incorrectAnswers: userState.incorrectAnswers,
      currentLevel: userState.currentLevel,
      phase: userState.phase,
      role: userState.role,
    }));
  } catch (err) {
    console.error("Error al guardar:", err);
  }
}

function loadProgress() {
  const saved = localStorage.getItem('tutorPRL_progress');
  if (!saved) return;
  
  try {
    const progress = JSON.parse(saved);
    userState.questionsAsked = progress.questionsAsked || 0;
    userState.correctAnswers = progress.correctAnswers || 0;
    userState.incorrectAnswers = progress.incorrectAnswers || 0;
    userState.currentLevel = progress.currentLevel || 'BÁSICO';
    userState.phase = progress.phase || 'role';
    userState.role = progress.role || null;
  } catch (err) {
    console.error("Error al cargar:", err);
  }
}

// ===== INICIALIZACIÓN =====

loadProgress();

if (messages.length === 0 && !userState.role) {
  addMessage("Hola, soy tu tutor adaptativo de PRL. Vamos a trabajar con preguntas tipo test que se adaptarán a tu nivel de conocimiento.\n\n¿Cuál es tu rol en la empresa? (comercial, back-office, IT, etc.)", "bot");
  userState.phase = 'role';
}

// ===== EVENT LISTENERS =====

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  let text = userInput.value.trim();
  if (!text) return;

  // FASE 1: OBTENER ROL
  if (userState.phase === 'role') {
    addMessage(text, "user");
    userInput.value = "";
    const submitButton = chatForm.querySelector("button");
    submitButton.disabled = true;
    isRequestInProgress = true;

    messages.push({ role: "user", content: text });
    
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));

    try {
      const result = await callWorker(text);
      
      if (result.type === 'initial') {
        userState.role = text;
        userState.phase = 'question';
        addMessage(result.content, "bot");
        messages.push({ role: "assistant", content: result.content, metadata: {} });
        
        // GENERAR PRIMERA PREGUNTA
        setTimeout(async () => {
          try {
            const firstQuestion = await callWorker("Genera la primera pregunta de nivel BÁSICO sobre PRL con 4 opciones (A, B, C, D)");
            
            if (firstQuestion.type === 'evaluation') {
              currentQuestion = {
                text: firstQuestion.nextQuestion,
                options: firstQuestion.options,
                correctAnswer: firstQuestion.correctAnswer
              };
              
              addMessage(firstQuestion.nextQuestion, "bot", {
                options: firstQuestion.options,
                progress: {
                  questionsAsked: 0,
                  correctAnswers: 0,
                  currentLevel: 'BÁSICO'
                }
              });
              
              saveProgress();
            }
          } catch (err) {
            console.error("Error generando primera pregunta:", err);
            addMessage("Error al generar la primera pregunta. Por favor, intenta de nuevo.", "bot");
          }
        }, 1000);
      }
      
      saveProgress();
    } catch (err) {
      console.error("Error:", err);
      addMessage("Ha ocurrido un error. Por favor, intenta de nuevo.", "bot");
    } finally {
      submitButton.disabled = false;
      isRequestInProgress = false;
    }
    return;
  }

  // FASE 2: RESPONDER PREGUNTAS
  if (userState.phase === 'question') {
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
      const result = await callWorker(text, true);
      
      if (result.type === 'evaluation') {
        userState.questionsAsked++;
        
        if (result.isCorrect) {
          userState.correctAnswers++;
          addMessage(`✅ ¡Correcto! ${result.feedback}`, "bot");
        } else {
          userState.incorrectAnswers++;
          addMessage(`❌ Incorrecto. ${result.feedback}\n\n**Respuesta correcta:** ${result.correctAnswer}\n\n**Justificación:** ${result.justification}`, "bot");
        }
        
        const levelChanged = updateProgress();
        
        if (levelChanged || userState.questionsAsked % 5 === 0) {
          const levelMessages = {
            'BÁSICO': "ℹ️ Vamos a volver a nivel BÁSICO para reforzar fundamentos.",
            'MEDIO': "🎉 ¡Felicidades! Has subido a nivel MEDIO. Las preguntas serán más desafiantes.",
            'AVANZADO': "🏆 ¡Excelente! Has alcanzado nivel AVANZADO. Prepárate para preguntas complejas."
          };
          
          if (levelChanged) {
            addMessage(levelMessages[userState.currentLevel], "bot");
          }
          
          setTimeout(async () => {
            try {
              const explanation = await callWorker("Proporciona una explicación educativa sobre PRL para consolidar conocimientos");
              if (explanation.type === 'explanation') {
                addMessage(explanation.content, "bot");
                
                setTimeout(async () => {
                  try {
                    const nextQ = await callWorker(`Genera una nueva pregunta de nivel ${userState.currentLevel} sobre PRL con 4 opciones (A, B, C, D)`);
                    if (nextQ.type === 'evaluation') {
                      currentQuestion = {
                        text: nextQ.nextQuestion,
                        options: nextQ.options,
                        correctAnswer: nextQ.correctAnswer
                      };
                      
                      addMessage(nextQ.nextQuestion, "bot", {
                        options: nextQ.options,
                        progress: {
                          questionsAsked: userState.questionsAsked,
                          correctAnswers: userState.correctAnswers,
                          currentLevel: userState.currentLevel
                        }
                      });
                    }
                  } catch (err) {
                    console.error("Error:", err);
                  }
                }, 1000);
              }
            } catch (err) {
              console.error("Error:", err);
            }
          }, 1500);
        } else {
          setTimeout(() => {
            currentQuestion = {
              text: result.nextQuestion,
              options: result.options,
              correctAnswer: result.correctAnswer
            };
            
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
      }
      
      messages.push({ role: "assistant", content: result.feedback || result.content, metadata: {} });
      saveProgress();
      
    } catch (err) {
      console.error("Error:", err);
      addMessage("Ha ocurrido un error. Por favor, intenta de nuevo.", "bot");
    } finally {
      submitButton.disabled = false;
      isRequestInProgress = false;
    }
  }
});

setInterval(saveProgress, 15000);
