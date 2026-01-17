// ===== CONFIGURACIÓN =====
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
const REQUEST_DELAY_MS = 1000;


// ===== VARIABLES GLOBALES =====
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");


// Historial de mensajes
const messages = [];


let userState = {
  questionsAsked: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  currentLevel: 'BÁSICO',
  phase: 'question', // 'question' o 'explanation'
  role: null,
  experience: null,
};


let isRequestInProgress = false;
let currentQuestion = null; // Pregunta actual para evaluar respuesta


// ===== FUNCIONES AUXILIARES =====


function addMessage(text, sender = "bot", metadata = {}) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  
  const formattedText = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  div.innerHTML = formattedText;
  
  // Añadir metadata si existe
  if (metadata.sources && metadata.sources.length > 0) {
    const sourcesDiv = document.createElement("div");
    sourcesDiv.classList.add("sources");
    sourcesDiv.innerHTML = "<strong>📚 Fuentes PRL:</strong><br>";
    metadata.sources.forEach((source, index) => {
      sourcesDiv.innerHTML += `${index + 1}. ${source.topic} - ${source.section}<br>`;
    });
    div.appendChild(sourcesDiv);
  }
  
  // Añadir progreso si existe
  if (metadata.progress) {
    const progressDiv = document.createElement("div");
    progressDiv.classList.add("progress-indicator");
    progressDiv.innerHTML = `
      <strong>📊 Progreso:</strong> 
      ${metadata.progress.correctAnswers}/${metadata.progress.questionsAsked} correctas | 
      Nivel: <span class="level-badge">${metadata.progress.currentLevel}</span>
    `;
    div.appendChild(progressDiv);
  }
  
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
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
  // Actualizar nivel basado en desempeño
  const totalAnswered = userState.correctAnswers + userState.incorrectAnswers;
  
  if (totalAnswered > 0) {
    const successRate = (userState.correctAnswers / totalAnswered) * 100;
    
    if (successRate >= 80 && userState.currentLevel === 'BÁSICO') {
      userState.currentLevel = 'MEDIO';
      addMessage("🎉 ¡Felicidades! Has subido a nivel MEDIO. Las preguntas serán más desafiantes.", "bot");
    } else if (successRate >= 80 && userState.currentLevel === 'MEDIO') {
      userState.currentLevel = 'AVANZADO';
      addMessage("🏆 ¡Excelente! Has alcanzado nivel AVANZADO. Prepárate para preguntas complejas.", "bot");
    } else if (successRate < 50 && userState.currentLevel === 'AVANZADO') {
      userState.currentLevel = 'MEDIO';
      addMessage("⚠️ Vamos a reducir la dificultad para consolidar conocimientos.", "bot");
    } else if (successRate < 50 && userState.currentLevel === 'MEDIO') {
      userState.currentLevel = 'BÁSICO';
      addMessage("ℹ️ Vamos a volver a nivel BÁSICO para reforzar fundamentos.", "bot");
    }
  }
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
  addMessage("Hola, soy tu tutor adaptativo de PRL. Vamos a trabajar con preguntas tipo test que se adaptarán a tu nivel de conocimiento. ¿Cuál es tu rol en la empresa? (comercial, back-office, IT, etc.)", "bot");
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
    console.log("Enviando solicitud al tutor adaptativo...");
    const result = await callWorker(text);
    
    if (result.type === 'evaluation') {
      // Procesar evaluación de respuesta
      userState.questionsAsked++;
      
      if (result.isCorrect) {
        userState.correctAnswers++;
        const feedback = `✅ ¡Correcto! ${result.feedback}`;
        addMessage(feedback, "bot", { sources: result.sources });
      } else {
        userState.incorrectAnswers++;
        const feedback = `❌ Incorrecto. ${result.feedback}\n\n**Respuesta correcta:** ${result.correctAnswer}\n\n**Justificación:** ${result.justification}`;
        addMessage(feedback, "bot", { sources: result.sources });
      }
      
      // Actualizar progreso
      updateProgress();
      
      // Mostrar siguiente pregunta
      setTimeout(() => {
        addMessage(result.nextQuestion, "bot", { 
          progress: {
            questionsAsked: userState.questionsAsked,
            correctAnswers: userState.correctAnswers,
            currentLevel: userState.currentLevel
          }
        });
        currentQuestion = result.nextQuestion;
      }, 1000);
      
    } else if (result.type === 'explanation') {
      // Procesar explicación
      addMessage(result.content, "bot", { sources: result.sources });
      
      // Después de la explicación, volver a preguntas
      userState.phase = 'question';
      
    } else if (result.type === 'text') {
      // Respuesta en texto plano
      addMessage(result.content, "bot", { sources: result.sources });
    }
    
    messages.push({ 
      role: "assistant", 
      content: result.content || result.nextQuestion || result.feedback,
      metadata: { sources: result.sources }
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


// Guardar progreso cada 15 segundos
setInterval(saveProgress, 15000);
