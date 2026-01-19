// ============================================
// FRONTEND ADAPTATIVO V2 - CORREGIDO
// Limpia correctamente las preguntas fallidas
// ============================================

// CONFIGURACIÓN
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
let currentQuestion = null;
let currentLevel = "BÁSICO";
let currentUser = null;

// Estadísticas por nivel (se resetean al cambiar de nivel)
let levelStats = {
  "BÁSICO": { total: 0, correct: 0 },
  "MEDIO": { total: 0, correct: 0 },
  "AVANZADO": { total: 0, correct: 0 }
};

// Preguntas fallidas en el bloque actual (últimas 5)
let currentBlockFailed = [];
let questionsInCurrentBlock = 0;
let answered = false;
let answeredQuestionIds = [];

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
    alert("Por favor, completa todos los campos");
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
      alert("Error: " + data.error);
      return;
    }
    
    alert("¡Cuenta creada! Ahora puedes iniciar sesión.");
    toggleForms();
  } catch (error) {
    alert("Error de conexión: " + error.message);
  }
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  
  if (!username || !password) {
    alert("Por favor, completa todos los campos");
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
      alert("Error: " + data.error);
      return;
    }
    
    currentUser = data;
    localStorage.setItem("tutor_user", JSON.stringify(data));
    
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("quiz-screen").style.display = "block";
    document.getElementById("current-user").textContent = currentUser.username;
    
    // Cargar nivel y progreso del usuario
    await loadUserLevel();
    loadQuestion();
  } catch (error) {
    alert("Error de conexión: " + error.message);
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
  currentBlockFailed = [];
  questionsInCurrentBlock = 0;
  answeredQuestionIds = [];
  
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("quiz-screen").style.display = "none";
}

// ============================================
// CARGAR NIVEL DEL USUARIO
// ============================================

async function loadUserLevel() {
  try {
    const response = await fetch(`${WORKER_URL}/api/user/level?userId=${currentUser.userId}`);
    const data = await response.json();
    
    currentLevel = data.level || "BÁSICO";
    
    // Cargar estadísticas históricas
    if (data.stats) {
      data.stats.forEach(stat => {
        if (levelStats[stat.level]) {
          levelStats[stat.level].total = stat.total;
          levelStats[stat.level].correct = stat.correct;
        }
      });
    }
    
    console.log(`Nivel actual: ${currentLevel}`);
    console.log("Estadísticas:", levelStats);
  } catch (error) {
    console.error("Error cargando nivel:", error);
    currentLevel = "BÁSICO";
  }
}

// ============================================
// CARGAR PREGUNTA
// ============================================

async function loadQuestion() {
  try {
    const container = document.getElementById("question-container");
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Cargando pregunta...</p>
      </div>
    `;
    
    // Excluir preguntas ya respondidas en esta sesión
    const excludeIds = answeredQuestionIds.join(",");
    const response = await fetch(`${WORKER_URL}/api/questions/random?level=${currentLevel}&exclude=${excludeIds}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    currentQuestion = await response.json();
    answered = false;
    
    displayQuestion();
    updateProgressDisplay();
  } catch (error) {
    console.error("Error cargando pregunta:", error);
    document.getElementById("question-container").innerHTML = `
      <div style="color: red; padding: 20px; background: #ffe0e0; border-radius: 8px;">
        <strong>Error:</strong> ${error.message}
        <br><br>
        <button onclick="loadQuestion()" style="padding: 10px 20px; cursor: pointer;">Reintentar</button>
      </div>
    `;
  }
}

// ============================================
// MOSTRAR PREGUNTA
// ============================================

function displayQuestion() {
  const container = document.getElementById("question-container");
  
  const html = `
    <div class="question-card">
      <div class="question-header">
        <span class="level-badge level-${currentLevel.toLowerCase()}">${currentLevel}</span>
        <span class="question-id">Pregunta #${currentQuestion.id}</span>
      </div>
      
      <h2 class="question-text">${currentQuestion.question}</h2>
      
      <div class="options-container" id="options-container">
        ${Object.entries(currentQuestion.options).map(([letter, text]) => `
          <button class="option-btn" id="option-${letter}" onclick="selectAnswer('${letter}')">
            <span class="option-letter">${letter}</span>
            <span class="option-text">${text}</span>
          </button>
        `).join("")}
      </div>
      
      <div id="feedback-container" style="display: none;"></div>
      
      <div id="next-btn-container" style="display: none; margin-top: 20px; text-align: center;">
        <button class="btn-next" onclick="loadQuestion()">Siguiente pregunta →</button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// ============================================
// ACTUALIZAR DISPLAY DE PROGRESO
// ============================================

function updateProgressDisplay() {
  const stats = levelStats[currentLevel];
  const percentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
  
  const progressHtml = `
    <div class="progress-card">
      <div class="progress-header">
        <span class="progress-title">📊 Progreso en nivel ${currentLevel}</span>
      </div>
      <div class="progress-stats">
        <div class="stat">
          <span class="stat-value">${stats.total}</span>
          <span class="stat-label">Respondidas</span>
        </div>
        <div class="stat correct">
          <span class="stat-value">${stats.correct}</span>
          <span class="stat-label">Correctas</span>
        </div>
        <div class="stat wrong">
          <span class="stat-value">${stats.total - stats.correct}</span>
          <span class="stat-label">Incorrectas</span>
        </div>
        <div class="stat percentage">
          <span class="stat-value">${percentage}%</span>
          <span class="stat-label">Acierto</span>
        </div>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
      <p class="progress-hint">Necesitas 80% de acierto para subir de nivel</p>
    </div>
  `;
  
  document.getElementById("progress-display").innerHTML = progressHtml;
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
    // Guardar pregunta fallida para este bloque
    currentBlockFailed.push(currentQuestion.id);
  }
  
  // Incrementar contador del bloque
  questionsInCurrentBlock++;
  
  // Agregar a preguntas respondidas
  answeredQuestionIds.push(currentQuestion.id);
  
  // Deshabilitar opciones
  document.querySelectorAll(".option-btn").forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = "default";
  });
  
  // Marcar respuesta correcta e incorrecta
  const selectedBtn = document.getElementById(`option-${letter}`);
  const correctBtn = document.getElementById(`option-${currentQuestion.correctAnswer}`);
  
  if (isCorrect) {
    selectedBtn.classList.add("correct");
  } else {
    selectedBtn.classList.add("wrong");
    correctBtn.classList.add("correct");
  }
  
  // Mostrar feedback
  const feedbackContainer = document.getElementById("feedback-container");
  feedbackContainer.style.display = "block";
  feedbackContainer.innerHTML = `
    <div class="feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}">
      <div class="feedback-icon">${isCorrect ? '✅' : '❌'}</div>
      <div class="feedback-text">
        <strong>${isCorrect ? '¡Correcto!' : 'Incorrecto'}</strong>
        <p>${currentQuestion.explanation}</p>
      </div>
    </div>
  `;
  
  // Mostrar botón siguiente
  document.getElementById("next-btn-container").style.display = "block";
  
  // Guardar progreso en BD
  try {
    await fetch(`${WORKER_URL}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.userId,
        questionId: currentQuestion.id,
        answer: letter,
        isCorrect: isCorrect,
        level: currentLevel
      })
    });
  } catch (error) {
    console.error("Error guardando progreso:", error);
  }
  
  // Actualizar display
  updateProgressDisplay();
  
  // Verificar si completamos un bloque de 5 preguntas
  if (questionsInCurrentBlock >= 5) {
    // Esperar un momento y mostrar resumen
    setTimeout(() => {
      showBlockSummary();
    }, 1500);
  }
}

// ============================================
// MOSTRAR RESUMEN DEL BLOQUE
// ============================================

async function showBlockSummary() {
  const stats = levelStats[currentLevel];
  const percentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
  
  // Crear modal
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "summary-modal";
  
  let levelChangeMessage = "";
  let newLevel = currentLevel;
  
  // Verificar si sube de nivel
  if (parseFloat(percentage) >= 80 && stats.total >= 5) {
    if (currentLevel === "BÁSICO") {
      newLevel = "MEDIO";
      levelChangeMessage = `<div class="level-up-message">🎉 ¡Felicidades! Has alcanzado el 80% de aciertos. ¡Subes al nivel MEDIO!</div>`;
    } else if (currentLevel === "MEDIO") {
      newLevel = "AVANZADO";
      levelChangeMessage = `<div class="level-up-message">🎉 ¡Excelente! Has alcanzado el 80% de aciertos. ¡Subes al nivel AVANZADO!</div>`;
    } else {
      levelChangeMessage = `<div class="level-up-message">🏆 ¡Increíble! Estás dominando el nivel AVANZADO. ¡Sigue así!</div>`;
    }
  }
  
  // Obtener explicación del LLM solo si hay preguntas fallidas
  let explanationHtml = "";
  
  if (currentBlockFailed.length > 0) {
    explanationHtml = `
      <div class="explanation-section">
        <h3>📖 Explicación teórica</h3>
        <div class="explanation-loading">
          <div class="spinner"></div>
          <p>Generando explicación personalizada...</p>
        </div>
      </div>
    `;
  } else {
    explanationHtml = `
      <div class="explanation-section success">
        <h3>📖 ¡Excelente trabajo!</h3>
        <p>No has fallado ninguna pregunta en este bloque. ¡Sigue así!</p>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div class="modal-content">
      <h2>📊 Resumen de tu progreso</h2>
      
      ${levelChangeMessage}
      
      <div class="summary-stats">
        <h3>📈 Estadísticas del nivel ${currentLevel}</h3>
        <p>Preguntas respondidas: <strong>${stats.total}</strong></p>
        <p>Correctas: <strong style="color: #28a745;">${stats.correct}</strong></p>
        <p>Incorrectas: <strong style="color: #dc3545;">${stats.total - stats.correct}</strong></p>
        <p>Porcentaje de acierto: <strong>${percentage}%</strong></p>
        <p class="hint">Necesitas 80% para subir de nivel</p>
      </div>
      
      ${explanationHtml}
      
      <button class="btn-continue" onclick="closeSummaryAndContinue('${newLevel}')">Continuar</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Si hay preguntas fallidas, obtener explicación del LLM
  if (currentBlockFailed.length > 0) {
    try {
      console.log("Solicitando explicación para preguntas:", currentBlockFailed);
      
      const response = await fetch(`${WORKER_URL}/api/llm/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failedQuestions: currentBlockFailed })
      });
      
      const data = await response.json();
      console.log("Explicación recibida");
      
      const explanationSection = modal.querySelector(".explanation-section");
      if (explanationSection && data.explanation) {
        // Convertir markdown básico a HTML
        let formattedExplanation = data.explanation
          .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>')
          .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/- (.*?)(\n|$)/g, '<li>$1</li>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        
        explanationSection.innerHTML = `
          <h3>📖 Explicación teórica</h3>
          <div class="explanation-content">${formattedExplanation}</div>
        `;
      }
    } catch (error) {
      console.error("Error obteniendo explicación:", error);
      const explanationSection = modal.querySelector(".explanation-section");
      if (explanationSection) {
        explanationSection.innerHTML = `
          <h3>📖 Explicación teórica</h3>
          <p>No se pudo generar la explicación. Por favor, revisa los conceptos de las preguntas fallidas.</p>
        `;
      }
    }
  }
}

// ============================================
// CERRAR RESUMEN Y CONTINUAR
// ============================================

function closeSummaryAndContinue(newLevel) {
  // Cerrar modal
  const modal = document.getElementById("summary-modal");
  if (modal) {
    modal.remove();
  }
  
  // Cambiar de nivel si es necesario
  if (newLevel !== currentLevel) {
    currentLevel = newLevel;
    // Resetear estadísticas del nuevo nivel
    levelStats[newLevel] = { total: 0, correct: 0 };
    answeredQuestionIds = []; // Resetear preguntas respondidas para el nuevo nivel
  }
  
  // Resetear bloque actual
  currentBlockFailed = [];
  questionsInCurrentBlock = 0;
  
  // Cargar siguiente pregunta
  loadQuestion();
}

// ============================================
// ESTILOS ADICIONALES
// ============================================

const additionalStyles = `
<style>
  .question-card {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 25px;
  }
  
  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .level-badge {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .level-básico { background: #28a745; color: white; }
  .level-medio { background: #ffc107; color: black; }
  .level-avanzado { background: #dc3545; color: white; }
  
  .question-id {
    color: #666;
    font-size: 14px;
  }
  
  .question-text {
    font-size: 20px;
    color: #333;
    margin-bottom: 25px;
    line-height: 1.5;
  }
  
  .options-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .option-btn {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 20px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }
  
  .option-btn:hover:not(:disabled) {
    border-color: #667eea;
    background: #f0f4ff;
  }
  
  .option-btn:disabled {
    cursor: default;
  }
  
  .option-btn.correct {
    border-color: #28a745;
    background: #d4edda;
  }
  
  .option-btn.wrong {
    border-color: #dc3545;
    background: #f8d7da;
  }
  
  .option-letter {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #667eea;
    color: white;
    border-radius: 50%;
    font-weight: 600;
    flex-shrink: 0;
  }
  
  .option-text {
    flex: 1;
    font-size: 16px;
    color: #333;
  }
  
  .feedback {
    display: flex;
    gap: 15px;
    padding: 20px;
    border-radius: 10px;
    margin-top: 20px;
  }
  
  .feedback-correct {
    background: #d4edda;
    border: 1px solid #28a745;
  }
  
  .feedback-wrong {
    background: #f8d7da;
    border: 1px solid #dc3545;
  }
  
  .feedback-icon {
    font-size: 24px;
  }
  
  .feedback-text strong {
    display: block;
    margin-bottom: 5px;
  }
  
  .feedback-text p {
    margin: 0;
    color: #333;
    line-height: 1.5;
  }
  
  .btn-next {
    padding: 12px 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .btn-next:hover {
    transform: translateY(-2px);
  }
  
  /* Progress card */
  .progress-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  }
  
  .progress-header {
    margin-bottom: 15px;
  }
  
  .progress-title {
    font-weight: 600;
    color: #333;
  }
  
  .progress-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 15px;
  }
  
  .stat {
    text-align: center;
  }
  
  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: #333;
  }
  
  .stat.correct .stat-value { color: #28a745; }
  .stat.wrong .stat-value { color: #dc3545; }
  .stat.percentage .stat-value { color: #667eea; }
  
  .stat-label {
    font-size: 12px;
    color: #666;
  }
  
  .progress-bar-container {
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s;
  }
  
  .progress-hint {
    margin-top: 10px;
    font-size: 12px;
    color: #666;
    text-align: center;
  }
  
  /* Modal */
  .modal-overlay {
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
  }
  
  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 30px;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-content h2 {
    margin-bottom: 20px;
    color: #333;
  }
  
  .level-up-message {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
  }
  
  .summary-stats {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    margin-bottom: 20px;
  }
  
  .summary-stats h3 {
    margin-bottom: 15px;
    color: #333;
  }
  
  .summary-stats p {
    margin: 8px 0;
    color: #555;
  }
  
  .summary-stats .hint {
    font-size: 12px;
    color: #888;
    margin-top: 15px;
  }
  
  .explanation-section {
    background: #fff9e6;
    border: 1px solid #ffc107;
    padding: 20px;
    border-radius: 10px;
    margin-bottom: 20px;
  }
  
  .explanation-section.success {
    background: #d4edda;
    border-color: #28a745;
  }
  
  .explanation-section h3 {
    margin-bottom: 15px;
    color: #333;
  }
  
  .explanation-content {
    color: #333;
    line-height: 1.7;
  }
  
  .explanation-content h2 {
    font-size: 18px;
    margin: 20px 0 10px;
    color: #333;
  }
  
  .explanation-content h3 {
    font-size: 16px;
    margin: 15px 0 10px;
    color: #444;
  }
  
  .explanation-content li {
    margin-left: 20px;
    margin-bottom: 5px;
  }
  
  .explanation-loading {
    text-align: center;
    padding: 20px;
  }
  
  .btn-continue {
    width: 100%;
    padding: 15px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .btn-continue:hover {
    transform: translateY(-2px);
  }
  
  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .loading {
    text-align: center;
    padding: 60px 20px;
    color: #666;
  }
</style>
`;

// Insertar estilos al cargar
document.addEventListener("DOMContentLoaded", () => {
  document.head.insertAdjacentHTML("beforeend", additionalStyles);
});

// ============================================
// INICIALIZAR
// ============================================

window.addEventListener("DOMContentLoaded", () => {
  console.log("Página cargada");
  
  // Verificar si hay usuario guardado
  const saved = localStorage.getItem("tutor_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("quiz-screen").style.display = "block";
    document.getElementById("current-user").textContent = currentUser.username;
    
    // Cargar nivel y progreso
    loadUserLevel().then(() => {
      loadQuestion();
    });
  }
});
