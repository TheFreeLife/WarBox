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
        this.shakeY = 0;

        // 현재 화면비 모드 ('16:9', '9:16', 'free')
        this.aspectMode = '16:9';
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
        // 스크린 셰이크 감쇠
        if (this.trauma > 0) {
            const shakeMagnitude = this.trauma * this.trauma * 25;
            this.shakeX = (Math.random() * 2 - 1) * shakeMagnitude;
            this.shakeY = (Math.random() * 2 - 1) * shakeMagnitude;
            this.trauma = Math.max(0, this.trauma - dt * 2.0);
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
