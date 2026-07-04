// ============================================================
// CONTRA HTML5 - Modern Remake
// A side-scrolling shooter inspired by the classic Contra
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Constants ---
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const GRAVITY = 0.6;
const LEVEL_WIDTH = 6400;
const ENEMY_SPAWN_X = LEVEL_WIDTH - 400;

// Weapon definitions
const WEAPONS = {
  NORMAL: { name: 'N', color: '#ffff00', speed: 10, damage: 1, spread: 0, size: 4, fireRate: 150 },
  SPREAD: { name: 'S', color: '#ff8800', speed: 8, damage: 1, spread: 5, size: 5, fireRate: 300 },
  LASER:  { name: 'L', color: '#00ffff', speed: 18, damage: 2, spread: 0, size: 3, fireRate: 200 },
  FIREBALL: { name: 'F', color: '#ff2200', speed: 6, damage: 3, spread: 0, size: 8, fireRate: 400 }
};

// --- Resize canvas ---
function resizeCanvas() {
  const scaleX = window.innerWidth / GAME_WIDTH;
  const scaleY = window.innerHeight / GAME_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  canvas.style.width = (GAME_WIDTH * scale) + 'px';
  canvas.style.height = (GAME_HEIGHT * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- Input System ---
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// --- Camera ---
const camera = { x: 0, y: 0 };

function updateCamera(targetX, targetY) {
  const cx = targetX - GAME_WIDTH / 2;
  const cy = targetY - GAME_HEIGHT / 2;
  camera.x = Math.max(0, Math.min(cx, LEVEL_WIDTH - GAME_WIDTH));
  camera.y = Math.max(-100, Math.min(cy, 100));
}

// --- Particle System ---
const particles = [];

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.maxLife = life;
    this.size = size || 3;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vy += 0.1 * dt;
    this.life -= dt;
  }
  draw() {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 2,
      color, 30 + Math.random() * 20,
      2 + Math.random() * 3
    ));
  }
}

function spawnSmoke(x, y, count) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(
      x + (Math.random()-0.5)*10, y,
      (Math.random()-0.5)*2, -Math.random()*2,
      '#888', 20 + Math.random()*15,
      3 + Math.random()*4
    ));
  }
}

// --- Bullet ---
class Bullet {
  constructor(x, y, vx, vy, weapon, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.weapon = weapon; this.owner = owner;
    this.damage = weapon.damage;
    this.alive = true;
    this.trail = [];
  }
  update(dt) {
    this.trail.push({x: this.x, y: this.y});
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < camera.x - 50 || this.x > camera.x + GAME_WIDTH + 50) this.alive = false;
    if (this.y < -50 || this.y > camera.y + GAME_HEIGHT + 50) this.alive = false;
  }
  draw() {
    // Draw trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = i / this.trail.length * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.weapon.color;
      const s = this.weapon.size * (i / this.trail.length);
      ctx.beginPath();
      ctx.arc(t.x - camera.x, t.y - camera.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Draw bullet
    ctx.fillStyle = this.weapon.color;
    ctx.shadowColor = this.weapon.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.weapon.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

const bullets = [];

// --- Platform ---
class Platform {
  constructor(x, y, w, h, type) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.type = type || 'normal';
  }
  draw() {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    if (sx > GAME_WIDTH + 10 || sx + this.w < -10) return;

    if (this.type === 'ground') {
      // Ground with grass
      const grd = ctx.createLinearGradient(sx, sy, sx, sy + this.h);
      grd.addColorStop(0, '#4a7a3a');
      grd.addColorStop(0.15, '#6b4226');
      grd.addColorStop(1, '#4a2a14');
      ctx.fillStyle = grd;
      ctx.fillRect(sx, sy, this.w, this.h);
      // Grass top
      ctx.fillStyle = '#5cb85c';
      ctx.fillRect(sx, sy, this.w, 6);
      // Grass blades
      ctx.fillStyle = '#6dd66d';
      for (let gx = sx; gx < sx + this.w; gx += 8) {
        ctx.fillRect(gx, sy - 3, 2, 6);
      }
    } else if (this.type === 'metal') {
      // Metal platform
      const grd = ctx.createLinearGradient(sx, sy, sx, sy + this.h);
      grd.addColorStop(0, '#778899');
      grd.addColorStop(0.5, '#556677');
      grd.addColorStop(1, '#334455');
      ctx.fillStyle = grd;
      ctx.fillRect(sx, sy, this.w, this.h);
      // Rivets
      ctx.fillStyle = '#99aabb';
      for (let rx = sx + 10; rx < sx + this.w; rx += 30) {
        ctx.beginPath();
        ctx.arc(rx, sy + 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Edge highlight
      ctx.strokeStyle = '#aabbcc';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, this.w, 2);
    } else if (this.type === 'bridge') {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(sx, sy, this.w, this.h);
      ctx.strokeStyle = '#6B4914';
      ctx.lineWidth = 1;
      for (let bx = sx; bx < sx + this.w; bx += 15) {
        ctx.beginPath();
        ctx.moveTo(bx, sy);
        ctx.lineTo(bx, sy + this.h);
        ctx.stroke();
      }
    } else if (this.type === 'lava') {
      const grd = ctx.createLinearGradient(sx, sy, sx, sy + this.h);
      grd.addColorStop(0, '#ff6600');
      grd.addColorStop(0.5, '#ff3300');
      grd.addColorStop(1, '#cc0000');
      ctx.fillStyle = grd;
      ctx.fillRect(sx, sy, this.w, this.h);
      // Lava glow
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 15;
      ctx.fillStyle = 'rgba(255,100,0,0.3)';
      ctx.fillRect(sx, sy - 5, this.w, 5);
      ctx.shadowBlur = 0;
    }
  }
}

const platforms = [];

// --- Player ---
class Player {
  constructor(id, x, y, controls, colorScheme) {
    this.id = id;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.w = 20; this.h = 36;
    this.controls = controls;
    this.colorScheme = colorScheme;
    this.facing = 1; // 1=right, -1=left
    this.onGround = false;
    this.crouching = false;
    this.hp = 5;
    this.maxHp = 5;
    this.lives = 3;
    this.weapon = 'NORMAL';
    this.lastShot = 0;
    this.invincible = 0;
    this.alive = true;
    this.animFrame = 0;
    this.animTimer = 0;
    this.state = 'idle'; // idle, run, jump, crouch, shoot
    this.shootAnim = 0;
  }

  getWeapon() { return WEAPONS[this.weapon]; }

  update(dt, enemies) {
    if (!this.alive) return;
    const c = this.controls;
    const wp = this.getWeapon();

    // Movement
    let moving = false;
    if (keys[c.left]) { this.vx = -3.5; this.facing = -1; moving = true; }
    else if (keys[c.right]) { this.vx = 3.5; this.facing = 1; moving = true; }
    else { this.vx *= 0.7; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

    // Jump
    if (keys[c.jump] && this.onGround) {
      this.vy = -10;
      this.onGround = false;
    }

    // Crouch
    this.crouching = keys[c.crouch] && this.onGround;
    if (this.crouching) {
      this.vx *= 0.3;
      this.h = 22;
    } else {
      this.h = 36;
    }

    // Shoot
    const now = Date.now();
    if (keys[c.shoot] && now - this.lastShot >= wp.fireRate) {
      this.shoot(now, enemies);
      this.lastShot = now;
      this.shootAnim = 8;
    }
    if (this.shootAnim > 0) this.shootAnim--;

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 12) this.vy = 12;

    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Platform collision
    this.onGround = false;
    for (const p of platforms) {
      if (p.type === 'lava') {
        if (this.rectOverlap(this, p) && this.invincible <= 0) {
          this.takeDamage(99);
        }
        continue;
      }
      // Top collision (landing on platform)
      if (this.vy >= 0 &&
          this.x + this.w > p.x && this.x < p.x + p.w &&
          this.y + this.h >= p.y && this.y + this.h <= p.y + p.h + this.vy * dt + 2) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // Bounds
    if (this.x < 0) this.x = 0;
    if (this.x > LEVEL_WIDTH - this.w) this.x = LEVEL_WIDTH - this.w;
    if (this.y > GAME_HEIGHT + 100) {
      this.takeDamage(99);
    }

    // Invincibility timer
    if (this.invincible > 0) this.invincible -= dt;

    // Animation
    this.animTimer += dt;
    if (this.animTimer > 8) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }
    if (moving && this.onGround) this.state = 'run';
    else if (!this.onGround) this.state = 'jump';
    else if (this.crouching) this.state = 'crouch';
    else this.state = 'idle';
  }

  shoot(now, enemies) {
    const wp = this.getWeapon();
    const bx = this.x + this.w/2;
    const by = this.y + (this.crouching ? 10 : 14);

    if (this.weapon === 'SPREAD') {
      for (let i = -2; i <= 2; i++) {
        const angle = i * 0.15 * this.facing;
        bullets.push(new Bullet(
          bx, by,
          Math.cos(angle) * wp.speed * this.facing,
          Math.sin(angle) * wp.speed - 1,
          wp, this.id
        ));
      }
    } else if (this.weapon === 'LASER') {
      // Laser pierces through enemies
      const laser = {
        x: bx, y: by,
        vx: wp.speed * this.facing, vy: 0,
        weapon: wp, owner: this.id,
        alive: true, length: 60, trail: [],
        update(dt) {
          this.trail.push({x: this.x, y: this.y});
          if (this.trail.length > 8) this.trail.shift();
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          if (this.x < camera.x - 100 || this.x > camera.x + GAME_WIDTH + 100) this.alive = false;
        },
        draw() {
          ctx.strokeStyle = this.weapon.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = this.weapon.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(this.x - camera.x - this.vx * 3 * this.facing, this.y - camera.y);
          ctx.lineTo(this.x - camera.x, this.y - camera.y);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      };
      bullets.push(laser);
    } else if (this.weapon === 'FIREBALL') {
      bullets.push(new Bullet(
        bx, by,
        wp.speed * this.facing, -2,
        wp, this.id
      ));
    } else {
      bullets.push(new Bullet(
        bx, by,
        wp.speed * this.facing, 0,
        wp, this.id
      ));
    }
  }

  rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.hp -= amount;
    this.invincible = 60;
    spawnExplosion(this.x + this.w/2, this.y + this.h/2, '#ff4444', 10);
    if (this.hp <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.alive = false;
      } else {
        this.hp = this.maxHp;
        this.x = this.id === 1 ? 100 : 150;
        this.y = 200;
        this.invincible = 120;
      }
    }
  }

  draw() {
    if (!this.alive) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    // Blink when invincible
    if (this.invincible > 0 && Math.floor(this.invincible) % 4 < 2) return;

    const cs = this.colorScheme;
    const f = this.facing;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx + this.w/2, sy + this.h + 2, this.w/2 + 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.crouching) {
      this.drawCrouching(sx, sy, cs, f);
    } else {
      this.drawStanding(sx, sy, cs, f);
    }

    ctx.restore();
  }

  drawStanding(sx, sy, cs, f) {
    // Body
    ctx.fillStyle = cs.skin;
    // Head
    ctx.beginPath();
    ctx.arc(sx + this.w/2, sy + 8, 7, 0, Math.PI * 2);
    ctx.fill();
    // Hair/headband
    ctx.fillStyle = cs.band;
    ctx.fillRect(sx + this.w/2 - 8, sy + 3, 16, 4);
    // Headband tail
    ctx.strokeStyle = cs.band;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + this.w/2 - f * 8, sy + 5);
    ctx.lineTo(sx + this.w/2 - f * 16, sy + 2 + Math.sin(Date.now()/100) * 2);
    ctx.stroke();

    // Torso
    ctx.fillStyle = cs.shirt;
    ctx.fillRect(sx + 4, sy + 14, 12, 10);

    // Belt
    ctx.fillStyle = '#333';
    ctx.fillRect(sx + 3, sy + 23, 14, 3);

    // Legs
    ctx.fillStyle = cs.pants;
    if (this.state === 'run') {
      const legOff = Math.sin(this.animFrame * Math.PI / 2) * 4;
      ctx.fillRect(sx + 4, sy + 26, 5, 10 + legOff);
      ctx.fillRect(sx + 11, sy + 26, 5, 10 - legOff);
    } else if (this.state === 'jump') {
      ctx.fillRect(sx + 2, sy + 26, 6, 8);
      ctx.fillRect(sx + 12, sy + 26, 6, 8);
    } else {
      ctx.fillRect(sx + 4, sy + 26, 5, 10);
      ctx.fillRect(sx + 11, sy + 26, 5, 10);
    }

    // Boots
    ctx.fillStyle = '#442200';
    ctx.fillRect(sx + 3, sy + 34, 6, 3);
    ctx.fillRect(sx + 11, sy + 34, 6, 3);

    // Arms + Gun
    ctx.fillStyle = cs.skin;
    const gunY = sy + 16;
    const gunX = f > 0 ? sx + 16 : sx - 8;
    // Arm
    ctx.fillRect(f > 0 ? sx + 14 : sx + 2, gunY, 6, 4);
    // Gun
    ctx.fillStyle = '#555';
    ctx.fillRect(gunX, gunY - 1, 14, 4);
    // Gun barrel
    ctx.fillStyle = '#333';
    ctx.fillRect(f > 0 ? gunX + 12 : gunX - 4, gunY - 2, 6, 6);
    // Muzzle flash
    if (this.shootAnim > 0) {
      ctx.fillStyle = '#ffaa00';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(f > 0 ? gunX + 18 : gunX - 4, gunY + 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawCrouching(sx, sy, cs, f) {
    ctx.fillStyle = cs.skin;
    ctx.beginPath();
    ctx.arc(sx + this.w/2, sy + 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cs.band;
    ctx.fillRect(sx + this.w/2 - 7, sy + 2, 14, 3);

    ctx.fillStyle = cs.shirt;
    ctx.fillRect(sx + 3, sy + 10, 14, 8);

    ctx.fillStyle = cs.pants;
    ctx.fillRect(sx + 2, sy + 18, 16, 4);

    // Gun low
    ctx.fillStyle = '#555';
    ctx.fillRect(f > 0 ? sx + 14 : sx - 6, sy + 12, 14, 3);
  }
}

// --- Enemy ---
class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.w = 20; this.h = 36;
    this.type = type; // 'guard', 'shooter', 'drone', 'boss'
    this.vx = 0; this.vy = 0;
    this.hp = 1;
    this.maxHp = 1;
    this.alive = true;
    this.lastShot = 0;
    this.patrolDir = Math.random() > 0.5 ? 1 : -1;
    this.patrolDist = 0;
    this.maxPatrol = 100 + Math.random() * 100;
    this.animTimer = 0;
    this.animFrame = 0;
    this.alerted = false;
    this.alertTimer = 0;
    this.onGround = false;
    this.shootCooldown = 0;

    if (type === 'guard') {
      this.hp = 2; this.maxHp = 2;
      this.color = '#cc4444';
    } else if (type === 'shooter') {
      this.hp = 1; this.maxHp = 1;
      this.color = '#44cc44';
      this.shootCooldown = 90;
    } else if (type === 'drone') {
      this.hp = 1; this.maxHp = 1;
      this.color = '#cccc44';
      this.w = 18; this.h = 14;
      this.baseY = y;
      this.droneAngle = Math.random() * Math.PI * 2;
    } else if (type === 'boss') {
      this.hp = 30; this.maxHp = 30;
      this.color = '#ff44ff';
      this.w = 48; this.h = 56;
      this.shootCooldown = 30;
      this.phase = 0;
    }
  }

  update(dt, player) {
    if (!this.alive) return;
    if (!player || !player.alive) return;

    this.animTimer += dt;
    if (this.animTimer > 10) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Alert when player is near
    if (dist < 300) this.alerted = true;

    if (this.type === 'drone') {
      this.droneAngle += 0.03 * dt;
      this.y = this.baseY + Math.sin(this.droneAngle) * 30;
      // Shoot at player
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0 && dist < 400) {
        this.shootAt(player);
        this.shootCooldown = 80 + Math.random() * 40;
      }
      return;
    }

    if (this.type === 'boss') {
      this.updateBoss(dt, player, dist);
      return;
    }

    if (!this.alerted) return;

    // Patrol
    if (dist > 200) {
      this.vx = this.patrolDir * 1.5;
      this.x += this.vx * dt;
      this.patrolDist += Math.abs(this.vx) * dt;
      if (this.patrolDist > this.maxPatrol) {
        this.patrolDir *= -1;
        this.patrolDist = 0;
      }
    } else {
      // Chase player
      this.vx = Math.sign(dx) * 2;
      this.x += this.vx * dt;

      // Shooter fires
      if (this.type === 'shooter') {
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0 && dist < 350 && dist > 50) {
          this.shootAt(player);
          this.shootCooldown = 60 + Math.random() * 30;
        }
      }
    }

    // Gravity for ground enemies
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    this.onGround = false;
    for (const p of platforms) {
      if (p.type === 'lava' || p.type === 'ground') continue;
      if (this.vy >= 0 &&
          this.x + this.w > p.x && this.x < p.x + p.w &&
          this.y + this.h >= p.y && this.y + this.h <= p.y + p.h + this.vy * dt + 2) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }
    // Ground collision
    for (const p of platforms) {
      if (p.type !== 'ground') continue;
      if (this.vy >= 0 &&
          this.x + this.w > p.x && this.x < p.x + p.w &&
          this.y + this.h >= p.y && this.y + this.h <= p.y + p.h + 8) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }
  }

  updateBoss(dt, player, dist) {
    this.shootCooldown -= dt;

    // Boss moves slowly toward player
    const dx = player.x - this.x;
    if (Math.abs(dx) > 60) {
      this.x += Math.sign(dx) * 1.2 * dt;
    }

    // Boss shoots in patterns
    if (this.shootCooldown <= 0) {
      const pattern = this.phase % 3;
      if (pattern === 0) {
        // Spread shot
        for (let i = -3; i <= 3; i++) {
          const angle = i * 0.2;
          bullets.push({
            x: this.x + this.w/2,
            y: this.y + 10,
            vx: Math.cos(angle) * 4 * Math.sign(dx),
            vy: Math.sin(angle) * 4,
            weapon: { color: '#ff44ff', speed: 4, damage: 1, size: 5, fireRate: 0 },
            owner: 'enemy',
            alive: true,
            trail: [],
            update(dt) {
              this.x += this.vx * dt; this.y += this.vy * dt;
              if (this.x < camera.x - 100 || this.x > camera.x + GAME_WIDTH + 100) this.alive = false;
            },
            draw() {
              ctx.fillStyle = '#ff44ff';
              ctx.beginPath();
              ctx.arc(this.x - camera.x, this.y - camera.y, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
      } else if (pattern === 1) {
        // Aimed shot
        const angle = Math.atan2(dy, dx);
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (this.alive) {
              bullets.push({
                x: this.x + this.w/2, y: this.y + 10,
                vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
                weapon: { color: '#ff88ff', speed: 6, damage: 1, size: 4, fireRate: 0 },
                owner: 'enemy', alive: true, trail: [],
                update(dt) { this.x += this.vx*dt; this.y += this.vy*dt; },
                draw() {
                  ctx.fillStyle = '#ff88ff';
                  ctx.beginPath();
                  ctx.arc(this.x-camera.x, this.y-camera.y, 4, 0, Math.PI*2);
                  ctx.fill();
                }
              });
            }
          }, i * 150);
        }
      } else {
        // Rapid fire
        bullets.push({
          x: this.x + this.w/2, y: this.y + 10,
          vx: Math.sign(dx) * 7, vy: 0,
          weapon: { color: '#ff00ff', speed: 7, damage: 1, size: 3, fireRate: 0 },
          owner: 'enemy', alive: true, trail: [],
          update(dt) { this.x += this.vx*dt; this.y += this.vy*dt; },
          draw() {
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.arc(this.x-camera.x, this.y-camera.y, 3, 0, Math.PI*2);
            ctx.fill();
          }
        });
      }
      this.shootCooldown = 40;
      this.phase++;
    }
  }

  shootAt(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const nx = dx/dist;
    const ny = dy/dist;
    bullets.push({
      x: this.x + this.w/2, y: this.y + (this.type === 'shooter' ? 14 : 7),
      vx: nx * 4, vy: ny * 4 - 1,
      weapon: { color: '#ff4444', speed: 4, damage: 1, size: 4, fireRate: 0 },
      owner: 'enemy', alive: true, trail: [],
      update(dt) { this.x += this.vx*dt; this.y += this.vy*dt; this.vy += 0.05*dt; },
      draw() {
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(this.x-camera.x, this.y-camera.y, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
  }

  draw() {
    if (!this.alive) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    if (sx > GAME_WIDTH + 50 || sx + this.w < -50) return;

    ctx.save();

    if (this.type === 'drone') {
      this.drawDrone(sx, sy);
    } else if (this.type === 'boss') {
      this.drawBoss(sx, sy);
    } else {
      this.drawSoldier(sx, sy);
    }

    // Health bar for damaged enemies
    if (this.hp < this.maxHp && this.maxHp > 1) {
      const barW = this.w + 10;
      ctx.fillStyle = '#333';
      ctx.fillRect(sx - 5, sy - 8, barW, 4);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(sx - 5, sy - 8, barW * (this.hp / this.maxHp), 4);
    }

    ctx.restore();
  }

  drawSoldier(sx, sy) {
    // Body
    ctx.fillStyle = this.color;
    ctx.fillRect(sx + 4, sy + 12, 12, 14);
    // Head
    ctx.fillStyle = '#ddaa88';
    ctx.beginPath();
    ctx.arc(sx + 10, sy + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    // Helmet
    ctx.fillStyle = '#555';
    ctx.fillRect(sx + 3, sy + 2, 14, 5);
    // Legs
    ctx.fillStyle = '#444';
    const legOff = Math.sin(this.animFrame * Math.PI / 2) * 3;
    ctx.fillRect(sx + 4, sy + 26, 5, 10 + legOff);
    ctx.fillRect(sx + 11, sy + 26, 5, 10 - legOff);
    // Gun
    ctx.fillStyle = '#333';
    ctx.fillRect(sx + 14, sy + 16, 10, 3);
  }

  drawDrone(sx, sy) {
    // Hovering drone
    const bob = Math.sin(Date.now() / 200) * 2;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx + 9, sy + 7 + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(sx + 9, sy + 7 + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    // Rotors
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    const rotorAngle = Date.now() / 50;
    ctx.beginPath();
    ctx.moveTo(sx + 9 + Math.cos(rotorAngle)*12, sy + bob);
    ctx.lineTo(sx + 9 - Math.cos(rotorAngle)*12, sy + bob);
    ctx.stroke();
  }

  drawBoss(sx, sy) {
    // Big armored boss
    const pulse = Math.sin(Date.now() / 200) * 2;

    // Body
    ctx.fillStyle = '#662266';
    ctx.fillRect(sx + 4, sy + 16, 40, 30);

    // Armor plates
    ctx.fillStyle = '#883388';
    ctx.fillRect(sx, sy + 14, 48, 8);
    ctx.fillRect(sx, sy + 38, 48, 6);

    // Head
    ctx.fillStyle = '#aa44aa';
    ctx.beginPath();
    ctx.arc(sx + 24, sy + 10, 12, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8 + pulse;
    ctx.beginPath();
    ctx.arc(sx + 19, sy + 8, 3, 0, Math.PI * 2);
    ctx.arc(sx + 29, sy + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Mouth
    ctx.fillStyle = '#330033';
    ctx.fillRect(sx + 18, sy + 14, 12, 3);

    // Legs
    ctx.fillStyle = '#551155';
    const legOff = Math.sin(this.animFrame * Math.PI / 2) * 3;
    ctx.fillRect(sx + 8, sy + 46, 12, 10 + legOff);
    ctx.fillRect(sx + 28, sy + 46, 12, 10 - legOff);

    // Cannon arm
    ctx.fillStyle = '#773377';
    ctx.fillRect(sx + 40, sy + 20, 16, 8);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(sx + 52, sy + 18, 6, 12);

    // HP bar above boss
    const barW = 50;
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - 1, sy - 12, barW, 5);
    ctx.fillStyle = '#ff44ff';
    ctx.fillRect(sx - 1, sy - 12, barW * (this.hp / this.maxHp), 5);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 1, sy - 12, barW, 5);
  }

  takeDamage(amount) {
    this.hp -= amount;
    spawnExplosion(this.x + this.w/2, this.y + this.h/2, this.color, 5);
    if (this.hp <= 0) {
      this.alive = false;
      spawnExplosion(this.x + this.w/2, this.y + this.h/2, '#ff8800', 20);
      spawnSmoke(this.x + this.w/2, this.y + this.h/2, 8);
      game.score += this.type === 'boss' ? 5000 : (this.type === 'drone' ? 150 : 100);
      game.kills++;
    }
  }
}

// --- Game State ---
const game = {
  state: 'menu', // menu, playing, paused, gameover, victory
  score: 0,
  kills: 0,
  time: 0,
  levelComplete: false,
  player1: null,
  player2: null,
  enemies: [],
  powerUps: [],

  init() {
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.levelComplete = false;
    particles.length = 0;
    bullets.length = 0;
    platforms.length = 0;
    this.enemies = [];
    this.powerUps = [];

    // Create level
    this.buildLevel();

    // Create players
    this.player1 = new Player(1, 100, 300, {
      left: 'KeyA', right: 'KeyD', jump: 'KeyW', crouch: 'KeyS', shoot: 'Space', weaponSwap: 'KeyQ'
    }, { skin: '#ddbb99', band: '#ff2222', shirt: '#2244aa', pants: '#2244aa' });

    this.player2 = new Player(2, 150, 300, {
      left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown', shoot: 'Enter', weaponSwap: 'Numpad0'
    }, { skin: '#ddbb99', band: '#2222ff', shirt: '#22aa44', pants: '#226622' });

    // Spawn enemies
    this.spawnEnemies();

    // Spawn power-ups
    this.spawnPowerUps();
  },

  buildLevel() {
    // Ground segments with gaps
    const groundSegments = [
      { x: 0, w: 600 },
      { x: 700, w: 400 },
      { x: 1200, w: 300 },
      { x: 1600, w: 500 },
      { x: 2200, w: 300 },
      { x: 2600, w: 400 },
      { x: 3100, w: 600 },
      { x: 3800, w: 300 },
      { x: 4200, w: 500 },
      { x: 4800, w: 400 },
      { x: 5300, w: 600 },
      { x: 6000, w: 400 },
    ];

    for (const seg of groundSegments) {
      platforms.push(new Platform(seg.x, GAME_HEIGHT - 40, seg.w, 40, 'ground'));
    }

    // Floating platforms
    const platDefs = [
      { x: 300, y: 380, w: 120, h: 16, t: 'metal' },
      { x: 500, y: 300, w: 100, h: 16, t: 'metal' },
      { x: 750, y: 350, w: 150, h: 16, t: 'metal' },
      { x: 950, y: 280, w: 100, h: 16, t: 'metal' },
      { x: 1100, y: 350, w: 120, h: 16, t: 'metal' },
      { x: 1350, y: 300, w: 100, h: 16, t: 'metal' },
      { x: 1500, y: 220, w: 130, h: 16, t: 'metal' },
      { x: 1800, y: 350, w: 150, h: 16, t: 'metal' },
      { x: 2000, y: 280, w: 100, h: 16, t: 'metal' },
      { x: 2300, y: 320, w: 120, h: 16, t: 'metal' },
      { x: 2500, y: 240, w: 100, h: 16, t: 'metal' },
      { x: 2700, y: 350, w: 150, h: 16, t: 'metal' },
      { x: 2900, y: 280, w: 100, h: 16, t: 'metal' },
      { x: 3200, y: 350, w: 120, h: 16, t: 'metal' },
      { x: 3400, y: 250, w: 100, h: 16, t: 'metal' },
      { x: 3600, y: 300, w: 130, h: 16, t: 'metal' },
      { x: 3900, y: 350, w: 100, h: 16, t: 'metal' },
      { x: 4100, y: 260, w: 120, h: 16, t: 'metal' },
      { x: 4400, y: 320, w: 150, h: 16, t: 'metal' },
      { x: 4600, y: 240, w: 100, h: 16, t: 'metal' },
      { x: 4900, y: 350, w: 120, h: 16, t: 'metal' },
      { x: 5100, y: 280, w: 100, h: 16, t: 'metal' },
      { x: 5400, y: 350, w: 150, h: 16, t: 'metal' },
      { x: 5600, y: 260, w: 100, h: 16, t: 'metal' },
      { x: 5800, y: 300, w: 120, h: 16, t: 'metal' },
      // Bridges over lava
      { x: 1050, y: 400, w: 60, h: 12, t: 'bridge' },
      { x: 1150, y: 400, w: 60, h: 12, t: 'bridge' },
      { x: 3700, y: 400, w: 60, h: 12, t: 'bridge' },
      { x: 3800, y: 400, w: 60, h: 12, t: 'bridge' },
    ];

    for (const pd of platDefs) {
      platforms.push(new Platform(pd.x, pd.y, pd.w, pd.h, pd.t));
    }

    // Lava pits
    platforms.push(new Platform(1180, GAME_HEIGHT - 20, 100, 20, 'lava'));
    platforms.push(new Platform(2180, GAME_HEIGHT - 20, 100, 20, 'lava'));
    platforms.push(new Platform(3750, GAME_HEIGHT - 20, 100, 20, 'lava'));
    platforms.push(new Platform(5250, GAME_HEIGHT - 20, 100, 20, 'lava'));
  },

  spawnEnemies() {
    const enemyDefs = [
      // Guards
      { x: 400, y: 0, type: 'guard' },
      { x: 650, y: 0, type: 'guard' },
      { x: 900, y: 0, type: 'guard' },
      { x: 1150, y: 0, type: 'guard' },
      { x: 1450, y: 0, type: 'guard' },
      { x: 1750, y: 0, type: 'guard' },
      { x: 2050, y: 0, type: 'guard' },
      { x: 2400, y: 0, type: 'guard' },
      { x: 2650, y: 0, type: 'guard' },
      { x: 3000, y: 0, type: 'guard' },
      { x: 3300, y: 0, type: 'guard' },
      { x: 3550, y: 0, type: 'guard' },
      { x: 3850, y: 0, type: 'guard' },
      { x: 4050, y: 0, type: 'guard' },
      { x: 4350, y: 0, type: 'guard' },
      { x: 4550, y: 0, type: 'guard' },
      { x: 4850, y: 0, type: 'guard' },
      { x: 5050, y: 0, type: 'guard' },
      { x: 5350, y: 0, type: 'guard' },
      { x: 5550, y: 0, type: 'guard' },
      { x: 5750, y: 0, type: 'guard' },
      // Shooters
      { x: 500, y: 264, type: 'shooter' },
      { x: 950, y: 244, type: 'shooter' },
      { x: 1500, y: 184, type: 'shooter' },
      { x: 2000, y: 244, type: 'shooter' },
      { x: 2900, y: 244, type: 'shooter' },
      { x: 3400, y: 214, type: 'shooter' },
      { x: 4100, y: 224, type: 'shooter' },
      { x: 4600, y: 204, type: 'shooter' },
      { x: 5100, y: 244, type: 'shooter' },
      { x: 5600, y: 224, type: 'shooter' },
      // Drones
      { x: 700, y: 200, type: 'drone' },
      { x: 1300, y: 200, type: 'drone' },
      { x: 1900, y: 180, type: 'drone' },
      { x: 2500, y: 160, type: 'drone' },
      { x: 3100, y: 200, type: 'drone' },
      { x: 3700, y: 180, type: 'drone' },
      { x: 4300, y: 200, type: 'drone' },
      { x: 4900, y: 180, type: 'drone' },
      { x: 5500, y: 200, type: 'drone' },
      // Boss
      { x: 6100, y: 0, type: 'boss' },
    ];

    for (const ed of enemyDefs) {
      const e = new Enemy(ed.x, ed.y, ed.type);
      // Find ground below enemy
      if (ed.type !== 'drone') {
        for (const p of platforms) {
          if (p.type === 'ground' && e.x + e.w > p.x && e.x < p.x + p.w) {
            e.y = p.y - e.h;
            e.baseY = e.y;
            break;
          }
        }
      }
      this.enemies.push(e);
    }
  },

  spawnPowerUps() {
    const puDefs = [
      { x: 350, y: 340, type: 'weapon_SPREAD' },
      { x: 1000, y: 240, type: 'weapon_LASER' },
      { x: 1800, y: 310, type: 'weapon_FIREBALL' },
      { x: 2700, y: 310, type: 'weapon_SPREAD' },
      { x: 3600, y: 260, type: 'weapon_LASER' },
      { x: 4400, y: 290, type: 'weapon_FIREBALL' },
      { x: 5400, y: 310, type: 'weapon_SPREAD' },
      { x: 5800, y: 260, type: 'health' },
    ];

    for (const pd of puDefs) {
      this.powerUps.push({
        x: pd.x, y: pd.y, w: 20, h: 20,
        type: pd.type,
        alive: true,
        bobPhase: Math.random() * Math.PI * 2
      });
    }
  },

  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;

    // Player controls
    [this.player1, this.player2].forEach(p => {
      if (!p || !p.alive) return;
      // Weapon swap
      if (keys[p.controls.weaponSwap]) {
        const weaponKeys = ['NORMAL', 'SPREAD', 'LASER', 'FIREBALL'];
        const idx = weaponKeys.indexOf(p.weapon);
        p.weapon = weaponKeys[(idx + 1) % weaponKeys.length];
        keys[p.controls.weaponSwap] = false;
      }
      p.update(dt, this.enemies);
    });

    // Update enemies
    for (const e of this.enemies) {
      e.update(dt, this.player1 || this.player2);
    }

    // Update bullets
    for (const b of bullets) {
      b.update(dt);
    }

    // Update particles
    for (const p of particles) {
      p.update(dt);
    }

    // Bullet-enemy collision
    for (const b of bullets) {
      if (!b.alive || b.owner === 'enemy') continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          if (b.weapon && b.weapon.name === 'LASER') continue; // Laser pierces
          b.alive = false;
          e.takeDamage(b.damage);
        }
      }
    }

    // Enemy bullet-player collision
    for (const b of bullets) {
      if (!b.alive || b.owner !== 'enemy') continue;
      [this.player1, this.player2].forEach(p => {
        if (!p || !p.alive) return;
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          b.alive = false;
          p.takeDamage(1);
        }
      });
    }

    // Enemy-player contact damage
    [this.player1, this.player2].forEach(p => {
      if (!p || !p.alive) return;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (p.rectOverlap && p.rectOverlap(p, e)) {
          p.takeDamage(1);
        }
      }
    });

    // Power-up collection
    for (const pu of this.powerUps) {
      if (!pu.alive) continue;
      pu.bobPhase += 0.05 * dt;
      [this.player1, this.player2].forEach(p => {
        if (!p || !p.alive) return;
        const py = pu.y + Math.sin(pu.bobPhase) * 5;
        if (p.x + p.w > pu.x && p.x < pu.x + pu.w &&
            p.y + p.h > py && p.y < py + pu.h) {
          pu.alive = false;
          if (pu.type.startsWith('weapon_')) {
            p.weapon = pu.type.replace('weapon_', '');
          } else if (pu.type === 'health') {
            p.hp = Math.min(p.hp + 2, p.maxHp);
          }
          spawnExplosion(pu.x + 10, py + 10, '#44ff44', 10);
        }
      });
    }

    // Clean up
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].alive) bullets.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Check victory (boss defeated)
    const boss = this.enemies.find(e => e.type === 'boss');
    if (boss && !boss.alive && !this.levelComplete) {
      this.levelComplete = true;
      setTimeout(() => {
        this.state = 'victory';
        document.getElementById('victoryScore').textContent = this.score;
        document.getElementById('victoryKills').textContent = this.kills;
        showScreen('victoryScreen');
      }, 2000);
    }

    // Check game over
    if (this.player1 && !this.player1.alive && this.player2 && !this.player2.alive) {
      this.state = 'gameover';
      document.getElementById('finalScore').textContent = this.score;
      document.getElementById('finalKills').textContent = this.kills;
      showScreen('gameOverScreen');
    }

    // Update camera (follow active player)
    const activePlayer = this.player1 && this.player1.alive ? this.player1 :
                         this.player2 && this.player2.alive ? this.player2 : null;
    if (activePlayer) {
      updateCamera(activePlayer.x + activePlayer.w/2, activePlayer.y + activePlayer.h/2);
    }
  },

  draw() {
    // Sky gradient
    const skyGrd = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrd.addColorStop(0, '#1a0a2e');
    skyGrd.addColorStop(0.4, '#2d1b69');
    skyGrd.addColorStop(0.7, '#1a3a4a');
    skyGrd.addColorStop(1, '#0a1a0a');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stars (parallax)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 137 + 50) % GAME_WIDTH + GAME_WIDTH - camera.x * 0.05 % GAME_WIDTH) % GAME_WIDTH;
      const sy = (i * 97 + 20) % (GAME_HEIGHT * 0.5);
      const twinkle = Math.sin(Date.now() / 500 + i) * 0.5 + 0.5;
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // Mountains (parallax)
    this.drawMountains();

    // Jungle background (parallax)
    this.drawJungle();

    // Platforms
    for (const p of platforms) {
      p.draw();
    }

    // Power-ups
    for (const pu of this.powerUps) {
      if (!pu.alive) continue;
      const py = pu.y + Math.sin(pu.bobPhase) * 5;
      const sx = pu.x - camera.x;
      const sy = py - camera.y;
      const glow = Math.sin(Date.now() / 200) * 0.3 + 0.7;

      ctx.globalAlpha = glow;
      if (pu.type.startsWith('weapon_')) {
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#44ff44';
        ctx.shadowColor = '#44ff44';
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.arc(sx + 10, sy + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Icon
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Courier New';
      ctx.textAlign = 'center';
      if (pu.type.startsWith('weapon_')) {
        ctx.fillText('W', sx + 10, sy + 14);
      } else {
        ctx.fillText('+', sx + 10, sy + 14);
      }
    }

    // Enemies
    for (const e of this.enemies) {
      e.draw();
    }

    // Bullets
    for (const b of bullets) {
      b.draw();
    }

    // Players
    if (this.player1) this.player1.draw();
    if (this.player2) this.player2.draw();

    // Particles
    for (const p of particles) {
      p.draw();
    }

    // HUD
    this.drawHUD();

    // Progress bar
    this.drawProgress();
  },

  drawMountains() {
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 60) {
      const worldX = x + camera.x * 0.1;
      const h = Math.sin(worldX * 0.003) * 80 + Math.sin(worldX * 0.007) * 40 + 120;
      ctx.lineTo(x, GAME_HEIGHT - h);
    }
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.fill();

    // Far mountains
    ctx.fillStyle = '#2a3a4a';
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 40) {
      const worldX = x + camera.x * 0.2;
      const h = Math.sin(worldX * 0.005) * 60 + Math.sin(worldX * 0.012) * 30 + 80;
      ctx.lineTo(x, GAME_HEIGHT - h);
    }
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.fill();
  },

  drawJungle() {
    ctx.fillStyle = '#0a2a0a';
    for (let x = 0; x <= GAME_WIDTH; x += 30) {
      const worldX = x + camera.x * 0.4;
      const h = Math.sin(worldX * 0.02) * 15 + 30 + Math.sin(worldX * 0.05) * 10;
      ctx.fillRect(x, GAME_HEIGHT - h, 20, h);
      // Tree canopy
      ctx.fillStyle = '#0a3a0a';
      ctx.beginPath();
      ctx.arc(x + 10, GAME_HEIGHT - h, 15 + Math.sin(worldX) * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a2a0a';
    }
  },

  drawHUD() {
    // Background bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH, 36);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, GAME_WIDTH, 36);

    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'left';

    // P1
    if (this.player1 && this.player1.alive) {
      ctx.fillStyle = '#ff4444';
      ctx.fillText(`P1`, 10, 14);
      ctx.fillStyle = '#fff';
      ctx.fillText(`HP: `, 40, 14);
      for (let i = 0; i < this.player1.maxHp; i++) {
        ctx.fillStyle = i < this.player1.hp ? '#ff4444' : '#333';
        ctx.fillRect(70 + i * 14, 6, 10, 10);
      }
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`Lives: ${this.player1.lives}`, 70, 30);
      ctx.fillStyle = WEAPONS[this.player1.weapon].color;
      ctx.fillText(`[${this.player1.weapon}]`, 130, 14);
    }

    // P2
    if (this.player2 && this.player2.alive) {
      ctx.fillStyle = '#44ff44';
      ctx.fillText(`P2`, 260, 14);
      ctx.fillStyle = '#fff';
      ctx.fillText(`HP: `, 290, 14);
      for (let i = 0; i < this.player2.maxHp; i++) {
        ctx.fillStyle = i < this.player2.hp ? '#44ff44' : '#333';
        ctx.fillRect(320 + i * 14, 6, 10, 10);
      }
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`Lives: ${this.player2.lives}`, 320, 30);
      ctx.fillStyle = WEAPONS[this.player2.weapon].color;
      ctx.fillText(`[${this.player2.weapon}]`, 380, 14);
    }

    // Score
    ctx.fillStyle = '#ffdd44';
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText(`SCORE: ${this.score.toString().padStart(7, '0')}`, GAME_WIDTH - 10, 14);
    ctx.font = 'bold 12px Courier New';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`KILLS: ${this.kills}`, GAME_WIDTH - 10, 30);
  },

  drawProgress() {
    const barX = GAME_WIDTH / 2 - 100;
    const barY = 38;
    const barW = 200;
    const barH = 6;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);

    const activePlayer = this.player1 && this.player1.alive ? this.player1 :
                         this.player2 && this.player2.alive ? this.player2 : null;
    if (activePlayer) {
      const progress = Math.min(1, activePlayer.x / LEVEL_WIDTH);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(barX, barY, barW * progress, barH);
    }

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Flag at end
    ctx.fillStyle = '#ff0000';
    const flagX = barX + barW - 2;
    ctx.fillRect(flagX, barY - 4, 2, barH + 8);
    ctx.beginPath();
    ctx.moveTo(flagX + 2, barY - 4);
    ctx.lineTo(flagX + 12, barY);
    ctx.lineTo(flagX + 2, barY + 4);
    ctx.fill();
  }
};

// --- Screen Management ---
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
  if (id) {
    document.getElementById(id).classList.add('visible');
    document.getElementById('ui-overlay').classList.add('active');
  } else {
    document.getElementById('ui-overlay').classList.remove('active');
  }
}

// --- Button Handlers ---
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', startGame);

function startGame() {
  game.init();
  game.state = 'playing';
  showScreen(null);
}

// --- Keyboard shortcuts ---
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && game.state === 'playing') {
    game.state = 'paused';
    showScreen('pauseScreen');
  } else if (e.code === 'Escape' && game.state === 'paused') {
    game.state = 'playing';
    showScreen(null);
  }
  if (e.code === 'Enter' && (game.state === 'menu' || game.code === 'gameover' || game.state === 'victory')) {
    startGame();
  }
});

// --- Main Game Loop ---
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 16.67, 3); // normalize to ~60fps, cap at 3x
  lastTime = timestamp;

  // Clear
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (game.state === 'playing') {
    game.update(dt);
  }

  game.draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

console.log('CONTRA HTML5 loaded! Press START to play.');
