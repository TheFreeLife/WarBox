/**
 * flowField.js - 무한 맵 지원 동적 로컬 유동장 (Dynamic Floating Flow Field)
 * 
 * 전 세계가 무한히 확장되더라도 연산량 폭발 없이 항상 O(1) 성능을 사수하기 위해
 * 현재 교전이 벌어지는 활성 전투 구역을 중심으로 동적 윈도우(80x60 = 4,800 셀)를
 * 유동적으로 이동시키며 진영별 다중 목적지 Dijkstra 최단 우회 경로를 생성합니다.
 */

export class FlowField {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.totalCells = cols * rows;

        // 통합 거리 필드 (0 ~ 65535, 65535는 도달 불가)
        this.integrationField = new Uint16Array(this.totalCells);

        // 2D 정규화 방향 벡터 필드
        this.vectorX = new Float32Array(this.totalCells);
        this.vectorY = new Float32Array(this.totalCells);

        this.hasGoals = false;
        this.valid = false;
    }

    reset() {
        this.integrationField.fill(65535);
        this.vectorX.fill(0);
        this.vectorY.fill(0);
        this.hasGoals = false;
        this.valid = false;
    }
}

export class FlowFieldManager {
    constructor(worldWidth = 2400, worldHeight = 1600, cellSize = 48) {
        this.cellSize = cellSize;

        // 동적 윈도우 크기 (80x60 셀 = 3,840px x 2,880px 대규모 교전 구역 커버)
        this.cols = 80;
        this.rows = 60;
        this.totalCells = this.cols * this.rows;

        // 윈도우 좌상단 타일 기준점 (음수/양수 자유 이동)
        this.originTileX = -Math.floor(this.cols / 2);
        this.originTileY = -Math.floor(this.rows / 2);

        // 1. 공통 비용 필드 (Shared Cost Field: 1=보통, 4=바리케이드, 255=벽)
        this.costField = new Uint8Array(this.totalCells);
        this.costField.fill(1);

        // 2. 진영별 분리 유동장 (RED & BLUE)
        this.redField = new FlowField(this.cols, this.rows);   // RED 유닛용: 목적지 = BLUE 유닛
        this.blueField = new FlowField(this.cols, this.rows);  // BLUE 유닛용: 목적지 = RED 유닛

        // 3. Zero-GC Dijkstra BFS 탐색 큐 (재사용 버퍼)
        this.queue = new Int32Array(this.totalCells * 2);

        // 4. 갱신 주기 타이머 (약 0.15초 간격으로 분산 갱신)
        this.updateTimer = 0;
        this.updateInterval = 0.15; // 초 단위

        // 디버그 시각화 설정
        this.debugRender = false;
        this.debugFaction = "red"; // "red" | "blue"

        // 타일맵 참조
        this.lastMapManager = null;
    }

    /**
     * 월드 좌표를 현재 동적 윈도우의 로컬 그리드 (lx, ly)로 변환
     */
    worldToLocalCell(x, y) {
        const worldTileX = Math.floor(x / this.cellSize);
        const worldTileY = Math.floor(y / this.cellSize);

        const lx = worldTileX - this.originTileX;
        const ly = worldTileY - this.originTileY;

        if (lx < 0 || lx >= this.cols || ly < 0 || ly >= this.rows) {
            return null;
        }

        return { lx, ly, index: ly * this.cols + lx };
    }

    /**
     * 현재 동적 윈도우 중심을 갱신하고 비용 필드(Cost Field) 재구축
     */
    rebuildCostField(mapManager = null, centerTileX = 0, centerTileY = 0) {
        if (mapManager) {
            this.lastMapManager = mapManager;
        }
        const mgr = mapManager || this.lastMapManager;

        this.originTileX = Math.floor(centerTileX - this.cols / 2);
        this.originTileY = Math.floor(centerTileY - this.rows / 2);

        this.costField.fill(1);

        if (mgr) {
            // 현재 윈도우 영역 안의 타일들만 초고속 조회하여 비용 필드 구축
            for (let ly = 0; ly < this.rows; ly++) {
                const worldCy = this.originTileY + ly;
                const rowOffset = ly * this.cols;
                for (let lx = 0; lx < this.cols; lx++) {
                    const worldCx = this.originTileX + lx;
                    const tile = mgr.getTile(worldCx, worldCy);

                    if (tile === 1) { // WALL
                        this.costField[rowOffset + lx] = 255;
                    } else if (tile === 2) { // BARRICADE
                        this.costField[rowOffset + lx] = 4;
                    }
                }
            }
        }

        this.updateTimer = this.updateInterval;
    }

    /**
     * 매 프레임 업데이트 (활성 전투 구역 추적 및 BFS 갱신)
     */
    update(dt, units = [], camera = null) {
        this.updateTimer += dt;
        if (this.updateTimer < this.updateInterval) return;
        this.updateTimer = 0;

        // 1. 활성 전투 중심점 계산 (생존 유닛 평균 위치 또는 카메라 중심)
        let centerX = camera ? camera.x : 0;
        let centerY = camera ? camera.y : 0;

        if (units.length > 0) {
            let sumX = 0;
            let sumY = 0;
            let aliveCount = 0;
            const sampleStep = Math.max(1, Math.floor(units.length / 80)); // 샘플링으로 초고속 계산

            for (let i = 0; i < units.length; i += sampleStep) {
                const u = units[i];
                if (u.isAlive) {
                    sumX += u.x;
                    sumY += u.y;
                    aliveCount++;
                }
            }

            if (aliveCount > 0) {
                centerX = sumX / aliveCount;
                centerY = sumY / aliveCount;
            }
        }

        const targetOriginTileX = Math.floor(centerX / this.cellSize - this.cols / 2);
        const targetOriginTileY = Math.floor(centerY / this.cellSize - this.rows / 2);

        // 윈도우가 4타일 이상 이동했을 때 비용 필드 리빌드
        if (Math.abs(targetOriginTileX - this.originTileX) >= 4 ||
            Math.abs(targetOriginTileY - this.originTileY) >= 4) {
            this.rebuildCostField(this.lastMapManager, Math.floor(centerX / this.cellSize), Math.floor(centerY / this.cellSize));
        }

        // 2. 윈도우 범위 내의 생존 유닛 수집
        const blueGoals = [];
        const redGoals = [];

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!u.isAlive) continue;

            const cell = this.worldToLocalCell(u.x, u.y);
            if (!cell) continue;

            if (u.faction === "blue") {
                blueGoals.push(cell);
            } else if (u.faction === "red") {
                redGoals.push(cell);
            }
        }

        // 3. RED 유동장 계산 (목적지: 윈도우 내 BLUE 유닛들)
        this.computeFieldForFaction(this.redField, blueGoals);

        // 4. BLUE 유동장 계산 (목적지: 윈도우 내 RED 유닛들)
        this.computeFieldForFaction(this.blueField, redGoals);
    }

    /**
     * 특정 유동장에 대해 다중 목적지(Multi-Source) Dijkstra BFS 및 벡터장 생성
     */
    computeFieldForFaction(flowField, targetCells) {
        flowField.reset();

        if (targetCells.length === 0) {
            flowField.valid = false;
            return;
        }

        let qHead = 0;
        let qTail = 0;

        // 1. 모든 타겟 셀 위치를 목적지(Sink, 거리 0)로 큐에 삽입
        const markedGoalCells = new Uint8Array(this.totalCells);

        for (let i = 0; i < targetCells.length; i++) {
            const idx = targetCells[i].index;
            if (this.costField[idx] < 255 && markedGoalCells[idx] === 0) {
                markedGoalCells[idx] = 1;
                flowField.integrationField[idx] = 0;
                this.queue[qTail++] = idx;
                flowField.hasGoals = true;
            }
        }

        if (!flowField.hasGoals) {
            flowField.valid = false;
            return;
        }

        // 2. 다중 출발점 Dijkstra BFS 확산 (8방향 이동)
        const cols = this.cols;
        const rows = this.rows;
        const costField = this.costField;
        const integrationField = flowField.integrationField;

        const dx = [1, -1, 0, 0, 1, -1, 1, -1];
        const dy = [0, 0, 1, -1, 1, 1, -1, -1];
        const stepCost = [10, 10, 10, 10, 14, 14, 14, 14];

        while (qHead < qTail) {
            const currentIdx = this.queue[qHead++];
            const currentDist = integrationField[currentIdx];
            const cx = currentIdx % cols;
            const cy = Math.floor(currentIdx / cols);

            for (let dir = 0; dir < 8; dir++) {
                const nx = cx + dx[dir];
                const ny = cy + dy[dir];

                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

                const nIdx = ny * cols + nx;
                const nCost = costField[nIdx];

                if (nCost === 255) continue;

                // 대각선 모서리 관통 방지
                if (dir >= 4) {
                    const checkX = cy * cols + nx;
                    const checkY = ny * cols + cx;
                    if (costField[checkX] === 255 || costField[checkY] === 255) {
                        continue;
                    }
                }

                const newDist = currentDist + stepCost[dir] * nCost;

                if (newDist < integrationField[nIdx]) {
                    integrationField[nIdx] = newDist;
                    if (qTail < this.queue.length) {
                        this.queue[qTail++] = nIdx;
                    }
                }
            }
        }

        // 3. 통합 거리 필드로부터 단위 방향 벡터 필드 생성
        const vectorX = flowField.vectorX;
        const vectorY = flowField.vectorY;

        for (let idx = 0; idx < this.totalCells; idx++) {
            if (costField[idx] === 255) {
                vectorX[idx] = 0;
                vectorY[idx] = 0;
                continue;
            }

            const currentDist = integrationField[idx];
            if (currentDist === 0 || currentDist === 65535) {
                vectorX[idx] = 0;
                vectorY[idx] = 0;
                continue;
            }

            const cx = idx % cols;
            const cy = Math.floor(idx / cols);

            let bestNeighborDist = currentDist;
            let bestDx = 0;
            let bestDy = 0;

            for (let dir = 0; dir < 8; dir++) {
                const nx = cx + dx[dir];
                const ny = cy + dy[dir];

                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

                const nIdx = ny * cols + nx;
                if (costField[nIdx] === 255) continue;

                if (dir >= 4) {
                    const checkX = cy * cols + nx;
                    const checkY = ny * cols + cx;
                    if (costField[checkX] === 255 || costField[checkY] === 255) {
                        continue;
                    }
                }

                const nDist = integrationField[nIdx];
                if (nDist < bestNeighborDist) {
                    bestNeighborDist = nDist;
                    bestDx = dx[dir];
                    bestDy = dy[dir];
                }
            }

            if (bestDx !== 0 || bestDy !== 0) {
                const len = Math.hypot(bestDx, bestDy);
                vectorX[idx] = bestDx / len;
                vectorY[idx] = bestDy / len;
            } else {
                vectorX[idx] = 0;
                vectorY[idx] = 0;
            }
        }

        flowField.valid = true;
    }

    /**
     * 월드 좌표 (x, y)에서 해당 진영의 최적 이동 방향 벡터 샘플링 (Bilinear Interpolation)
     */
    getFlowVector(x, y, faction) {
        const field = faction === "red" ? this.redField : this.blueField;
        if (!field.valid) return { x: 0, y: 0 };

        const localTileX = (x / this.cellSize) - this.originTileX - 0.5;
        const localTileY = (y / this.cellSize) - this.originTileY - 0.5;

        const x0 = Math.floor(localTileX);
        const y0 = Math.floor(localTileY);

        if (x0 < 0 || x0 >= this.cols - 1 || y0 < 0 || y0 >= this.rows - 1) {
            return { x: 0, y: 0 }; // 윈도우 밖은 직선 추적으로 전환
        }

        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fx = localTileX - x0;
        const fy = localTileY - y0;

        const idx00 = y0 * this.cols + x0;
        const idx10 = y0 * this.cols + x1;
        const idx01 = y1 * this.cols + x0;
        const idx11 = y1 * this.cols + x1;

        const vx = (field.vectorX[idx00] * (1 - fx) + field.vectorX[idx10] * fx) * (1 - fy) +
                   (field.vectorX[idx01] * (1 - fx) + field.vectorX[idx11] * fx) * fy;
        const vy = (field.vectorY[idx00] * (1 - fx) + field.vectorY[idx10] * fx) * (1 - fy) +
                   (field.vectorY[idx01] * (1 - fx) + field.vectorY[idx11] * fx) * fy;

        const len = Math.hypot(vx, vy);
        if (len > 0.05) {
            return { x: vx / len, y: vy / len };
        }

        return { x: 0, y: 0 };
    }

    /**
     * 유동장 디버그 오버레이 렌더링
     */
    renderDebug(ctx, faction = null) {
        const targetFaction = faction || this.debugFaction;
        const field = targetFaction === "red" ? this.redField : this.blueField;
        const arrowColor = targetFaction === "red" ? "rgba(239, 68, 68, 0.6)" : "rgba(14, 165, 233, 0.6)";
        const goalColor = targetFaction === "red" ? "rgba(239, 68, 68, 0.25)" : "rgba(14, 165, 233, 0.25)";

        ctx.save();
        const half = this.cellSize / 2;
        const arrowLen = this.cellSize * 0.38;

        for (let cy = 0; cy < this.rows; cy++) {
            const worldCy = this.originTileY + cy;
            const rowOffset = cy * this.cols;
            for (let cx = 0; cx < this.cols; cx++) {
                const worldCx = this.originTileX + cx;
                const idx = rowOffset + cx;
                const px = worldCx * this.cellSize + half;
                const py = worldCy * this.cellSize + half;

                const cost = this.costField[idx];
                if (cost === 255) {
                    ctx.fillStyle = "rgba(51, 65, 85, 0.25)";
                    ctx.fillRect(worldCx * this.cellSize, worldCy * this.cellSize, this.cellSize, this.cellSize);
                    continue;
                } else if (cost > 1) {
                    ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
                    ctx.fillRect(worldCx * this.cellSize, worldCy * this.cellSize, this.cellSize, this.cellSize);
                }

                if (field.valid && field.integrationField[idx] === 0) {
                    ctx.fillStyle = goalColor;
                    ctx.fillRect(worldCx * this.cellSize, worldCy * this.cellSize, this.cellSize, this.cellSize);
                }

                if (field.valid) {
                    const vx = field.vectorX[idx];
                    const vy = field.vectorY[idx];

                    if (vx !== 0 || vy !== 0) {
                        const toX = px + vx * arrowLen;
                        const toY = py + vy * arrowLen;

                        ctx.strokeStyle = arrowColor;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(toX, toY);
                        ctx.stroke();

                        const angle = Math.atan2(vy, vx);
                        const headLen = 4;
                        ctx.beginPath();
                        ctx.moveTo(toX, toY);
                        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
                        ctx.moveTo(toX, toY);
                        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
                        ctx.stroke();
                    }
                }
            }
        }

        ctx.restore();
    }
}
