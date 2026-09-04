/**
 * projectiles.js - 총알, 산탄, 저격 관통탄, 로켓, 화염, 산성액 투사체 풀링 시스템
 * 
 * Zero-Allocation 풀링을 통해 총알이 초당 수천 발 발사되어도 메모리 동적 할당 없이 60 FPS를 유지합니다.
 */

import { soundFX } from './audio.js';

class Projectile {
    constructor() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.speed = 10;
        this.radius = 3;
        this.damage = 10;
        this.knockback = 1;
        this.color = "#ffffff";
        this.type = "bullet"; // bullet, shotgun, tracer, rocket, flame, acid
        this.faction = "blue";
        this.life = 1.0;
        this.penetration = 1; // 남은 관통 횟수
        this.explosionRadius = 0;
        this.shooterId = null;

        // 2.5D 포물선 높이 시뮬레이션 (로켓 / 산성액 곡사포)
        this.z = 0;
        this.vz = 0;
        this.gravity = 0;

        // 저격총 트레이서 잔상용 시작 좌표
        this.startX = 0;
        this.startY = 0;
    }

    init(x, y, targetX, targetY, unitData, faction, shooterId) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.faction = faction;
        this.shooterId = shooterId;
        this.type = unitData.weapon || "bullet";
        this.color = unitData.bulletColor || "#ffffff";
        this.radius = unitData.bulletRadius || 3;
        this.damage = unitData.damage || 15;
        this.knockback = unitData.knockback || 1.5;
        this.penetration = unitData.penetration || 1;
        this.explosionRadius = unitData.explosionRadius || 0;
        this.life = 1.2;

        // 탄도 각도 계산 및 명중률 탄퍼짐(Spread)
        const dx = targetX - x;
        const dy = targetY - y;
        let angle = Math.atan2(dy, dx);

        if (unitData.accuracy && unitData.accuracy < 1.0) {
            const spread = (1 - unitData.accuracy) * 0.4;
            angle += (Math.random() - 0.5) * spread;
        }

        const spd = unitData.bulletSpeed || 14;
        this.speed = spd;
        this.vx = Math.cos(angle) * spd;
        this.vy = Math.sin(angle) * spd;

        // 곡사포 투사체 (산성액 등)
        if (this.type === "acid_ball" || this.type === "mortar") {
            const dist = Math.hypot(dx, dy);
            const timeToTarget = dist / spd;
            this.z = 5;
            this.gravity = 0.4;
            this.vz = (0.5 * this.gravity * timeToTarget * timeToTarget + 20) / timeToTarget;
            this.life = timeToTarget / 60 + 0.1;
        } else {
            this.z = 0;
            this.vz = 0;
            this.gravity = 0;
        }
    }

    update(dt, spatialGrid, particlePool, stampBuffer, onHitCallback) {
        if (!this.active) return;

        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.life -= dt;

        // 2.5D 높이 곡사 계산
        if (this.gravity > 0) {
            this.z += this.vz * dt * 60;
            this.vz -= this.gravity * dt * 60;
            if (this.z <= 0) {
                // 착탄
                this.detonate(particlePool, stampBuffer, onHitCallback);
                this.active = false;
                return;
            }
        }

        // 로켓 비행 시 꼬리 연기 파티클
        if (this.type === "missile" && Math.random() < 0.4) {
            particlePool.spawn(this.x, this.y, -this.vx * 0.2, -this.vy * 0.2, 2.5, "#94a3b8", 0.08, "smoke");
        }

        if (this.life <= 0) {
            if (this.explosionRadius > 0) {
                this.detonate(particlePool, stampBuffer, onHitCallback);
            }
            this.active = false;
            return;
        }

        // 적 충돌 검사 (Spatial Hash Grid O(1) 쿼리)
        spatialGrid.query(this.x, this.y, this.radius + 15, (unit) => {
            if (!this.active) return;
            if (unit.faction !== this.faction && unit.isAlive) {
                // 충돌 성공!
                this.hitUnit(unit, particlePool, stampBuffer, onHitCallback);
            }
        });
    }

    hitUnit(unit, particlePool, stampBuffer, onHitCallback) {
        if (this.explosionRadius > 0) {
            // 폭발형 무기 (로켓 등)
            this.detonate(particlePool, stampBuffer, onHitCallback);
            this.active = false;
        } else {
            // 직격 관통/단발 무기
            unit.takeDamage(this.damage, this.knockback, this.vx, this.vy);
            particlePool.spawnBloodSplatter(unit.x, unit.y, 4, unit.bloodColor || "#991b1b");
            if (onHitCallback) onHitCallback(unit, this);

            this.penetration--;
            if (this.penetration <= 0) {
                this.active = false;
            }
        }
    }

    detonate(particlePool, stampBuffer, onHitCallback) {
        soundFX.playExplosion(this.explosionRadius / 45);
        particlePool.spawnExplosion(this.x, this.y, this.explosionRadius, stampBuffer);

        if (onHitCallback) {
            onHitCallback(null, this, true); // 광역 폭발 콜백
        }
    }

    render(ctx) {
        if (!this.active) return;

        ctx.save();

        if (this.type === "tracer_bullet") {
            // 저격총 레이저 트레이서 백색 섬광 라인 (보는 맛 극대화)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(this.x - this.vx * 3, this.y - this.vy * 3);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();

            // 총알 헤드 글로우
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === "missile") {
            // 로켓 탄체 (회전 방향)
            const angle = Math.atan2(this.vy, this.vx);
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            ctx.fillStyle = "#e11d48";
            ctx.fillRect(-7, -2.5, 14, 5);
            ctx.fillStyle = "#facc15";
            ctx.fillRect(-9, -1.5, 3, 3); // 후미 화염
        } else if (this.type === "flame") {
            // 화염 입자
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * (2.0 - this.life), 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 일반 총알 / 펠릿
            // 2.5D 지면 그림자
            if (this.z > 0) {
                ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 본체 탄환 (높이 z만큼 위로 띄움)
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.z, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

export class ProjectilePool {
    constructor(maxCount = 2500) {
        this.maxCount = maxCount;
        this.pool = new Array(maxCount);
        for (let i = 0; i < maxCount; i++) {
            this.pool[i] = new Projectile();
        }
        this.currentIndex = 0;
    }

    spawn(x, y, targetX, targetY, unitData, faction, shooterId) {
        const p = this.pool[this.currentIndex];
        p.init(x, y, targetX, targetY, unitData, faction, shooterId);
        this.currentIndex = (this.currentIndex + 1) % this.maxCount;
        return p;
    }

    update(dt, spatialGrid, particlePool, stampBuffer, onHitCallback) {
        for (let i = 0; i < this.maxCount; i++) {
            if (this.pool[i].active) {
                this.pool[i].update(dt, spatialGrid, particlePool, stampBuffer, onHitCallback);
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

    clear() {
        for (let i = 0; i < this.maxCount; i++) {
            this.pool[i].active = false;
        }
    }
}
