/**
 * obstacles.js - 무한 타일맵 시스템 (Infinite Tilemap System & MapManager)
 * 
 * 동서남북 무한히 확장되는 전장을 48px 바둑판 격자로 관리하는 희소 타일맵(Sparse Tilemap) 매니저입니다.
 * 음수/양수 좌표(-Infinity ~ +Infinity)를 완벽 지원하며, 유닛 충돌은 언제나 O(1) 주변 3x3 타일만 검사합니다.
 */

import { soundFX } from './audio.js';

export const TILE_TYPES = {
    EMPTY: 0,
    WALL: 1,
    BARRICADE: 2,
    MINE: 3,
    SPAWNER: 4
};

export class MapManager {
    constructor(worldWidth = 2400, worldHeight = 1600, tileSize = 48) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.tileSize = tileSize;

        // 희소 타일맵: 배치된 타일만 정수 키(32-bit Hash)로 저장 (무한 맵 메모리 최적화)
        this.tiles = new Map();

        // 특수 타일 메타데이터 맵 (스폰 타이머, 지뢰 데미지 등)
        this.spawners = new Map();
        this.mines = new Map();

        // 맵 변경 시 유동장에 알리는 콜백
        this.onChange = null;
    }

    /**
     * (cx, cy) 좌표를 유일한 32비트 정수 키로 변환 (-32768 ~ +32767 셀 = 약 400만 px 지원)
     */
    getKey(cx, cy) {
        return ((cx + 32768) & 0xFFFF) | (((cy + 32768) & 0xFFFF) << 16);
    }

    notifyChange() {
        if (this.onChange) {
            this.onChange(this);
        }
    }

    worldToTile(x, y) {
        const cx = Math.floor(x / this.tileSize);
        const cy = Math.floor(y / this.tileSize);
        return { cx, cy, key: this.getKey(cx, cy) };
    }

    getTile(cx, cy) {
        const key = this.getKey(cx, cy);
        return this.tiles.get(key) || TILE_TYPES.EMPTY;
    }

    setTile(cx, cy, type, options = {}) {
        const key = this.getKey(cx, cy);

        if (type === TILE_TYPES.EMPTY) {
            this.tiles.delete(key);
            this.spawners.delete(key);
            this.mines.delete(key);
        } else {
            this.tiles.set(key, type);

            if (type === TILE_TYPES.SPAWNER) {
                this.spawners.set(key, {
                    cx, cy,
                    timer: 0,
                    interval: options.spawnInterval || 2.5,
                    count: options.spawnCount || 4,
                    type: options.spawnType || "runner",
                    faction: options.spawnFaction || "red"
                });
            } else {
                this.spawners.delete(key);
            }

            if (type === TILE_TYPES.MINE) {
                this.mines.set(key, {
                    cx, cy,
                    damage: options.mineDamage || 250,
                    radius: options.explosionRadius || 70
                });
            } else {
                this.mines.delete(key);
            }
        }

        this.notifyChange();
    }

    setTileRect(minCx, minCy, maxCx, maxCy, type, options = {}) {
        const x0 = Math.min(minCx, maxCx);
        const x1 = Math.max(minCx, maxCx);
        const y0 = Math.min(minCy, maxCy);
        const y1 = Math.max(minCy, maxCy);

        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                const key = this.getKey(cx, cy);
                if (type === TILE_TYPES.EMPTY) {
                    this.tiles.delete(key);
                    this.spawners.delete(key);
                    this.mines.delete(key);
                } else {
                    this.tiles.set(key, type);

                    if (type === TILE_TYPES.SPAWNER) {
                        this.spawners.set(key, {
                            cx, cy,
                            timer: 0,
                            interval: options.spawnInterval || 2.5,
                            count: options.spawnCount || 4,
                            type: options.spawnType || "runner",
                            faction: options.spawnFaction || "red"
                        });
                    } else {
                        this.spawners.delete(key);
                    }

                    if (type === TILE_TYPES.MINE) {
                        this.mines.set(key, {
                            cx, cy,
                            damage: options.mineDamage || 250,
                            radius: options.explosionRadius || 70
                        });
                    } else {
                        this.mines.delete(key);
                    }
                }
            }
        }
        this.notifyChange();
    }

    clear() {
        this.tiles.clear();
        this.spawners.clear();
        this.mines.clear();
        this.notifyChange();
    }

    /**
     * 타일맵 주기적 갱신 (스폰 포탈 타이머)
     */
    update(dt, unitManager, particlePool, stampBuffer) {
        const ts = this.tileSize;

        for (const [key, spawner] of this.spawners.entries()) {
            spawner.timer += dt;
            if (spawner.timer >= spawner.interval) {
                spawner.timer = 0;
                const sx = spawner.cx * ts + ts * 0.5;
                const sy = spawner.cy * ts + ts * 0.5;

                for (let i = 0; i < spawner.count; i++) {
                    const rx = sx + (Math.random() - 0.5) * (ts * 0.8);
                    const ry = sy + (Math.random() - 0.5) * (ts * 0.8);
                    if (unitManager) {
                        unitManager.spawn(spawner.type, rx, ry, spawner.faction);
                    }
                }

                if (particlePool) {
                    particlePool.spawn(sx, sy, 0, 0, 24, "#a855f7", 0.05, "shockwave");
                }
            }
        }
    }

    /**
     * O(1) 초고속 타일 기반 유닛 충돌 판정 및 물리 슬라이딩
     * 전 세계가 무한하더라도 유닛 위치 주변 3x3 타일만 검사하므로 연산량은 항상 O(1)입니다.
     */
    resolveCollisions(unit, unitManager, particlePool, stampBuffer) {
        const ts = this.tileSize;
        const uTileX = Math.floor(unit.x / ts);
        const uTileY = Math.floor(unit.y / ts);

        for (let cy = uTileY - 1; cy <= uTileY + 1; cy++) {
            for (let cx = uTileX - 1; cx <= uTileX + 1; cx++) {
                const key = this.getKey(cx, cy);
                const tile = this.tiles.get(key);
                if (!tile || tile === TILE_TYPES.EMPTY) continue;

                const tileLeft = cx * ts;
                const tileTop = cy * ts;
                const tileRight = tileLeft + ts;
                const tileBottom = tileTop + ts;

                if (tile === TILE_TYPES.WALL) {
                    // Circle vs Tile AABB Collision
                    const closestX = Math.max(tileLeft, Math.min(unit.x, tileRight));
                    const closestY = Math.max(tileTop, Math.min(unit.y, tileBottom));

                    const dx = unit.x - closestX;
                    const dy = unit.y - closestY;
                    const distSq = dx * dx + dy * dy;
                    const r = unit.radius;

                    if (distSq < r * r) {
                        const dist = Math.sqrt(distSq);
                        if (dist > 0.001) {
                            const overlap = r - dist;
                            unit.x += (dx / dist) * overlap;
                            unit.y += (dy / dist) * overlap;
                        } else {
                            unit.x += 1;
                        }
                    }
                } else if (tile === TILE_TYPES.BARRICADE) {
                    // 바리케이드 타일 진입 시 속도 70% 감속
                    if (unit.x >= tileLeft && unit.x <= tileRight &&
                        unit.y >= tileTop && unit.y <= tileBottom) {
                        unit.speedMultiplier = 0.3;
                    }
                } else if (tile === TILE_TYPES.MINE) {
                    // 지뢰 센서 (중심부 22px 이내 진입 시 폭발)
                    const mcx = tileLeft + ts * 0.5;
                    const mcy = tileTop + ts * 0.5;
                    const dx = unit.x - mcx;
                    const dy = unit.y - mcy;
                    if (dx * dx + dy * dy < 22 * 22) {
                        this.detonateMine(cx, cy, unitManager, particlePool, stampBuffer);
                    }
                }
            }
        }
    }

    /**
     * 지뢰 폭발 처리
     */
    detonateMine(cx, cy, unitManager, particlePool, stampBuffer) {
        const key = this.getKey(cx, cy);
        const mineData = this.mines.get(key) || { damage: 250, radius: 70 };
        this.tiles.delete(key);
        this.mines.delete(key);

        const worldX = cx * this.tileSize + this.tileSize * 0.5;
        const worldY = cy * this.tileSize + this.tileSize * 0.5;

        soundFX.playExplosion(1.5);
        if (particlePool) {
            particlePool.spawnExplosion(worldX, worldY, mineData.radius, stampBuffer);
        }
        if (unitManager) {
            unitManager.applySplashDamage(worldX, worldY, mineData.radius, mineData.damage, 9.0);
        }
        this.notifyChange();
    }

    /**
     * 무한 타일맵 렌더링 (카메라 뷰포트 컬링 적용)
     */
    render(ctx, camera = null) {
        const ts = this.tileSize;
        ctx.save();

        if (camera) {
            // 카메라 화면 안에 보이는 타일만 선별 렌더링 (초고속 컬링)
            const halfW = (camera.canvas.width / 2) / camera.zoom;
            const halfH = (camera.canvas.height / 2) / camera.zoom;
            const minCx = Math.floor((camera.x - halfW) / ts) - 1;
            const maxCx = Math.ceil((camera.x + halfW) / ts) + 1;
            const minCy = Math.floor((camera.y - halfH) / ts) - 1;
            const maxCy = Math.ceil((camera.y + halfH) / ts) + 1;

            for (let cy = minCy; cy <= maxCy; cy++) {
                for (let cx = minCx; cx <= maxCx; cx++) {
                    const key = this.getKey(cx, cy);
                    const tile = this.tiles.get(key);
                    if (!tile || tile === TILE_TYPES.EMPTY) continue;
                    this.renderSingleTile(ctx, cx, cy, tile, ts);
                }
            }
        } else {
            // 카메라가 없을 경우 등록된 모든 타일 렌더링
            for (const [key, tile] of this.tiles.entries()) {
                const cx = (key & 0xFFFF) - 32768;
                const cy = ((key >>> 16) & 0xFFFF) - 32768;
                this.renderSingleTile(ctx, cx, cy, tile, ts);
            }
        }

        ctx.restore();
    }

    renderSingleTile(ctx, cx, cy, tile, ts) {
        const px = cx * ts;
        const py = cy * ts;

        if (tile === TILE_TYPES.WALL) {
            // 1. 콘크리트 벽 타일 (바닥 그림자 + 슬레이트 바디 + 베벨 테두리)
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(px + 4, py + 4, ts, ts);

            ctx.fillStyle = "#334155";
            ctx.fillRect(px, py, ts, ts);

            ctx.fillStyle = "#475569";
            ctx.fillRect(px + 2, py + 2, ts - 4, 3); // 상단 하이라이트

            ctx.strokeStyle = "#64748b";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        } else if (tile === TILE_TYPES.BARRICADE) {
            // 2. 바리케이드 / 철조망 타일
            ctx.fillStyle = "rgba(120, 113, 108, 0.25)";
            ctx.fillRect(px, py, ts, ts);

            ctx.strokeStyle = "#a8a29e";
            ctx.lineWidth = 1.8;
            ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);

            // X자 교차살
            ctx.beginPath();
            ctx.moveTo(px + 3, py + 3); ctx.lineTo(px + ts - 3, py + ts - 3);
            ctx.moveTo(px + ts - 3, py + 3); ctx.lineTo(px + 3, py + ts - 3);
            ctx.stroke();

            // 철조망 매듭
            ctx.fillStyle = "#78716c";
            ctx.fillRect(px + ts * 0.5 - 3, py + ts * 0.5 - 3, 6, 6);
        } else if (tile === TILE_TYPES.MINE) {
            // 3. 지뢰 타일
            const mcx = px + ts * 0.5;
            const mcy = py + ts * 0.5;

            ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
            ctx.beginPath();
            ctx.arc(mcx, mcy, 14, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#475569";
            ctx.beginPath();
            ctx.arc(mcx, mcy, 9, 0, Math.PI * 2);
            ctx.fill();

            // 깜빡이는 붉은 LED 센서
            const blink = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + blink * 0.6})`;
            ctx.beginPath();
            ctx.arc(mcx, mcy, 3.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (tile === TILE_TYPES.SPAWNER) {
            // 4. 스폰 포탈 타일
            const scx = px + ts * 0.5;
            const scy = py + ts * 0.5;

            ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
            ctx.beginPath();
            ctx.arc(scx, scy, ts * 0.45, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#c084fc";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(scx, scy, ts * 0.4, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🌀", scx, scy);
        }
    }

    /**
     * 타일맵 JSON 내보내기 (Export)
     */
    exportJSON() {
        const paintedTiles = [];
        for (const [key, tile] of this.tiles.entries()) {
            if (tile !== TILE_TYPES.EMPTY) {
                const cx = (key & 0xFFFF) - 32768;
                const cy = ((key >>> 16) & 0xFFFF) - 32768;
                const item = { cx, cy, type: tile };
                if (tile === TILE_TYPES.SPAWNER && this.spawners.has(key)) {
                    item.options = this.spawners.get(key);
                }
                paintedTiles.push(item);
            }
        }
        return JSON.stringify({
            infinite: true,
            tileSize: this.tileSize,
            tiles: paintedTiles
        }, null, 2);
    }

    /**
     * 타일맵 JSON 불러오기 (Import)
     */
    importJSON(jsonString) {
        try {
            const data = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
            this.clear();
            if (data.tiles && Array.isArray(data.tiles)) {
                for (const t of data.tiles) {
                    this.setTile(t.cx, t.cy, t.type, t.options || {});
                }
            }
            return true;
        } catch (e) {
            console.error("Failed to import tilemap JSON:", e);
            return false;
        }
    }

    /**
     * 기본 프리셋 맵 로드 (타일 좌표계 기반)
     */
    loadPreset(presetName) {
        this.clear();
        if (presetName === "choke_outpost") {
            // 중앙 요새 및 양쪽 협곡 초크포인트 (48px 타일 기준)
            this.setTileRect(12, 6, 13, 14, TILE_TYPES.WALL);
            this.setTileRect(12, 17, 13, 25, TILE_TYPES.WALL);
            this.setTileRect(12, 15, 13, 16, TILE_TYPES.BARRICADE);

            this.setTileRect(27, 6, 28, 14, TILE_TYPES.WALL);
            this.setTileRect(27, 17, 28, 25, TILE_TYPES.WALL);
            this.setTileRect(27, 15, 28, 16, TILE_TYPES.BARRICADE);

            this.setTile(10, 15, TILE_TYPES.MINE);
            this.setTile(10, 16, TILE_TYPES.MINE);
            this.setTile(29, 15, TILE_TYPES.MINE);
            this.setTile(29, 16, TILE_TYPES.MINE);
        } else if (presetName === "crossroad_bunker") {
            // 중앙 십자로 벙커
            this.setTileRect(17, 9, 21, 9, TILE_TYPES.WALL);
            this.setTileRect(24, 9, 28, 9, TILE_TYPES.WALL);
            this.setTileRect(22, 9, 23, 9, TILE_TYPES.BARRICADE);

            this.setTileRect(17, 17, 21, 17, TILE_TYPES.WALL);
            this.setTileRect(24, 17, 28, 17, TILE_TYPES.WALL);
            this.setTileRect(22, 17, 23, 17, TILE_TYPES.BARRICADE);
        } else if (presetName === "arena_open") {
            // 개방형 결투장: 4방면 기둥 엄폐물
            this.setTileRect(14, 8, 15, 9, TILE_TYPES.WALL);
            this.setTileRect(34, 8, 35, 9, TILE_TYPES.WALL);
            this.setTileRect(14, 24, 15, 25, TILE_TYPES.WALL);
            this.setTileRect(34, 24, 35, 25, TILE_TYPES.WALL);
        }
    }
}
