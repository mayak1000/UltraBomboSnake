// Основная игровая логика для игры "Маяковская Змейка"

// Получение элементов DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');

// Константы игры
const gridSize = 20;
let tileCount = 20; // Значение по умолчанию, будет обновлено после загрузки canvas
const gameSpeed = 150;

const IMMATERIAL_TURNS_COUNT = 10; // Количество ходов, когда новые структуры нематериальны

// Переменные состояния игры
let snake = [{x: 10, y: 10}];
let food = {};
let obstacles = [];
let dx = 0, dy = 0;

// Защищенные переменные score и level
let _score = 0;
let _level = 1;

/* // Создаем защищенные свойства
Object.defineProperty(window, 'score', {
    get: function() {
        console.warn('⚠️ Попытка доступа к score через консоль');
        console.warn('Используйте мозги!');
        return _score;
    },
    set: function(value) {
        console.error('❌ ИЗМЕНЕНИЕ SCORE ЗАПРЕЩЕНО!');
        console.error('Попытка установить score =', value);
        console.error('Используйте мозги для изменения очков');
        console.error('Значение score осталось:', _score);
        return false; // Запрещаем изменение
    },
    configurable: false,
    enumerable: true
});

Object.defineProperty(window, 'level', {
    get: function() {
        console.warn('⚠️ Попытка доступа к level через консоль');
        console.warn('Используйте мозги!');
        return _level;
    },
    set: function(value) {
        console.error('❌ ИЗМЕНЕНИЕ LEVEL ЗАПРЕЩЕНО!');
        console.error('Используйте мозги для изменения уровня');
        console.error('Значение level осталось:', _level);
        return false; // Запрещаем изменение
    },
    configurable: false,
    enumerable: true
}); */

// Функции для безопасного изменения значений
function safeSetScore(newScore) {
    if (typeof newScore === 'number' && newScore >= 0) {
        _score = newScore;
        if (scoreElement) {
            scoreElement.textContent = _score;
        }
    }
}

function safeSetLevel(newLevel) {
    if (typeof newLevel === 'number' && newLevel >= 1 && newLevel <= 10) {
        _level = newLevel;
        if (levelElement) {
            levelElement.textContent = _level;
        }
    }
}

let gameRunning = true;
let inputQueue = [];
let nextStructureFunction = null;
let immaterialTurns = 0; 
let lastSnakeHead = null; 
let isNewStructureImmaterial = false; // Флаг для новых структур

// Переменные для запуска с конкретной структурой
let isSpecificStructureMode = false;
let specificLevel = 1;
let specificStructure = 0;

// Поиск безопасной позиции для еды
function findSafePosition() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * tileCount);
        const y = Math.floor(Math.random() * tileCount);
        
        const isOccupied = obstacles.some(obs => obs.x === x && obs.y === y) ||
                          snake.some(segment => segment.x === x && segment.y === y) ||
                          (food.x === x && food.y === y);
        
        if (!isOccupied) return {x, y};
    }
    
    const centerPos = {x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2)};
    return centerPos;
}

// Поиск безопасной стартовой позиции для змейки
function findSafeStartPosition() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * (tileCount - 4)) + 2;
        const y = Math.floor(Math.random() * (tileCount - 4)) + 2;
        
        let isAreaClear = true;
        for (let dx = -1; dx <= 1 && isAreaClear; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (obstacles.some(obs => obs.x === x + dx && obs.y === y + dy)) {
                    isAreaClear = false;
                    break;
                }
            }
        }
        
        if (isAreaClear) return {x, y};
    }
    
    const centerPos = {x: 10, y: 10};
    return centerPos;
}

// Генерация еды в случайной позиции
function randomFood() {
    food = findSafePosition();
    
    // Золотые яблоки появляются при наборе 40, 90, 140, 190, 240 очков и т.д.
    const isGoldenScore = (_score + 10) % 50 === 0 && (_score + 10) > 0;
    
    if (isGoldenScore) {
        food.isGolden = true;
    } else {
        food.isGolden = false;
    }
    
    if (obstacles.some(obs => obs.x === food.x && obs.y === food.y)) {
        let attempts = 0;
        while (obstacles.some(obs => obs.x === food.x && obs.y === food.y) && attempts < 20) {
            food = findSafePosition();
            attempts++;
        }
        if (attempts >= 20) {
            // Не удалось найти безопасную позицию для еды
        }
    }
}

// Инициализация препятствий для первого уровня
function initializeObstacles() {
    let structures, selectedStructure;
    
    if (isSpecificStructureMode) {
        // Режим конкретной структуры
        structures = levelStructures[specificLevel];
        selectedStructure = structures[specificStructure];
        safeSetLevel(specificLevel);
    } else {
        // Обычный режим
        structures = levelStructures[1];
        selectedStructure = structures[Math.floor(Math.random() * structures.length)];
    }
    
    // Применяем случайную ротацию
    const reflectionType = Math.floor(Math.random() * 8);
    obstacles = applyReflection(selectedStructure, reflectionType);
}

// Подготовка следующей структуры препятствий
function prepareNextStructure() {
    // В обычном режиме останавливаемся на 250 очках
    if (!isSpecificStructureMode && _score >= 250) {
        return;
    }
    
    // В режиме структурного лаунчера структуры НЕ меняются
    if (isSpecificStructureMode) {
        return;
    }
    
    const nextLevel = Math.min(Math.floor((_score + 10) / 50) + 1, 5);
    
    const structures = levelStructures[nextLevel];
    const randomStructure = structures[Math.floor(Math.random() * structures.length)];
    
    const reflectionType = Math.floor(Math.random() * 8);
    
    nextStructureFunction = () => applyReflection(randomStructure, reflectionType);
}

// Смена уровня
function changeLevel() {
    // В режиме конкретной структуры не меняем препятствия
    if (isSpecificStructureMode) {
        return;
    }
    
    if (nextStructureFunction) {
        const newObstacles = nextStructureFunction();
        obstacles = newObstacles;
        nextStructureFunction = null;
    } else {
        const structures = levelStructures[_level];
        const randomStructure = structures[Math.floor(Math.random() * structures.length)];
        const reflectionType = Math.floor(Math.random() * 8);
        obstacles = applyReflection(randomStructure, reflectionType);
    }
    
    // Новые структуры становятся нематериальными на 4 хода
    isNewStructureImmaterial = true;
    immaterialTurns = IMMATERIAL_TURNS_COUNT;
    
    let attempts = 0;
    while (obstacles.some(obs => obs.x === food.x && obs.y === food.y) && attempts < 10) {
        randomFood();
        attempts++;
    }
}

// Отрисовка игрового поля
function drawGame() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#34495e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    snake.forEach((segment, index) => {
        if (index === 0) {
            const headGradient = ctx.createRadialGradient(
                segment.x * gridSize + gridSize/2, segment.y * gridSize + gridSize/2, 0,
                segment.x * gridSize + gridSize/2, segment.y * gridSize + gridSize/2, gridSize/2
            );
            headGradient.addColorStop(0, '#2ecc71');
            headGradient.addColorStop(1, '#27ae60');
            ctx.fillStyle = headGradient;
        } else {
            ctx.fillStyle = index % 2 === 0 ? '#27ae60' : '#229954';
        }
        
        const x = segment.x * gridSize;
        const y = segment.y * gridSize;
        const size = gridSize - 2;
        const radius = 3;
        
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, radius);
        ctx.fill();
    });

    if (food.isGolden) {
        ctx.shadowColor = '#f39c12';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#f39c12';
    } else {
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#e74c3c';
    }
    
    const foodX = food.x * gridSize;
    const foodY = food.y * gridSize;
    const foodSize = gridSize - 2;
    
    ctx.beginPath();
    ctx.roundRect(foodX, foodY, foodSize, foodSize, 4);
    ctx.fill();
    
    ctx.shadowBlur = 0;

    // Отрисовка препятствий
    obstacles.forEach(obstacle => {
        const x = obstacle.x * gridSize;
        const y = obstacle.y * gridSize;
        const size = gridSize - 2;
        
        // Если структура новая и нематериальная - рисуем полупрозрачно
        if (isNewStructureImmaterial && immaterialTurns > 0) {
            ctx.fillStyle = 'rgba(142, 68, 173, 0.4)'; // Полупрозрачный фиолетовый
        } else {
            ctx.fillStyle = '#8e44ad'; // Обычный фиолетовый
        }
        
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 2);
        ctx.fill();
    });
    

}

// Обработка движения змейки
function moveSnake() {
    if (!gameRunning) return;

    if (inputQueue.length > 0) {
        const nextDirection = inputQueue.shift();
        if ((dx === 0 && dy === 0) || !(nextDirection.dx === -dx && nextDirection.dy === -dy)) {
            dx = nextDirection.dx;
            dy = nextDirection.dy;
        }
    }

    if (dx === 0 && dy === 0) return;

    const head = {x: snake[0].x + dx, y: snake[0].y + dy};

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount ||
        snake.some(segment => head.x === segment.x && head.y === segment.y) ||
        (!isNewStructureImmaterial && obstacles.some(obstacle => head.x === obstacle.x && head.y === obstacle.y))) {
        gameOver();
        return;
    }

    snake.unshift(head);

    if (lastSnakeHead && (head.x !== lastSnakeHead.x || head.y !== lastSnakeHead.y)) {
        if (isNewStructureImmaterial && immaterialTurns > 0) {
            immaterialTurns--;
            if (immaterialTurns === 0) {
                isNewStructureImmaterial = false; // Структура больше не нематериальна
            }
        }
    }
    lastSnakeHead = {x: head.x, y: head.y};

    if (head.x === food.x && head.y === food.y) {
        safeSetScore(_score + 10);
        
        if (checkWin()) {
            return;
        }
        
        const scoreItem = document.querySelector('.stat-item');
        scoreItem.classList.add('score-updated');
        setTimeout(() => {
            scoreItem.classList.remove('score-updated');
        }, 600);
        
        if (_score % 50 === 0) {
            const newLevel = Math.floor(_score / 50) + 1;
            if (newLevel !== _level) {
                safeSetLevel(newLevel);
                
                const levelItem = document.querySelectorAll('.stat-item')[1];
                levelItem.classList.add('score-updated');
                setTimeout(() => {
                    levelItem.classList.remove('score-updated');
                }, 600);
            }
            
            if (!nextStructureFunction) {
                prepareNextStructure();
            }
            
            changeLevel();
        } else {
            const pointsToNext50 = 50 - (_score % 50);
            if (pointsToNext50 === 10 && !nextStructureFunction) {
                prepareNextStructure();
            }
        }
        
        randomFood();
    } else {
        snake.pop();
    }
}

// Завершение игры
function gameOver() {
    gameRunning = false;
    finalScoreElement.textContent = _score;
    gameOverElement.style.display = 'block';
}

// Проверка победы
function checkWin() {
    // В режиме структурного лаунчера нет победы - игра бесконечная
    if (isSpecificStructureMode) {
        return false;
    }
    
    if (_score >= 250) {
        gameRunning = false;
        showWinScreen();
        return true;
    }
    return false;
}

// Отображение экрана победы
function showWinScreen() {
    const winScreen = document.createElement('div');
    winScreen.className = 'game-over';
    winScreen.id = 'winScreen';
    winScreen.style.display = 'block';
    winScreen.innerHTML = `
        <h2 style="color: #f39c12;">🎉 Победа! 🎉</h2>
        <p>Поздравляем! Ты прошел все уровни!</p>
        <p>Не, всем и так понятно, что ты отбитый, но не на столько же?</p>
        <p>Сделай скрин и скинь Маяку</p>
        <button class="restart-btn" onclick="restartGame()">Играть снова</button>
    `;
    
    document.body.appendChild(winScreen);
}

// Перезапуск игры с сбросом состояния
function restartGame() {
    gameOverElement.style.display = 'none';
    const winScreen = document.getElementById('winScreen');
    if (winScreen) {
        winScreen.remove();
    }
    
    obstacles = [];
    inputQueue = [];
    dx = 0;
    dy = 0;
    safeSetScore(0);
    
    // Восстанавливаем уровень для режима конкретной структуры
    if (isSpecificStructureMode) {
        safeSetLevel(specificLevel);
    } else {
        safeSetLevel(1);
    }
    
    nextStructureFunction = null;
    immaterialTurns = 0;
    isNewStructureImmaterial = false;
    lastSnakeHead = null;
    
    gameRunning = true;
    
    initializeObstacles();
    
    // Если в режиме конкретной структуры, инициализируем змею с нужной длиной
    if (isSpecificStructureMode) {
        initializeSnakeForLevel(specificLevel);
    } else {
        // Обычная инициализация для первого уровня
        const safeStart = findSafeStartPosition();
        snake = [{x: safeStart.x, y: safeStart.y}];
    }
    
    randomFood();
}

// Обработка клавиатурного ввода
document.addEventListener('keydown', (e) => {
    if (e.key === 'R' || e.key === 'r' || e.key === 'Enter' || 
        e.key === 'к' || e.key === 'К') {
        if (!gameRunning) {
            const winScreen = document.getElementById('winScreen');
            if (winScreen && winScreen.style.display === 'block') {
                return;
            }
            restartGame();
            return;
        }
        return;
    }

    if (!gameRunning) return;

    let newDirection = null;
    const key = e.key.toLowerCase();

    if (key === 'arrowup' || key === 'w' || key === 'ц') {
        newDirection = {dx: 0, dy: -1};
    } else if (key === 'arrowdown' || key === 's' || key === 'ы') {
        newDirection = {dx: 0, dy: 1};
    } else if (key === 'arrowleft' || key === 'a' || key === 'ф') {
        newDirection = {dx: -1, dy: 0};
    } else if (key === 'arrowright' || key === 'd' || key === 'в') {
        newDirection = {dx: 1, dy: 0};
    }

    if (newDirection) {
        let currentDx = dx;
        let currentDy = dy;
        if (inputQueue.length > 0) {
            const lastCommand = inputQueue[inputQueue.length - 1];
            currentDx = lastCommand.dx;
            currentDy = lastCommand.dy;
        }

        if ((dx === 0 && dy === 0) || !(newDirection.dx === -currentDx && newDirection.dy === -currentDy)) {
            if (inputQueue.length < 3) {
                inputQueue.push(newDirection);
            }
        }
    }
});

// Основной игровой цикл
function gameLoop() {
    moveSnake();
    drawGame();
}

// Полифилл для roundRect в старых браузерах
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
    };
}

// Валидация структур уровней
function validateLevelStructures() {
    for (let level = 1; level <= 5; level++) {
        if (!levelStructures[level] || !Array.isArray(levelStructures[level])) {
            return false;
        }
        
        levelStructures[level].forEach((structure, index) => {
            if (!Array.isArray(structure) || structure.length === 0) {
                return false;
            }
            
            structure.forEach(point => {
                if (point.x < 0 || point.x >= tileCount || point.y < 0 || point.y >= tileCount) {
                    // Координата выходит за пределы поля
                }
            });
        });
    }
    return true;
}

// Функция отладки для разработчиков
function debugPreview() {
    // Функция отладки доступна для разработчиков
}

// Экспорт функций для глобального доступа
window.debugPreview = debugPreview;
window.restartGame = restartGame;

// Дополнительная защита от переопределения

// Защита от переопределения безопасных функций
Object.defineProperty(window, 'safeSetScore', {
    writable: false,
    configurable: false
});

Object.defineProperty(window, 'safeSetLevel', {
    writable: false,
    configurable: false
});

/* // Защита от переопределения защищенных переменных
Object.defineProperty(window, '_score', {
    get: function() {
        console.error('❌ Доступ к защищенной переменной _score заблокирован!');
        return undefined;
    },
    set: function() {
        console.error('❌ Изменение защищенной переменной _score заблокировано!');
        return false;
    },
    configurable: false,
    enumerable: false
});

Object.defineProperty(window, '_level', {
    get: function() {
        console.error('❌ Доступ к защищенной переменной _level заблокирован!');
        return undefined;
    },
    set: function() {
        console.error('❌ Изменение защищенной переменной _level заблокировано!');
        return false;
    },
    configurable: false,
    enumerable: false
}); */

// Функция для установки параметров конкретной структуры
function setSpecificStructure(level, structure) {
    isSpecificStructureMode = true;
    specificLevel = level;
    specificStructure = structure;
}

// Функция для инициализации змеи с длиной, соответствующей уровню
function initializeSnakeForLevel(level) {
    const safeStart = findSafeStartPosition();
    const snakeLength = calculateSnakeLengthForLevel(level);
    
    // Создаем змею с нужной длиной
    snake = [];
    for (let i = 0; i < snakeLength; i++) {
        // Размещаем сегменты змеи в ряд, начиная с головы
        snake.push({
            x: safeStart.x - i,
            y: safeStart.y
        });
    }
    
    // Устанавливаем начальный счет и уровень
    safeSetScore((level - 1) * 50);
    safeSetLevel(level);
}

// Функция для расчета длины змеи на основе уровня
function calculateSnakeLengthForLevel(level) {
    // Начальная длина змеи - 1 сегмент
    // Каждые 50 очков уровень увеличивается
    // Каждые 10 очков змея растет на 1 сегмент
    // Для уровня N нужно (N-1) * 50 очков
    const scoreForLevel = (level - 1) * 50;
    const segmentsForScore = Math.floor(scoreForLevel / 10);
    return 1 + segmentsForScore; // +1 для начального сегмента
}

// Инициализация игры после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Обновляем tileCount после загрузки canvas
    tileCount = canvas.width / gridSize;
    
    // Проверяем, есть ли параметры для запуска с конкретной структурой
    const launchSpecific = localStorage.getItem('launchSpecificStructure');
    if (launchSpecific === 'true') {
        const selectedLevel = parseInt(localStorage.getItem('selectedLevel')) || 1;
        const selectedStructure = parseInt(localStorage.getItem('selectedStructure')) || 0;
        
        setSpecificStructure(selectedLevel, selectedStructure);
        
        // Очищаем localStorage
        localStorage.removeItem('launchSpecificStructure');
        localStorage.removeItem('selectedLevel');
        localStorage.removeItem('selectedStructure');
    }
    
    validateLevelStructures();
    initializeObstacles();
    
    // Если запускаем с конкретной структурой, инициализируем змею с нужной длиной
    if (isSpecificStructureMode) {
        initializeSnakeForLevel(specificLevel);
    } else {
        // Обычная инициализация для первого уровня
        const safeStart = findSafeStartPosition();
        snake = [{x: safeStart.x, y: safeStart.y}];
    }
    
    randomFood();
    setInterval(gameLoop, gameSpeed);
    drawGame();
});
