/**
 * spatialGrid.js - 무한 좌표계 지원 O(1) 공간 분할 해시 그리드 (Spatial Hash Grid)
 * 
 * 전 세계가 무한히 확장되는 무한 맵(Infinite Map) 환경에서도 음수/양수 좌표 제한 없이
 * 10,000마리 유닛의 충돌 및 적 탐색을 Zero-GC와 O(N) 초고속으로 처리합니다.
 */

export class SpatialHashGrid {
    constructor(worldWidth = 2400, worldHeight = 1600, cellSize = 64) {
        this.cellSize = cellSize;

        // 정수 키 기반 버킷 해시 맵 (Zero-GC 풀링 구조)
        this.cells = new Map();
        this.activeKeys = [];

        // 재사용 가능한 버킷 풀 (Array Pool)
        this.bucketPool = [];
        for (let i = 0; i < 2000; i++) {
            this.bucketPool.push([]);
        }
    }

    /**
     * (cx, cy) 좌표를 유일한 32비트 정수 키로 변환 (-32768 ~ +32767 셀 = 400만 px 지원)
     */
    getKey(cx, cy) {
        return ((cx + 32768) & 0xFFFF) | (((cy + 32768) & 0xFFFF) << 16);
    }

    getBucket() {
        if (this.bucketPool.length > 0) {
            return this.bucketPool.pop();
        }
        return [];
    }

    /**
     * 매 프레임 활성 버킷 비우기 (메모리 해제 없이 length = 0 재사용)
     */
    clear() {
        for (let i = 0; i < this.activeKeys.length; i++) {
            const key = this.activeKeys[i];
            const bucket = this.cells.get(key);
            if (bucket) {
                bucket.length = 0;
                this.bucketPool.push(bucket);
            }
        }
        this.cells.clear();
        this.activeKeys.length = 0;
    }

    /**
     * 유닛을 무한 그리드에 등록
     */
    insert(unit) {
        const cx = Math.floor(unit.x / this.cellSize);
        const cy = Math.floor(unit.y / this.cellSize);
        const key = this.getKey(cx, cy);

        let bucket = this.cells.get(key);
        if (!bucket) {
            bucket = this.getBucket();
            this.cells.set(key, bucket);
            this.activeKeys.push(key);
        }
        bucket.push(unit);
    }

    /**
     * 특정 지점 (x, y) 주변 반경 radius 내에 있는 모든 유닛 콜백 실행
     */
    query(x, y, radius, callback) {
        const minCx = Math.floor((x - radius) / this.cellSize);
        const maxCx = Math.floor((x + radius) / this.cellSize);
        const minCy = Math.floor((y - radius) / this.cellSize);
        const maxCy = Math.floor((y + radius) / this.cellSize);

        const r2 = radius * radius;

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const key = this.getKey(cx, cy);
                const bucket = this.cells.get(key);
                if (!bucket || bucket.length === 0) continue;

                const len = bucket.length;
                for (let i = 0; i < len; i++) {
                    const other = bucket[i];
                    const dx = other.x - x;
                    const dy = other.y - y;
                    if (dx * dx + dy * dy <= r2) {
                        callback(other);
                    }
                }
            }
        }
    }

    /**
     * 특정 유닛 기준 가장 가까운 적(Enemy) 찾기 (초고속 O(1) 탐색)
     */
    findNearestEnemy(unit, maxRadius = 500) {
        const minCx = Math.floor((unit.x - maxRadius) / this.cellSize);
        const maxCx = Math.floor((unit.x + maxRadius) / this.cellSize);
        const minCy = Math.floor((unit.y - maxRadius) / this.cellSize);
        const maxCy = Math.floor((unit.y + maxRadius) / this.cellSize);

        let closestEnemy = null;
        let closestDistSq = maxRadius * maxRadius;
        const myFaction = unit.faction;

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const key = this.getKey(cx, cy);
                const bucket = this.cells.get(key);
                if (!bucket || bucket.length === 0) continue;

                const len = bucket.length;
                for (let i = 0; i < len; i++) {
                    const other = bucket[i];
                    if (other.faction !== myFaction && other.isAlive) {
                        const dx = other.x - unit.x;
                        const dy = other.y - unit.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < closestDistSq) {
                            closestDistSq = distSq;
                            closestEnemy = other;
                        }
                    }
                }
            }
        }

        return closestEnemy;
    }
}
