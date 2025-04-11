// --- Elementos del DOM ---
const mainMenu = document.getElementById('main-menu');
const startButton = document.getElementById('start-button');
const highScoresButton = document.getElementById('high-scores-button');
const difficultyScreen = document.getElementById('difficulty-screen');
const difficultyButtons = document.querySelectorAll('#difficulty-screen button[data-difficulty]');
const backToMenuFromDifficulty = document.getElementById('back-to-menu-from-difficulty');
const countdownScreen = document.getElementById('countdown-screen');
const countdownText = document.getElementById('countdown-text');
const gameScreen = document.getElementById('game-screen');
const gameCanvas = document.getElementById('gameCanvas');
const nextPieceDisplay = document.getElementById('next-piece');
const levelDisplay = document.getElementById('level');
const scoreDisplay = document.getElementById('score');
const recordDisplay = document.getElementById('record');
const pauseButton = document.getElementById('pause-button');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const finalLevelDisplay = document.getElementById('final-level');
const finalLinesDisplay = document.getElementById('final-lines');
const newRecordMessage = document.getElementById('new-record-message');
const playAgainButton = document.getElementById('play-again-button');
const backToMenuFromGameOver = document.getElementById('back-to-menu-from-game-over');
const highScoresScreen = document.getElementById('high-scores-screen');
const highScoresList = document.getElementById('high-scores-list');
const backToMenuFromHighScores = document.getElementById('back-to-menu-from-high-scores');
const ctx = gameCanvas.getContext('2d');

// --- Constantes y Variables del Juego ---
const grid = [];
const gridRows = 20;
const gridCols = 10;
const blockSize = 30; // El tamaño base del bloque, CSS puede escalarlo visualmente
let currentPiece = null;
let nextPiece = null;
let gameInterval;
let dropInterval = 1000; // Velocidad inicial de caída (se ajusta por dificultad)
let score = 0;
let level = 1;
let linesCleared = 0;
let isPaused = false;
let gameIsRunning = false; // Indica si el juego está activo (post-cuenta atrás)
let difficulty = 'normal';
let highScores = loadHighScores();

// --- Colores y Formas de las Piezas ---
const colors = {
    I: '#00ffff', J: '#0000ff', L: '#ffa500', O: '#ffff00', S: '#008000', T: '#800080', Z: '#ff0000'
};
const darkColors = { // Colores más oscuros para los bordes
    I: '#00cccc', J: '#0000cc', L: '#cc8400', O: '#cccc00', S: '#006600', T: '#660066', Z: '#cc0000'
};
// Definición corregida de las formas de las piezas (coordenadas relativas al centro [0,0])
// Ajustadas para que el punto [0,0] sea el centro de rotación (aproximado)
const pieces = {
    'I': [[0, -1], [0, 0], [0, 1], [0, 2]],
    'J': [[-1, 0], [-1, 1], [0, 1], [1, 1]],
    'L': [[1, 0], [-1, 1], [0, 1], [1, 1]],
    'O': [[0, 0], [1, 0], [0, 1], [1, 1]], // Cuadrado, el [0,0] es arriba-izquierda
    'S': [[0, 0], [1, 0], [-1, 1], [0, 1]],
    'T': [[0, 0], [-1, 1], [0, 1], [1, 1]],
    'Z': [[-1, 0], [0, 0], [0, 1], [1, 1]]
};
const pieceLetters = Object.keys(pieces); // ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

// --- Funciones de Puntuaciones ---
function loadHighScores() {
    const storedScores = localStorage.getItem('tretisHighScores');
    try {
        const parsed = JSON.parse(storedScores);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Error cargando high scores:", e);
        return [];
    }
}

function saveHighScores() {
    localStorage.setItem('tretisHighScores', JSON.stringify(highScores));
}

function displayHighScores() {
    highScoresList.innerHTML = '';
    if (!Array.isArray(highScores)) {
        highScores = [];
    }
    const sortedScores = highScores.sort((a, b) => b - a).slice(0, 10);
    if (sortedScores.length === 0) {
        const li = document.createElement('li');
        li.textContent = "Aún no hay puntuaciones";
        li.style.textAlign = 'center';
        highScoresList.appendChild(li);
    } else {
        sortedScores.forEach((score, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${score}`;
            highScoresList.appendChild(li);
        });
    }
}

function updateRecordDisplay() {
     // Asegura que highScores sea un array antes de usar spread operator
     const scoresArray = Array.isArray(highScores) ? highScores : [];
     recordDisplay.textContent = Math.max(0, ...scoresArray); // Muestra 0 si está vacío
}

// --- Funciones del Grid y Dibujo ---
function createGrid() {
    grid.length = 0;
    for (let y = 0; y < gridRows; y++) {
        grid[y] = Array(gridCols).fill(0);
    }
}

function getRandomPiece() {
    const index = Math.floor(Math.random() * pieceLetters.length);
    const letter = pieceLetters[index];
    const shape = pieces[letter];
    // Ajusta la posición inicial X para centrar mejor
    let initialX = Math.floor(gridCols / 2);
    if (letter === 'O') initialX -=1; // Ajuste para cuadrado
    else if (letter !== 'I') initialX -=1; // Ajuste para la mayoría
    return {
        shape: shape.map(arr => [...arr]), // Copia profunda
        color: colors[letter],
        darkColor: darkColors[letter],
        x: initialX,
        y: (letter === 'I' || letter === 'O') ? 0 : -1, // Ajusta Y inicial para evitar spawn inmediato en el techo
        letter: letter
    };
}

function drawBlock(x, y, color, darkColor) {
    const actualBlockSize = gameCanvas.width / gridCols; // Calcula tamaño real del bloque basado en canvas reescalado
    ctx.fillStyle = color;
    ctx.fillRect(x * actualBlockSize, y * actualBlockSize, actualBlockSize, actualBlockSize);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2; // Grosor del borde (puede necesitar ajuste si los bloques son muy pequeños)
    // Dibuja el borde ligeramente hacia adentro para que no se solape
    ctx.strokeRect(x * actualBlockSize + 1, y * actualBlockSize + 1, actualBlockSize - 2, actualBlockSize - 2);
}

function drawGrid() {
    for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
            if (grid[y][x]) {
                drawBlock(x, y, grid[y][x].color, grid[y][x].darkColor);
            }
        }
    }
}

function drawPiece(piece) {
    piece.shape.forEach(block => {
        const drawX = piece.x + block[0];
        const drawY = piece.y + block[1];
        if (drawY >= 0) { // Solo dibuja bloques dentro del área visible verticalmente
            drawBlock(drawX, drawY, piece.color, piece.darkColor);
        }
    });
}

function drawGhostPiece() {
    if (!currentPiece || isPaused || !gameIsRunning) return;

    let ghostY = currentPiece.y;
    while (!collision(currentPiece.shape, currentPiece.x, ghostY + 1)) {
        ghostY++;
    }

    ctx.globalAlpha = 0.3; // Transparencia para la pieza fantasma
    currentPiece.shape.forEach(block => {
        const drawX = currentPiece.x + block[0];
        const drawY = ghostY + block[1];
        if (drawY >= 0) {
             drawBlock(drawX, drawY, currentPiece.color, currentPiece.darkColor);
        }
    });
    ctx.globalAlpha = 1.0; // Restaura opacidad
}

// --- Funciones de Lógica del Juego ---
function collision(shape, x, y) {
    return shape.some(block => {
        const newX = x + block[0];
        const newY = y + block[1];
        return (
            newX < 0 || newX >= gridCols || newY >= gridRows ||
            (newY >= 0 && grid[newY] && grid[newY][newX])
        );
    });
}

function mergePiece() {
    if (!currentPiece) return;
    currentPiece.shape.forEach(block => {
        const x = currentPiece.x + block[0];
        const y = currentPiece.y + block[1];
        // Asegura que solo se mergea dentro de los límites del grid visible
        if (y >= 0 && y < gridRows && x >= 0 && x < gridCols) {
            grid[y][x] = { color: currentPiece.color, darkColor: currentPiece.darkColor };
        }
    });
}

function clearLines() {
    let linesClearedThisTurn = 0;
    for (let y = gridRows - 1; y >= 0; y--) {
        if (grid[y].every(cell => cell !== 0)) {
            linesClearedThisTurn++;
            grid.splice(y, 1);
            grid.unshift(Array(gridCols).fill(0));
            y++; // Revisa la misma fila (ahora con el contenido de arriba)
        }
    }

    if (linesClearedThisTurn > 0) {
        let points = 0;
        switch (linesClearedThisTurn) {
            case 1: points = 100 * level; break;
            case 2: points = 300 * level; break;
            case 3: points = 500 * level; break;
            case 4: points = 800 * level; break; // ¡Tretis!
        }
        score += points;
        linesCleared += linesClearedThisTurn;

        const newLevel = Math.floor(linesCleared / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            let baseSpeed = 1000; // ms por paso
            if (difficulty === 'easy') baseSpeed = 1500;
            else if (difficulty === 'hard') baseSpeed = 600; // Más rápido en difícil
            // El intervalo disminuye con el nivel, mínimo 100ms
            dropInterval = Math.max(100, baseSpeed - (level * 50)); // Ajusta la fórmula de velocidad

            clearInterval(gameInterval);
            gameInterval = setInterval(drop, dropInterval);
        }
        updateDisplay();
    }
}

function movePiece(dx) {
    if (!isGameActive()) return;
    const newX = currentPiece.x + dx;
    if (!collision(currentPiece.shape, newX, currentPiece.y)) {
        currentPiece.x = newX;
    }
}

function rotatePiece() {
    if (!isGameActive() || currentPiece.letter === 'O') return;

    const shape = currentPiece.shape;
    const newShape = shape.map(([x, y]) => [-y, x]); // Rotación 90 grados horario

    // Intenta rotar sin moverse
    if (!collision(newShape, currentPiece.x, currentPiece.y)) {
        currentPiece.shape = newShape;
    } else {
         // Intenta Wall Kick básico: 1 a la derecha, 1 a la izquierda
         if (!collision(newShape, currentPiece.x + 1, currentPiece.y)) {
             currentPiece.x++;
             currentPiece.shape = newShape;
         } else if (!collision(newShape, currentPiece.x - 1, currentPiece.y)) {
             currentPiece.x--;
             currentPiece.shape = newShape;
         }
         // Podría necesitarse lógica de wall kick más compleja para cumplir SRS
     }
}

function drop() { // Caída automática temporizada
    if (!isGameActive()) return;

    if (!collision(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
        currentPiece.y++;
    } else {
        // Colisión detectada al intentar bajar
        mergePiece();
        clearLines();
        currentPiece = nextPiece;
        nextPiece = getRandomPiece();
        updateNextPieceDisplay();

        // Comprobación de Game Over DESPUÉS de obtener la nueva pieza
        if (collision(currentPiece.shape, currentPiece.x, currentPiece.y)) {
            // Si la nueva pieza colisiona inmediatamente, es game over
            // Dibuja el estado final antes de mostrar la pantalla de game over
            drawGrid(); // Dibuja el grid con la pieza recién mergeada
            drawPiece(currentPiece); // Dibuja la nueva pieza colisionando
            gameOver();
            return; // Detiene la función drop
        }
    }
    draw(); // Redibuja el estado en cada paso de caída
}

function dropFast() { // Soft drop activado por usuario
    if (!isGameActive()) return;

    if (!collision(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
        currentPiece.y++;
        score += 1; // Bonus por bajar
        updateDisplay();
        draw(); // Redibuja inmediatamente
        // Reinicia el temporizador de caída automática para que no se acumule
        clearInterval(gameInterval);
        gameInterval = setInterval(drop, dropInterval);
    } else {
        // Si ya no puede bajar más, fuerza la lógica de mergeo, etc.
        drop();
    }
}

function hardDrop() { // Caída instantánea activada por usuario
    if (!isGameActive()) return;

    let dropCount = 0;
    while (!collision(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
        currentPiece.y++;
        dropCount++;
    }

    if (dropCount > 0) {
        score += dropCount * 2; // Bonus mayor por hard drop
    }

    // Ejecuta la secuencia de mergeo y nueva pieza
    mergePiece();
    clearLines(); // Limpia líneas inmediatamente después del hard drop
    currentPiece = nextPiece;
    nextPiece = getRandomPiece();
    updateNextPieceDisplay();

    if (collision(currentPiece.shape, currentPiece.x, currentPiece.y)) {
        drawGrid(); // Dibuja estado final antes de game over
        drawPiece(currentPiece);
        gameOver();
        return;
    }

    updateDisplay(); // Actualiza score
    draw(); // Dibuja el nuevo estado
    // Reinicia el intervalo de caída normal
    clearInterval(gameInterval);
    gameInterval = setInterval(drop, dropInterval);
}


// --- Funciones de Actualización de Pantalla ---
function updateDisplay() {
    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    updateRecordDisplay(); // Llama a la función que actualiza el récord
}

function updateNextPieceDisplay() {
    nextPieceDisplay.innerHTML = ''; // Limpia contenedor
    if (!nextPiece) return;

    const previewCanvas = document.createElement('canvas');
    const previewCtx = previewCanvas.getContext('2d');

    // Define un tamaño fijo para el canvas de preview (ej. 4x4 bloques base)
    const previewBlockSize = 15; // Tamaño de bloque para la preview (más pequeño)
    previewCanvas.width = previewBlockSize * 4;
    previewCanvas.height = previewBlockSize * 4;

    // Calcula desplazamiento para centrar la pieza en el 4x4
    const offsetX = 2; // Centro X en bloques
    const offsetY = 2; // Centro Y en bloques

    nextPiece.shape.forEach(block => {
        const x = block[0] + offsetX;
        const y = block[1] + offsetY;
        // Dibuja el bloque en el canvas de vista previa si está dentro de los límites 0-3
        if (x >= 0 && x < 4 && y >= 0 && y < 4) {
            previewCtx.fillStyle = nextPiece.color;
            previewCtx.fillRect(x * previewBlockSize, y * previewBlockSize, previewBlockSize, previewBlockSize);
            previewCtx.strokeStyle = nextPiece.darkColor;
            previewCtx.lineWidth = 1; // Borde fino para preview
            previewCtx.strokeRect(x * previewBlockSize + 0.5, y * previewBlockSize + 0.5, previewBlockSize - 1, previewBlockSize - 1);
        }
    });
    nextPieceDisplay.appendChild(previewCanvas);
}


function draw() {
    if (!ctx || !gameIsRunning) return; // No dibujar si el juego no está activo

    // Adapta el tamaño interno del canvas al tamaño mostrado por CSS
    // Esto es crucial si el canvas se escala
    const cssWidth = gameCanvas.clientWidth;
    const cssHeight = gameCanvas.clientHeight;
    if (gameCanvas.width !== cssWidth || gameCanvas.height !== cssHeight) {
        gameCanvas.width = cssWidth;
        gameCanvas.height = cssHeight;
        // Recalcula blockSize si es necesario aquí basado en gameCanvas.width
        // blockSize = gameCanvas.width / gridCols; // Opcional si drawBlock lo calcula
    }


    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Limpia
    drawGrid(); // Dibuja piezas fijas
    if (currentPiece) {
        drawGhostPiece(); // Dibuja fantasma
        drawPiece(currentPiece); // Dibuja pieza actual
    }
}

// --- Funciones de Control del Estado del Juego ---
function startGame() {
    mainMenu.classList.add('hidden');
    difficultyScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    highScoresScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');

    // Aplica clase de dificultad al body para CSS dinámico
    document.body.className = `difficulty-${difficulty}`;

    createGrid();
    currentPiece = getRandomPiece();
    nextPiece = getRandomPiece();
    updateNextPieceDisplay();
    score = 0;
    level = 1;
    linesCleared = 0;
    isPaused = false;
    gameIsRunning = false; // Aún no ha terminado la cuenta atrás
    pauseButton.innerHTML = '||'; // Icono inicial de pausa
    updateDisplay();
    updateRecordDisplay(); // Asegura que el récord se muestre

    // Ajusta velocidad inicial según dificultad
    if (difficulty === 'easy') dropInterval = 1500;
    else if (difficulty === 'normal') dropInterval = 1000;
    else if (difficulty === 'hard') dropInterval = 600; // Más rápido

    clearInterval(gameInterval); // Limpia intervalo previo

    // Cuenta atrás
    let countdown = 3;
    countdownText.textContent = countdown;
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownText.textContent = countdown;
        } else if (countdown === 0) {
            countdownText.textContent = '¡YA!';
        } else {
            clearInterval(countdownInterval);
            countdownScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            gameIsRunning = true; // ¡Ahora sí empieza el juego!
            gameInterval = setInterval(drop, dropInterval); // Inicia caída
            document.addEventListener('keydown', handleKeyDown); // Activa teclado
            draw(); // Dibuja estado inicial
        }
    }, 1000);
}

function pauseGame() {
    if (!gameIsRunning) return; // No pausar si no ha iniciado el juego
    isPaused = !isPaused;
    pauseButton.innerHTML = isPaused ? '►' : '||'; // Cambia icono (► Reanudar, || Pausa)

    if (isPaused) {
        clearInterval(gameInterval); // Detiene caída
        // Muestra mensaje de Pausa en el canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, gameCanvas.height / 2 - 30, gameCanvas.width, 60);
        ctx.font = "24px 'Press Start 2P'";
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSA', gameCanvas.width / 2, gameCanvas.height / 2);
    } else {
        // Reanuda el juego
        gameInterval = setInterval(drop, dropInterval);
        // No es necesario llamar a draw() explícitamente aquí,
        // el próximo ciclo de drop() o una acción del usuario redibujará.
        // Opcional: llamar a draw() si quieres quitar el overlay de pausa inmediatamente.
        draw();
    }
}

function gameOver() {
    gameIsRunning = false; // Marca el juego como terminado
    clearInterval(gameInterval); // Detiene bucle
    document.removeEventListener('keydown', handleKeyDown); // Desactiva teclado
    gameScreen.classList.add('hidden'); // Oculta juego
    gameOverScreen.classList.remove('hidden'); // Muestra Game Over

    finalScoreDisplay.textContent = score;
    finalLevelDisplay.textContent = level;
    finalLinesDisplay.textContent = linesCleared;

    // Lógica de High Score
    const scoresArray = Array.isArray(highScores) ? highScores : [];
    const currentRecord = Math.max(0, ...scoresArray);
    if (score > currentRecord) {
        newRecordMessage.classList.remove('hidden');
        highScores.push(score);
        highScores.sort((a, b) => b - a);
        highScores = highScores.slice(0, 10); // Top 10
        saveHighScores();
        displayHighScores(); // Actualiza la lista (puede estar oculta)
    } else {
        newRecordMessage.classList.add('hidden');
    }
     updateRecordDisplay(); // Asegura que el récord mostrado sea el actual
}

function resetGame() { // Llamado por "Jugar de Nuevo"
    gameOverScreen.classList.add('hidden');
    // Vuelve a la pantalla de selección de dificultad
    showDifficultyScreen();
}

// --- Funciones de Navegación entre Pantallas ---
function showDifficultyScreen() {
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    highScoresScreen.classList.add('hidden');
    gameScreen.classList.add('hidden'); // Asegura ocultar pantalla de juego
    difficultyScreen.classList.remove('hidden');
    document.body.className = ''; // Limpia clase de dificultad del body
}

function showMainMenu() {
    difficultyScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    highScoresScreen.classList.add('hidden');
    countdownScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    // Resetea estado del juego al volver al menú
    gameIsRunning = false;
    isPaused = false;
    clearInterval(gameInterval);
    document.removeEventListener('keydown', handleKeyDown);
    document.body.className = ''; // Limpia clase de dificultad del body
    // Opcional: Limpiar el canvas si quedó algo dibujado
    // ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
}

function showHighScores() {
    mainMenu.classList.add('hidden');
    difficultyScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameScreen.classList.add('hidden'); // Asegura ocultar pantalla de juego
    highScoresScreen.classList.remove('hidden');
    displayHighScores(); // Muestra puntuaciones actualizadas
}

// --- Manejador de Eventos de Teclado ---
function handleKeyDown(e) {
    if (!isGameActive()) return; // Usa la función centralizada

    let actionTaken = false;

    switch (e.key.toLowerCase()) { // Convertir a minúsculas para A, D, S, W, P
        case 'arrowleft':
        case 'a':
            movePiece(-1);
            actionTaken = true;
            break;
        case 'arrowright':
        case 'd':
            movePiece(1);
            actionTaken = true;
            break;
        case 'arrowdown':
        case 's':
            dropFast(); // Soft drop
            break;
        case 'arrowup':
        case 'w':
        case ' ': // Espacio
            rotatePiece();
            actionTaken = true;
            break;
        case 'p': // Pausa
             pauseGame();
             break;
        // Puedes añadir una tecla para Hard Drop si quieres
         case 'enter': // Ejemplo: Enter para Hard Drop
             hardDrop();
             break;
    }

    // Redibuja si hubo movimiento/rotación y no está pausado
    if (actionTaken && !isPaused) {
        draw();
    }
}

// --- Event Listeners de Botones de Navegación ---
startButton.addEventListener('click', showDifficultyScreen);
highScoresButton.addEventListener('click', showHighScores);
backToMenuFromDifficulty.addEventListener('click', showMainMenu);
backToMenuFromHighScores.addEventListener('click', showMainMenu);
playAgainButton.addEventListener('click', resetGame);
backToMenuFromGameOver.addEventListener('click', showMainMenu);
pauseButton.addEventListener('click', pauseGame);

// Listener para botones de dificultad
difficultyButtons.forEach(button => {
    button.addEventListener('click', function() {
        difficulty = this.dataset.difficulty;
        startGame();
    });
});

// --- INICIO: CÓDIGO PARA CONTROLES MÓVILES ---

// Referencias a los botones móviles
const moveLeftButton = document.getElementById('move-left-btn');
const moveRightButton = document.getElementById('move-right-btn');
const rotateButton = document.getElementById('rotate-btn');
const moveDownButton = document.getElementById('move-down-btn'); // Soft Drop (↓)
const dropButton = document.getElementById('drop-btn');         // Hard Drop (↓↓)

// Función para verificar si el juego está activo
function isGameActive() {
    return gameIsRunning && !isPaused;
}

// Listeners para los botones móviles
if (moveLeftButton) {
    moveLeftButton.addEventListener('click', () => {
        if (isGameActive()) {
            movePiece(-1);
            if (!isPaused) draw(); // Redibuja si no está pausado
        }
    });
}

if (moveRightButton) {
    moveRightButton.addEventListener('click', () => {
        if (isGameActive()) {
            movePiece(1);
            if (!isPaused) draw(); // Redibuja si no está pausado
        }
    });
}

if (rotateButton) {
    rotateButton.addEventListener('click', () => {
        if (isGameActive()) {
            rotatePiece();
            if (!isPaused) draw(); // Redibuja si no está pausado
        }
    });
}

if (moveDownButton) {
    moveDownButton.addEventListener('click', () => {
        if (isGameActive()) {
            dropFast(); // Soft drop (ya maneja su propio draw/estado)
        }
    });
}

if (dropButton) {
    dropButton.addEventListener('click', () => {
        if (isGameActive()) {
            hardDrop(); // Hard drop (ya maneja su propio draw/estado)
        }
    });
}

// --- FIN: CÓDIGO PARA CONTROLES MÓVILES ---


// --- Inicialización ---
showMainMenu();        // Muestra el menú principal al cargar la página
updateRecordDisplay(); // Asegura que el récord se cargue y muestre inicialmente
