/**
 * camera.js - 2D 시네마틱 카메라 (줌, 패닝, 스크린 셰이크, 16:9 ↔ 9:16 화면비 전환)
 * 
 * 유튜브 일반 영상(16:9) 및 유튜브 쇼츠(9:16) 규격에 맞춰 뷰포트를 실시간으로 전환할 수 있습니다.
 */

import { CONFIG } from './config.js';

export class Camera {
    constructor(canvas, viewportContainer) {
        this.canvas = canvas;
        this.viewportContainer = viewportContainer;

        this.x = CONFIG.WORLD.WIDTH / 2;
        this.y = CONFIG.WORLD.HEIGHT / 2;
        this.zoom = 1.0;
        this.minZoom = 0.35;
        this.maxZoom = 2.5;

        // 드래그 패닝 상태
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.camStartX = 0;
        this.camStartY = 0;

        // 스크린 셰이크 (화면 흔들림) 트라우마 시스템
        this.trauma = 0;
        this.shakeX = 0;
        // 화면 섬광 및 열핵 지속 조명 시스템
        this.flashAlpha = 0;
        this.flashColor = "#ffffff";
        this.flashDecay = 1.0;
        this.flashMode = 'simple'; // 'simple' | 'nuclear'
        this.nuclearFlashTimer = 0;
        this.nuclearFlashDuration = 5.5;
        this.nuclearFlashElapsed = 0;

        // 지진 럼블 (초기 폭발 충격 후 빠르게 안정화되도록 1.8초로 단축)
        this.rumbleTimer = 0;
        this.rumbleDuration = 1.8;
        this.rumbleIntensity = 0;

        // 현재 화면비 모드 ('16:9', '9:16', 'free')
        this.aspectMode = '16:9';
    }

    triggerFlash(color = "#ffffff", intensity = 1.0, decayRate = 0.48) {
        this.flashMode = 'simple';
        this.flashColor = color;
        this.flashAlpha = intensity;
        this.flashDecay = decayRate;
    }

    /**
     * 초장기 지속 열핵 섬광 시스템 (총 5.5초 지속)
     * - 0.0s~1.3s: 순백의 초고온 백열 섬광 (Blinding Whiteout)
     * - 1.3s~3.3s: 눈부신 태양광/황금빛 백열 노출광 (Incandescent Solar Bloom)
     * - 3.3s~5.5s: 따뜻한 잔여 열핵 후광 및 대기 노을광 (Thermal Radiance Decay)
     */
    triggerNuclearFlash(duration = 5.5) {
        this.flashMode = 'nuclear';
        this.nuclearFlashDuration = duration;
        this.nuclearFlashTimer = duration;
        this.nuclearFlashElapsed = 0;
        this.flashAlpha = 1.0;
        this.flashColor = "#ffffff";
    }

    triggerRumble(intensity = 0.85, duration = 1.8) {
        this.rumbleIntensity = intensity;
        this.rumbleDuration = duration;
        this.rumbleTimer = duration;
        this.addTrauma(intensity);
    }

    addTrauma(amount) {
        this.trauma = Math.min(1.0, this.trauma + amount * CONFIG.VISUALS.DEFAULT_SCREEN_SHAKE);
    }

    setAspectMode(mode) {
        this.aspectMode = mode;
        if (this.viewportContainer) {
            this.viewportContainer.setAttribute("data-ratio", mode);
        }
        this.updateCanvasResolution();
    }

    toggleAspectMode() {
        if (this.aspectMode === '16:9') {
            this.setAspectMode('9:16');
        } else {
            this.setAspectMode('16:9');
        }
    }

    updateCanvasResolution() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = screenX - rect.left;
        const mouseY = screenY - rect.top;

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        const worldX = (mouseX - cx) / this.zoom + this.x;
        const worldY = (mouseY - cy) / this.zoom + this.y;

        return { x: worldX, y: worldY };
    }

    update(dt) {
        // 1. 열핵 지속 섬광 시스템 (3단계 색온도 변화 및 장기 지속)
        if (this.flashMode === 'nuclear' && this.nuclearFlashTimer > 0) {
            this.nuclearFlashTimer = Math.max(0, this.nuclearFlashTimer - dt);
            this.nuclearFlashElapsed += dt;
            const elapsed = this.nuclearFlashElapsed;
            const total = this.nuclearFlashDuration;

            if (elapsed < 1.3) {
                // [1단계: 0.0s ~ 1.3s] 순백의 초고온 백열 섬광 (Blinding Pure White Flash)
                // 0.8초까지 1.0 유지, 이후 1.3초까지 0.88로 부드럽게 전환
                this.flashColor = "#ffffff";
                const p = elapsed / 1.3;
                this.flashAlpha = 1.0 - (p > 0.6 ? ((p - 0.6) / 0.4) * 0.12 : 0);
            } else if (elapsed < 3.3) {
                // [2단계: 1.3s ~ 3.3s] 눈부신 고온 백열 노출광 (Incandescent Golden Solar Bloom)
                // 백색에서 따뜻한 태양광/황금빛으로 전환되며 유닛과 전장이 눈부시게 드러남
                const p = (elapsed - 1.3) / 2.0; // 0.0 ~ 1.0
                this.flashAlpha = 0.88 - p * 0.50; // 0.88 -> 0.38
                if (p < 0.45) {
                    this.flashColor = "rgb(255, 252, 235)"; // 초고온 백열 연노랑
                } else {
                    this.flashColor = "rgb(254, 240, 138)"; // 강렬한 황금 태양광
                }
            } else if (elapsed < total) {
                // [3단계: 3.3s ~ 5.5s] 잔여 열핵 후광 및 대기 노을광 (Thermal Radiance Decay)
                const p = (elapsed - 3.3) / (total - 3.3); // 0.0 ~ 1.0
                this.flashAlpha = 0.38 * (1.0 - p); // 0.38 -> 0.0
                this.flashColor = "rgb(253, 186, 116)"; // 따뜻한 열핵 앰버빛
            } else {
                this.flashAlpha = 0;
                this.flashMode = 'simple';
            }
        } else if (this.flashAlpha > 0) {
            this.flashAlpha = Math.max(0, this.flashAlpha - dt * this.flashDecay);
        }

        // 2. 지진 럼블 효과 (1.8초 동안만 강렬하게 충격을 주고 빠르게 안정화)
        if (this.rumbleTimer > 0) {
            this.rumbleTimer -= dt;
            const rumbleRatio = Math.max(0, this.rumbleTimer / this.rumbleDuration);
            this.addTrauma(this.rumbleIntensity * rumbleRatio * 0.25);
        }

        // 3. 묵직한 스크린 셰이크 (초기 충격 후 빠르게 감쇠하여 화면이 쓸데없이 오래 흔들리지 않음)
        if (this.trauma > 0) {
            const shakeMagnitude = this.trauma * this.trauma * 60; // 60px 진폭
            const now = performance.now();
            const lowFreqWaveX = Math.cos(now * 0.02) * shakeMagnitude * 0.6;
            const lowFreqWaveY = Math.sin(now * 0.025) * shakeMagnitude * 0.7;
            const highFreqJitterX = (Math.random() * 2 - 1) * shakeMagnitude * 0.35;
            const highFreqJitterY = (Math.random() * 2 - 1) * shakeMagnitude * 0.35;

            this.shakeX = lowFreqWaveX + highFreqJitterX;
            this.shakeY = lowFreqWaveY + highFreqJitterY;

            // 흔들림이 질질 끌리지 않도록 감쇠율 상향 (1.8s 내에 완전히 정돈됨)
            const decayRate = this.rumbleTimer > 0 ? 0.9 : 2.5;
            this.trauma = Math.max(0, this.trauma - dt * decayRate);
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    }

    apply(ctx) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.save();
        ctx.translate(cx + this.shakeX, cy + this.shakeY);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }

    restore(ctx) {
        ctx.restore();
    }

    zoomAt(screenX, screenY, zoomDelta) {
        const worldBefore = this.screenToWorld(screenX, screenY);
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * (zoomDelta > 0 ? 1.15 : 0.87)));
        this.zoom = newZoom;
        const worldAfter = this.screenToWorld(screenX, screenY);

        this.x += worldBefore.x - worldAfter.x;
        this.y += worldBefore.y - worldAfter.y;
    }

    reset() {
        this.x = CONFIG.WORLD.WIDTH / 2;
        this.y = CONFIG.WORLD.HEIGHT / 2;
        this.zoom = 0.9;
        this.trauma = 0;
    }
}
