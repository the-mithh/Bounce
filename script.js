(function () {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;

  // Visual & physics constants
  const DOT_RADIUS = 5; // CSS pixels
  const BASE_SPEED = 280; // pixels per second

  // Ripple effects for impacts and interactions
  const ripples = [];

  class Dot {
    constructor(x, y) {
      this.radius = DOT_RADIUS;
      this.x = x;
      this.y = y;
      this.speed = BASE_SPEED;
      this.pulsePhase = Math.random() * Math.PI * 2;
      this.initVelocity();
    }

    // Pick an unmistakably diagonal direction
    initVelocity() {
      // Pick one of 4 quadrants with an angle between 25° and 65° off-axis
      const quadrant = Math.floor(Math.random() * 4);
      const minAngle = (25 * Math.PI) / 180;
      const maxAngle = (65 * Math.PI) / 180;
      const offset = minAngle + Math.random() * (maxAngle - minAngle);
      const angle = quadrant * (Math.PI / 2) + offset;

      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
      this.maintainSpeedAndDiagonals();
    }

    // Prevent near-axis lock: ensure neither axis velocity drops below 25% of total speed
    maintainSpeedAndDiagonals() {
      const currentSpeed = Math.hypot(this.vx, this.vy) || this.speed;
      let vxNorm = this.vx / currentSpeed;
      let vyNorm = this.vy / currentSpeed;

      const minComponent = 0.25;
      if (Math.abs(vxNorm) < minComponent) {
        vxNorm = Math.sign(vxNorm || 1) * minComponent;
        vyNorm = Math.sign(vyNorm || 1) * Math.sqrt(1 - vxNorm * vxNorm);
      } else if (Math.abs(vyNorm) < minComponent) {
        vyNorm = Math.sign(vyNorm || 1) * minComponent;
        vxNorm = Math.sign(vxNorm || 1) * Math.sqrt(1 - vyNorm * vyNorm);
      }

      this.vx = vxNorm * this.speed;
      this.vy = vyNorm * this.speed;
    }

    update(dt) {
      // Advance position based on delta time
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Subtle organic breathing of the glow
      this.pulsePhase += dt * 3.5;

      // Boundary collision detection & response (taking radius into account)
      let bounced = false;

      // Left boundary
      if (this.x - this.radius <= 0) {
        this.x = this.radius;
        this.vx = Math.abs(this.vx);
        bounced = true;
      }
      // Right boundary
      else if (this.x + this.radius >= width) {
        this.x = width - this.radius;
        this.vx = -Math.abs(this.vx);
        bounced = true;
      }

      // Top boundary
      if (this.y - this.radius <= 0) {
        this.y = this.radius;
        this.vy = Math.abs(this.vy);
        bounced = true;
      }
      // Bottom boundary
      else if (this.y + this.radius >= height) {
        this.y = height - this.radius;
        this.vy = -Math.abs(this.vy);
        bounced = true;
      }

      if (bounced) {
        this.maintainSpeedAndDiagonals();
        createRipple(this.x, this.y, 20, 0.35, 0.3);
      }

      this.clamp();
    }

    // Never leave the visible viewport
    clamp() {
      const minX = this.radius;
      const maxX = Math.max(minX, width - this.radius);
      const minY = this.radius;
      const maxY = Math.max(minY, height - this.radius);

      this.x = Math.min(Math.max(this.x, minX), maxX);
      this.y = Math.min(Math.max(this.y, minY), maxY);
    }

    draw(ctx) {
      ctx.save();

      // Subtle breathing radius for the atmospheric glow
      const glowSpread = this.radius * (4.2 + 0.5 * Math.sin(this.pulsePhase));

      // Layer 1: Soft atmospheric radial gradient
      const gradient = ctx.createRadialGradient(
        this.x, this.y, this.radius * 0.2,
        this.x, this.y, glowSpread
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.05)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, glowSpread, 0, Math.PI * 2);
      ctx.fill();

      // Layer 2: Radiant luminous bloom
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 12;

      // Layer 3: Solid crisp white core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Deflect gently away from an interaction point
    deflect(fromX, fromY) {
      const dx = this.x - fromX;
      const dy = this.y - fromY;
      const dist = Math.hypot(dx, dy);

      if (dist < 1e-4) {
        this.initVelocity();
        return;
      }

      // Stronger push when close, gentle cosmic wave from afar
      const maxProximity = 350;
      const influence = dist < maxProximity
        ? 0.5 + (1 - dist / maxProximity) * 1.5
        : 0.3;

      const nx = dx / dist;
      const ny = dy / dist;

      this.vx += nx * this.speed * influence;
      this.vy += ny * this.speed * influence;
      this.maintainSpeedAndDiagonals();
    }
  }

  // Ripple visual effect
  class Ripple {
    constructor(x, y, maxRadius = 50, duration = 0.5, maxOpacity = 0.4) {
      this.x = x;
      this.y = y;
      this.maxRadius = maxRadius;
      this.duration = duration;
      this.maxOpacity = maxOpacity;
      this.elapsed = 0;
      this.finished = false;
    }

    update(dt) {
      this.elapsed += dt;
      if (this.elapsed >= this.duration) {
        this.finished = true;
      }
    }

    draw(ctx) {
      const progress = Math.min(this.elapsed / this.duration, 1);
      const currentRadius = this.maxRadius * progress;
      const opacity = this.maxOpacity * (1 - progress);

      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function createRipple(x, y, maxRadius = 50, duration = 0.5, maxOpacity = 0.4) {
    ripples.push(new Ripple(x, y, maxRadius, duration, maxOpacity));
  }

  let dot;

  function handleResize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    // Apply coordinate scale to match CSS pixels 1:1
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    if (!dot) {
      dot = new Dot(width / 2, height / 2);
    } else {
      dot.clamp();
    }
  }

  // Cursor auto-hide logic for authentic screensaver experience
  let idleTimer = null;
  function resetIdleTimer() {
    document.body.classList.remove('hide-cursor');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.body.classList.add('hide-cursor');
    }, 2500);
  }

  window.addEventListener('pointermove', resetIdleTimer);

  // User interactions: tap/click and spacebar
  function handlePointerAction(e) {
    resetIdleTimer();
    const x = e.clientX;
    const y = e.clientY;

    createRipple(x, y, 65, 0.55, 0.45);
    if (dot) {
      dot.deflect(x, y);
    }
  }

  window.addEventListener('pointerdown', handlePointerAction);

  window.addEventListener('keydown', (e) => {
    resetIdleTimer();
    if (e.code === 'Space' && dot) {
      dot.initVelocity();
      createRipple(dot.x, dot.y, 80, 0.6, 0.5);
    }
  });

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 100);
  });

  // Initialize display
  handleResize();
  resetIdleTimer();

  // Animation Loop with precise delta-time handling
  let lastTimestamp = 0;

  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;

    // Delta time in seconds, capped at 100ms to prevent tunnel glitches if browser tab loses focus
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    // Clear frame with pure black background (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Update and draw ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].update(dt);
      ripples[i].draw(ctx);
      if (ripples[i].finished) {
        ripples.splice(i, 1);
      }
    }

    // Update and render the bouncing dot
    dot.update(dt);
    dot.draw(ctx);

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
