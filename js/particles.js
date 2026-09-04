/**
 * particles.js - 고성능 제로-GC 파티클 오브젝트 풀 & 배경 스탬프 버퍼
 * 
 * 1. ParticlePool: 미리 생성된 고정 배열을 재사용하여 GC(가비지 컬렉터) 렉을 완전히 제거
 * 2. BackgroundStampBuffer: 피 자국, 탄피, 폭발 그을음을 배경 오프스크린 캔버스에 영구 '도장(Stamp)'
 *    -> 매 프레임 수천 개의 파티클을 재계산할 필요 없이 1회의 drawImage로 0ms 렌더링 실현!
 */

import { CONFIG } from './config.js';

class Particle {
    constructor() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 2;
        this.color = "#ffffff";
        this.alpha = 1.0;
        this.decay = 0.02;
        this.type = "spark"; // blood, muzzle, spark, smoke, casing, shockwave, acid
        this.bounce = 0;
        this.life = 1.0;
    }

    init(x, y, vx, vy, size, color, decay, type) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color;
        this.alpha = 1.0;
        this.decay = decay;
        this.type = type;
        this.bounce = type === "casing" ? 2 : 0;
        this.life = 1.0;
    }

    update(dt, stampBuffer) {
        if (!this.active) return;

        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.life -= this.decay * dt * 60;
        this.alpha = Math.max(0, this.life);

        // 마찰력 감속
        this.vx *= 0.92;
        this.vy *= 0.92;

        // 탄피 바닥 바운스 및 배경 스탬프
        if (this.type === "casing") {
            if (this.bounce > 0 && (Math.abs(this.vx) < 0.2 && Math.abs(this.vy) < 0.2)) {
                this.bounce--;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
            }
        }

        // 피 파티클이 속도가 줄어들면 지면에 핏자국으로 영구 도장(Stamp)
        if (this.type === "blood" && (Math.abs(this.vx) + Math.abs(this.vy) < 0.3 || this.life <= 0.2)) {
            stampBuffer.stampBlood(this.x, this.y, this.size * 1.5, this.color);
            this.active = false;
            return;
        }

        // 탄피가 멈추면 지면에 영구 도장
        if (this.type === "casing" && this.life <= 0.1) {
            stampBuffer.stampCasing(this.x, this.y);
            this.active = false;
            return;
        }

        if (this.life <= 0) {
            this.active = false;
        }
    }

    render(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (this.type === "shockwave") {
            // 대폭발 충격파 링
            ctx.strokeStyle = this.color;
            ctx.lineWidth = Math.max(1, 4 * this.life);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * (1 - this.life + 0.1), 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === "casing") {
            // 황동 탄피 (작은 금색 막대)
            ctx.fillStyle = "#facc15";
            ctx.fillRect(this.x - 1.5, this.y - 0.75, 3, 1.5);
        } else {
            // 일반 파티클 (피, 불꽃, 연기)
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * 배경 오프스크린 스탬프 버퍼 (핏자국, 시체, 폭발 그을음 누적 캔버스)
 */
export class BackgroundStampBuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d", { alpha: true });
        this.clear();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 미세한 모눈종이 전장 그리드 라인 1회 렌더링
        this.ctx.strokeStyle = CONFIG.COLORS.GRID_LINES;
        this.ctx.lineWidth = 1;
        const step = 64;
        this.ctx.beginPath();
        for (let x = 0; x < this.width; x += step) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
        }
        for (let y = 0; y < this.height; y += step) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
        }
        this.ctx.stroke();
    }

    /**
     * 지면에 핏자국 영구 도장 찍기
     */
    stampBlood(x, y, radius, color = "#881337") {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.65;
        this.ctx.beginPath();
        // 무작위 불규칙 웅덩이 타원
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // 튀어 나간 작은 핏방울 2~3개
        for (let i = 0; i < 2; i++) {
            const rx = x + (Math.random() - 0.5) * radius * 2.2;
            const ry = y + (Math.random() - 0.5) * radius * 2.2;
            this.ctx.beginPath();
            this.ctx.arc(rx, ry, radius * 0.35, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    /**
     * 바닥에 탄피 영구 도장
     */
    stampCasing(x, y) {
        this.ctx.save();
        this.ctx.fillStyle = "rgba(234, 179, 8, 0.4)";
        this.ctx.fillRect(x - 1.5, y - 0.75, 3, 1.5);
        this.ctx.restore();
    }

    /**
     * 폭발 그을음 분화구 (Crater) 영구 도장
     */
    stampCrater(x, y, radius) {
        this.ctx.save();
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * 메인 캔버스에 누적된 배경 1회 블릿
     */
    render(mainCtx) {
        mainCtx.drawImage(this.canvas, 0, 0);
    }
}

/**
 * 파티클 매니저 (Object Pool)
 */
export class ParticlePool {
    constructor(maxCount = 3500) {
        this.maxCount = maxCount;
        this.pool = new Array(maxCount);
        for (let i = 0; i < maxCount; i++) {
            this.pool[i] = new Particle();
        }
        this.currentIndex = 0;
    }

    spawn(x, y, vx, vy, size, color, decay, type) {
        const p = this.pool[this.currentIndex];
        p.init(x, y, vx, vy, size, color, decay, type);
        this.currentIndex = (this.currentIndex + 1) % this.maxCount;
        return p;
    }

    /**
     * 피격 시 피 튀김 연출 (도파민 이펙트)
     */
    spawnBloodSplatter(x, y, count = 5, color = "#991b1b") {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.0 + Math.random() * 3.5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 1.5 + Math.random() * 2.5;
            const decay = 0.025 + Math.random() * 0.02;
            this.spawn(x, y, vx, vy, size, color, decay, "blood");
        }
    }

    /**
     * 총기 발사 시 총구 화염 및 탄피 배출
     */
    spawnMuzzleFlash(x, y, angle, color = "#fef08a") {
        // 총구 화염 스파크 3개
        for (let i = 0; i < 3; i++) {
            const spread = angle + (Math.random() - 0.5) * 0.4;
            const speed = 2.0 + Math.random() * 3.0;
            this.spawn(x, y, Math.cos(spread) * speed, Math.sin(spread) * speed, 2.0, color, 0.15, "muzzle");
        }

        // 옆으로 튀는 탄피 (90도 각도)
        const casingAngle = angle + (Math.PI / 2) * (Math.random() > 0.5 ? 1 : -1) + (Math.random() - 0.5) * 0.3;
        const casingSpeed = 1.5 + Math.random() * 2.0;
        this.spawn(x, y, Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed, 2, "#facc15", 0.015, "casing");
    }

    /**
     * 대폭발 쇼크웨이브 & 화염구 파편
     */
    spawnExplosion(x, y, radius = 50, stampBuffer) {
        // 지면 그을음 영구 도장
        if (stampBuffer) {
            stampBuffer.stampCrater(x, y, radius);
        }

        // 1. 거대한 충격파 링
        this.spawn(x, y, 0, 0, radius * 1.6, "#ffffff", 0.04, "shockwave");

        // 2. 화염 파편 25개
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.0 + Math.random() * 6.0;
            const size = 3.0 + Math.random() * 4.0;
            const colors = ["#f97316", "#ef4444", "#fbbf24", "#475569"];
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, size, color, 0.035, "spark");
        }
    }

    update(dt, stampBuffer) {
        for (let i = 0; i < this.maxCount; i++) {
            if (this.pool[i].active) {
                this.pool[i].update(dt, stampBuffer);
            }
        }
    }

    render(ctx) {
        for (let i = 0; i < this.maxCount; i++) {
            if (this.pool[i].active) {
                this.pool[i].render(ctx);
            }
        }
    }
}
