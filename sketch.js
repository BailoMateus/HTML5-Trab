// ============================================================
// NEON SURVIVORS — Jogo estilo Vampire Survivors com p5.js
// Arquivo principal contendo toda a lógica do jogo.
// ============================================================

// --- Variável de estado que controla qual tela está ativa ---
// 0 = Início, 1 = Instruções, 2 = Jogo, 3 = Game Over
let gameState = 0;

// --- Objetos e listas principais do jogo ---
let player;               // Instância do jogador
let enemies = [];          // Lista de inimigos ativos
let projectiles = [];      // Lista de projéteis ativos
let particles = [];        // Lista de partículas visuais
let score = 0;             // Pontuação atual
let gameTimer = 0;         // Contador de frames desde o início da partida
let spawnInterval = 60;    // Intervalo (em frames) para gerar inimigos
let shootInterval = 25;    // Intervalo (em frames) para atirar
let lastShot = 0;          // Frame do último disparo
let lastSpawn = 0;         // Frame do último spawn
let cameraX = 0;           // Deslocamento X da câmera
let cameraY = 0;           // Deslocamento Y da câmera

// ============================================================
// CLASSE PLAYER — Representa o personagem controlado pelo jogador
// ============================================================
class Player {
  constructor() {
    this.x = 0;             // Posição X no mundo
    this.y = 0;             // Posição Y no mundo
    this.size = 28;          // Tamanho do jogador
    this.speed = 3.5;        // Velocidade de movimento
    this.maxHealth = 100;    // Vida máxima
    this.health = 100;       // Vida atual
    this.invincibleTimer = 0;// Frames restantes de invencibilidade após levar dano
  }

  // Atualiza posição com base nas teclas pressionadas (WASD ou Setas)
  update() {
    let dx = 0, dy = 0;
    if (keyIsDown(65) || keyIsDown(LEFT_ARROW))  dx -= 1; // A ou Seta Esquerda
    if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) dx += 1; // D ou Seta Direita
    if (keyIsDown(87) || keyIsDown(UP_ARROW))    dy -= 1; // W ou Seta Cima
    if (keyIsDown(83) || keyIsDown(DOWN_ARROW))  dy += 1; // S ou Seta Baixo

    // Normaliza diagonal para manter velocidade constante
    if (dx !== 0 && dy !== 0) {
      let len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }
    this.x += dx * this.speed;
    this.y += dy * this.speed;

    // Reduz timer de invencibilidade
    if (this.invincibleTimer > 0) this.invincibleTimer--;
  }

  // Aplica dano ao jogador e ativa invencibilidade temporária
  takeDamage(amount) {
    if (this.invincibleTimer > 0) return; // Ignora se invencível
    this.health -= amount;
    this.invincibleTimer = 30; // ~0.5 segundo de invencibilidade
    if (this.health <= 0) {
      this.health = 0;
      gameState = 3; // Muda para tela de Game Over
    }
  }

  // Desenha o jogador na tela
  draw() {
    push();
    // Efeito de piscar quando invencível
    if (this.invincibleTimer > 0 && frameCount % 6 < 3) {
      pop();
      return;
    }
    // Brilho ao redor do jogador
    noStroke();
    fill(80, 160, 255, 40);
    circle(this.x, this.y, this.size * 2.5);
    fill(80, 160, 255, 80);
    circle(this.x, this.y, this.size * 1.6);
    // Corpo principal — círculo azul
    fill(100, 180, 255);
    stroke(180, 220, 255);
    strokeWeight(2);
    circle(this.x, this.y, this.size);
    pop();
  }
}

// ============================================================
// CLASSE ENEMY — Representa um inimigo que persegue o jogador
// ============================================================
class Enemy {
  constructor(x, y, tier) {
    this.x = x;
    this.y = y;
    this.tier = tier || 1;           // Nível do inimigo (afeta vida e tamanho)
    this.size = 18 + this.tier * 4;  // Tamanho baseado no tier
    this.speed = 1.2 + random(-0.3, 0.3); // Velocidade com variação aleatória
    this.maxHealth = 2 + this.tier;  // Vida máxima
    this.health = this.maxHealth;
    this.damage = 8 + this.tier * 2; // Dano causado ao jogador
    this.flashTimer = 0;             // Timer para efeito de flash ao ser atingido
  }

  // Move o inimigo na direção do jogador
  update() {
    let dx = player.x - this.x;
    let dy = player.y - this.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
    if (this.flashTimer > 0) this.flashTimer--;
  }

  // Aplica dano ao inimigo e retorna true se morreu
  takeDamage(amount) {
    this.health -= amount;
    this.flashTimer = 6;
    return this.health <= 0;
  }

  // Desenha o inimigo na tela — quadrado vermelho
  draw() {
    push();
    rectMode(CENTER);
    noStroke();
    // Brilho sutil ao redor
    fill(255, 60, 60, 30);
    rect(this.x, this.y, this.size * 1.8, this.size * 1.8, 4);
    // Corpo — branco se levou dano recentemente, vermelho normalmente
    if (this.flashTimer > 0) {
      fill(255, 255, 255);
    } else {
      fill(220, 50, 50);
    }
    stroke(255, 100, 100);
    strokeWeight(1.5);
    rect(this.x, this.y, this.size, this.size, 3);
    // Barra de vida do inimigo (só aparece se não estiver com vida cheia)
    if (this.health < this.maxHealth) {
      noStroke();
      let barW = this.size;
      let barH = 4;
      let barY = this.y - this.size / 2 - 8;
      fill(60, 60, 60);
      rect(this.x, barY, barW, barH, 2);
      fill(255, 80, 80);
      let healthRatio = this.health / this.maxHealth;
      rect(this.x - barW * (1 - healthRatio) / 2, barY, barW * healthRatio, barH, 2);
    }
    pop();
  }
}

// ============================================================
// CLASSE PROJECTILE — Projéteis disparados automaticamente
// ============================================================
class Projectile {
  constructor(x, y, targetX, targetY) {
    this.x = x;
    this.y = y;
    this.size = 8;
    this.speed = 7;
    this.damage = 1;
    this.life = 90; // Frames de vida restantes antes de desaparecer
    // Calcula direção normalizada para o alvo
    let dx = targetX - x;
    let dy = targetY - y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
  }

  // Atualiza posição e reduz tempo de vida
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  // Verifica se o projétil ainda é válido
  isAlive() {
    return this.life > 0;
  }

  // Desenha o projétil — pequeno círculo amarelo brilhante
  draw() {
    push();
    noStroke();
    fill(255, 255, 100, 50);
    circle(this.x, this.y, this.size * 2.5);
    fill(255, 255, 150);
    circle(this.x, this.y, this.size);
    pop();
  }
}

// ============================================================
// CLASSE PARTICLE — Partículas visuais para efeitos de explosão
// ============================================================
class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, 3);
    this.vy = random(-3, 3);
    this.life = random(15, 30);  // Duração da partícula em frames
    this.maxLife = this.life;
    this.size = random(3, 7);
    this.col = col || [255, 100, 100]; // Cor (padrão: vermelho)
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  isAlive() {
    return this.life > 0;
  }

  draw() {
    push();
    noStroke();
    let alpha = map(this.life, 0, this.maxLife, 0, 255);
    fill(this.col[0], this.col[1], this.col[2], alpha);
    circle(this.x, this.y, this.size);
    pop();
  }
}

// ============================================================
// FUNÇÕES DE SETUP E DRAW DO p5.js
// ============================================================

// Função chamada uma vez ao iniciar — configura o canvas
function setup() {
  createCanvas(800, 600);
  textFont('monospace');
}

// Função chamada a cada frame — controla qual tela exibir
function draw() {
  background(15, 15, 25);

  // Máquina de estados: decide qual tela renderizar
  if (gameState === 0) {
    drawStartScreen();
  } else if (gameState === 1) {
    drawInstructionsScreen();
  } else if (gameState === 2) {
    runGame();
  } else if (gameState === 3) {
    drawGameOverScreen();
  }
}

// ============================================================
// TELA 0 — TELA DE INÍCIO
// ============================================================
function drawStartScreen() {
  // Fundo com grade animada sutil
  drawBackgroundGrid();

  push();
  textAlign(CENTER, CENTER);

  // Título do jogo com efeito de pulso
  let pulse = sin(frameCount * 0.05) * 10;
  textSize(52 + pulse * 0.3);
  fill(100, 200, 255);
  text('NEON SURVIVORS', width / 2, height / 2 - 80);

  // Subtítulo
  textSize(16);
  fill(180, 180, 200);
  text('Um jogo de sobrevivência contra hordas infinitas', width / 2, height / 2 - 30);

  // Instrução para iniciar — pisca suavemente
  let alpha = map(sin(frameCount * 0.08), -1, 1, 80, 255);
  textSize(18);
  fill(255, 255, 100, alpha);
  text('Pressione ENTER para jogar', width / 2, height / 2 + 40);

  // Link para instruções
  textSize(14);
  fill(150, 150, 170);
  text('Pressione I para ver as instruções', width / 2, height / 2 + 80);
  pop();
}

// ============================================================
// TELA 1 — TELA DE INSTRUÇÕES
// ============================================================
function drawInstructionsScreen() {
  drawBackgroundGrid();

  push();
  textAlign(CENTER, CENTER);

  textSize(36);
  fill(100, 200, 255);
  text('COMO JOGAR', width / 2, 70);

  textSize(16);
  fill(220, 220, 230);
  let instructions = [
    'Use WASD ou Setas para mover o personagem.',
    '',
    'Inimigos (quadrados vermelhos) surgem continuamente',
    'e perseguem você. Não deixe que te toquem!',
    '',
    'Seu personagem ataca automaticamente,',
    'disparando projéteis no inimigo mais próximo.',
    '',
    'Cada inimigo derrotado dá pontos.',
    'Se sua vida chegar a 0, é Game Over!',
    '',
    'A dificuldade aumenta gradualmente com o tempo.',
    'Tente sobreviver o máximo possível!'
  ];

  // Percorre cada linha de instrução e exibe na tela
  for (let i = 0; i < instructions.length; i++) {
    text(instructions[i], width / 2, 140 + i * 28);
  }

  let alpha = map(sin(frameCount * 0.08), -1, 1, 80, 255);
  textSize(18);
  fill(255, 255, 100, alpha);
  text('Pressione ENTER para jogar', width / 2, height - 60);
  pop();
}

// ============================================================
// TELA 3 — TELA DE GAME OVER
// ============================================================
function drawGameOverScreen() {
  drawBackgroundGrid();

  push();
  textAlign(CENTER, CENTER);

  // Título Game Over
  textSize(48);
  fill(255, 70, 70);
  text('GAME OVER', width / 2, height / 2 - 80);

  // Pontuação final
  textSize(22);
  fill(255, 255, 100);
  text('Pontuação: ' + score, width / 2, height / 2 - 20);

  // Tempo sobrevivido (converte frames em segundos)
  let seconds = Math.floor(gameTimer / 60);
  textSize(16);
  fill(180, 180, 200);
  text('Tempo sobrevivido: ' + seconds + 's', width / 2, height / 2 + 20);

  // Instrução para reiniciar
  let alpha = map(sin(frameCount * 0.08), -1, 1, 80, 255);
  textSize(18);
  fill(255, 255, 100, alpha);
  text('Pressione ENTER para tentar novamente', width / 2, height / 2 + 80);
  pop();
}

// ============================================================
// LÓGICA PRINCIPAL DO JOGO (TELA 2)
// ============================================================
function runGame() {
  gameTimer++;

  // Atualiza a câmera para seguir o jogador
  cameraX = player.x - width / 2;
  cameraY = player.y - height / 2;

  push();
  translate(-cameraX, -cameraY); // Aplica deslocamento da câmera

  drawWorldBackground();   // Desenha grade de fundo do mundo
  player.update();         // Atualiza posição do jogador
  spawnEnemies();          // Gera novos inimigos
  shootAtClosestEnemy();   // Dispara projéteis automaticamente
  updateProjectiles();     // Atualiza e desenha projéteis
  updateEnemies();         // Atualiza e desenha inimigos
  updateParticles();       // Atualiza e desenha partículas
  checkEnemyPlayerCollisions(); // Verifica colisões inimigo-jogador
  player.draw();           // Desenha o jogador

  pop();

  drawHUD(); // Desenha interface (vida, pontuação, tempo)
}

// ============================================================
// FUNÇÕES AUXILIARES DO JOGO
// ============================================================

// Gera inimigos fora da tela a cada intervalo de spawn
function spawnEnemies() {
  // Escalona dificuldade: reduz intervalo de spawn ao longo do tempo
  let difficulty = Math.floor(gameTimer / 600); // Aumenta a cada 10 segundos
  let currentSpawnInterval = max(15, spawnInterval - difficulty * 3);

  if (frameCount - lastSpawn >= currentSpawnInterval) {
    lastSpawn = frameCount;

    // Número de inimigos por spawn aumenta com a dificuldade
    let count = 1 + Math.floor(difficulty / 3);
    for (let i = 0; i < count; i++) {
      // Posição aleatória fora da tela visível
      let angle = random(TWO_PI);
      let dist = random(420, 550);
      let ex = player.x + cos(angle) * dist;
      let ey = player.y + sin(angle) * dist;

      // Tier do inimigo aumenta gradualmente
      let tier = 1;
      if (difficulty > 5) tier = random() < 0.3 ? 2 : 1;
      if (difficulty > 12) tier = random() < 0.2 ? 3 : (random() < 0.4 ? 2 : 1);

      enemies.push(new Enemy(ex, ey, tier));
    }
  }
}

// Dispara um projétil em direção ao inimigo mais próximo
function shootAtClosestEnemy() {
  if (frameCount - lastShot < shootInterval) return; // Respeita cooldown
  if (enemies.length === 0) return; // Sem inimigos, não atira

  // Encontra o inimigo mais próximo do jogador
  let closest = null;
  let closestDist = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    let d = dist(player.x, player.y, enemies[i].x, enemies[i].y);
    if (d < closestDist) {
      closestDist = d;
      closest = enemies[i];
    }
  }

  // Só atira se o inimigo estiver dentro do alcance visual
  if (closest && closestDist < 500) {
    projectiles.push(new Projectile(player.x, player.y, closest.x, closest.y));
    lastShot = frameCount;
  }
}

// Atualiza e desenha todos os projéteis; verifica colisão com inimigos
function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.update();

    // Remove projéteis expirados
    if (!p.isAlive()) {
      projectiles.splice(i, 1);
      continue;
    }

    // Verifica colisão com cada inimigo
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      let e = enemies[j];
      let d = dist(p.x, p.y, e.x, e.y);
      if (d < (p.size + e.size) / 2) {
        hit = true;
        let killed = e.takeDamage(p.damage);
        if (killed) {
          // Gera partículas de explosão ao destruir inimigo
          spawnDeathParticles(e.x, e.y);
          score += 10 * e.tier;
          enemies.splice(j, 1);
        }
        break; // Um projétil atinge apenas um inimigo
      }
    }
    if (hit) {
      projectiles.splice(i, 1);
    } else {
      p.draw();
    }
  }
}

// Atualiza e desenha todos os inimigos ativos
function updateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    enemies[i].update();
    enemies[i].draw();
  }
}

// Verifica colisão entre inimigos e o jogador
function checkEnemyPlayerCollisions() {
  for (let i = 0; i < enemies.length; i++) {
    let e = enemies[i];
    let d = dist(player.x, player.y, e.x, e.y);
    if (d < (player.size + e.size) / 2) {
      player.takeDamage(e.damage);
    }
  }
}

// Atualiza e desenha partículas visuais
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (!particles[i].isAlive()) {
      particles.splice(i, 1);
    } else {
      particles[i].draw();
    }
  }
}

// Cria partículas de explosão na posição de um inimigo destruído
function spawnDeathParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push(new Particle(x, y, [255, random(60, 150), 60]));
  }
}

// ============================================================
// INTERFACE DO JOGO (HUD)
// ============================================================
function drawHUD() {
  push();
  // Barra de vida no topo esquerdo
  let barW = 200;
  let barH = 16;
  let barX = 20;
  let barY = 20;

  // Fundo da barra
  noStroke();
  fill(40, 40, 50);
  rect(barX, barY, barW, barH, 4);

  // Preenchimento da barra de vida (verde -> vermelho conforme perde vida)
  let healthRatio = player.health / player.maxHealth;
  let barColor = lerpColor(color(220, 50, 50), color(80, 220, 80), healthRatio);
  fill(barColor);
  rect(barX, barY, barW * healthRatio, barH, 4);

  // Texto de vida
  fill(255);
  textSize(11);
  textAlign(LEFT, CENTER);
  text('HP: ' + player.health + ' / ' + player.maxHealth, barX + 6, barY + barH / 2);

  // Pontuação no topo direito
  textAlign(RIGHT, TOP);
  textSize(18);
  fill(255, 255, 100);
  text('Score: ' + score, width - 20, 18);

  // Tempo decorrido
  let seconds = Math.floor(gameTimer / 60);
  textSize(14);
  fill(180, 180, 200);
  text('Tempo: ' + seconds + 's', width - 20, 42);

  // Contador de inimigos
  textSize(12);
  fill(255, 120, 120);
  text('Inimigos: ' + enemies.length, width - 20, 62);
  pop();
}

// ============================================================
// FUNÇÕES VISUAIS DE FUNDO
// ============================================================

// Desenha grade animada para telas de menu
function drawBackgroundGrid() {
  push();
  stroke(40, 40, 60);
  strokeWeight(0.5);
  let spacing = 40;
  let offsetX = (frameCount * 0.3) % spacing;
  let offsetY = (frameCount * 0.2) % spacing;
  // Linhas verticais
  for (let x = -spacing + offsetX; x < width + spacing; x += spacing) {
    line(x, 0, x, height);
  }
  // Linhas horizontais
  for (let y = -spacing + offsetY; y < height + spacing; y += spacing) {
    line(0, y, width, y);
  }
  pop();
}

// Desenha grade de fundo no mundo do jogo (se move com a câmera)
function drawWorldBackground() {
  push();
  stroke(30, 30, 45);
  strokeWeight(0.5);
  let spacing = 50;
  // Calcula os limites visíveis com base na câmera
  let startX = Math.floor(cameraX / spacing) * spacing;
  let startY = Math.floor(cameraY / spacing) * spacing;
  for (let x = startX; x < cameraX + width + spacing; x += spacing) {
    line(x, cameraY, x, cameraY + height);
  }
  for (let y = startY; y < cameraY + height + spacing; y += spacing) {
    line(cameraX, y, cameraX + width, y);
  }
  pop();
}

// ============================================================
// CONTROLE DE TECLADO — Transição entre telas
// ============================================================
function keyPressed() {
  if (keyCode === ENTER) {
    if (gameState === 0 || gameState === 1) {
      // Inicia o jogo: reseta todas as variáveis
      resetGame();
      gameState = 2;
    } else if (gameState === 3) {
      // Reinicia após Game Over
      resetGame();
      gameState = 2;
    }
  }

  // Tecla I abre instruções na tela inicial
  if (gameState === 0 && (key === 'i' || key === 'I')) {
    gameState = 1;
  }
}

// Reseta todas as variáveis para um novo jogo
function resetGame() {
  player = new Player();
  enemies = [];
  projectiles = [];
  particles = [];
  score = 0;
  gameTimer = 0;
  lastShot = 0;
  lastSpawn = 0;
  cameraX = 0;
  cameraY = 0;
}
