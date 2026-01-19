// ============================================
// FRONTEND CON D1 - FASE 2
// Login + Progreso en BD
// ============================================

// CONFIGURACIÓN
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
let currentQuestion = null;
let currentLevel = "BÁSICO";
let questionsAnswered = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let answered = false;
let currentUser = null;

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

    // Login exitoso
    currentUser = data.user;
    localStorage.setItem("tutor_user", JSON.stringify(currentUser));
    
    // Mostrar pantalla de quiz
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("quiz-screen").style.display = "block";
    document.getElementById("current-user").textContent = currentUser.username;
    
    // Cargar progreso previo
    loadUserProgress();
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
      // Calcular estadísticas
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
        Nivel: <strong>${currentQuestion.level}</strong> | Pregunta ID: ${currentQuestion.id}
      </div>
      
      <h2 style="margin: 20px 0; font-size: 18px; color: #333;">
        ${currentQuestion.question}
      </h2>
      
      <div style="margin: 20px 0;">
  `;

  // Mostrar opciones
  currentQuestion.options.forEach((option, index) => {
    const letter = option.charAt(0);
    const isCorrect = letter === currentQuestion.correctAnswer;
    
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
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
        <button 
          onclick="loadQuestion()"
          style="
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          "
        >
          ↻ Siguiente pregunta
        </button>
        
        <button 
          onclick="changeLevel('BÁSICO')"
          style="
            padding: 10px 20px;
            margin-left: 10px;
            background: ${currentLevel === 'BÁSICO' ? '#28a745' : '#ddd'};
            color: ${currentLevel === 'BÁSICO' ? 'white' : 'black'};
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          "
        >
          BÁSICO
        </button>
        
        <button 
          onclick="changeLevel('MEDIO')"
          style="
            padding: 10px 20px;
            margin-left: 10px;
            background: ${currentLevel === 'MEDIO' ? '#28a745' : '#ddd'};
            color: ${currentLevel === 'MEDIO' ? 'white' : 'black'};
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          "
        >
          MEDIO
        </button>
        
        <button 
          onclick="changeLevel('AVANZADO')"
          style="
            padding: 10px 20px;
            margin-left: 10px;
            background: ${currentLevel === 'AVANZADO' ? '#28a745' : '#ddd'};
            color: ${currentLevel === 'AVANZADO' ? 'white' : 'black'};
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          "
        >
          AVANZADO
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
  
  // Actualizar estadísticas
  questionsAnswered++;
  if (isCorrect) {
    correctAnswers++;
  } else {
    wrongAnswers++;
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

  // Mostrar feedback
  const feedback = isCorrect 
    ? `✅ ¡CORRECTO!\n\n${currentQuestion.explanation}`
    : `❌ INCORRECTO\n\nRespuesta correcta: ${currentQuestion.correctAnswer}\n\n${currentQuestion.explanation}`;
  
  alert(feedback);
  
  // Cargar siguiente pregunta
  setTimeout(() => {
    loadQuestion();
  }, 500);
}

// ============================================
// CAMBIAR NIVEL
// ============================================

function changeLevel(level) {
  currentLevel = level;
  console.log(`Nivel cambiado a: ${level}`);
  loadQuestion();
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
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("quiz-screen").style.display = "block";
    document.getElementById("current-user").textContent = currentUser.username;
    loadUserProgress();
    loadQuestion();
  }
});
