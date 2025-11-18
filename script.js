// ---- Canvas & basic setup ----
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

let lastTime = 0;
let running = true;

// ---- Images ----

// Character
const girlImg = new Image();
girlImg.src = "girl.png";

// House obstacle
const houseImg = new Image();
houseImg.src = "house.png";
let houseImgLoaded = false;
houseImg.onload = () => {
  houseImgLoaded = true;
};

// Background
const bgImg = new Image();
bgImg.src = "background.png";
let bgLoaded = false;
bgImg.onload = () => {
  bgLoaded = true;
};

// Parrot obstacle
const parrotImg = new Image();
parrotImg.src = "parrot.png";
let parrotImgLoaded = false;
parrotImg.onload = () => {
  parrotImgLoaded = true;
};

// ---- Game constants / state ----
let gameSpeed = 600;           // starts fast
const SPEED_ACCEL = 20;        // how quickly speed increases (pixels/s per second)
const gravity = 3200;          // stronger gravity for quick jumps

const groundY = HEIGHT - 10;   // near bottom of canvas

const normalHeight = 80;
const duckHeight = 40;
let isDucking = false;

const dino = {
  x: 80,
  y: groundY - normalHeight,
  width: 60,
  height: normalHeight,
  vy: 0,
  onGround: true,
};

// Obstacles
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 1.5;    // seconds between possible spawns

// Score
let score = 0;

// ---- Quiz state ----
const QUIZ_INTERVAL = 10;      // seconds
let quizActive = false;
let timeSinceQuiz = 0;
let quizIndex = 0;

// Simple example questions – change these to your class questions
const quizData = [
  {
    question: "What key do you use to jump in this game?",
    options: ["A", "Space or Up Arrow", "Shift", "Ctrl"],
    correctIndex: 1,
  },
  {
    question: "What is the girl trying to avoid?",
    options: ["Cars", "Houses and parrots", "Coins", "Water"],
    correctIndex: 1,
  },
  {
    question: "What happens if you answer a question wrong?",
    options: ["Nothing", "You get more points", "The game restarts", "The game speeds up"],
    correctIndex: 2,
  },
];

// Quiz DOM elements
const quizOverlay = document.getElementById("quiz-overlay");
const quizQuestionEl = document.getElementById("quiz-question");
const quizOptionsEl = document.getElementById("quiz-options");

// Death overlay elements
const deathOverlay = document.getElementById("death-overlay");
const deathMessageEl = document.getElementById("death-message");
let deathActive = false;
let lastHitType = null; // "house" or "parrot"

// Wrong answer overlay
const wrongOverlay = document.getElementById("wrong-overlay");
let wrongActive = false;

// Correct answer overlay
const correctOverlay = document.getElementById("correct-overlay");
const correctMainEl = document.getElementById("correct-main");
const correctCountEl = document.getElementById("correct-count");
let correctActive = false;
let correctCountdownTimer = null;



// ---- Input: jump + duck ----
window.addEventListener("keydown", (e) => {
  // If wrong-answer popup is active, ANY key restarts
  if (wrongActive) {
    wrongOverlay.style.display = "none";
    wrongActive = false;
    resetGame();
    return;
  }

  // If death popup is active, ANY key restarts
  if (deathActive) {
    deathOverlay.style.display = "none";
    deathActive = false;
    resetGame();
    return;
  }

  // During correct countdown, ignore controls
  if (correctActive) return;

  // During quiz, ignore game controls
  if (quizActive) return;

  if (e.code === "Space" || e.code === "ArrowUp") {
    jump();
  }

  if (e.code === "ArrowDown") {
    startDuck();
  }
});



window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown") {
    stopDuck();
  }
});

function jump() {
  if (dino.onGround) {
    dino.vy = -800;   // LOWER jump: can clear houses but not parrots
    dino.onGround = false;
  }
}


function startDuck() {
  if (!dino.onGround) return;   // only duck on ground
  if (!isDucking) {
    isDucking = true;
    dino.height = duckHeight;
    dino.y = groundY - dino.height;   // keep feet on ground
  }
}

function stopDuck() {
  if (isDucking) {
    isDucking = false;
    dino.height = normalHeight;
    dino.y = groundY - dino.height;
  }
}

// ---- Game logic ----

function resetGame() {
  obstacles = [];
  score = 0;

  isDucking = false;
  dino.height = normalHeight;
  dino.y = groundY - dino.height;
  dino.vy = 0;
  dino.onGround = true;

  timeSinceQuiz = 0;
  obstacleTimer = 0;
  gameSpeed = 600;

  // clear overlays & state
  deathActive = false;
  lastHitType = null;
  deathOverlay.style.display = "none";

  wrongActive = false;
  wrongOverlay.style.display = "none";

  correctActive = false;
  correctOverlay.style.display = "none";
  if (correctCountdownTimer) {
    clearInterval(correctCountdownTimer);
    correctCountdownTimer = null;
  }

  quizActive = false;
  quizOverlay.style.display = "none";

  running = true;
}



function spawnObstacle() {
  // 0 = house, 1 = parrot
  const type = Math.random() < 0.5 ? "house" : "parrot";

  let width, height, x, y;
  x = WIDTH + 20;

  if (type === "house") {
    width = 60;
    height = 70;              // smaller house so you can jump over it
    y = groundY - height;     // sits on the ground
  } else {
    width = 80;
    height = 60;
    const flyOffset = 70;     // mid-air, in “duck only” zone
    y = groundY - height - flyOffset;
  }

  obstacles.push({ x, y, width, height, type });
}


function update(dt) {
  if (!running) return;

  // If a quiz is active, freeze game update
  if (quizActive) return;

  // Time tracking for quiz
  timeSinceQuiz += dt;
  if (timeSinceQuiz >= QUIZ_INTERVAL) {
    triggerQuiz();
    return;
  }

  // Score increases over time
  score += dt * 10;

  // Increase speed over time
  gameSpeed += SPEED_ACCEL * dt;

  // Update dino physics
  dino.vy += gravity * dt;
  dino.y += dino.vy * dt;

  if (dino.y >= groundY - dino.height) {
    dino.y = groundY - dino.height;
    dino.vy = 0;
    dino.onGround = true;
  }

  // Obstacle spawn timer
  obstacleTimer += dt;
  if (obstacleTimer >= obstacleInterval) {
    spawnObstacle();
    // randomize next interval slightly
    obstacleInterval = 1.2 + Math.random() * 1.0;
    obstacleTimer = 0;
  }

  // Move obstacles
  obstacles.forEach((obs) => {
    obs.x -= gameSpeed * dt;
  });

  // Remove off-screen obstacles
  obstacles = obstacles.filter((obs) => obs.x + obs.width > 0);

  // Collision detection
  for (const obs of obstacles) {
    if (rectsOverlap(dino, obs)) {
      // Record what we hit and show death popup
      lastHitType = obs.type;  // "house" or "parrot"
      running = false;
      showDeathScreen();
      break;
    }
  }
} // <--- this closing brace was missing


function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function showDeathScreen() {
  deathActive = true;

  let msg;
  if (lastHitType === "house") {
    msg = "Well done, you just ran headlong into a house.";
  } else if (lastHitType === "parrot") {
    msg = "Well done, you just ran headlong into a parrot.";
  } else {
    msg = "Well done, you just ran headlong into something.";
  }

  deathMessageEl.textContent = msg;
  deathOverlay.style.display = "flex";
}



// ---- Drawing ----

function draw() {
  // Background cropped (no stretch)
  if (bgLoaded) {
    const srcWidth = bgImg.width;
    const srcHeight = bgImg.height;

    const desiredRatio = WIDTH / HEIGHT;
    let cropWidth = srcWidth;
    let cropHeight = srcWidth / desiredRatio;

    if (cropHeight > srcHeight) {
      cropHeight = srcHeight;
      cropWidth = cropHeight * desiredRatio;
    }

    const sx = (srcWidth - cropWidth) / 2;
    const sy = (srcHeight - cropHeight) / 2;

    ctx.drawImage(
      bgImg,
      sx, sy, cropWidth, cropHeight,   // source cropped area
      0, 0, WIDTH, HEIGHT              // draw to canvas
    );
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Optional extra ground line
 

  // Girl
  ctx.drawImage(girlImg, dino.x, dino.y, dino.width, dino.height);

// Obstacles (houses + parrots)
const HOUSE_Y_OFFSET = 10; // tweak 0–20 until house sits nicely on the road

obstacles.forEach((obs) => {
  if (obs.type === "house") {
    if (houseImgLoaded) {
      ctx.drawImage(
        houseImg,
        obs.x,
        obs.y + HOUSE_Y_OFFSET,   // visually move house image down a bit
        obs.width,
        obs.height
      );
    } else {
      ctx.fillStyle = "#964b00";
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
  } else if (obs.type === "parrot") {
    if (parrotImgLoaded) {
      ctx.drawImage(parrotImg, obs.x, obs.y, obs.width, obs.height);
    } else {
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
  }
});

  // Score text
  ctx.fillStyle = "#333";
  ctx.font = "16px system-ui";
  ctx.fillText("Score: " + Math.floor(score), 10, 25);
}

// ---- Quiz logic ----

function triggerQuiz() {
  quizActive = true;
  timeSinceQuiz = 0;

  const data = quizData[quizIndex % quizData.length];
  quizQuestionEl.textContent = data.question;

  // Clear previous options
  quizOptionsEl.innerHTML = "";

  data.options.forEach((optText, index) => {
    const btn = document.createElement("button");
    btn.textContent = `${index + 1}. ${optText}`;
    btn.addEventListener("click", () => handleAnswer(index));
    quizOptionsEl.appendChild(btn);
  });

  quizOverlay.style.display = "flex";
}

function showWrongAnswerScreen() {
  wrongActive = true;
  running = false;
  wrongOverlay.style.display = "flex";
}

function startCorrectCountdown() {
  correctActive = true;
  running = false;

  let count = 3;
  correctCountEl.textContent = count;

  // Clear any old timer just in case
  if (correctCountdownTimer) {
    clearInterval(correctCountdownTimer);
    correctCountdownTimer = null;
  }

  correctOverlay.style.display = "flex";

  correctCountdownTimer = setInterval(() => {
    count -= 1;

    if (count > 0) {
      // Update the big number
      correctCountEl.textContent = count;
    } else {
      // Countdown finished
      clearInterval(correctCountdownTimer);
      correctCountdownTimer = null;
      correctOverlay.style.display = "none";
      correctActive = false;
      running = true; // resume game
    }
  }, 1000);
}


function handleAnswer(chosenIndex) {
  const data = quizData[quizIndex % quizData.length];
  const correct = chosenIndex === data.correctIndex;

  // Hide the question popup
  quizOverlay.style.display = "none";
  quizActive = false;

  if (correct) {
    quizIndex++;
    startCorrectCountdown();
  } else {
    showWrongAnswerScreen();
  }
}


// ---- Main loop ----

function loop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Start
resetGame();
requestAnimationFrame(loop);
