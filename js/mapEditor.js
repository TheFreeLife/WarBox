/**
 * mapEditor.js - 타일맵 기반 실시간 맵 에디터 (Class MapEditor)
 * 
 * 48px 바둑판 격자에 완벽히 스냅(Grid Snap)되어 타일 단위로 벽, 바리케이드,
 * 지뢰, 좀비 포탈을 마우스 드래그로 일괄 배치하거나 지울 수 있는 전용 에디터입니다.
 */

import { TILE_TYPES } from './obstacles.js';

export class MapEditor {
    constructor(mapManager, camera) {
        this.mapManager = mapManager;
        this.camera = camera;
        this.active = false;
        this.currentTool = "wall"; // "wall", "barricade", "mine", "spawner", "eraser"

        // 타일 드래그 배치 상태
        this.isDrawing = false;
        this.startCx = 0;
        this.startCy = 0;
        this.currentCx = 0;
        this.currentCy = 0;

        // 호버 타일 좌표
        this.hoverCx = -1;
        this.hoverCy = -1;
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    toggleActive(forceState) {
        this.active = forceState !== undefined ? forceState : !this.active;
        if (!this.active) {
            this.isDrawing = false;
            this.hoverCx = -1;
            this.hoverCy = -1;
        }
        return this.active;
    }

    handleMouseDown(worldX, worldY) {
        if (!this.active) return false;

        const { cx, cy } = this.mapManager.worldToTile(worldX, worldY);
        this.isDrawing = true;
        this.startCx = cx;
        this.startCy = cy;
        this.currentCx = cx;
        this.currentCy = cy;
        this.hoverCx = cx;
        this.hoverCy = cy;

        // 단일 타일 즉시 배치/삭제 도구
        if (this.currentTool === "mine") {
            this.mapManager.setTile(cx, cy, TILE_TYPES.MINE);
            this.isDrawing = false;
            return true;
        } else if (this.currentTool === "spawner") {
            this.mapManager.setTile(cx, cy, TILE_TYPES.SPAWNER, {
                spawnType: "runner",
                spawnFaction: "red",
                spawnInterval: 2.5,
                spawnCount: 4
            });
            this.isDrawing = false;
            return true;
        } else if (this.currentTool === "eraser") {
            this.mapManager.setTile(cx, cy, TILE_TYPES.EMPTY);
            return true;
        }

        return true;
    }

    handleMouseMove(worldX, worldY) {
        if (!this.active) return false;

        const { cx, cy } = this.mapManager.worldToTile(worldX, worldY);
        this.hoverCx = cx;
        this.hoverCy = cy;

        if (this.isDrawing) {
            this.currentCx = cx;
            this.currentCy = cy;

            // 지우개 도구인 경우 드래그 경로 실시간 지우기
            if (this.currentTool === "eraser") {
                this.mapManager.setTile(cx, cy, TILE_TYPES.EMPTY);
                return true;
            }
        }
        return false;
    }

    handleMouseUp(worldX, worldY) {
        if (!this.active || !this.isDrawing) return false;
        this.isDrawing = false;

        const { cx, cy } = this.mapManager.worldToTile(worldX, worldY);
        const minCx = Math.min(this.startCx, cx);
        const maxCx = Math.max(this.startCx, cx);
        const minCy = Math.min(this.startCy, cy);
        const maxCy = Math.max(this.startCy, cy);

        if (this.currentTool === "wall") {
            this.mapManager.setTileRect(minCx, minCy, maxCx, maxCy, TILE_TYPES.WALL);
            return true;
        } else if (this.currentTool === "barricade") {
            this.mapManager.setTileRect(minCx, minCy, maxCx, maxCy, TILE_TYPES.BARRICADE);
            return true;
        } else if (this.currentTool === "eraser") {
            this.mapManager.setTileRect(minCx, minCy, maxCx, maxCy, TILE_TYPES.EMPTY);
            return true;
        }

        return false;
    }

    /**
     * 에디터 격자망 가이드 및 타일 드래그 미리보기 렌더링
     */
    renderPreview(ctx) {
        if (!this.active) return;

        const ts = this.mapManager.tileSize;
        ctx.save();

        // 1. 드래그 중인 사각형 타일 영역 미리보기 (engine.js의 48px 격자와 1:1 완벽 정렬)
        if (this.isDrawing && (this.currentTool === "wall" || this.currentTool === "barricade" || this.currentTool === "eraser")) {
            const minCx = Math.min(this.startCx, this.currentCx);
            const maxCx = Math.max(this.startCx, this.currentCx);
            const minCy = Math.min(this.startCy, this.currentCy);
            const maxCy = Math.max(this.startCy, this.currentCy);

            const px = minCx * ts;
            const py = minCy * ts;
            const pw = (maxCx - minCx + 1) * ts;
            const ph = (maxCy - minCy + 1) * ts;

            let fillColor = "rgba(51, 65, 85, 0.5)";
            let strokeColor = "#38bdf8";

            if (this.currentTool === "barricade") {
                fillColor = "rgba(217, 119, 6, 0.35)";
                strokeColor = "#f59e0b";
            } else if (this.currentTool === "eraser") {
                fillColor = "rgba(239, 68, 68, 0.3)";
                strokeColor = "#ef4444";
            }

            ctx.fillStyle = fillColor;
            ctx.fillRect(px, py, pw, ph);

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(px, py, pw, ph);

            // 칸 수 정보 배지 표시
            const tileCountW = maxCx - minCx + 1;
            const tileCountH = maxCy - minCy + 1;
            const badgeText = `${tileCountW} × ${tileCountH} (${tileCountW * tileCountH}칸)`;

            ctx.setLineDash([]);
            ctx.font = "bold 12px sans-serif";
            const textMetrics = ctx.measureText(badgeText);
            const badgeW = textMetrics.width + 12;
            const badgeH = 20;
            const badgeX = px + pw * 0.5 - badgeW * 0.5;
            const badgeY = py - 26 < 0 ? py + ph + 6 : py - 26;

            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(badgeText, badgeX + badgeW * 0.5, badgeY + badgeH * 0.5);
        } else if (this.hoverCx !== -1 && this.hoverCy !== -1) {
            // 3. 마우스 호버 커서 타일 1칸 가이드
            const px = this.hoverCx * ts;
            const py = this.hoverCy * ts;

            let hoverColor = "rgba(56, 189, 248, 0.3)";
            let strokeColor = "#38bdf8";

            if (this.currentTool === "barricade") {
                hoverColor = "rgba(245, 158, 11, 0.3)";
                strokeColor = "#f59e0b";
            } else if (this.currentTool === "mine") {
                hoverColor = "rgba(239, 68, 68, 0.35)";
                strokeColor = "#ef4444";
            } else if (this.currentTool === "spawner") {
                hoverColor = "rgba(168, 85, 247, 0.35)";
                strokeColor = "#c084fc";
            } else if (this.currentTool === "eraser") {
                hoverColor = "rgba(239, 68, 68, 0.25)";
                strokeColor = "#ef4444";
            }

            ctx.fillStyle = hoverColor;
            ctx.fillRect(px, py, ts, ts);

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(px, py, ts, ts);
        }

        ctx.restore();
    }

    /**
     * 타일맵을 JSON 파일로 내보내기
     */
    exportMapToFile() {
        const jsonStr = this.mapManager.exportJSON();
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tilemap_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * 외부 JSON 파일을 읽어 타일맵 불러오기
     */
    importMapFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const success = this.mapManager.importJSON(content);
            if (success) {
                console.log("Tilemap loaded successfully.");
            }
        };
        reader.readAsText(file);
    }
}
