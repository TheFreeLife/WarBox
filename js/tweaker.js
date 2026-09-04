/**
 * tweaker.js - 시뮬레이터 실시간 변수 조절기 & 신의 권능 (Class SimulatorTweaker)
 * 
 * 감염 모드, 아군 오사, 넉백 배율, 핵폭탄/블랙홀 신 모드 등을 제어합니다.
 */

import { soundFX } from './audio.js';

export class SimulatorTweaker {
    constructor(unitManager, particlePool, stampBuffer, camera) {
        this.unitManager = unitManager;
        this.particlePool = particlePool;
        this.stampBuffer = stampBuffer;
        this.camera = camera;

        // 시뮬레이터 변수
        this.infectionMode = true;  // 좀비 감염 모드 (인간 사망 시 좀비 부활)
        this.friendlyFire = false;  // 아군 오사
        this.knockbackScale = 1.0;  // 넉백 배율 (0.0 ~ 5.0)
        this.atmosphere = "day";    // 'day', 'night', 'neon'

        // 신의 권능 활성화 상태
        this.godPower = null; // "nuke", "blackhole", "airstrike"

        // 공중 낙하 중인 핵폭탄 목록
        this.fallingNukes = [];

        // 폭심지 지속 열핵 발광 돔 목록 (World Space Thermal Light Domes)
        this.activeNukeLights = [];
    }

    clear() {
        this.fallingNukes = [];
        this.activeNukeLights = [];
    }

    setInfectionMode(enabled) {
        this.infectionMode = enabled;
    }

    setKnockbackScale(scale) {
        this.knockbackScale = scale;
    }

    setAtmosphere(mode) {
        this.atmosphere = mode;
    }

    /**
     * 신의 권능 1: 전술 핵폭탄 공중 투하 (Falling Nuke Sequence)
     * - 지면 클릭 시 높은 상공에서 실물 핵폭탄이 가속 낙하 시작
     * - 낙하 중 사이렌 + 하강 휘파람 소리 + 지면 타겟 조준선 및 다가오는 그림자
     * - 바닥에 닿는 순간: 침묵의 백색 섬광(Silent Flash)
     * - 0.15초 후: 쿠구구궁 폭음 + 하늘로 치솟는 거대한 불기둥 + 충격파 및 버섯구름 연기
     */
    triggerNuke(x, y) {
        // 1. 공습 사이렌 경보 + 공기를 가르는 낙하 휘파람 소리
        soundFX.playSiren();
        soundFX.playFallingWhistle(1.65);

        // 2. 상공에서 투하되는 실물 핵폭탄 객체 생성 (왼쪽 위 상공에서 진입)
        const startX = x - 200;
        const startY = y - 750;
        const dx = x - startX;
        const dy = y - startY;

        this.fallingNukes.push({
            targetX: x,
            targetY: y,
            startX: startX,
            startY: startY,
            currentX: startX,
            currentY: startY,
            angle: Math.atan2(dy, dx),
            progress: 0,
            duration: 1.65, // 1.65초 동안 낙하
            hasImpacted: false
        });
    }

    /**
     * 핵폭탄 바닥 착탄 폭발 (장기 지속형 시네마틱 핵폭발 시퀀스: 총 7~8초 진행)
     * - 0초: 5.5초간 이어지는 초광역 열핵 섬광 및 폭심지 발광체 가동
     * - 0.2초: 1.8초간 강렬한 충격파 럼블 & 폭음 + 1차 초음속 압력파 (화면 흔들림은 길게 끌지 않고 빠르게 정돈)
     * - 0.5초~1.5초: 지면에서 상공으로 치솟는 4연속 거대 불기둥
     * - 1.2초: 2차 초열 폭풍 압력파 팽창 (반경 540px 넉백)
     * - 1.5초~7.5초: 5.5초간 타오르는 중심부 열핵 광원 속에서 팽창하는 웅장한 버섯구름 연기
     */
    detonateNuke(x, y) {
        // [1단계: 0초] 바닥 착탄 순간 - 5.5초간 길게 지속되는 다단계 열핵 섬광 가동
        this.camera.triggerNuclearFlash(5.5);

        // 폭심지 거대 열핵 발광 돔 (World Space Thermal Light Dome - 5.5초 동안 전장을 비춤)
        this.activeNukeLights.push({
            x: x,
            y: y,
            timer: 5.5,
            duration: 5.5,
            maxRadius: 850
        });

        // [2단계: 0.2초 뒤] 폭음 시작 & 1.8초간 묵직한 충격파 럼블 & 1차 충격파
        setTimeout(() => {
            // 1. 서브베이스 지진 폭음 & 1.8초 럼블 (불필요하게 오래 흔들리지 않고 강렬하게 울린 뒤 안정화)
            soundFX.playNukeSound();
            this.camera.triggerRumble(0.85, 1.8);

            // 2. 폭심지 소멸급 즉사 피해 (반경 360px)
            this.unitManager.applySplashDamage(x, y, 360, 3000, 26.0);

            // 3. 초대형 다중 충격파 + 거대 화구 코어 + 크레이터 분화구 발동
            this.particlePool.spawnNukeDetonation(x, y, 420, this.stampBuffer);

            // [3단계: 0.5초 ~ 1.5초] 끊임없이 솟구쳐 오르는 거대한 불기둥 (4회 연속 분출)
            for (let wave = 1; wave <= 4; wave++) {
                setTimeout(() => {
                    this.particlePool.spawnFirePillar(x, y, 60, 160 + wave * 15);
                }, wave * 250);
            }

            // [4단계: 1.2초 뒤] 2차 초열 폭풍 압력파 팽창 및 대량 넉백
            setTimeout(() => {
                this.unitManager.applySplashDamage(x, y, 540, 850, 22.0);
                this.particlePool.spawn(x, y, 0, 0, 520, "#f97316", 0.015, "nuke_shockwave");
            }, 1000);

            // [5단계: 1.5초 ~ 7.0초] 5.5초간 타오르는 열핵 빛을 뚫고 부풀어 오르는 버섯구름 연기 기둥 (36회 연속 생성)
            let smokeWaveCount = 0;
            const smokeInterval = setInterval(() => {
                smokeWaveCount++;

                // 중심부에서 상공으로 치솟으며 최대 250px까지 부풀어 오르는 짙은 연기들
                const spreadRadius = 45 + smokeWaveCount * 4.5;
                this.particlePool.spawnNukeSmokeWave(x, y, 16, spreadRadius);

                // 화면 흔들림은 추가하지 않아 시야가 안정적으로 유지됨

                if (smokeWaveCount >= 36) {
                    clearInterval(smokeInterval);
                }
            }, 140);
        }, 200);
    }

    update(dt) {
        // 활성 열핵 발광 돔 타이머 갱신 (5.5초 지속 광원)
        for (let i = this.activeNukeLights.length - 1; i >= 0; i--) {
            this.activeNukeLights[i].timer -= dt;
            if (this.activeNukeLights[i].timer <= 0) {
                this.activeNukeLights.splice(i, 1);
            }
        }

        // 낙하 중인 핵폭탄 위치 갱신 및 꼬리 연기 트레일
        for (let i = this.fallingNukes.length - 1; i >= 0; i--) {
            const nuke = this.fallingNukes[i];
            nuke.progress += dt / nuke.duration;

            // 중력 가속 이징 (묵직하게 가속 낙하)
            const ease = Math.pow(Math.min(1.0, nuke.progress), 2.1);
            nuke.currentX = nuke.startX + (nuke.targetX - nuke.startX) * ease;
            nuke.currentY = nuke.startY + (nuke.targetY - nuke.startY) * ease;

            // 꼬리 연기 궤적 (두껍고 묵직한 Vapor Trail)
            if (Math.random() < 0.9) {
                const trailColor = nuke.progress > 0.65 ? "#ea580c" : "rgba(226, 232, 240, 0.7)";
                const trailSize = nuke.progress > 0.65 ? 6.0 : 4.5;
                this.particlePool.spawn(
                    nuke.currentX - Math.cos(nuke.angle) * 24,
                    nuke.currentY - Math.sin(nuke.angle) * 24,
                    (Math.random() - 0.5) * 2.0,
                    (Math.random() - 0.5) * 2.0,
                    trailSize,
                    trailColor,
                    0.045,
                    "smoke"
                );
            }

            // 바닥 착탄 검사
            if (nuke.progress >= 1.0 && !nuke.hasImpacted) {
                nuke.hasImpacted = true;
                this.detonateNuke(nuke.targetX, nuke.targetY);
                this.fallingNukes.splice(i, 1);
            }
        }
    }

    render(ctx) {
        // 1. 폭심지 거대 열핵 발광 돔 렌더링 (World Space Thermal Light Domes - 5.5초 지속 광원)
        for (let i = 0; i < this.activeNukeLights.length; i++) {
            const light = this.activeNukeLights[i];
            const p = Math.max(0, light.timer / light.duration); // 1.0 -> 0.0
            const elapsed = light.duration - light.timer;

            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            const currentRadius = Math.min(light.maxRadius, 280 + elapsed * 95);
            const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, currentRadius);

            if (elapsed < 1.4) {
                // [초기 백열 화구] 순백-연노랑 초고온 플라즈마 구체
                grad.addColorStop(0, `rgba(255, 255, 255, ${0.98 * p})`);
                grad.addColorStop(0.2, `rgba(254, 249, 195, ${0.92 * p})`);
                grad.addColorStop(0.5, `rgba(250, 204, 21, ${0.70 * p})`);
                grad.addColorStop(0.8, `rgba(249, 115, 22, ${0.40 * p})`);
                grad.addColorStop(1.0, "rgba(239, 68, 68, 0)");
            } else {
                // [중후반부 지속 화구] 버섯구름을 뚫고 타오르는 거대한 태양광 구체
                grad.addColorStop(0, `rgba(255, 254, 240, ${0.90 * p})`);
                grad.addColorStop(0.3, `rgba(253, 224, 71, ${0.75 * p})`);
                grad.addColorStop(0.65, `rgba(249, 115, 22, ${0.50 * p})`);
                grad.addColorStop(0.9, `rgba(185, 28, 28, ${0.20 * p})`);
                grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(light.x, light.y, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 2. 낙하 중인 핵폭탄 및 지면 타겟팅 조준선 렌더링
        for (let i = 0; i < this.fallingNukes.length; i++) {
            const nuke = this.fallingNukes[i];

            // 1. 묵직한 지면 타겟 조준선 (Target Reticle)
            ctx.save();
            ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
            ctx.lineWidth = 2.2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(nuke.targetX, nuke.targetY, 46, 0, Math.PI * 2);
            ctx.stroke();

            // 십자 조준선
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(nuke.targetX - 22, nuke.targetY); ctx.lineTo(nuke.targetX + 22, nuke.targetY);
            ctx.moveTo(nuke.targetX, nuke.targetY - 22); ctx.lineTo(nuke.targetX, nuke.targetY + 22);
            ctx.stroke();

            // 2. 다가오는 거대한 지면 그림자 (Heavy Drop Shadow)
            const shadowAlpha = 0.25 + nuke.progress * 0.72;
            const shadowRadius = Math.max(16, 52 - nuke.progress * 24);
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(nuke.targetX, nuke.targetY, shadowRadius * 1.5, shadowRadius * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. 상공에서 떨어지는 실물 초대형 전술 핵폭탄 본체 (70px x 24px 스케일)
            ctx.save();
            ctx.translate(nuke.currentX, nuke.currentY);
            ctx.rotate(nuke.angle);

            // 꼬리 날개 (Heavy Fins)
            ctx.fillStyle = "#0f172a";
            ctx.beginPath();
            ctx.moveTo(-32, -18); ctx.lineTo(-14, -10); ctx.lineTo(-32, 0); ctx.lineTo(-14, 10); ctx.lineTo(-32, 18);
            ctx.lineTo(-20, 0);
            ctx.closePath();
            ctx.fill();

            // 육중한 탄체 본체 (Body - 다크 슬레이트 군용 합금)
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.roundRect(-24, -11, 46, 22, [0, 11, 11, 0]);
            ctx.fill();

            // 탄체 명암 하이라이트 라인
            ctx.fillStyle = "#475569";
            ctx.fillRect(-22, -10, 42, 3);

            // 노란색/검은색 방사능 위험 경고 줄무늬 (Radiation Hazard Stripes)
            ctx.fillStyle = "#eab308";
            ctx.fillRect(-4, -11, 10, 22);
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, -11, 4, 22);

            // 묵직하고 둥근 붉은 탄두 노즈콘 (Nose Cone)
            ctx.fillStyle = "#dc2626";
            ctx.beginPath();
            ctx.arc(22, 0, 11, -Math.PI / 2, Math.PI / 2);
            ctx.fill();

            // 추진 노즐 오렌지빛 발광
            ctx.fillStyle = "#ea580c";
            ctx.beginPath();
            ctx.arc(-24, 0, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * 신의 권능 2: 블랙홀 (Black Hole - 4초간 주변 유닛을 중심으로 빨아들임)
     */
    triggerBlackHole(x, y) {
        const duration = 4.0;
        let elapsed = 0;

        soundFX.playSiren();

        const interval = setInterval(() => {
            elapsed += 0.05;
            this.camera.addTrauma(0.08);

            // 보라색 소용돌이 파티클
            for (let i = 0; i < 6; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 150 + Math.random() * 180;
                const px = x + Math.cos(angle) * dist;
                const py = y + Math.sin(angle) * dist;
                const vx = -Math.cos(angle + 0.4) * 6;
                const vy = -Math.sin(angle + 0.4) * 6;
                this.particlePool.spawn(px, py, vx, vy, 3.5, "#a855f7", 0.08, "spark");
            }

            // 주변 유닛 빨아들이기 물리
            for (let i = 0; i < this.unitManager.units.length; i++) {
                const u = this.unitManager.units[i];
                if (!u.isAlive) continue;
                const dx = x - u.x;
                const dy = y - u.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 350 * 350 && distSq > 100) {
                    const dist = Math.sqrt(distSq);
                    const pull = (350 - dist) / 350 * 5.0;
                    u.vx += (dx / dist) * pull;
                    u.vy += (dy / dist) * pull;
                    u.takeDamage(1.5, 0); // 중심부 마찰 데미지
                }
            }

            if (elapsed >= duration) {
                clearInterval(interval);
                // 최종 폭발
                this.triggerNuke(x, y);
            }
        }, 50);
    }
}
