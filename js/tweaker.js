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
     * 신의 권능 1: 전술 핵미사일 (Tactical Nuke)
     */
    triggerNuke(x, y) {
        soundFX.playExplosion(2.5);
        this.camera.addTrauma(0.9);

        // 거대한 분화구 및 쇼크웨이브
        this.particlePool.spawnExplosion(x, y, 220, this.stampBuffer);

        // 350px 반경 모든 유닛 소멸급 피해
        this.unitManager.applySplashDamage(x, y, 320, 1500, 16.0);
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
