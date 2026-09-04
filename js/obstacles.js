/**
 * obstacles.js - 벽, 바리케이드, 지뢰, 스폰 포탈 및 맵 관리자
 * 
 * 인게임 맵 에디터와 연동되어 자유롭게 설치/삭제할 수 있으며, 맵 JSON 저장/로드 기능을 지원합니다.
 */

import { soundFX } from './audio.js';

export class Obstacle {
    constructor(type, x, y, width, height, options = {}) {
        this.type = type; // "wall", "barricade", "mine", "spawner"
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;

        // 스폰 포탈 전용 옵션
        this.spawnType = options.spawnType || "runner";
        this.spawnFaction = options.spawnFaction || "red";
        this.spawnInterval = options.spawnInterval || 2.0; // 2초마다
        this.spawnTimer = 0;
        this.spawnCount = options.spawnCount || 5;

        // 지뢰 전용 옵션
        this.exploded = false;
        this.explosionRadius = options.explosionRadius || 70;
        this.mineDamage = options.mineDamage || 250;
    }

    update(dt, unitManager, particlePool, stampBuffer) {
        if (!this.active) return;

        // 스폰 포탈 자동 생성 로직
        if (this.type === "spawner") {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0;
                for (let i = 0; i < this.spawnCount; i++) {
                    const sx = this.x + this.width / 2 + (Math.random() - 0.5) * 40;
                    const sy = this.y + this.height / 2 + (Math.random() - 0.5) * 40;
                    unitManager.spawn(this.spawnType, sx, sy, this.spawnFaction);
                }
                particlePool.spawn(this.x + this.width / 2, this.y + this.height / 2, 0, 0, 25, "#a855f7", 0.05, "shockwave");
            }
        }
    }

    /**
     * 유닛이 벽에 부딪혔을 때 충돌 해결 (슬라이딩 처리)
     */
    resolveUnitCollision(unit, unitManager, particlePool, stampBuffer) {
        if (!this.active) return;

        if (this.type === "wall") {
            // AABB vs Circle 충돌
            const closestX = Math.max(this.x, Math.min(unit.x, this.x + this.width));
            const closestY = Math.max(this.y, Math.min(unit.y, this.y + this.height));

            const dx = unit.x - closestX;
            const dy = unit.y - closestY;
            const distSq = dx * dx + dy * dy;

            if (distSq < unit.radius * unit.radius) {
                const dist = Math.sqrt(distSq);
                if (dist > 0.001) {
                    const overlap = unit.radius - dist;
                    unit.x += (dx / dist) * overlap;
                    unit.y += (dy / dist) * overlap;
                } else {
                    unit.x += 1;
                }
            }
        } else if (this.type === "barricade") {
            // 바리케이드: 유닛이 내부를 통과할 때 이동 속도 70% 감속
            if (unit.x >= this.x && unit.x <= this.x + this.width &&
                unit.y >= this.y && unit.y <= this.y + this.height) {
                unit.speedMultiplier = 0.3;
            }
        } else if (this.type === "mine" && !this.exploded) {
            // 지뢰: 적이 밟으면 폭발
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const dx = unit.x - cx;
            const dy = unit.y - cy;
            if (dx * dx + dy * dy < 20 * 20) {
                this.detonateMine(unitManager, particlePool, stampBuffer);
            }
        }
    }

    detonateMine(unitManager, particlePool, stampBuffer) {
        this.exploded = true;
        this.active = false;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        soundFX.playExplosion(1.5);
        particlePool.spawnExplosion(cx, cy, this.explosionRadius, stampBuffer);

        // 주변 모든 유닛에게 스플래시 데미지
        unitManager.applySplashDamage(cx, cy, this.explosionRadius, this.mineDamage, 9.0);
    }

    render(ctx) {
        if (!this.active) return;

        ctx.save();

        if (this.type === "wall") {
            // 2.5D 두꺼운 콘크리트 벽
            // 바닥 그림자
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(this.x + 6, this.y + 6, this.width, this.height);

            // 벽 본체
            ctx.fillStyle = "#334155";
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // 벽 상단 테두리 하이라이트
            ctx.strokeStyle = "#64748b";
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        } else if (this.type === "barricade") {
            // 철조망 / 바리케이드 (X자 교차 패턴)
            ctx.fillStyle = "rgba(120, 113, 108, 0.3)";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = "#a8a29e";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // X자 살
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.moveTo(this.x + this.width, this.y);
            ctx.lineTo(this.x, this.y + this.height);
            ctx.stroke();
        } else if (this.type === "mine") {
            // 지뢰 (원형 센서 깜빡임)
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            ctx.fillStyle = "#475569";
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === "spawner") {
            // 스폰 포탈 (보라색 네온 소용돌이)
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            ctx.fillStyle = "rgba(168, 85, 247, 0.3)";
            ctx.beginPath();
            ctx.arc(cx, cy, this.width / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#c084fc";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, this.width / 2 - 4, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("🌀 PORTAL", cx, cy + 4);
        }

        ctx.restore();
    }
}

export class MapManager {
    constructor(worldWidth = 2400, worldHeight = 1600) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.obstacles = [];
    }

    addObstacle(type, x, y, width, height, options = {}) {
        const obs = new Obstacle(type, x, y, width, height, options);
        this.obstacles.push(obs);
        return obs;
    }

    removeAt(x, y, radius = 20) {
        this.obstacles = this.obstacles.filter(obs => {
            const cx = obs.x + obs.width / 2;
            const cy = obs.y + obs.height / 2;
            const dist = Math.hypot(x - cx, y - cy);
            return dist > radius + Math.max(obs.width, obs.height) / 2;
        });
    }

    clear() {
        this.obstacles = [];
    }

    update(dt, unitManager, particlePool, stampBuffer) {
        for (let i = 0; i < this.obstacles.length; i++) {
            this.obstacles[i].update(dt, unitManager, particlePool, stampBuffer);
        }
    }

    resolveCollisions(unit, unitManager, particlePool, stampBuffer) {
        for (let i = 0; i < this.obstacles.length; i++) {
            this.obstacles[i].resolveUnitCollision(unit, unitManager, particlePool, stampBuffer);
        }
    }

    render(ctx) {
        for (let i = 0; i < this.obstacles.length; i++) {
            this.obstacles[i].render(ctx);
        }
    }

    /**
     * 맵 데이터 JSON 내보내기 (Export)
     */
    exportJSON() {
        return JSON.stringify({
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight,
            obstacles: this.obstacles.map(o => ({
                type: o.type,
                x: o.x,
                y: o.y,
                width: o.width,
                height: o.height,
                spawnType: o.spawnType,
                spawnFaction: o.spawnFaction,
                spawnInterval: o.spawnInterval
            }))
        }, null, 2);
    }

    /**
     * 맵 데이터 JSON 불러오기 (Import)
     */
    importJSON(jsonString) {
        try {
            const data = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
            this.clear();
            if (data.obstacles && Array.isArray(data.obstacles)) {
                for (const o of data.obstacles) {
                    this.addObstacle(o.type, o.x, o.y, o.width, o.height, o);
                }
            }
            return true;
        } catch (e) {
            console.error("Failed to import map JSON:", e);
            return false;
        }
    }

    /**
     * 기본 프리셋 맵 로드
     */
    loadPreset(presetName) {
        this.clear();
        if (presetName === "choke_outpost") {
            // 중앙 요새 및 양쪽 협곡 초크포인트
            this.addObstacle("wall", 600, 300, 40, 400);  // 좌측 상부 벽
            this.addObstacle("wall", 600, 800, 40, 400);  // 좌측 하부 벽
            this.addObstacle("barricade", 600, 700, 40, 100); // 좁은 골목에 바리케이드

            this.addObstacle("wall", 1300, 300, 40, 400); // 우측 상부 벽
            this.addObstacle("wall", 1300, 800, 40, 400); // 우측 하부 벽
            this.addObstacle("barricade", 1300, 700, 40, 100);

            // 지뢰밭
            this.addObstacle("mine", 520, 730, 20, 20);
            this.addObstacle("mine", 560, 750, 20, 20);
            this.addObstacle("mine", 1340, 730, 20, 20);
        } else if (presetName === "crossroad_bunker") {
            // 중앙 십자로 벙커
            this.addObstacle("wall", 800, 400, 120, 30);
            this.addObstacle("wall", 1000, 400, 120, 30);
            this.addObstacle("wall", 800, 680, 120, 30);
            this.addObstacle("wall", 1000, 680, 120, 30);
            this.addObstacle("barricade", 920, 400, 80, 30);
            this.addObstacle("barricade", 920, 680, 80, 30);
        }
    }
}
