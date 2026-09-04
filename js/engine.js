/**
 * engine.js - 메인 시뮬레이션 루프 및 성능 프로파일러 (Class BattleEngine)
 * 
 * 60 FPS 사수 및 Zero-GC를 유지하며 모든 하위 시스템(물리, AI, 렌더링, 시나리오)을 총괄합니다.
 */

import { CONFIG } from './config.js';
import { SpatialHashGrid } from './spatialGrid.js';
import { UnitManager } from './units.js';
import { ProjectilePool } from './projectiles.js';
import { ParticlePool, BackgroundStampBuffer } from './particles.js';
import { MapManager } from './obstacles.js';
import { Camera } from './camera.js';
import { ScenarioDirector } from './scenarioDirector.js';
import { SimulatorTweaker } from './tweaker.js';
import { MapEditor } from './mapEditor.js';
import { FlowFieldManager } from './flowField.js';

export class BattleEngine {
    constructor(canvas, viewportContainer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false }); // GPU/CPU 최적화

        // 서브시스템 인스턴스화 (OOP SRP 원칙 준수)
        this.camera = new Camera(canvas, viewportContainer);
        this.spatialGrid = new SpatialHashGrid(CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT, CONFIG.PHYSICS.GRID_CELL_SIZE);
        this.stampBuffer = new BackgroundStampBuffer(CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
        this.particlePool = new ParticlePool(CONFIG.POOLS.MAX_PARTICLES);
        this.projectilePool = new ProjectilePool(CONFIG.POOLS.MAX_PROJECTILES);
        this.mapManager = new MapManager(CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
        this.flowFieldManager = new FlowFieldManager(
            CONFIG.WORLD.WIDTH,
            CONFIG.WORLD.HEIGHT,
            CONFIG.PHYSICS.FLOW_CELL_SIZE || 48
        );
        // 맵 장애물 변경 시 유동장 비용 필드 자동 재구축 연동
        this.mapManager.onChange = (mapMgr) => {
            this.flowFieldManager.rebuildCostField(mapMgr);
        };
        this.flowFieldManager.rebuildCostField(this.mapManager);

        this.unitManager = new UnitManager();

        this.scenarioDirector = new ScenarioDirector(
            this.unitManager,
            this.mapManager,
            this.camera,
            this.particlePool,
            this.stampBuffer
        );

        this.tweaker = new SimulatorTweaker(
            this.unitManager,
            this.particlePool,
            this.stampBuffer,
            this.camera
        );

        this.mapEditor = new MapEditor(this.mapManager, this.camera);

        // 시뮬레이션 상태
        this.isRunning = true;
        this.isPaused = false;
        this.timeScale = CONFIG.PHYSICS.DEFAULT_TIME_SCALE;
        this.lastTimestamp = 0;

        // 실시간 성능 프로파일러 (FPS & Frame Time ms)
        this.fps = 60;
        this.frameTimeMs = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;

        // 클린 녹화 모드 (모든 UI 숨김)
        this.cleanRecordingMode = false;
    }

    start() {
        this.camera.updateCanvasResolution();
        this.lastTimestamp = performance.now();
        requestAnimationFrame((ts) => this.loop(ts));
    }

    loop(timestamp) {
        const frameStart = performance.now();
        let dt = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;

        // OBS 프레임 드랍 시 델타 타임 클램핑 (순간이동/벽뚫 방지)
        if (dt > CONFIG.PHYSICS.MAX_DELTA) {
            dt = CONFIG.PHYSICS.MAX_DELTA;
        }

        // FPS 측정
        this.frameCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 0.5) {
            this.fps = Math.round((this.frameCount / this.fpsTimer));
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        // 1. 시뮬레이션 업데이트 (일시정지가 아닐 때)
        if (!this.isPaused) {
            const scaledDt = dt * this.timeScale;
            this.update(scaledDt);
        }

        // 2. 캔버스 렌더링
        this.render();

        // 프레임 처리 시간 측정
        this.frameTimeMs = Math.round((performance.now() - frameStart) * 10) / 10;

        requestAnimationFrame((ts) => this.loop(ts));
    }

    update(dt) {
        // 카메라 업데이트
        this.camera.update(dt);

        // 맵 장애물 업데이트 (스폰 포탈)
        this.mapManager.update(dt, this.unitManager, this.particlePool, this.stampBuffer);

        // 유동장 업데이트 (진영별 다중 목적지 BFS 갱신 - 카메라 및 유닛 중심 추적)
        this.flowFieldManager.update(dt, this.unitManager.units, this.camera);

        // 공간 분할 그리드 클리어 및 유닛 재등록 (O(N) 초고속 무한 해시)
        this.spatialGrid.clear();
        for (let i = 0; i < this.unitManager.units.length; i++) {
            this.spatialGrid.insert(this.unitManager.units[i]);
        }

        // 유닛 AI 및 물리 업데이트 (유동장 하이브리드 조향 적용)
        this.unitManager.update(
            dt,
            this.spatialGrid,
            this.projectilePool,
            this.particlePool,
            this.stampBuffer,
            this.mapManager,
            this.tweaker.infectionMode,
            this.flowFieldManager
        );

        // 투사체 충돌 및 비행 업데이트
        this.projectilePool.update(
            dt,
            this.spatialGrid,
            this.particlePool,
            this.stampBuffer,
            (unit, proj, isSplash) => {
                if (isSplash) {
                    // 로켓 스플래시 데미지
                    this.unitManager.applySplashDamage(
                        proj.x,
                        proj.y,
                        proj.explosionRadius,
                        proj.damage,
                        proj.knockback * this.tweaker.knockbackScale
                    );
                    this.camera.addTrauma(proj.explosionRadius / 150);
                }
            }
        );

        // 파티클 풀 업데이트
        this.particlePool.update(dt, this.stampBuffer);

        // 신의 권능(낙하 핵폭탄 등) 업데이트
        this.tweaker.update(dt);

        // 시나리오 디렉터 타임라인 업데이트
        this.scenarioDirector.update(dt);
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. 메인 캔버스 기본 배경 지우기
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, w, h);

        // 2. 카메라 변환 적용 (줌, 패닝, 스크린 셰이크)
        this.camera.apply(ctx);

        // 2.5. 무한 전장 모눈종이 기본 그리드 렌더링
        this.renderInfiniteGrid(ctx);

        // 3. 배경 오프스크린 스탬프 버퍼 렌더링 (영구 핏자국, 분화구, 탄피 청크)
        this.stampBuffer.render(ctx, this.camera);

        // 4. 무한 맵 장애물 렌더링 (뷰포트 컬링)
        this.mapManager.render(ctx, this.camera);

        // 4.5. 유동장 디버그 오버레이 렌더링
        if (this.flowFieldManager.debugRender) {
            this.flowFieldManager.renderDebug(ctx);
        }

        // 5. 맵 에디터 미리보기 렌더링
        this.mapEditor.renderPreview(ctx);

        // 6. 투사체 렌더링 (총알, 로켓, 레이저)
        this.projectilePool.render(ctx);

        // 7. 유닛 렌더링 (2.5D 그림자 및 백색 피격 섬광)
        this.unitManager.render(ctx);

        // 8. 파티클 풀 렌더링 (총구 화염, 피 튀김, 충격파)
        this.particlePool.render(ctx);

        // 8.5. 신의 권능 렌더링 (낙하 중인 실물 핵폭탄 및 지면 타겟 조준선)
        this.tweaker.render(ctx);

        // 9. 야간 손전등(Flashlight) 모드 연출
        if (this.tweaker.atmosphere === "night") {
            this.renderNightVision(ctx);
        }

        // 카메라 변환 복원
        this.camera.restore(ctx);

        // 10. 상단 시네마틱 자막 배너 (스크린 좌표)
        this.scenarioDirector.renderBanner(ctx, w);

        // 11. 화면 전체 섬광 및 열핵 조명 효과 (지속적인 백열 과노출 Bloom 연출)
        if (this.camera.flashAlpha > 0.01) {
            ctx.save();
            ctx.fillStyle = this.camera.flashColor || "#ffffff";
            ctx.globalAlpha = Math.min(1.0, this.camera.flashAlpha);
            ctx.fillRect(0, 0, w, h);

            // 핵폭발 고온 백열 구간(0.6s ~ 3.8s)에는 가산 혼합(lighter)으로 눈부신 빛 번짐(Overexposure Bloom) 추가
            if (this.camera.flashMode === 'nuclear' && this.camera.nuclearFlashElapsed > 0.6 && this.camera.nuclearFlashElapsed < 3.8) {
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = Math.min(0.45, this.camera.flashAlpha * 0.55);
                ctx.fillStyle = "#fef08a";
                ctx.fillRect(0, 0, w, h);
            }
            ctx.restore();
        }
    }

    renderInfiniteGrid(ctx) {
        const cam = this.camera;
        const halfW = (cam.canvas.width / 2) / cam.zoom;
        const halfH = (cam.canvas.height / 2) / cam.zoom;
        const step = this.mapManager ? this.mapManager.tileSize : 48;

        const minX = Math.floor((cam.x - halfW) / step) * step;
        const maxX = Math.ceil((cam.x + halfW) / step) * step;
        const minY = Math.floor((cam.y - halfH) / step) * step;
        const maxY = Math.ceil((cam.y + halfH) / step) * step;

        ctx.save();
        // 맵 에디터 활성화 시 격자선 밝기 및 시인성 강조
        if (this.mapEditor && this.mapEditor.active) {
            ctx.strokeStyle = "rgba(56, 189, 248, 0.18)";
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = CONFIG.COLORS.GRID_LINES || "rgba(255, 255, 255, 0.05)";
            ctx.lineWidth = 1;
        }
        ctx.beginPath();

        for (let x = minX; x <= maxX; x += step) {
            ctx.moveTo(x, minY);
            ctx.lineTo(x, maxY);
        }
        for (let y = minY; y <= maxY; y += step) {
            ctx.moveTo(minX, y);
            ctx.lineTo(maxX, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    renderNightVision(ctx) {
        // 전장을 어둡게 덮고 인간 유닛들 주변에만 손전등 빛을 비추는 호러 아포칼립스 연출 (무한 뷰포트 대응)
        ctx.save();
        const cam = this.camera;
        const halfW = (cam.canvas.width / 2) / cam.zoom;
        const halfH = (cam.canvas.height / 2) / cam.zoom;

        ctx.fillStyle = "rgba(5, 10, 20, 0.88)";
        ctx.fillRect(cam.x - halfW - 50, cam.y - halfH - 50, halfW * 2 + 100, halfH * 2 + 100);

        // Blue 군인들 주변 시야 밝히기 (손전등 효과)
        ctx.globalCompositeOperation = "destination-out";
        const units = this.unitManager.units;
        const maxFlashlights = Math.min(units.length, 250);
        for (let i = 0; i < maxFlashlights; i++) {
            const u = units[i];
            if (u.faction === "blue") {
                const grad = ctx.createRadialGradient(u.x, u.y, 15, u.x, u.y, 150);
                grad.addColorStop(0, "rgba(0, 0, 0, 0.95)");
                grad.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(u.x, u.y, 150, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    toggleSlowMo() {
        if (this.timeScale === CONFIG.PHYSICS.SLOW_MO_SCALE) {
            this.timeScale = CONFIG.PHYSICS.DEFAULT_TIME_SCALE;
        } else {
            this.timeScale = CONFIG.PHYSICS.SLOW_MO_SCALE;
        }
        return this.timeScale;
    }

    toggleFastForward() {
        if (this.timeScale === CONFIG.PHYSICS.FAST_SCALE) {
            this.timeScale = CONFIG.PHYSICS.DEFAULT_TIME_SCALE;
        } else {
            this.timeScale = CONFIG.PHYSICS.FAST_SCALE;
        }
        return this.timeScale;
    }

    toggleCleanRecording() {
        this.cleanRecordingMode = !this.cleanRecordingMode;
        document.body.classList.toggle("clean-recording-mode", this.cleanRecordingMode);
        return this.cleanRecordingMode;
    }

    clearAll() {
        this.unitManager.clear();
        this.projectilePool.clear();
        this.stampBuffer.clear();
        this.particlePool.currentIndex = 0;
        this.mapManager.clear();
        this.flowFieldManager.rebuildCostField(this.mapManager);
        this.flowFieldManager.redField.reset();
        this.flowFieldManager.blueField.reset();
        this.scenarioDirector.clear();
        this.tweaker.clear();
    }
}
