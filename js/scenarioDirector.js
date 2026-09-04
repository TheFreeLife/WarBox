/**
 * scenarioDirector.js - 시나리오 타임라인 및 이벤트 디렉터 (Class ScenarioDirector)
 * 
 * 시나리오 스크립트(SCENARIOS)에 맞춰 시간별 웨이브 스폰, 공중폭격, 시네마틱 자막 배너를 연출합니다.
 */

import { SCENARIOS } from './scenarioData.js';
import { CONFIG } from './config.js';
import { soundFX } from './audio.js';

export class ScenarioDirector {
    constructor(unitManager, mapManager, camera, particlePool, stampBuffer) {
        this.unitManager = unitManager;
        this.mapManager = mapManager;
        this.camera = camera;
        this.particlePool = particlePool;
        this.stampBuffer = stampBuffer;

        this.currentScenario = null;
        this.elapsedTime = 0;
        this.isPlaying = false;
        this.firedEvents = new Set();

        // 시네마틱 자막 배너
        this.activeBanner = null;
        this.bannerTimer = 0;
    }

    loadScenario(scenarioId) {
        const sc = SCENARIOS[scenarioId];
        if (!sc) return;

        this.currentScenario = sc;
        this.elapsedTime = 0;
        this.isPlaying = true;
        this.firedEvents.clear();
        this.activeBanner = null;

        // 1. 유닛 및 맵 초기화
        this.unitManager.clear();
        this.particlePool.currentIndex = 0;
        this.stampBuffer.clear();

        // 2. 맵 프리셋 로드
        if (sc.mapPreset) {
            this.mapManager.loadPreset(sc.mapPreset);
        }

        // 3. 초기 유닛 스폰
        if (sc.initialSpawns) {
            for (const sp of sc.initialSpawns) {
                if (sp.radius) {
                    this.unitManager.spawnBrush(sp.type, sp.x, sp.y, sp.radius, sp.count, sp.faction);
                } else {
                    for (let i = 0; i < sp.count; i++) {
                        this.unitManager.spawn(sp.type, sp.x + (Math.random() - 0.5) * 20, sp.y + (Math.random() - 0.5) * 20, sp.faction);
                    }
                }
            }
        }
    }

    triggerBanner(text, color = "#38bdf8", duration = 3.5) {
        this.activeBanner = { text, color, duration, maxDuration: duration };
        this.bannerTimer = duration;
        soundFX.playSiren();
    }

    update(dt) {
        if (!this.currentScenario || !this.isPlaying) return;

        this.elapsedTime += dt;

        // 배너 타이머 감소
        if (this.bannerTimer > 0) {
            this.bannerTimer -= dt;
            if (this.bannerTimer <= 0) {
                this.activeBanner = null;
            }
        }

        // 시나리오 타임라인 이벤트 검사
        const events = this.currentScenario.events || [];
        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            if (this.firedEvents.has(i)) continue;

            if (this.elapsedTime >= ev.time) {
                this.firedEvents.add(i);
                this.executeEvent(ev);
            }
        }
    }

    executeEvent(ev) {
        if (ev.type === "banner") {
            this.triggerBanner(ev.text, ev.color, ev.duration || 3);
        } else if (ev.type === "spawnWave") {
            this.spawnWave(ev.faction, ev.unit, ev.count, ev.area);
        } else if (ev.type === "spawnExact") {
            for (let i = 0; i < ev.count; i++) {
                this.unitManager.spawn(ev.unit, ev.x + (Math.random() - 0.5) * 40, ev.y + (Math.random() - 0.5) * 40, ev.faction);
            }
        } else if (ev.type === "airstrike") {
            this.triggerAirstrike(ev.area, ev.count || 12);
        } else if (ev.type === "screenShake") {
            this.camera.addTrauma(ev.intensity / 10);
        }
    }

    spawnWave(faction, unitType, count, area) {
        const w = CONFIG.WORLD.WIDTH;
        const h = CONFIG.WORLD.HEIGHT;

        for (let i = 0; i < count; i++) {
            let x = 0, y = 0;
            if (area === "west") {
                x = 40 + Math.random() * 80;
                y = Math.random() * h;
            } else if (area === "east") {
                x = w - 40 - Math.random() * 80;
                y = Math.random() * h;
            } else if (area === "north") {
                x = Math.random() * w;
                y = 40 + Math.random() * 80;
            } else if (area === "south") {
                x = Math.random() * w;
                y = h - 40 - Math.random() * 80;
            } else if (area === "surround") {
                // 사방 무작위 외곽
                const edge = Math.floor(Math.random() * 4);
                if (edge === 0) { x = Math.random() * w; y = 50; }
                else if (edge === 1) { x = Math.random() * w; y = h - 50; }
                else if (edge === 2) { x = 50; y = Math.random() * h; }
                else { x = w - 50; y = Math.random() * h; }
            }

            this.unitManager.spawn(unitType, x, y, faction);
        }
    }

    triggerAirstrike(area, count = 12) {
        let startX = 600;
        let startY = 300;
        if (area === "west") { startX = 400; startY = 400; }

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const ex = startX + (Math.random() - 0.5) * 400 + i * 20;
                const ey = startY + (Math.random() - 0.5) * 400;
                soundFX.playExplosion(1.5);
                this.particlePool.spawnExplosion(ex, ey, 80, this.stampBuffer);
                this.unitManager.applySplashDamage(ex, ey, 80, 250, 9.0);
                this.camera.addTrauma(0.25);
            }, i * 150);
        }
    }

    /**
     * 화면 상단 유튜브용 시네마틱 배너 렌더링
     */
    renderBanner(ctx, canvasWidth) {
        if (!this.activeBanner) return;

        ctx.save();
        const progress = Math.min(1.0, (this.activeBanner.maxDuration - this.bannerTimer) * 4); // 페이드 인
        const alpha = Math.min(1.0, this.bannerTimer * 2);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.fillRect(canvasWidth / 2 - 380, 25, 760, 52);

        ctx.strokeStyle = this.activeBanner.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(canvasWidth / 2 - 380, 25, 760, 52);

        ctx.fillStyle = this.activeBanner.color;
        ctx.font = "bold 20px 'Pretendard', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(this.activeBanner.text, canvasWidth / 2, 58);

        ctx.restore();
    }

    getNextEventInfo() {
        if (!this.currentScenario) return "시나리오 미선택";
        const events = this.currentScenario.events || [];
        for (let i = 0; i < events.length; i++) {
            if (!this.firedEvents.has(i) && events[i].text) {
                const timeLeft = Math.max(0, Math.ceil(events[i].time - this.elapsedTime));
                return `Next: [${timeLeft}s] ${events[i].text}`;
            }
        }
        return "모든 이벤트 종료";
    }
}
