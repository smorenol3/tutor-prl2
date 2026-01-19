// ============================================
// FRONTEND SIMPLE - PASO 3
// Solo muestra preguntas (sin evaluación aún )
// ============================================

// CONFIGURACIÓN
const WORKER_URL = "https://tutor-prl2.s-morenoleiva91.workers.dev";
let currentQuestion = null;
let currentLevel = "BÁSICO";

// ============================================
// CARGAR PREGUNTA
// ============================================
async function loadQuestion( ) {
  try {
    console.log(`Cargando pregunta de nivel: ${currentLevel}`);
    
    const response = await fetch(`${WORKER_URL}/api/questions/random?level=${currentLevel}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    currentQuestion = await response.json();
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
  
  let html = `
    <div style="padding: 20px; background: #f5f5f5; border-radius: 8px;">
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
    html += `
      <button 
        onclick="selectAnswer('${letter}')"
        style="
          display: block;
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          text-align: left;
          background: white;
          border: 2px solid #ddd;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        "
        onmouseover="this.style.background='#f0f0f0'; this.style.borderColor='#999';"
        onmouseout="this.style.background='white'; this.style.borderColor='#ddd';"
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
          ↻ Otra pregunta
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
function selectAnswer(letter) {
  const isCorrect = letter === currentQuestion.correctAnswer;
  
  alert(`
Respuesta: ${letter}
Correcta: ${currentQuestion.correctAnswer}

${isCorrect ? '✅ ¡CORRECTO!' : '❌ INCORRECTO'}

Explicación:
${currentQuestion.explanation}
  `);
  
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
  loadQuestion();
});
