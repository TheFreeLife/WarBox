/**
 * mapEditor.js - 인게임 실시간 맵 에디터 (Class MapEditor)
 * 
 * 마우스 드래그로 벽, 바리케이드, 지뢰, 스폰 포탈을 직접 배치하고 지우며
 * 내가 만든 맵을 JSON 파일로 내보내거나 불러올 수 있습니다.
 */

export class MapEditor {
    constructor(mapManager, camera) {
        this.mapManager = mapManager;
        this.camera = camera;
        this.active = false;
        this.currentTool = "wall"; // "wall", "barricade", "mine", "spawner", "eraser"

        // 드래그 배치 상태
        this.isDrawing = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentWorldX = 0;
        this.currentWorldY = 0;
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    toggleActive(forceState) {
        this.active = forceState !== undefined ? forceState : !this.active;
        return this.active;
    }

    handleMouseDown(worldX, worldY) {
        if (!this.active) return false;

        this.isDrawing = true;
        this.dragStartX = worldX;
        this.dragStartY = worldY;
        this.currentWorldX = worldX;
        this.currentWorldY = worldY;

        if (this.currentTool === "mine") {
            this.mapManager.addObstacle("mine", worldX - 10, worldY - 10, 20, 20);
            this.isDrawing = false;
            return true;
        } else if (this.currentTool === "spawner") {
            this.mapManager.addObstacle("spawner", worldX - 30, worldY - 30, 60, 60, {
                spawnType: "runner",
                spawnFaction: "red",
                spawnInterval: 2.5
            });
            this.isDrawing = false;
            return true;
        } else if (this.currentTool === "eraser") {
            this.mapManager.removeAt(worldX, worldY, 25);
            return true;
        }

        return true;
    }

    handleMouseMove(worldX, worldY) {
        if (!this.active) return false;
        this.currentWorldX = worldX;
        this.currentWorldY = worldY;

        if (this.isDrawing && this.currentTool === "eraser") {
            this.mapManager.removeAt(worldX, worldY, 25);
            return true;
        }
        return false;
    }

    handleMouseUp(worldX, worldY) {
        if (!this.active || !this.isDrawing) return false;
        this.isDrawing = false;

        if (this.currentTool === "wall" || this.currentTool === "barricade") {
            const x = Math.min(this.dragStartX, worldX);
            const y = Math.min(this.dragStartY, worldY);
            const w = Math.max(20, Math.abs(worldX - this.dragStartX));
            const h = Math.max(20, Math.abs(worldY - this.dragStartY));

            this.mapManager.addObstacle(this.currentTool, x, y, w, h);
            return true;
        }

        return false;
    }

    /**
     * 드래그 중인 오브젝트 미리보기 렌더링
     */
    renderPreview(ctx) {
        if (!this.active || !this.isDrawing) return;

        ctx.save();
        if (this.currentTool === "wall" || this.currentTool === "barricade") {
            const x = Math.min(this.dragStartX, this.currentWorldX);
            const y = Math.min(this.dragStartY, this.currentWorldY);
            const w = Math.max(20, Math.abs(this.currentWorldX - this.dragStartX));
            const h = Math.max(20, Math.abs(this.currentWorldY - this.dragStartY));

            ctx.fillStyle = this.currentTool === "wall" ? "rgba(51, 65, 85, 0.5)" : "rgba(168, 162, 158, 0.4)";
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x, y, w, h);
        } else if (this.currentTool === "eraser") {
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.currentWorldX, this.currentWorldY, 25, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    exportMapToFile() {
        const jsonStr = this.mapManager.exportJSON();
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `custom_map_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
