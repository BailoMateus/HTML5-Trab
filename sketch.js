// ============================================================
// NEON SURVIVORS — Jogo estilo Vampire Survivors com p5.js
// Arquivo principal contendo toda a lógica do jogo.
// ============================================================

// --- Variável de estado que controla qual tela está ativa ---
// 0 = Início, 1 = Instruções, 2 = Jogo, 3 = Game Over, 4 = Powerups
let gameState = 0;

// --- Objetos e listas principais do jogo ---
let player;               // Instância do jogador
let enemies = [];          // Lista de inimigos ativos
let bosses = [];           // Lista de bosses ativos
let projectiles = [];      // Lista de projéteis ativos
let particles = [];        // Lista de partículas visuais
let score = 0;             // Pontuação atual
let gameTimer = 0;         // Contador de frames desde o início da partida
let spawnInterval = 60;    // Intervalo (em frames) para gerar inimigos
let shootInterval = 25;    // Intervalo (em frames) para atirar (depreciado, usaremos player.fireRate)
let lastShot = 0;          // Frame do último disparo
let lastSpawn = 0;         // Frame do último spawn
let cameraX = 0;           // Deslocamento X da câmera
let cameraY = 0;           // Deslocamento Y da câmera

// Variáveis para sistema de Boss e Powerups
let nextBossScore = 500;
let bossMessageTimer = 0;
let availablePowerups = [];

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
    this.baseDamage = 1;     // Dano base dos tiros
    this.fireRate = 25;      // Cooldown dos tiros em frames
    this.piercing = 0;       // Quantos inimigos o tiro atravessa antes de sumir
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
  constructor(x, y, tier, type) {
    this.x = x;
    this.y = y;
    this.tier = tier || 1;           // Nível do inimigo (afeta vida e tamanho)
    this.type = type || 'normal';    // 'normal', 'fast', 'tank'
    
    // Configura atributos baseados no tipo
    if (this.type === 'fast') {
      this.size = 14 + this.tier * 2;
      this.speed = 2.2 + random(-0.2, 0.2);
      this.maxHealth = 1 + this.tier;
      this.damage = 5 + this.tier;
    } else if (this.type === 'tank') {
      this.size = 24 + this.tier * 6;
      this.speed = 0.7 + random(-0.1, 0.1);
      this.maxHealth = 6 + this.tier * 3;
      this.damage = 12 + this.tier * 3;
    } else {
      this.size = 18 + this.tier * 4;
      this.speed = 1.2 + random(-0.3, 0.3);
      this.maxHealth = 2 + this.tier;
      this.damage = 8 + this.tier * 2;
    }
    
    this.health = this.maxHealth;
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

  // Desenha o inimigo na tela de acordo com seu tipo
  draw() {
    push();
    rectMode(CENTER);
    noStroke();
    
    // Cores padrão baseadas no tipo
    let glowColor, mainColor, strokeCol;
    
    if (this.type === 'fast') {
      glowColor = color(255, 255, 60, 30);
      mainColor = color(220, 220, 50);
      strokeCol = color(255, 255, 100);
    } else if (this.type === 'tank') {
      glowColor = color(200, 60, 255, 30);
      mainColor = color(160, 50, 220);
      strokeCol = color(220, 100, 255);
    } else {
      glowColor = color(255, 60, 60, 30);
      mainColor = color(220, 50, 50);
      strokeCol = color(255, 100, 100);
    }
    
    if (this.flashTimer > 0) {
      mainColor = color(255, 255, 255);
    }

    push();
    translate(this.x, this.y);
    
    if (this.type === 'fast') {
      // Desenha um triângulo que aponta para o jogador
      let angle = atan2(player.y - this.y, player.x - this.x);
      rotate(angle);
      
      fill(glowColor);
      triangle(this.size, 0, -this.size, -this.size*0.8, -this.size, this.size*0.8);
      
      fill(mainColor);
      stroke(strokeCol);
      strokeWeight(1.5);
      triangle(this.size*0.8, 0, -this.size*0.8, -this.size*0.6, -this.size*0.8, this.size*0.6);
      
    } else if (this.type === 'tank') {
      // Desenha um losango
      rotate(PI / 4);
      fill(glowColor);
      rect(0, 0, this.size * 1.8, this.size * 1.8, 4);
      
      fill(mainColor);
      stroke(strokeCol);
      strokeWeight(1.5);
      rect(0, 0, this.size, this.size, 3);
      
    } else {
      // Quadrado normal
      fill(glowColor);
      rect(0, 0, this.size * 1.8, this.size * 1.8, 4);
      
      fill(mainColor);
      stroke(strokeCol);
      strokeWeight(1.5);
      rect(0, 0, this.size, this.size, 3);
    }
    pop();

    // Barra de vida
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
// CLASSE BOSS — Chefe gigantesco e resistente
// ============================================================
class Boss {
  constructor(x, y, tier) {
    this.x = x;
    this.y = y;
    this.tier = tier || 1;
    this.size = 80 + this.tier * 10;
    this.speed = 0.8 + (this.tier * 0.1);
    this.maxHealth = 100 + this.tier * 50; // Vida inicial reduzida (150 no nível 1)
    this.health = this.maxHealth;
    this.damage = 25 + this.tier * 5;
    this.flashTimer = 0;
  }

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

  takeDamage(amount) {
    this.health -= amount;
    this.flashTimer = 6;
    return this.health <= 0;
  }

  draw() {
    push();
    rectMode(CENTER);
    
    let glowColor = color(255, 150, 50, 40);
    let mainColor = color(220, 100, 20);
    let strokeCol = color(255, 200, 100);
    
    if (this.flashTimer > 0) {
      mainColor = color(255, 255, 255);
    }

    push();
    translate(this.x, this.y);
    let pulse = sin(frameCount * 0.1) * 10;
    
    // Hexágono (ou estrela pulsante)
    rotate(frameCount * 0.01);
    
    fill(glowColor);
    noStroke();
    circle(0, 0, this.size * 1.5 + pulse * 2);
    
    fill(mainColor);
    stroke(strokeCol);
    strokeWeight(3);
    
    // Desenha um octógono
    beginShape();
    for (let i = 0; i < 8; i++) {
      let angle = TWO_PI / 8 * i;
      let vx = cos(angle) * (this.size/2 + pulse);
      let vy = sin(angle) * (this.size/2 + pulse);
      vertex(vx, vy);
    }
    endShape(CLOSE);
    
    // Detalhe central
    fill(0, 0, 0, 100);
    circle(0, 0, this.size * 0.4);
    
    pop();
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
    this.damage = player.baseDamage;
    this.life = 90; // Frames de vida restantes antes de desaparecer
    this.piercing = player.piercing; // Quantas vezes pode perfurar
    this.hitTargets = []; // Guarda os alvos já atingidos
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
  createCanvas(1000, 800);
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
  } else if (gameState === 4) {
    drawPowerupScreen();
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
    'Inimigos (quadrados vermelhos) surgem continuamente.',
    'Rápidos (Amarelos) e Tanques (Roxos) aparecem com o tempo.',
    '',
    'A cada 500 pontos, um BOSS (Dourado) surge.',
    'Derrote o Boss para escolher um POWERUP de status!',
    '',
    'Seu personagem ataca automaticamente,',
    'disparando projéteis no alvo mais próximo.',
    '',
    'Se sua vida chegar a 0, é Game Over!',
    'Sobreviva o máximo que puder!'
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
  updateBosses();          // Atualiza e desenha bosses
  updateParticles();       // Atualiza e desenha partículas
  checkEnemyPlayerCollisions(); // Verifica colisões inimigo-jogador
  player.draw();           // Desenha o jogador

  pop();

  drawHUD(); // Desenha interface (vida, pontuação, tempo)
  
  // Mensagem do Boss
  if (bossMessageTimer > 0) {
    push();
    textAlign(CENTER, CENTER);
    let pulse = sin(frameCount * 0.2) * 5;
    textSize(32 + pulse);
    fill(255, 100, 100);
    stroke(0);
    strokeWeight(4);
    text('UM BOSS FOI SUMMONADO!', width / 2, height / 4);
    pop();
    bossMessageTimer--;
  }
}

// ============================================================
// FUNÇÕES AUXILIARES DO JOGO
// ============================================================

// Gera inimigos fora da tela a cada intervalo de spawn
function spawnEnemies() {
  // Escalona dificuldade: reduz intervalo de spawn ao longo do tempo
  let difficulty = Math.floor(gameTimer / 600); // Aumenta a cada 10 segundos
  let currentSpawnInterval = max(15, spawnInterval - difficulty * 3);

  // Lógica de spawn do Boss
  if (score >= nextBossScore) {
    let angle = random(TWO_PI);
    let dist = random(450, 600);
    let ex = player.x + cos(angle) * dist;
    let ey = player.y + sin(angle) * dist;
    
    // Tier aumenta a cada boss
    let tier = Math.floor(nextBossScore / 500); 
    bosses.push(new Boss(ex, ey, tier));
    
    nextBossScore += 500;
    bossMessageTimer = 180; // 3 segundos de mensagem
  }

  // Pausar spawn de inimigos normais enquanto existir um boss
  if (bosses.length > 0) {
    if (score < 3000) {
      return; // Pausa completamente
    } else {
      currentSpawnInterval *= 3; // Reduz drasticamente o spawn
    }
  }

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
      let type = 'normal';
      
      // Aumenta muito a variabilidade para aparecer mais rápidos e tanques
      if (difficulty > 2) {
        tier = random() < 0.4 ? 2 : 1;
        if (random() < 0.3) type = 'fast';
      }
      if (difficulty > 6) {
        tier = random() < 0.3 ? 3 : (random() < 0.5 ? 2 : 1);
        let r = random();
        if (r < 0.3) type = 'tank';
        else if (r < 0.6) type = 'fast';
      }

      enemies.push(new Enemy(ex, ey, tier, type));
    }
  }
}

// Dispara um projétil em direção ao inimigo mais próximo
function shootAtClosestEnemy() {
  if (frameCount - lastShot < player.fireRate) return; // Respeita cooldown (usando player.fireRate)
  
  // Agrupa bosses e enemies para encontrar o mais próximo
  let allTargets = enemies.concat(bosses);
  if (allTargets.length === 0) return; // Sem alvos

  // Encontra o alvo mais próximo do jogador
  let closest = null;
  let closestDist = Infinity;
  for (let i = 0; i < allTargets.length; i++) {
    let d = dist(player.x, player.y, allTargets[i].x, allTargets[i].y);
    if (d < closestDist) {
      closestDist = d;
      closest = allTargets[i];
    }
  }

  // Só atira se o inimigo estiver dentro do alcance visual
  if (closest && closestDist < 500) {
    projectiles.push(new Projectile(player.x, player.y, closest.x, closest.y));
    lastShot = frameCount;
  }
}

// Atualiza e desenha todos os projéteis; verifica colisão com inimigos e bosses
function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.update();

    // Remove projéteis expirados
    if (!p.isAlive()) {
      projectiles.splice(i, 1);
      continue;
    }

    let hitDestroyed = false; // Define se o projétil deve ser destruído
    
    // Verifica colisão com bosses primeiro (tamanho maior)
    for (let j = bosses.length - 1; j >= 0; j--) {
      let b = bosses[j];
      if (p.hitTargets.includes(b)) continue; // Já bateu neste boss
      
      let d = dist(p.x, p.y, b.x, b.y);
      if (d < (p.size + b.size) / 2) {
        p.hitTargets.push(b);
        let killed = b.takeDamage(p.damage);
        if (killed) {
          spawnDeathParticles(b.x, b.y);
          spawnDeathParticles(b.x + 20, b.y - 20); // Mais partículas pro Boss
          score += 150 * b.tier; // Mais pontos
          bosses.splice(j, 1);
          // Prepara a tela de powerups
          setupPowerups();
          gameState = 4; 
        }
        if (p.piercing > 0) {
          p.piercing--;
        } else {
          hitDestroyed = true;
          break; // Para o loop se destruiu
        }
      }
    }
    
    // Verifica colisão com inimigos normais
    if (!hitDestroyed) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        let e = enemies[j];
        if (p.hitTargets.includes(e)) continue; // Já bateu neste inimigo
        
        let d = dist(p.x, p.y, e.x, e.y);
        if (d < (p.size + e.size) / 2) {
          p.hitTargets.push(e);
          let killed = e.takeDamage(p.damage);
          if (killed) {
            spawnDeathParticles(e.x, e.y);
            score += 10 * e.tier;
            enemies.splice(j, 1);
          }
          if (p.piercing > 0) {
            p.piercing--;
          } else {
            hitDestroyed = true;
            break; // Para o loop se destruiu
          }
        }
      }
    }

    if (hitDestroyed) {
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

// Atualiza e desenha todos os bosses ativos
function updateBosses() {
  for (let i = 0; i < bosses.length; i++) {
    bosses[i].update();
    bosses[i].draw();
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
  for (let i = 0; i < bosses.length; i++) {
    let b = bosses[i];
    let d = dist(player.x, player.y, b.x, b.y);
    if (d < (player.size + b.size) / 2) {
      player.takeDamage(b.damage);
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
  
  // Barras de vida dos Bosses (se houver ativos)
  for (let i = 0; i < bosses.length; i++) {
    let b = bosses[i];
    let bBarW = width - 300;
    let bBarH = 16;
    let bBarX = 150;
    let bBarY = height - 40 - (i * 22); // Empilha uma em cima da outra
    
    noStroke();
    fill(40, 40, 50);
    rect(bBarX, bBarY, bBarW, bBarH, 4);
    
    let bRatio = b.health / b.maxHealth;
    fill(255, 150, 50);
    rect(bBarX, bBarY, bBarW * bRatio, bBarH, 4);
    
    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('BOSS: ' + Math.ceil(b.health) + ' / ' + b.maxHealth, width / 2, bBarY + bBarH / 2);
  }

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
// TELA 4 — SELEÇÃO DE POWERUP
// ============================================================
function setupPowerups() {
  // Lista de possíveis powerups
  let allPowerups = [
    { title: "Vida Máxima", desc: "+20 Max HP", apply: () => { player.maxHealth += 20; player.health += 20; } },
    { title: "Velocidade", desc: "+1 Speed", apply: () => { player.speed += 1; } },
    { title: "Mais Dano", desc: "+1 Dano", apply: () => { player.baseDamage += 1; } },
    { title: "Tiro Rápido", desc: "Reduz recarga", apply: () => { player.fireRate = max(5, player.fireRate - 5); } },
    { title: "Penetrante", desc: "+1 Alvo atingido", apply: () => { player.piercing += 1; } }
  ];
  
  // Seleciona 3 aleatórios
  availablePowerups = [];
  while (availablePowerups.length < 3) {
    let p = random(allPowerups);
    if (!availablePowerups.includes(p)) {
      availablePowerups.push(p);
    }
  }
}

function drawPowerupScreen() {
  // Desenha o fundo e o jogador parecendo pausado
  drawWorldBackground();
  push();
  translate(-cameraX, -cameraY);
  player.draw();
  pop();
  
  // Fundo translúcido
  push();
  fill(0, 0, 0, 200);
  rectMode(CORNER);
  rect(0, 0, width, height);
  
  textAlign(CENTER, CENTER);
  textSize(36);
  fill(255, 255, 100);
  let titleText = score === 0 ? "BÔNUS INICIAL!" : "BOSS DERROTADO!";
  text(titleText, width / 2, 100);
  
  textSize(24);
  fill(200, 200, 200);
  text("Escolha um Powerup (Pressione 1, 2 ou 3):", width / 2, 150);
  
  // Desenha os 3 botões/caixas
  for (let i = 0; i < 3; i++) {
    let boxW = 200;
    let boxH = 150;
    let boxX = width / 2 - boxW * 1.5 + i * (boxW + 20) + 10;
    let boxY = 250;
    
    // Caixa
    fill(40, 40, 60);
    stroke(100, 100, 150);
    strokeWeight(2);
    rectMode(CORNER);
    rect(boxX, boxY, boxW, boxH, 10);
    
    // Texto Número
    fill(255);
    noStroke();
    textSize(20);
    text("[" + (i + 1) + "]", boxX + boxW / 2, boxY + 25);
    
    // Título
    fill(100, 255, 100);
    textSize(22);
    text(availablePowerups[i].title, boxX + boxW / 2, boxY + 70);
    
    // Descrição
    fill(180);
    textSize(16);
    text(availablePowerups[i].desc, boxX + boxW / 2, boxY + 110);
  }
  pop();
}

// ============================================================
// CONTROLE DE TECLADO — Transição entre telas
// ============================================================
function keyPressed() {
  if (gameState === 4) {
    if (key === '1') { availablePowerups[0].apply(); gameState = 2; }
    if (key === '2') { availablePowerups[1].apply(); gameState = 2; }
    if (key === '3') { availablePowerups[2].apply(); gameState = 2; }
  } else if (keyCode === ENTER) {
    if (gameState === 0 || gameState === 1) {
      // Inicia o jogo: reseta todas as variáveis e pede o powerup inicial
      resetGame();
      setupPowerups();
      gameState = 4;
    } else if (gameState === 3) {
      // Reinicia após Game Over
      resetGame();
      setupPowerups();
      gameState = 4;
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
  bosses = [];
  projectiles = [];
  particles = [];
  score = 0;
  gameTimer = 0;
  lastShot = 0;
  lastSpawn = 0;
  cameraX = 0;
  cameraY = 0;
  nextBossScore = 500;
  bossMessageTimer = 0;
}
