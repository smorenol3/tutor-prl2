// ===== CONFIGURACIÓN =====
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";

// ===== VARIABLES GLOBALES =====
const chatContainer = document.getElementById("chat-container" );
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

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

// ===== FUNCIONES =====

function log(message) {
  console.log(`[TUTOR] ${new Date().toLocaleTimeString()}: ${message}`);
}

function addMessage(text, sender = "bot", metadata = {}) {
  log(`Añadiendo mensaje: ${sender} - ${text.substring(0, 50)}...`);
  
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
    log(`Añadiendo opciones: ${Object.keys(metadata.options).join(', ')}`);
    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("options-container");
    
    Object.entries(metadata.options).forEach(([key, value]) => {
      const button = document.createElement("button");
      button.classList.add("option-button");
      button.type = "button";
      button.textContent = `${key}. ${value}`;
      button.onclick = (e) => {
        e.preventDefault();
        log(`Usuario seleccionó opción: ${key}`);
        selectOption(key);
      };
      optionsDiv.appendChild(button);
    });
    
    div.appendChild(optionsDiv);
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
    log("Solicitud en progreso, ignorando click");
    return;
  }
  
  log(`Opción seleccionada: ${option}`);
  userInput.value = option.toUpperCase();
  
  const event = new Event('submit', { bubbles: true });
  chatForm.dispatchEvent(event);
}

async function callWorker(message) {
  log(`Llamando Worker con: ${message.substring(0, 50)}...`);
  
  try {
    const payload = { message, userState, currentQuestion };
    log(`Payload: ${JSON.stringify(payload).substring(0, 100)}...`);
    
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    log(`Respuesta Worker: status ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      log(`Error HTTP ${response.status}: ${errorText}`);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    log(`Datos recibidos: type=${data.type}`);
    return data;
  } catch (error) {
    log(`Error en callWorker: ${error.message}`);
    throw error;
  }
}

function saveProgress() {
  try {
    localStorage.setItem('tutorPRL_state', JSON.stringify(userState));
    log(`Progreso guardado: ${userState.questionsAsked} preguntas`);
  } catch (err) {
    log(`Error guardando: ${err.message}`);
  }
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('tutorPRL_state');
    if (saved) {
      userState = JSON.parse(saved);
      log(`Progreso cargado: ${userState.questionsAsked} preguntas`);
    }
  } catch (err) {
    log(`Error cargando: ${err.message}`);
  }
}

// ===== INICIALIZACIÓN =====

log("Inicializando tutor PRL...");
loadProgress();

if (!userState.role) {
  addMessage("Hola, soy tu tutor adaptativo de PRL. Vamos a trabajar con preguntas tipo test que se adaptarán a tu nivel de conocimiento.\\n\\n¿Cuál es tu rol en la empresa? (comercial, back-office, IT, etc.)", "bot");
  userState.phase = 'role';
  log("Esperando rol del usuario");
}

// ===== EVENT LISTENERS =====

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  let text = userInput.value.trim();
  if (!text) return;

  log(`Usuario escribió: ${text}`);
  
  if (isRequestInProgress) {
    log("Ya hay una solicitud en progreso");
    return;
  }

  addMessage(text, "user");
  userInput.value = "";
  isRequestInProgress = true;
  const submitButton = chatForm.querySelector("button");
  submitButton.disabled = true;

  try {
    // FASE 1: OBTENER ROL
    if (userState.phase === 'role') {
      log("FASE: Obtener rol");
      
      const result = await callWorker(text);
      
      if (result.type === 'roleSet') {
        userState.role = text;
        userState.phase = 'question';
        addMessage(result.message, "bot");
        log(`Rol establecido: ${text}`);
        saveProgress();
        
        // Generar primera pregunta
        log("Generando primera pregunta...");
        setTimeout(async () => {
          try {
            const firstQ = await callWorker('GENERAR_PREGUNTA');
            
            if (firstQ.type === 'question') {
              currentQuestion = {
                text: firstQ.question,
                options: firstQ.options,
                correctAnswer: firstQ.correctAnswer
              };
              
              log(`Primera pregunta generada: ${firstQ.question.substring(0, 50)}...`);
              
              addMessage(firstQ.question, "bot", {
                options: firstQ.options,
                progress: {
                  questionsAsked: 0,
                  correctAnswers: 0,
                  currentLevel: 'BÁSICO'
                }
              });
            }
          } catch (err) {
            log(`Error generando primera pregunta: ${err.message}`);
            addMessage("Error al generar la primera pregunta. Por favor, intenta de nuevo.", "bot");
          } finally {
            submitButton.disabled = false;
            isRequestInProgress = false;
          }
        }, 1000);
        return;
      }
    }

    // FASE 2: RESPONDER PREGUNTAS
    if (userState.phase === 'question') {
      text = text.toUpperCase();
      
      if (!/^[A-D]$/.test(text)) {
        log("Respuesta inválida, no es A-D");
        addMessage("Por favor, responde con A, B, C o D", "bot");
        userInput.value = "";
        submitButton.disabled = false;
        isRequestInProgress = false;
        return;
      }

      log(`FASE: Evaluar respuesta - ${text}`);
      
      const result = await callWorker(text);
      
      if (result.type === 'evaluation') {
        log(`Evaluación: correcto=${result.isCorrect}, preguntas=${result.questionsAsked}`);
        
        userState.questionsAsked = result.questionsAsked;
        userState.correctAnswers = result.correctAnswers;
        userState.incorrectAnswers = result.incorrectAnswers;
        userState.currentLevel = result.currentLevel;
        
        addMessage(result.feedback, "bot");
        saveProgress();
        
        // Si cambió de nivel o es momento de explicación
        if (result.levelChanged || result.questionsAsked % 5 === 0) {
          log(`Cambio de nivel o explicación requerida`);
          
          setTimeout(async () => {
            try {
              log("Generando explicación...");
              const explanation = await callWorker('GENERAR_EXPLICACION');
              
              if (explanation.type === 'explanation') {
                addMessage(explanation.content, "bot");
                log("Explicación mostrada");
              }
              
              // Generar siguiente pregunta
              setTimeout(async () => {
                try {
                  log("Generando siguiente pregunta...");
                  const nextQ = await callWorker('GENERAR_PREGUNTA');
                  
                  if (nextQ.type === 'question') {
                    currentQuestion = {
                      text: nextQ.question,
                      options: nextQ.options,
                      correctAnswer: nextQ.correctAnswer
                    };
                    
                    log(`Siguiente pregunta generada`);
                    
                    addMessage(nextQ.question, "bot", {
                      options: nextQ.options,
                      progress: {
                        questionsAsked: userState.questionsAsked,
                        correctAnswers: userState.correctAnswers,
                        currentLevel: userState.currentLevel
                      }
                    });
                  }
                } catch (err) {
                  log(`Error generando siguiente pregunta: ${err.message}`);
                  addMessage("Error al generar la siguiente pregunta.", "bot");
                } finally {
                  submitButton.disabled = false;
                  isRequestInProgress = false;
                }
              }, 1500);
            } catch (err) {
              log(`Error generando explicación: ${err.message}`);
              addMessage("Error al generar la explicación.", "bot");
              submitButton.disabled = false;
              isRequestInProgress = false;
            }
          }, 1500);
        } else {
          // Sin cambio de nivel, generar siguiente pregunta directamente
          log("Generando siguiente pregunta (sin cambio de nivel)...");
          
          setTimeout(async () => {
            try {
              const nextQ = await callWorker('GENERAR_PREGUNTA');
              
              if (nextQ.type === 'question') {
                currentQuestion = {
                  text: nextQ.question,
                  options: nextQ.options,
                  correctAnswer: nextQ.correctAnswer
                };
                
                log(`Siguiente pregunta generada`);
                
                addMessage(nextQ.question, "bot", {
                  options: nextQ.options,
                  progress: {
                    questionsAsked: userState.questionsAsked,
                    correctAnswers: userState.correctAnswers,
                    currentLevel: userState.currentLevel
                  }
                });
              }
            } catch (err) {
              log(`Error generando siguiente pregunta: ${err.message}`);
              addMessage("Error al generar la siguiente pregunta.", "bot");
            } finally {
              submitButton.disabled = false;
              isRequestInProgress = false;
            }
          }, 1000);
        }
        return;
      }
    }

  } catch (err) {
    log(`Error general: ${err.message}`);
    addMessage(`Error: ${err.message}`, "bot");
    submitButton.disabled = false;
    isRequestInProgress = false;
  }
});

log("Tutor PRL inicializado correctamente");
