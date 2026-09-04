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
        if (this.type === "nuke_smoke" || this.type === "smoke") {
            this.vx *= 0.94;
            this.vy *= 0.94;
            this.vy -= 0.12; // 연기 상승 기류 효과
        } else {
            this.vx *= 0.92;
            this.vy *= 0.92;
        }

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

        if (this.type === "shockwave" || this.type === "nuke_shockwave") {
            // 대폭발 충격파 링 (두껍고 묵직한 초열 압력파 링)
            ctx.strokeStyle = this.color;
            const lineW = this.type === "nuke_shockwave" ? Math.max(3.5, 24 * this.life) : Math.max(1, 4 * this.life);
            ctx.lineWidth = lineW;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * (1 - this.life + 0.04), 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === "nuke_fireball") {
            // 중심부에서 거대하게 부풀어 오르는 초열 백열 플라즈마 화구
            const growth = 1.0 + (1.0 - this.life) * 2.2;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * growth, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === "nuke_smoke" || this.type === "smoke") {
            // 시간이 지날수록 웅장하게 부풀어 오르는 짙은 연기 (크기 1.0 -> 4.5배)
            const growth = 1.0 + (1.0 - this.life) * 3.5;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * growth, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === "casing") {
            // 황동 탄피 (작은 금색 막대)
            ctx.fillStyle = "#facc15";
            ctx.fillRect(this.x - 1.5, this.y - 0.75, 3, 1.5);
        } else {
            // 일반 파티클 (피, 불꽃, 스파크)
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
     * 핵폭발 초대형 그을음 및 파괴 분화구 (Crater) 영구 도장
     */
    stampNukeCrater(x, y, radius = 280) {
        this.ctx.save();

        // 1. 거대한 방사능 초열 그을음 (외곽 반투명 검은 재)
        this.ctx.fillStyle = "rgba(10, 15, 26, 0.75)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 1.25, 0, Math.PI * 2);
        this.ctx.fill();

        // 2. 중간 열폭풍 연소 구역
        this.ctx.fillStyle = "rgba(3, 7, 18, 0.9)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
        this.ctx.fill();

        // 3. 중심부 칠흑의 파괴 분화구
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.98)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
        this.ctx.fill();

        // 4. 사방으로 뻗어나간 지면 파열 균열선 (Cracks)
        this.ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
        this.ctx.lineWidth = 2.5;
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
            const dist = radius * (0.6 + Math.random() * 0.65);
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            const midX = x + Math.cos(angle) * (dist * 0.5) + (Math.random() - 0.5) * 20;
            const midY = y + Math.sin(angle) * (dist * 0.5) + (Math.random() - 0.5) * 20;
            const endX = x + Math.cos(angle) * dist;
            const endY = y + Math.sin(angle) * dist;
            this.ctx.lineTo(midX, midY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }

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

    /**
     * 초대형 전술 핵폭발 초기 발동 (다중 압력파 + 거대 플라즈마 화구 + 1차 연기)
     */
    spawnNukeDetonation(x, y, radius = 380, stampBuffer) {
        // 지면 초대형 분화구 & 균열 영구 도장
        if (stampBuffer) {
            stampBuffer.stampNukeCrater(x, y, radius * 0.85);
        }

        // 1. 초광속 1차 백색 초중량 충격파 링 (반경 620px)
        this.spawn(x, y, 0, 0, radius * 1.65, "#ffffff", 0.02, "nuke_shockwave");
        
        // 2. 2차 주황/황금빛 초열 폭풍 충격파 링 (반경 480px)
        this.spawn(x, y, 0, 0, radius * 1.25, "#fbbf24", 0.016, "nuke_shockwave");

        // 3. 중심부 초열 플라즈마 거대 화구 코어 16개 (반경 60~110px로 부풀어오름, 약 3초간 눈부시게 지속)
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 55;
            const px = x + Math.cos(angle) * dist;
            const py = y + Math.sin(angle) * dist;
            const size = 38 + Math.random() * 38;
            const colors = ["#ffffff", "#ffedd5", "#fef08a", "#fbbf24"];
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.spawn(px, py, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2 - 1.2, size, color, 0.007, "nuke_fireball");
        }

        // 4. 사방으로 비산하는 묵직한 화염 파편 110개
        for (let i = 0; i < 110; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3.0 + Math.random() * 14.0;
            const size = 7.0 + Math.random() * 10.0;
            const colors = ["#ffffff", "#ef4444", "#f97316", "#facc15", "#ea580c", "#7c2d12"];
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, size, color, 0.015, "spark");
        }

        // 5. 1차 버섯구름 짙은 연기 기둥 50개
        this.spawnNukeSmokeWave(x, y, 50, radius * 0.4);
    }

    /**
     * 짙은 버섯구름 팽창 연기 파티클 생성 (수명 6~8초 지속, 거대한 팽창)
     */
    spawnNukeSmokeWave(centerX, centerY, count = 16, spread = 80) {
        const smokeColors = [
            "rgba(15, 23, 42, 0.94)",   // 짙은 흑회색
            "rgba(30, 41, 59, 0.90)",   // 슬레이트 잿빛
            "rgba(51, 65, 85, 0.86)",   // 먹구름
            "rgba(67, 20, 7, 0.88)",    // 불타는 적갈색 연기
            "rgba(124, 45, 18, 0.84)"   // 그을린 주황빛 연기
        ];

        for (let i = 0; i < count; i++) {
            const offsetDist = Math.random() * spread;
            const offsetAngle = Math.random() * Math.PI * 2;
            const px = centerX + Math.cos(offsetAngle) * offsetDist;
            const py = centerY + Math.sin(offsetAngle) * offsetDist;

            // 서서히 솟구치며 사방으로 피어오르는 속도
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 3.2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - (1.2 + Math.random() * 2.4); // 상공으로 치솟음

            const baseSize = 26 + Math.random() * 28; // 부풀어 오르면 직경 120~250px의 묵직한 연기
            const decay = 0.0035 + Math.random() * 0.003; // 6~8초 동안 전장을 덮는 초장기 수명
            const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];

            this.spawn(px, py, vx, vy, baseSize, color, decay, "nuke_smoke");
        }
    }

    /**
     * 핵폭발 시 상공으로 수직 맹렬히 치솟는 거대한 불기둥 (Rising Fire Pillar)
     */
    spawnFirePillar(centerX, centerY, count = 95, spreadX = 160) {
        const pillarColors = ["#ffffff", "#ffedd5", "#fef08a", "#facc15", "#f97316", "#ef4444", "#dc2626"];

        for (let i = 0; i < count; i++) {
            const px = centerX + (Math.random() - 0.5) * spreadX;
            const py = centerY + (Math.random() - 0.5) * 45;

            // 상공(위쪽)으로 맹렬하게 솟구치는 거대한 화염 폭풍
            const vx = (Math.random() - 0.5) * 5.5;
            const vy = -(7.0 + Math.random() * 18.0); // 맹렬한 수직 상승력
            const size = 20.0 + Math.random() * 24.0; // 묵직한 거대 화염 덩어리
            const decay = 0.012 + Math.random() * 0.010; // 잔상 지속시간 증가
            const color = pillarColors[Math.floor(Math.random() * pillarColors.length)];

            this.spawn(px, py, vx, vy, size, color, decay, "spark");
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
