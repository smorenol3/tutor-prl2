// ============================================
// FRONTEND ADAPTATIVO - TUTOR INTELIGENTE
// Nivel automático + Explicaciones cada 5 preguntas
// ============================================

const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
let currentQuestion = null;
let currentLevel = "BÁSICO";
let questionsAnswered = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let answered = false;
let currentUser = null;
let failedQuestions = [];
let questionsInSession = 0; // Contador para cada 5 preguntas

// ============================================
// AUTENTICACIÓN
// ============================================

function toggleForms() {
  document.getElementById("login-form").style.display = 
    document.getElementById("login-form").style.display === "none" ? "block" : "none";
  document.getElementById("register-form").style.display = 
    document.getElementById("register-form").style.display === "none" ? "block" : "none";
}

async function handleRegister() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;
  const role = document.getElementById("register-role").value;

  if (!username || !password) {
    document.getElementById("register-error").textContent = "Usuario y contraseña requeridos";
    return;
  }

  try {
    const response = await fetch(`${WORKER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role })
    });

    const data = await response.json();

    if (!response.ok) {
      document.getElementById("register-error").textContent = data.error || "Error al registrar";
      return;
    }

    document.getElementById("register-success").textContent = "¡Cuenta creada! Ahora inicia sesión";
    document.getElementById("register-username").value = "";
    document.getElementById("register-password").value = "";
    document.getElementById("register-role").value = "";
    
    setTimeout(() => {
      toggleForms();
      document.getElementById("register-success").textContent = "";
    }, 2000);
  } catch (error) {
    document.getElementById("register-error").textContent = "Error: " + error.message;
  }
}

async function handleLogin() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    document.getElementById("login-error").textContent = "Usuario y contraseña requeridos";
    return;
  }

  try {
    const response = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      document.getElementById("login-error").textContent = data.error || "Credenciales inválidas";
      return;
    }

    currentUser = data.user;
    localStorage.setItem("tutor_user", JSON.stringify(currentUser));
    
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("quiz-screen").style.display = "block";
    document.getElementById("current-user").textContent = currentUser.username;
    
    await loadUserProgress();
    await determineLevel();
    loadQuestion();
  } catch (error) {
    document.getElementById("login-error").textContent = "Error: " + error.message;
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem("tutor_user");
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("quiz-screen").style.display = "none";
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("login-error").textContent = "";
}

// ============================================
// CARGAR PROGRESO DEL USUARIO
// ============================================

async function loadUserProgress() {
  if (!currentUser) return;

  try {
    const response = await fetch(`${WORKER_URL}/api/progress/${currentUser.id}`);
    const data = await response.json();

    if (data.success && data.stats) {
      questionsAnswered = 0;
      correctAnswers = 0;

      data.stats.forEach(stat => {
        questionsAnswered += stat.total;
        correctAnswers += stat.correct || 0;
      });

      wrongAnswers = questionsAnswered - correctAnswers;
      console.log("Progreso cargado:", { questionsAnswered, correctAnswers, wrongAnswers });
    }
  } catch (error) {
    console.error("Error cargando progreso:", error);
  }
}

// ============================================
// DETERMINAR NIVEL AUTOMÁTICAMENTE
// ============================================

async function determineLevel() {
  try {
    const response = await fetch(`${WORKER_URL}/api/progress/${currentUser.id}`);
    const data = await response.json();

    if (!data.success || !data.stats || data.stats.length === 0) {
      // Sin datos: comenzar en BÁSICO
      currentLevel = "BÁSICO";
      console.log("Sin datos previos. Comenzando en BÁSICO");
      return;
    }

    // Buscar el nivel más alto donde tiene ≥80% de aciertos
    let newLevel = "BÁSICO";
    
    // Verificar AVANZADO
    const avanzado = data.stats.find(s => s.level === "AVANZADO");
    if (avanzado && avanzado.correct / avanzado.total >= 0.80) {
      newLevel = "AVANZADO";
    } 
    // Verificar MEDIO
    else {
      const medio = data.stats.find(s => s.level === "MEDIO");
      if (medio && medio.correct / medio.total >= 0.80) {
        newLevel = "MEDIO";
      }
      // Si no, quedarse en BÁSICO
      else {
        newLevel = "BÁSICO";
      }
    }

    currentLevel = newLevel;
    console.log(`Nivel determinado automáticamente: ${currentLevel}`);
  } catch (error) {
    console.error("Error determinando nivel:", error);
    currentLevel = "BÁSICO";
  }
}

// ============================================
// CARGAR PREGUNTA
// ============================================

async function loadQuestion() {
  try {
    console.log(`Cargando pregunta de nivel: ${currentLevel}`);
    
    const response = await fetch(`${WORKER_URL}/api/questions/random?level=${currentLevel}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    currentQuestion = await response.json();
    answered = false;
    console.log("Pregunta cargada:", currentQuestion);
    
    displayQuestion();
  } catch (error) {
    console.error("Error cargando pregunta:", error);
    document.getElementById("question-container").innerHTML = `
      <div style="color: red; padding: 20px; background: #ffe0e0; border-radius: 5px;">
        ❌ Error: No se pudo cargar la pregunta. ${error.message}
      </div>
    `;
  }
}

// ============================================
// MOSTRAR PREGUNTA
// ============================================

function displayQuestion() {
  if (!currentQuestion) return;

  const container = document.getElementById("question-container");
  const percentage = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;
  
  let html = `
    <div style="padding: 20px; background: #f5f5f5; border-radius: 8px;">
      <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 5px; font-size: 13px; color: #666;">
        <strong>Progreso:</strong> ${questionsAnswered} preguntas | 
        <span style="color: #28a745;">✓ ${correctAnswers}</span> | 
        <span style="color: #dc3545;">✗ ${wrongAnswers}</span> | 
        <strong>${percentage}%</strong> correcto
      </div>
      
      <div style="margin-bottom: 10px; color: #666; font-size: 14px;">
        Nivel: <strong>${currentLevel}</strong> | Pregunta ID: ${currentQuestion.id}
      </div>
      
      <h2 style="margin: 20px 0; font-size: 18px; color: #333;">
        ${currentQuestion.question}
      </h2>
      
      <div style="margin: 20px 0;" id="options-container">
  `;

  // Mostrar opciones
  currentQuestion.options.forEach((option, index) => {
    const letter = option.charAt(0);
    
    let buttonStyle = `
      display: block;
      width: 100%;
      padding: 12px;
      margin: 10px 0;
      text-align: left;
      background: white;
      border: 2px solid #ddd;
      border-radius: 5px;
      cursor: ${answered ? 'default' : 'pointer'};
      font-size: 16px;
      transition: all 0.2s;
      opacity: ${answered ? 0.7 : 1};
    `;

    html += `
      <button 
        id="option-${letter}"
        onclick="selectAnswer('${letter}')"
        ${answered ? 'disabled' : ''}
        style="${buttonStyle}"
        onmouseover="${answered ? '' : "this.style.background='#f0f0f0'; this.style.borderColor='#999';"}"
        onmouseout="${answered ? '' : "this.style.background='white'; this.style.borderColor='#ddd';"}"
      >
        ${option}
      </button>
    `;
  });

  html += `
      </div>
      
      <div id="feedback-container" style="display: none; margin: 15px 0; padding: 15px; border-radius: 5px; font-size: 14px;">
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
        <button 
          onclick="loadQuestion()"
          id="next-button"
          style="
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            display: none;
          "
        >
          ↻ Siguiente pregunta
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ============================================
// SELECCIONAR RESPUESTA
// ============================================

async function selectAnswer(letter) {
  if (answered) return;
  
  answered = true;
  const isCorrect = letter === currentQuestion.correctAnswer;
  
  // Marcar la opción seleccionada
  const selectedButton = document.getElementById(`option-${letter}`);
  const correctButton = document.getElementById(`option-${currentQuestion.correctAnswer}`);
  
  if (isCorrect) {
    selectedButton.style.background = "#d4edda";
    selectedButton.style.borderColor = "#28a745";
  } else {
    selectedButton.style.background = "#f8d7da";
    selectedButton.style.borderColor = "#dc3545";
    correctButton.style.background = "#d4edda";
    correctButton.style.borderColor = "#28a745";
  }
  
  // Actualizar estadísticas
  questionsAnswered++;
  questionsInSession++;
  
  if (isCorrect) {
    correctAnswers++;
  } else {
    wrongAnswers++;
    failedQuestions.push({
      id: currentQuestion.id,
      question: currentQuestion.question,
      topic: extractTopic(currentQuestion.question)
    });
  }

  // Guardar en BD
  try {
    await fetch(`${WORKER_URL}/api/progress/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        questionId: currentQuestion.id,
        answer: letter,
        isCorrect: isCorrect,
        level: currentQuestion.level
      })
    });
  } catch (error) {
    console.error("Error guardando progreso:", error);
  }

  // Mostrar feedback discreto
  const feedbackContainer = document.getElementById("feedback-container");
  feedbackContainer.style.display = "block";
  
  if (isCorrect) {
    feedbackContainer.style.background = "#d4edda";
    feedbackContainer.style.color = "#155724";
    feedbackContainer.style.borderLeft = "4px solid #28a745";
    feedbackContainer.innerHTML = `
      <strong>✅ ¡Correcto!</strong><br>
      ${currentQuestion.explanation}
    `;
  } else {
    feedbackContainer.style.background = "#f8d7da";
    feedbackContainer.style.color = "#721c24";
    feedbackContainer.style.borderLeft = "4px solid #dc3545";
    feedbackContainer.innerHTML = `
      <strong>❌ Incorrecto</strong><br>
      <strong>Respuesta correcta:</strong> ${currentQuestion.correctAnswer}<br><br>
      ${currentQuestion.explanation}
    `;
  }

  // Mostrar botón siguiente
  document.getElementById("next-button").style.display = "inline-block";

  // Deshabilitar todas las opciones
  document.querySelectorAll("#options-container button").forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = "default";
  });

  // Cada 5 preguntas: mostrar explicación teórica
  if (questionsInSession % 5 === 0) {
    setTimeout(() => {
      showTheoreticalExplanation();
    }, 2000);
  }
}

// ============================================
// EXTRAER TEMA DE LA PREGUNTA
// ============================================

function extractTopic(question) {
  // Palabras clave para identificar temas
  const keywords = {
    "EPP": "Equipos de Protección Personal",
    "riesgo": "Evaluación de Riesgos",
    "accidente": "Prevención de Accidentes",
    "emergencia": "Planes de Emergencia",
    "salud": "Vigilancia de la Salud",
    "ergonomía": "Ergonomía",
    "ruido": "Contaminación Acústica",
    "químico": "Riesgos Químicos",
    "biológico": "Riesgos Biológicos",
    "capacitación": "Capacitación y Formación",
    "auditoría": "Auditorías de Seguridad",
    "incidente": "Gestión de Incidentes"
  };

  for (const [key, topic] of Object.entries(keywords)) {
    if (question.toLowerCase().includes(key.toLowerCase())) {
      return topic;
    }
  }

  return "Prevención de Riesgos Laborales";
}

// ============================================
// MOSTRAR EXPLICACIÓN TEÓRICA (CADA 5 PREGUNTAS)
// ============================================

async function showTheoreticalExplanation() {
  if (failedQuestions.length === 0) {
    console.log("Sin preguntas fallidas en este ciclo");
    return;
  }

  // Mostrar modal con explicación
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 10px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  `;

  // Obtener temas fallidos
  const failedTopics = [...new Set(failedQuestions.map(q => q.topic))];
  
  content.innerHTML = `
    <h2 style="color: #333; margin-bottom: 20px;">📚 Explicación Teórica - Refuerzo</h2>
    <p style="color: #666; margin-bottom: 15px;">
      Has completado 5 preguntas. Aquí está la explicación teórica de los temas donde fallaste:
    </p>
    
    <div id="explanation-content" style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; color: #333;">
      <p>Cargando explicación...</p>
    </div>
    
    <button onclick="this.parentElement.parentElement.remove()" style="
      width: 100%;
      padding: 12px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    ">
      Continuar
    </button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Generar explicación con LLM
  try {
    const explanation = await generateLLMExplanation(failedTopics);
    document.getElementById("explanation-content").innerHTML = explanation;
  } catch (error) {
    document.getElementById("explanation-content").innerHTML = `
      <p style="color: #dc3545;">Error al generar explicación: ${error.message}</p>
    `;
  }

  // Limpiar preguntas fallidas después de mostrar
  failedQuestions = [];
}

// ============================================
// GENERAR EXPLICACIÓN CON LLM
// ============================================

async function generateLLMExplanation(topics) {
  try {
    const response = await fetch(`${WORKER_URL}/api/llm/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topics: topics,
        level: currentLevel
      })
    });

    if (!response.ok) {
      throw new Error("Error en LLM");
    }

    const data = await response.json();
    return data.explanation || "No se pudo generar la explicación";
  } catch (error) {
    console.error("Error con LLM:", error);
    return `
      <p><strong>Temas a reforzar:</strong></p>
      <ul>
        ${topics.map(t => `<li>${t}</li>`).join("")}
      </ul>
      <p>Por favor, revisa estos temas en los materiales de estudio.</p>
    `;
  }
}

// ============================================
// INICIALIZAR
// ============================================

window.addEventListener("DOMContentLoaded", () => {
  console.log("Página cargada");
  
  const saved = localStorage.getItem("tutor_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("quiz-screen").style.display = "block";
    document.getElementById("current-user").textContent = currentUser.username;
    loadUserProgress().then(() => {
      determineLevel().then(() => {
        loadQuestion();
      });
    });
  }
});
