/**
 * units.js - 유닛 객체 및 유닛 매니저 (OOP 코어)
 * 
 * - Unit: 물리, 상태 머신, AI 타겟팅(타임슬라이싱 최적화), 2.5D 렌더링(그림자, 백색 피격 섬광)
 * - UnitManager: 유닛 생성, 풀 관리, 팀별 킬 카운트, 광역 스플래시 피해, 감염 모드 처리
 */

import { UNIT_TYPES } from './unitData.js';
import { CONFIG } from './config.js';
import { soundFX } from './audio.js';

let unitIdCounter = 0;

export class Unit {
    constructor(typeId, x, y, faction = "blue") {
        this.id = ++unitIdCounter;
        this.typeId = typeId;
        this.type = UNIT_TYPES[typeId] || UNIT_TYPES.rifleman;
        this.faction = faction || this.type.faction;

        // 위치 및 물리
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = this.type.radius || 10;
        this.angle = Math.random() * Math.PI * 2;
        this.speedMultiplier = 1.0;

        // 체력 및 생존
        this.maxHp = this.type.hp || 100;
        this.hp = this.maxHp;
        this.isAlive = true;

        // 전투 및 AI
        this.target = null;
        this.targetDistanceSq = Infinity;
        this.repathTimer = this.id % CONFIG.PHYSICS.TARGET_REPATH_INTERVAL; // 타임 슬라이싱
        this.attackCooldown = 0;

        // 시각 이펙트 상태
        this.hitFlashTimer = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.walkCycle = 0;
        this.bloodColor = this.faction === "blue" ? "#991b1b" : (this.type.role === "ranged" ? "#65a30d" : "#881337");

        // 버프 / 상태이상
        this.burnTimer = 0;
    }

    takeDamage(damage, knockback = 0, sourceVx = 0, sourceVy = 0) {
        if (!this.isAlive) return;

        this.hp -= damage;
        this.hitFlashTimer = CONFIG.VISUALS.HIT_FLASH_DURATION;

        // 넉백 물리 적용
        if (knockback > 0 && (!this.type.knockbackImmunity || Math.random() > this.type.knockbackImmunity)) {
            const mag = Math.hypot(sourceVx, sourceVy);
            if (mag > 0.001) {
                this.vx += (sourceVx / mag) * knockback;
                this.vy += (sourceVy / mag) * knockback;
            }
        }

        if (this.hp <= 0) {
            this.isAlive = false;
        }
    }

    update(dt, spatialGrid, projectilePool, particlePool, stampBuffer, mapManager, infectionMode, unitManager, flowFieldManager) {
        if (!this.isAlive) return;

        // 피격 백색 섬광 타이머 감소
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= dt;
        }

        // 화염 화상 도트 데미지
        if (this.burnTimer > 0) {
            this.burnTimer -= dt;
            this.takeDamage(12 * dt, 0);
            if (Math.random() < 0.3) {
                particlePool.spawn(this.x, this.y, (Math.random() - 0.5) * 0.8, -1.0, 3, "#ea580c", 0.08, "spark");
            }
        }

        // 공격 쿨다운 감소
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        // 1. AI 타겟 탐색 (타임 슬라이싱: 프레임 분산으로 연산량 75% 절감)
        this.repathTimer++;
        if (this.repathTimer >= CONFIG.PHYSICS.TARGET_REPATH_INTERVAL || !this.target || !this.target.isAlive) {
            this.repathTimer = 0;
            this.target = spatialGrid.findNearestEnemy(this, this.type.sightRange || 450);
        }

        // 2. 이동 및 조향 (하이브리드: 유동장 우회 기동 + 근접 타겟팅)
        let moveX = 0;
        let moveY = 0;

        // 진영별 & 크기별 유동장(Flow Field) 방향 벡터 자동 샘플링 (radius 기반 1x1 vs 2x2 자동 분기)
        let flowX = 0;
        let flowY = 0;
        if (flowFieldManager) {
            const flow = flowFieldManager.getFlowVector(this.x, this.y, this.faction, this.radius);
            flowX = flow.x;
            flowY = flow.y;
        }

        if (this.target && this.target.isAlive) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            this.targetDistanceSq = dx * dx + dy * dy;
            const dist = Math.sqrt(this.targetDistanceSq);
            this.angle = Math.atan2(dy, dx);

            const attackRange = this.type.attackRange || 20;

            // 사거리 안이면 공격 실행
            if (dist <= attackRange && this.attackCooldown <= 0) {
                this.performAttack(this.target, projectilePool, particlePool, stampBuffer, unitManager);
            }

            if (dist < attackRange * 0.4 && this.type.role === "ranged") {
                // 원거리 딜러 카이팅 (너무 가까우면 뒤로 후퇴)
                moveX = -(dx / dist) * 0.6;
                moveY = -(dy / dist) * 0.6;
            } else if (dist > attackRange * 0.85) {
                // 사거리 밖: 타겟과의 거리에 따라 플로우필드(벽 우회)와 직접 추적 벡터 지능형 혼합
                if (flowX !== 0 || flowY !== 0) {
                    // 사거리의 2.5배보다 멀리 있거나 벽 너머에 있을 때 플로우필드 비중을 높여 미로/벽 우회 보장
                    const directWeight = Math.min(1.0, (attackRange * 2.5) / Math.max(1, dist));
                    const flowWeight = 1.0 - directWeight * 0.7; // 최소 30% 플로우 유지로 코너 우회 보장

                    moveX = (dx / dist) * directWeight + flowX * flowWeight;
                    moveY = (dy / dist) * directWeight + flowY * flowWeight;
                    const mLen = Math.hypot(moveX, moveY);
                    if (mLen > 0.001) {
                        moveX /= mLen;
                        moveY /= mLen;
                    }
                } else {
                    moveX = dx / dist;
                    moveY = dy / dist;
                }
            }
        } else {
            // 시야 내에 타겟 적이 없을 때: 플로우필드를 따라 전선을 향해 진격!
            if (flowX !== 0 || flowY !== 0) {
                moveX = flowX;
                moveY = flowY;
                this.angle = Math.atan2(flowY, flowX);
            }
        }

        // 3. 군중 분리 (Flocking Separation - 서로 겹치지 않게 밀어냄)
        const sepRadius = this.radius * 2.2;
        spatialGrid.query(this.x, this.y, sepRadius, (other) => {
            if (other === this || !other.isAlive) return;
            const ox = this.x - other.x;
            const oy = this.y - other.y;
            const d2 = ox * ox + oy * oy;
            if (d2 > 0.0001 && d2 < sepRadius * sepRadius) {
                const d = Math.sqrt(d2);
                const push = (sepRadius - d) / sepRadius;
                moveX += (ox / d) * push * CONFIG.PHYSICS.FLOCKING_SEPARATION_FORCE;
                moveY += (oy / d) * push * CONFIG.PHYSICS.FLOCKING_SEPARATION_FORCE;
            }
        });

        // 4. 속도 적용 및 마찰 감쇠
        const baseSpeed = (this.type.speed || 2.0) * this.speedMultiplier;
        this.speedMultiplier = 1.0; // 매 프레임 초기화 (바리케이드 등에서 재설정)

        this.vx += moveX * baseSpeed * 0.35;
        this.vy += moveY * baseSpeed * 0.35;

        // 마찰력
        this.vx *= CONFIG.PHYSICS.DRAG;
        this.vy *= CONFIG.PHYSICS.DRAG;

        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;

        // 무한 맵: 월드 경계 제한 해제 (동서남북 무한 이동 지원)

        // 맵 장애물(벽) 충돌 해결
        if (mapManager) {
            mapManager.resolveCollisions(this, unitManager, particlePool, stampBuffer);
        }

        // 걸음 애니메이션 누적
        const currentSpeed = Math.hypot(this.vx, this.vy);
        if (currentSpeed > 0.2) {
            this.walkCycle += currentSpeed * 0.15;
        }

        // 자폭체 박동 효과 누적
        if (this.type.pulseGlow) {
            this.pulsePhase += dt * 8;
        }
    }

    performAttack(target, projectilePool, particlePool, stampBuffer, unitManager) {
        this.attackCooldown = 1.0 / (this.type.attackSpeed || 1.0);

        const weapon = this.type.weapon || "bullet";
        const tx = target.x;
        const ty = target.y;

        if (weapon === "melee") {
            // 근접 타격 (좀비 등)
            target.takeDamage(this.type.damage, 2.5, Math.cos(this.angle), Math.sin(this.angle));
            particlePool.spawnBloodSplatter(target.x, target.y, 3, target.bloodColor);
        } else if (weapon === "slam") {
            // 탱커 브루트의 지면 강타
            soundFX.playExplosion(0.8);
            target.takeDamage(this.type.damage, 8.0, Math.cos(this.angle), Math.sin(this.angle));
            particlePool.spawnExplosion(this.x, this.y, this.type.slamRadius || 40, null);
        } else if (weapon === "self_destruct") {
            // 자폭체 대폭발
            this.isAlive = false;
            soundFX.playExplosion(1.4);
            particlePool.spawnExplosion(this.x, this.y, this.type.explosionRadius || 80, stampBuffer);
            if (unitManager) {
                unitManager.applySplashDamage(this.x, this.y, this.type.explosionRadius || 80, this.type.damage, 8.0);
            }
        } else if (weapon === "shotgun") {
            // 샷건: 부채꼴 펠릿 일제 발사
            soundFX.playShotgun();
            particlePool.spawnMuzzleFlash(this.x + Math.cos(this.angle) * 14, this.y + Math.sin(this.angle) * 14, this.angle);
            const pellets = this.type.pellets || 6;
            const spread = this.type.spreadAngle || 0.35;
            for (let i = 0; i < pellets; i++) {
                const pelletAngle = this.angle + (i / (pellets - 1) - 0.5) * spread;
                const ptx = this.x + Math.cos(pelletAngle) * 200;
                const pty = this.y + Math.sin(pelletAngle) * 200;
                projectilePool.spawn(this.x, this.y, ptx, pty, this.type, this.faction, this.id);
            }
        } else if (weapon === "flame") {
            // 화염방사기
            soundFX.playFlame();
            const flameAngle = this.angle + (Math.random() - 0.5) * 0.4;
            const ftx = this.x + Math.cos(flameAngle) * 160;
            const fty = this.y + Math.sin(flameAngle) * 160;
            projectilePool.spawn(this.x, this.y, ftx, fty, this.type, this.faction, this.id);
        } else if (weapon === "laser") {
            // 메카 타이탄 트윈 레이저 빔
            soundFX.playLaser();
            target.takeDamage(this.type.damage, 0.5);
            particlePool.spawn(target.x, target.y, 0, 0, 8, "#38bdf8", 0.1, "spark");
        } else {
            // 기본 총알 및 저격총
            if (this.type.id === "sniper") soundFX.playSniper();
            else soundFX.playRifle();

            particlePool.spawnMuzzleFlash(this.x + Math.cos(this.angle) * 14, this.y + Math.sin(this.angle) * 14, this.angle);
            projectilePool.spawn(this.x, this.y, tx, ty, this.type, this.faction, this.id);
        }
    }

    render(ctx, lodSimplified = false) {
        if (!this.isAlive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 2.5D 동적 타원 바닥 그림자
        if (CONFIG.VISUALS.ENABLE_SHADOWS && !lodSimplified) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
            ctx.beginPath();
            ctx.ellipse(2, this.radius * 0.75, this.radius * 0.95, this.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 회전 각도 적용
        ctx.rotate(this.angle);

        // 2. 피격 시 1프레임 순백색(#ffffff) 섬광 (타격감 핵심)
        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // 3. 저격수 붉은 레이저 조준선 (보는 맛 극대화)
        if (this.type.laserSight && this.target && !lodSimplified) {
            ctx.save();
            ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(this.type.attackRange, 0);
            ctx.stroke();
            ctx.restore();
        }

        // 4. 유닛 본체 실루엣 렌더링 (구분 확실한 디자인)
        const color = this.type.color || (this.faction === "blue" ? CONFIG.COLORS.BLUE_PRIMARY : CONFIG.COLORS.RED_PRIMARY);

        if (this.type.shape === "mech_titan") {
            // [메카 타이탄] 2x2칸을 꽉 채우는 각진 거대 보행 병기 + 아크 리액터
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 4;
            ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

            // 트윈 캐논 포신 2문
            ctx.fillStyle = "#0284c7";
            const canonW = this.radius * 0.9;
            const canonH = this.radius * 0.24;
            ctx.fillRect(this.radius * 0.15, -this.radius * 0.65, canonW, canonH);
            ctx.fillRect(this.radius * 0.15, this.radius * 0.41, canonW, canonH);

            // 중심 청백색 아크 리액터 코어
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.32, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type.shape === "brute_monster") {
            // [탱커 브루트] 1칸 통로를 꽉 막는 거대한 근육질 체형
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // 주먹 2개
            ctx.fillStyle = "#7f1d1d";
            const fistR = this.radius * 0.28;
            ctx.beginPath();
            ctx.arc(this.radius * 0.75, -this.radius * 0.65, fistR, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.75, this.radius * 0.65, fistR, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type.shape === "bloater") {
            // [자폭체] 붉게 두근거리는 박동(Pulsing) 배
            const pulse = 1.0 + Math.sin(this.pulsePhase) * 0.18;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
            ctx.fill();

            // 코어 옐로우 섬광
            ctx.fillStyle = "rgba(254, 240, 138, 0.7)";
            ctx.beginPath();
            ctx.arc(0, 0, (this.radius * 0.5) * pulse, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.faction === "blue") {
            // [Blue 인간 군인 계열] 헬멧 + 돌격 소총 총구
            // 총기 배럴
            ctx.fillStyle = "#0f172a";
            const barrelLen = this.type.barrelLength || 14;
            const barrelW = this.type.barrelWidth || 3.5;
            ctx.fillRect(2, -barrelW / 2, barrelLen, barrelW);

            // 화염방사기 연료통 (등 뒤 노란 원통)
            if (this.type.hasFuelTank) {
                ctx.fillStyle = "#facc15";
                ctx.fillRect(-this.radius * 1.1, -this.radius * 0.6, 6, this.radius * 1.2);
            }

            // 본체 (방탄 조끼 & 어깨)
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // 헬멧 바이저 하이라이트
            ctx.fillStyle = "#0284c7";
            ctx.beginPath();
            ctx.arc(this.radius * 0.35, 0, this.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // [Red 좀비 / 감염체 계열] 앞으로 뻗은 날카로운 양팔
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // 앞으로 뻗은 양손
            ctx.fillStyle = "#991b1b";
            ctx.fillRect(this.radius * 0.7, -5, 6, 3);
            ctx.fillRect(this.radius * 0.7, 2, 6, 3);

            // 빛나는 눈동자 2개
            ctx.fillStyle = this.type.eyeColor || "#fef08a";
            ctx.fillRect(this.radius * 0.3, -3, 2, 2);
            ctx.fillRect(this.radius * 0.3, 1, 2, 2);
        }

        // 체력바 (데미지 입었을 때만 상단에 표시)
        if (this.hp < this.maxHp && !lodSimplified) {
            const barW = this.radius * 2.2;
            const barH = 3;
            const hpRatio = Math.max(0, this.hp / this.maxHp);
            ctx.rotate(-this.angle); // 체력바는 수평 유지
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(-barW / 2, -this.radius - 8, barW, barH);
            ctx.fillStyle = this.faction === "blue" ? "#38bdf8" : "#ef4444";
            ctx.fillRect(-barW / 2, -this.radius - 8, barW * hpRatio, barH);
        }

        ctx.restore();
    }
}

export class UnitManager {
    constructor() {
        this.units = [];
        this.blueCount = 0;
        this.redCount = 0;
        this.blueKills = 0;
        this.redKills = 0;
    }

    spawn(typeId, x, y, faction) {
        const unit = new Unit(typeId, x, y, faction);
        this.units.push(unit);
        if (unit.faction === "blue") this.blueCount++;
        else this.redCount++;
        return unit;
    }

    /**
     * 마우스 드래그 브러시 스폰 (수백 마리 대량 배치)
     */
    spawnBrush(typeId, centerX, centerY, radius = 50, count = 10, faction) {
        for (let i = 0; i < count; i++) {
            const r = Math.sqrt(Math.random()) * radius;
            const theta = Math.random() * Math.PI * 2;
            const x = centerX + r * Math.cos(theta);
            const y = centerY + r * Math.sin(theta);
            this.spawn(typeId, x, y, faction);
        }
    }

    /**
     * 광역 스플래시 피해 (폭탄, 로켓, 지뢰, 공중폭격)
     */
    applySplashDamage(centerX, centerY, radius, damage, knockbackForce = 7.0) {
        const r2 = radius * radius;
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i];
            if (!u.isAlive) continue;
            const dx = u.x - centerX;
            const dy = u.y - centerY;
            const distSq = dx * dx + dy * dy;
            if (distSq <= r2) {
                const dist = Math.sqrt(distSq);
                const falloff = 1 - (dist / radius); // 중심에 가까울수록 최대 피해
                const actualDmg = damage * falloff;
                const kx = dist > 0.001 ? (dx / dist) * knockbackForce : 0;
                const ky = dist > 0.001 ? (dy / dist) * knockbackForce : 0;
                u.takeDamage(actualDmg, knockbackForce * falloff, kx, ky);
            }
        }
    }

    update(dt, spatialGrid, projectilePool, particlePool, stampBuffer, mapManager, infectionMode, flowFieldManager) {
        let bCount = 0;
        let rCount = 0;

        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i];
            if (u.isAlive) {
                u.update(dt, spatialGrid, projectilePool, particlePool, stampBuffer, mapManager, infectionMode, this, flowFieldManager);
                if (u.faction === "blue") bCount++;
                else rCount++;
            } else {
                // 사망 처리
                if (u.faction === "blue") {
                    this.redKills++;
                    // 🧟 좀비 감염 모드 (Infection Mode): 사망한 인간이 좀비로 즉시 부활!
                    if (infectionMode) {
                        particlePool.spawn(u.x, u.y, 0, 0, 20, "#16a34a", 0.05, "shockwave");
                        this.spawn("runner", u.x, u.y, "red");
                    }
                } else {
                    this.blueKills++;
                }

                // 지면에 핏자국 영구 도장
                stampBuffer.stampBlood(u.x, u.y, u.radius * 1.6, u.bloodColor);
            }
        }

        // 죽은 유닛 제거 (GC 방지를 위해 인플레이스 필터링)
        let writeIdx = 0;
        for (let i = 0; i < this.units.length; i++) {
            if (this.units[i].isAlive) {
                this.units[writeIdx++] = this.units[i];
            }
        }
        this.units.length = writeIdx;

        this.blueCount = bCount;
        this.redCount = rCount;
    }

    render(ctx) {
        // LOD 최적화: 3,000마리 이상일 경우 장식 요소를 생략하여 60fps 유지
        const lodSimplified = this.units.length > 3000;
        for (let i = 0; i < this.units.length; i++) {
            this.units[i].render(ctx, lodSimplified);
        }
    }

    clear() {
        this.units = [];
        this.blueCount = 0;
        this.redCount = 0;
        this.blueKills = 0;
        this.redKills = 0;
    }
}
