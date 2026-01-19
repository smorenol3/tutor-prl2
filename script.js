// ============================================
// FRONTEND ADAPTATIVO CORREGIDO
// Nivel automático + Explicaciones LLM cada 5 preguntas
// ============================================

// CONFIGURACIÓN
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
let currentQuestion = null;
let currentLevel = "BÁSICO";
let currentUser = null;

// Estadísticas por nivel (separadas)
let levelStats = {
  "BÁSICO": { total: 0, correct: 0 },
  "MEDIO": { total: 0, correct: 0 },
  "AVANZADO": { total: 0, correct: 0 }
};

// Preguntas fallidas en la sesión actual
let failedQuestionsSession = [];

// Preguntas ya respondidas (para no repetir)
let answeredQuestions = [];

// Contador de preguntas desde última explicación
let questionsSinceExplanation = 0;

// Estado
let answered = false;

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
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();
  
  if (!username || !password) {
    showError("Por favor, completa todos los campos");
    return;
  }
  
  try {
    const response = await fetch(`${WORKER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role: "student" })
    });
    
    const data = await response.json();
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    // Auto-login después de registro
    currentUser = { id: data.userId, username: data.username };
    localStorage.setItem("tutor_user", JSON.stringify(currentUser));
    
    showQuizScreen();
  } catch (error) {
    console.error("Error en registro:", error);
    showError("Error de conexión");
  }
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  
  if (!username || !password) {
    showError("Por favor, completa todos los campos");
    return;
  }
  
  try {
    const response = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    currentUser = { id: data.userId, username: data.username };
    localStorage.setItem("tutor_user", JSON.stringify(currentUser));
    
    showQuizScreen();
  } catch (error) {
    console.error("Error en login:", error);
    showError("Error de conexión");
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("tutor_user");
  
  // Resetear estadísticas
  levelStats = {
    "BÁSICO": { total: 0, correct: 0 },
    "MEDIO": { total: 0, correct: 0 },
    "AVANZADO": { total: 0, correct: 0 }
  };
  failedQuestionsSession = [];
  answeredQuestions = [];
  questionsSinceExplanation = 0;
  
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("quiz-screen").style.display = "none";
}

function showError(message) {
  alert(message);
}

// ============================================
// PANTALLA DE QUIZ
// ============================================

async function showQuizScreen() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("quiz-screen").style.display = "block";
  document.getElementById("current-user").textContent = currentUser.username;
  
  // Cargar progreso del usuario desde BD
  await loadUserProgress();
  
  // Determinar nivel inicial
  await determineUserLevel();
  
  // Cargar primera pregunta
  loadQuestion();
}

async function loadUserProgress() {
  try {
    const response = await fetch(`${WORKER_URL}/api/progress?userId=${currentUser.id}`);
    const data = await response.json();
    
    if (data.stats) {
      // Cargar estadísticas por nivel desde BD
      data.stats.forEach(stat => {
        if (levelStats[stat.level]) {
          levelStats[stat.level].total = stat.total;
          levelStats[stat.level].correct = stat.correct;
        }
      });
    }
    
    if (data.failedQuestions) {
      // Cargar preguntas fallidas
      failedQuestionsSession = data.failedQuestions.map(q => q.question_id);
    }
    
    updateProgressDisplay();
  } catch (error) {
    console.error("Error cargando progreso:", error);
  }
}

async function determineUserLevel() {
  try {
    const response = await fetch(`${WORKER_URL}/api/user/level?userId=${currentUser.id}`);
    const data = await response.json();
    
    if (data.level) {
      currentLevel = data.level;
      console.log(`Nivel determinado: ${currentLevel}`);
    }
  } catch (error) {
    console.error("Error determinando nivel:", error);
    currentLevel = "BÁSICO";
  }
}

// ============================================
// CARGAR PREGUNTA
// ============================================

async function loadQuestion() {
  answered = false;
  
  try {
    // Excluir preguntas ya respondidas en esta sesión
    const excludeIds = answeredQuestions.join(",");
    
    const response = await fetch(
      `${WORKER_URL}/api/questions/random?level=${currentLevel}&exclude=${excludeIds}`
    );
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    currentQuestion = await response.json();
    console.log("Pregunta cargada:", currentQuestion);
    
    displayQuestion();
  } catch (error) {
    console.error("Error cargando pregunta:", error);
    document.getElementById("question-container").innerHTML = `
      <div style="color: red; padding: 20px; background: #ffe0e0; border-radius: 8px;">
        <strong>Error cargando pregunta</strong><br>
        ${error.message}
      </div>
    `;
  }
}

// ============================================
// MOSTRAR PREGUNTA
// ============================================

function displayQuestion() {
  const container = document.getElementById("question-container");
  
  const levelColor = {
    "BÁSICO": "#28a745",
    "MEDIO": "#ffc107", 
    "AVANZADO": "#dc3545"
  };
  
  let html = `
    <div style="margin-bottom: 15px;">
      <span style="
        background: ${levelColor[currentLevel]};
        color: ${currentLevel === 'MEDIO' ? 'black' : 'white'};
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
      ">
        Nivel: ${currentLevel}
      </span>
      <span style="color: #666; margin-left: 10px; font-size: 14px;">
        Pregunta ID: ${currentQuestion.id}
      </span>
    </div>
    
    <h3 style="margin-bottom: 20px; color: #333; line-height: 1.5;">
      ${currentQuestion.question}
    </h3>
    
    <div id="options-container">
  `;
  
  const options = ["A", "B", "C", "D"];
  options.forEach(letter => {
    html += `
      <button 
        id="option-${letter}"
        onclick="selectAnswer('${letter}')"
        style="
          display: block;
          width: 100%;
          padding: 15px 20px;
          margin-bottom: 10px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          text-align: left;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        "
        onmouseover="if(!${answered}) this.style.borderColor='#667eea'"
        onmouseout="if(!${answered}) this.style.borderColor='#e0e0e0'"
      >
        <strong>${letter})</strong> ${currentQuestion.options[letter]}
      </button>
    `;
  });
  
  html += `
    </div>
    
    <div id="feedback-container" style="display: none; margin-top: 20px;"></div>
    
    <div id="next-button-container" style="display: none; margin-top: 20px; text-align: center;">
      <button 
        onclick="handleNextQuestion()"
        style="
          padding: 12px 30px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        "
      >
        Siguiente pregunta →
      </button>
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
  
  // Actualizar estadísticas del nivel actual
  levelStats[currentLevel].total++;
  if (isCorrect) {
    levelStats[currentLevel].correct++;
  } else {
    // Guardar pregunta fallida
    if (!failedQuestionsSession.includes(currentQuestion.id)) {
      failedQuestionsSession.push(currentQuestion.id);
    }
  }
  
  // Marcar pregunta como respondida
  if (!answeredQuestions.includes(currentQuestion.id)) {
    answeredQuestions.push(currentQuestion.id);
  }
  
  // Incrementar contador
  questionsSinceExplanation++;
  
  // Actualizar display
  updateProgressDisplay();
  
  // Guardar en BD
  try {
    await fetch(`${WORKER_URL}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        questionId: currentQuestion.id,
        answer: letter,
        isCorrect: isCorrect,
        level: currentLevel
      })
    });
  } catch (error) {
    console.error("Error guardando progreso:", error);
  }
  
  // Mostrar feedback visual
  showFeedback(letter, isCorrect);
  
  // Deshabilitar opciones
  disableOptions();
  
  // Mostrar botón siguiente
  document.getElementById("next-button-container").style.display = "block";
}

function showFeedback(selectedLetter, isCorrect) {
  const options = ["A", "B", "C", "D"];
  
  options.forEach(letter => {
    const btn = document.getElementById(`option-${letter}`);
    if (!btn) return;
    
    if (letter === currentQuestion.correctAnswer) {
      // Respuesta correcta - verde
      btn.style.borderColor = "#28a745";
      btn.style.background = "#d4edda";
    } else if (letter === selectedLetter && !isCorrect) {
      // Respuesta incorrecta seleccionada - rojo
      btn.style.borderColor = "#dc3545";
      btn.style.background = "#f8d7da";
    }
  });
  
  // Mostrar explicación
  const feedbackContainer = document.getElementById("feedback-container");
  feedbackContainer.style.display = "block";
  feedbackContainer.innerHTML = `
    <div style="
      padding: 20px;
      border-radius: 8px;
      background: ${isCorrect ? '#d4edda' : '#f8d7da'};
      border: 1px solid ${isCorrect ? '#28a745' : '#dc3545'};
    ">
      <strong style="color: ${isCorrect ? '#155724' : '#721c24'};">
        ${isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto'}
      </strong>
      <p style="margin-top: 10px; color: #333;">
        ${currentQuestion.explanation}
      </p>
    </div>
  `;
}

function disableOptions() {
  const options = ["A", "B", "C", "D"];
  options.forEach(letter => {
    const btn = document.getElementById(`option-${letter}`);
    if (btn) {
      btn.style.cursor = "default";
      btn.onclick = null;
    }
  });
}

// ============================================
// SIGUIENTE PREGUNTA
// ============================================

async function handleNextQuestion() {
  // Verificar si toca explicación (cada 5 preguntas)
  if (questionsSinceExplanation >= 5) {
    await showExplanationModal();
    questionsSinceExplanation = 0;
    
    // Verificar cambio de nivel después de la explicación
    await checkLevelChange();
  }
  
  loadQuestion();
}

// ============================================
// CAMBIO DE NIVEL AUTOMÁTICO
// ============================================

async function checkLevelChange() {
  const stats = levelStats[currentLevel];
  
  if (stats.total < 5) {
    console.log(`Nivel ${currentLevel}: Solo ${stats.total} preguntas, necesitas al menos 5`);
    return;
  }
  
  const percentage = (stats.correct / stats.total) * 100;
  console.log(`Nivel ${currentLevel}: ${percentage.toFixed(1)}% (${stats.correct}/${stats.total})`);
  
  if (percentage >= 80) {
    // Subir de nivel
    if (currentLevel === "BÁSICO") {
      currentLevel = "MEDIO";
      showLevelUpNotification("MEDIO");
    } else if (currentLevel === "MEDIO") {
      currentLevel = "AVANZADO";
      showLevelUpNotification("AVANZADO");
    }
    
    // Resetear estadísticas del nuevo nivel
    levelStats[currentLevel] = { total: 0, correct: 0 };
    
    // Limpiar preguntas fallidas de la sesión
    failedQuestionsSession = [];
    answeredQuestions = [];
  }
}

function showLevelUpNotification(newLevel) {
  const modal = document.createElement("div");
  modal.id = "level-up-modal";
  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    ">
      <div style="
        background: white;
        padding: 40px;
        border-radius: 16px;
        max-width: 400px;
        text-align: center;
        animation: scaleIn 0.3s ease;
      ">
        <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
        <h2 style="color: #333; margin-bottom: 15px;">¡Felicidades!</h2>
        <p style="color: #666; margin-bottom: 20px;">
          Has alcanzado el <strong>80%</strong> de aciertos.<br>
          Subes al nivel <strong style="color: #667eea;">${newLevel}</strong>
        </p>
        <button 
          onclick="document.getElementById('level-up-modal').remove()"
          style="
            padding: 12px 30px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          "
        >
          ¡Continuar!
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ============================================
// MODAL DE EXPLICACIÓN TEÓRICA
// ============================================

async function showExplanationModal() {
  // Mostrar modal de carga
  const modal = document.createElement("div");
  modal.id = "explanation-modal";
  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    ">
      <div style="
        background: white;
        padding: 30px;
        border-radius: 16px;
        max-width: 700px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <h2 style="color: #333; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
          📚 Resumen de tu progreso
        </h2>
        
        <div id="explanation-content" style="color: #333;">
          <div style="text-align: center; padding: 40px;">
            <div class="spinner" style="
              border: 4px solid #f3f3f3;
              border-top: 4px solid #667eea;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            "></div>
            <p>Generando explicación personalizada...</p>
          </div>
        </div>
        
        <div id="close-button-container" style="display: none; text-align: center; margin-top: 20px;">
          <button 
            onclick="document.getElementById('explanation-modal').remove()"
            style="
              padding: 12px 30px;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
            "
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Obtener explicación del LLM
  try {
    const stats = levelStats[currentLevel];
    const percentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
    
    let explanationHtml = `
      <div style="
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      ">
        <h3 style="margin-bottom: 10px;">📊 Estadísticas del nivel ${currentLevel}</h3>
        <p>Preguntas respondidas: <strong>${stats.total}</strong></p>
        <p>Correctas: <strong style="color: #28a745;">${stats.correct}</strong></p>
        <p>Incorrectas: <strong style="color: #dc3545;">${stats.total - stats.correct}</strong></p>
        <p>Porcentaje de acierto: <strong>${percentage}%</strong></p>
        ${percentage >= 80 ? '<p style="color: #28a745; font-weight: bold;">✅ ¡Listo para subir de nivel!</p>' : '<p style="color: #666;">Necesitas 80% para subir de nivel</p>'}
      </div>
    `;
    
    if (failedQuestionsSession.length > 0) {
      // Llamar al LLM para explicación
      const response = await fetch(`${WORKER_URL}/api/llm/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failedQuestions: failedQuestionsSession.slice(-10) // Últimas 10 fallidas
        })
      });
      
      const data = await response.json();
      
      explanationHtml += `
        <div style="
          background: #fff3cd;
          border: 1px solid #ffc107;
          padding: 20px;
          border-radius: 8px;
        ">
          <h3 style="margin-bottom: 15px; color: #856404;">📖 Explicación teórica</h3>
          <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">
            ${formatExplanation(data.explanation)}
          </div>
        </div>
      `;
    } else {
      explanationHtml += `
        <div style="
          background: #d4edda;
          border: 1px solid #28a745;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        ">
          <h3 style="color: #155724;">🎉 ¡Excelente trabajo!</h3>
          <p style="color: #155724;">No has fallado ninguna pregunta en las últimas 5. ¡Sigue así!</p>
        </div>
      `;
    }
    
    document.getElementById("explanation-content").innerHTML = explanationHtml;
    document.getElementById("close-button-container").style.display = "block";
    
  } catch (error) {
    console.error("Error obteniendo explicación:", error);
    document.getElementById("explanation-content").innerHTML = `
      <div style="color: red; padding: 20px;">
        Error al generar la explicación. Por favor, continúa con las preguntas.
      </div>
    `;
    document.getElementById("close-button-container").style.display = "block";
  }
}

function formatExplanation(text) {
  // Convertir markdown básico a HTML
  return text
    .replace(/## (.*)/g, '<h3 style="margin-top: 15px; margin-bottom: 10px;">$1</h3>')
    .replace(/### (.*)/g, '<h4 style="margin-top: 12px; margin-bottom: 8px;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/- (.*)/g, '<li style="margin-left: 20px;">$1</li>')
    .replace(/\n/g, '<br>');
}

// ============================================
// ACTUALIZAR DISPLAY DE PROGRESO
// ============================================

function updateProgressDisplay() {
  const stats = levelStats[currentLevel];
  const percentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : 0;
  
  const progressHtml = `
    <div style="
      background: #f8f9fa;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <strong>Nivel ${currentLevel}:</strong> 
          ${stats.total} preguntas | 
          <span style="color: #28a745;">✓ ${stats.correct}</span> | 
          <span style="color: #dc3545;">✗ ${stats.total - stats.correct}</span> | 
          <strong>${percentage}%</strong>
        </div>
        <div style="
          background: ${percentage >= 80 ? '#28a745' : '#667eea'};
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 12px;
        ">
          ${percentage >= 80 ? '✓ Listo para subir' : `Faltan ${Math.max(0, 80 - percentage)}% para subir`}
        </div>
      </div>
      
      <div style="
        margin-top: 10px;
        background: #e0e0e0;
        border-radius: 10px;
        height: 10px;
        overflow: hidden;
      ">
        <div style="
          width: ${Math.min(percentage, 100)}%;
          height: 100%;
          background: ${percentage >= 80 ? '#28a745' : '#667eea'};
          transition: width 0.3s ease;
        "></div>
      </div>
    </div>
  `;
  
  document.getElementById("progress-display").innerHTML = progressHtml;
}

// ============================================
// INICIALIZAR
// ============================================

window.addEventListener("DOMContentLoaded", () => {
  console.log("Página cargada");
  
  // Verificar si hay usuario guardado
  const saved = localStorage.getItem("tutor_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    showQuizScreen();
  }
});

// CSS para animación del spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes scaleIn {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(style);
