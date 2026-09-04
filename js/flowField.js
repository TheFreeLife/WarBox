/**
 * flowField.js - 유닛 크기별 다중 클리어런스 동적 로컬 유동장 (Multi-Clearance Flow Field)
 * 
 * - Tier 1 (1x1 규격 / 소형·보병): 1칸(48px) 폭의 좁은 샛길/성문 통과
 * - Tier 2 (2x2 규격 / 중형·탱커): 2칸(96px) 이상의 일반 도로 통과 (Dilation 1셀)
 * - Tier 3 (3x3 규격 / 초대형·보스·전함): 3칸(144px) 이상의 광장/대로만 통과 (Dilation 2셀)
 * 
 * 신규 유닛 추가 시 radius를 기준으로 Tier 1~3으로 100% 자동 분류되며,
 * 상위 티어가 막힌 경우 하위 티어로 안전하게 계층형 폴백(Hierarchical Fallback)합니다.
 */

export const CLEARANCE_TIERS = {
    SMALL: 1,  // 1x1 규격 (반지름 <= 16px: 소총수, 저격수, 샷건, 화염, 로켓, 러너, 자폭체, 스피터, 크롤러 등)
    MEDIUM: 2, // 2x2 규격 (16px < 반지름 <= 32px: 탱커 브루트(22), 미니건 터렛(18) 등)
    HUGE: 3    // 3x3 규격 (반지름 > 32px: 메카 타이탄(44) 및 향후 초대형 전함/요새)
};

/**
 * 유닛의 반지름(radius)을 기준으로 적절한 클리어런스 티어를 자동 분류
 */
export function getClearanceTier(radius) {
    if (radius <= 16) return CLEARANCE_TIERS.SMALL;
    if (radius <= 32) return CLEARANCE_TIERS.MEDIUM;
    return CLEARANCE_TIERS.HUGE;
}

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

        // 1. 크기 티어별 비용 필드 (Cost Field 1, 2, 3)
        // - costFields[1] (1x1): 원본 벽(255), 바리케이드(4)
        // - costFields[2] (2x2): 벽 1셀 팽창 (1칸 골목 차단, 2칸 도로 필요)
        // - costFields[3] (3x3): 벽 2셀 팽창 (1~2칸 통로 차단, 3칸 대로 필요)
        this.costFields = {
            [CLEARANCE_TIERS.SMALL]: new Uint8Array(this.totalCells),
            [CLEARANCE_TIERS.MEDIUM]: new Uint8Array(this.totalCells),
            [CLEARANCE_TIERS.HUGE]: new Uint8Array(this.totalCells)
        };
        this.costFields[1].fill(1);
        this.costFields[2].fill(1);
        this.costFields[3].fill(1);

        // 2. 진영별 & 크기 티어별 분리 유동장 (RED & BLUE x [1x1, 2x2, 3x3])
        this.fields = {
            red: {
                [CLEARANCE_TIERS.SMALL]: new FlowField(this.cols, this.rows),
                [CLEARANCE_TIERS.MEDIUM]: new FlowField(this.cols, this.rows),
                [CLEARANCE_TIERS.HUGE]: new FlowField(this.cols, this.rows)
            },
            blue: {
                [CLEARANCE_TIERS.SMALL]: new FlowField(this.cols, this.rows),
                [CLEARANCE_TIERS.MEDIUM]: new FlowField(this.cols, this.rows),
                [CLEARANCE_TIERS.HUGE]: new FlowField(this.cols, this.rows)
            }
        };

        // 3. Zero-GC Dijkstra BFS 탐색 큐 (재사용 버퍼)
        this.queue = new Int32Array(this.totalCells * 2);

        // 4. 갱신 주기 타이머 (약 0.15초 간격으로 분산 갱신)
        this.updateTimer = 0;
        this.updateInterval = 0.15; // 초 단위

        // 디버그 시각화 설정
        this.debugRender = false;
        this.debugFaction = "red"; // "red" | "blue"
        this.debugTier = CLEARANCE_TIERS.SMALL; // 1 (1x1) | 2 (2x2) | 3 (3x3)

        // 하위 호환용 참조
        this.lastMapManager = null;
    }

    get redField() {
        return this.fields.red[this.debugTier] || this.fields.red[CLEARANCE_TIERS.SMALL];
    }

    get blueField() {
        return this.fields.blue[this.debugTier] || this.fields.blue[CLEARANCE_TIERS.SMALL];
    }

    /**
     * 모든 진영 및 크기 티어 유동장 리셋
     */
    reset() {
        for (const f of ["red", "blue"]) {
            for (const t of [CLEARANCE_TIERS.SMALL, CLEARANCE_TIERS.MEDIUM, CLEARANCE_TIERS.HUGE]) {
                if (this.fields[f][t]) {
                    this.fields[f][t].reset();
                }
            }
        }
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
     * 현재 동적 윈도우 중심을 갱신하고 3개 티어의 비용 필드(Cost Field) 재구축
     */
    rebuildCostField(mapManager = null, centerTileX = 0, centerTileY = 0) {
        if (mapManager) {
            this.lastMapManager = mapManager;
        }
        const mgr = mapManager || this.lastMapManager;

        this.originTileX = Math.floor(centerTileX - this.cols / 2);
        this.originTileY = Math.floor(centerTileY - this.rows / 2);

        // 1. Tier 1 (1x1 소형) 비용 필드 구축
        const c1 = this.costFields[CLEARANCE_TIERS.SMALL];
        c1.fill(1);

        if (mgr) {
            for (let ly = 0; ly < this.rows; ly++) {
                const worldCy = this.originTileY + ly;
                const rowOffset = ly * this.cols;
                for (let lx = 0; lx < this.cols; lx++) {
                    const worldCx = this.originTileX + lx;
                    const tile = mgr.getTile(worldCx, worldCy);

                    if (tile === 1) { // WALL
                        c1[rowOffset + lx] = 255;
                    } else if (tile === 2) { // BARRICADE
                        c1[rowOffset + lx] = 4;
                    }
                }
            }
        }

        // 2. Tier 2 (2x2 중형) 비용 필드 생성 (Dilation 1: 벽 주변 8방향 1셀 팽창)
        const c2 = this.costFields[CLEARANCE_TIERS.MEDIUM];
        c2.set(c1);
        this.applyObstacleDilation(c1, c2);

        // 3. Tier 3 (3x3 초대형) 비용 필드 생성 (Dilation 2: 2셀 팽창)
        const c3 = this.costFields[CLEARANCE_TIERS.HUGE];
        c3.set(c2);
        this.applyObstacleDilation(c2, c3);

        this.updateTimer = this.updateInterval;
    }

    /**
     * 벽 팽창(Obstacle Dilation) 연산: srcField의 벽(255) 주변 8방향을 dstField에서 255로 마킹
     */
    applyObstacleDilation(srcField, dstField) {
        const cols = this.cols;
        const rows = this.rows;
        const dx = [1, -1, 0, 0, 1, -1, 1, -1];
        const dy = [0, 0, 1, -1, 1, 1, -1, -1];

        for (let ly = 0; ly < rows; ly++) {
            const rowOffset = ly * cols;
            for (let lx = 0; lx < cols; lx++) {
                if (srcField[rowOffset + lx] === 255) {
                    for (let d = 0; d < 8; d++) {
                        const nx = lx + dx[d];
                        const ny = ly + dy[d];
                        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                            dstField[ny * cols + nx] = 255;
                        }
                    }
                }
            }
        }
    }

    /**
     * 매 프레임 업데이트 (활성 전투 구역 추적 및 3개 티어 BFS 갱신)
     */
    update(dt, units = [], camera = null) {
        this.updateTimer += dt;
        if (this.updateTimer < this.updateInterval) return;
        this.updateTimer = 0;

        // 1. 활성 전투 중심점 계산
        let centerX = camera ? camera.x : 0;
        let centerY = camera ? camera.y : 0;

        if (units.length > 0) {
            let sumX = 0;
            let sumY = 0;
            let aliveCount = 0;
            const sampleStep = Math.max(1, Math.floor(units.length / 80));

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

        // 3. RED 유동장 계산 (목적지: BLUE 유닛들, 3개 티어 순회)
        for (const tier of [CLEARANCE_TIERS.SMALL, CLEARANCE_TIERS.MEDIUM, CLEARANCE_TIERS.HUGE]) {
            this.computeField(this.fields.red[tier], blueGoals, this.costFields[tier], tier);
        }

        // 4. BLUE 유동장 계산 (목적지: RED 유닛들, 3개 티어 순회)
        for (const tier of [CLEARANCE_TIERS.SMALL, CLEARANCE_TIERS.MEDIUM, CLEARANCE_TIERS.HUGE]) {
            this.computeField(this.fields.blue[tier], redGoals, this.costFields[tier], tier);
        }
    }

    /**
     * 특정 유동장에 대해 다중 목적지(Multi-Source) Dijkstra BFS 및 벡터장 생성
     */
    computeField(flowField, targetCells, costField, tier = 1) {
        flowField.reset();

        if (targetCells.length === 0) {
            flowField.valid = false;
            return;
        }

        let qHead = 0;
        let qTail = 0;

        // 1. 통과 가능한 모든 타겟 셀 위치를 목적지(Sink, 거리 0)로 큐에 삽입
        const markedGoalCells = new Uint8Array(this.totalCells);

        for (let i = 0; i < targetCells.length; i++) {
            const idx = targetCells[i].index;
            if (costField[idx] < 255 && markedGoalCells[idx] === 0) {
                markedGoalCells[idx] = 1;
                flowField.integrationField[idx] = 0;
                this.queue[qTail++] = idx;
                flowField.hasGoals = true;
            }
        }

        // 상위 티어(2x2, 3x3)에서 타겟들이 좁은 골목(255) 안에 있어 직접 싱크가 없는 경우,
        // 타겟 주변의 통과 가능 셀들을 탐색하여 입구 지점을 목적지로 근사
        if (!flowField.hasGoals && tier > 1) {
            const cols = this.cols;
            const rows = this.rows;
            const searchDist = tier === CLEARANCE_TIERS.HUGE ? 3 : 2;

            for (let i = 0; i < targetCells.length; i++) {
                const cx = targetCells[i].lx;
                const cy = targetCells[i].ly;

                for (let dy = -searchDist; dy <= searchDist; dy++) {
                    for (let dx = -searchDist; dx <= searchDist; dx++) {
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                            const nIdx = ny * cols + nx;
                            if (costField[nIdx] < 255 && markedGoalCells[nIdx] === 0) {
                                markedGoalCells[nIdx] = 1;
                                flowField.integrationField[nIdx] = 0;
                                this.queue[qTail++] = nIdx;
                                flowField.hasGoals = true;
                            }
                        }
                    }
                }
            }
        }

        if (!flowField.hasGoals) {
            flowField.valid = false;
            return;
        }

        // 2. 다중 출발점 Dijkstra BFS 확산 (8방향 이동)
        const cols = this.cols;
        const rows = this.rows;
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
     * 특정 단일 유동장에서 (x, y)의 쌍선형 보간 벡터 샘플링 헬퍼
     */
    sampleVector(field, localTileX, localTileY) {
        const x0 = Math.floor(localTileX);
        const y0 = Math.floor(localTileY);

        if (x0 < 0 || x0 >= this.cols - 1 || y0 < 0 || y0 >= this.rows - 1) {
            return null;
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
        return null;
    }

    /**
     * 월드 좌표 (x, y)에서 해당 진영 및 유닛 크기(radius)에 맞는 최적 이동 방향 벡터 샘플링
     * (Tier 3 -> Tier 2 -> Tier 1 계층적 안전 폴백 적용)
     */
    getFlowVector(x, y, faction, radius = 10) {
        const tier = getClearanceTier(radius);
        const factionFields = this.fields[faction];
        if (!factionFields) return { x: 0, y: 0 };

        const localTileX = (x / this.cellSize) - this.originTileX - 0.5;
        const localTileY = (y / this.cellSize) - this.originTileY - 0.5;

        // 윈도우 바깥은 직선 추적으로 전환
        if (localTileX < 0 || localTileX >= this.cols - 1 || localTileY < 0 || localTileY >= this.rows - 1) {
            return { x: 0, y: 0 };
        }

        // 유닛 티어부터 시작하여 하위 티어로 순차적 폴백(Hierarchical Fallback)
        for (let t = tier; t >= 1; t--) {
            const field = factionFields[t];
            if (field && field.valid) {
                const vec = this.sampleVector(field, localTileX, localTileY);
                if (vec) return vec;
            }
        }

        return { x: 0, y: 0 };
    }

    /**
     * 유동장 디버그 오버레이 렌더링
     */
    renderDebug(ctx, faction = null, tier = null) {
        const targetFaction = faction || this.debugFaction;
        const targetTier = tier || this.debugTier;
        const factionFields = this.fields[targetFaction];
        if (!factionFields) return;

        const field = factionFields[targetTier] || factionFields[CLEARANCE_TIERS.SMALL];
        const costField = this.costFields[targetTier] || this.costFields[CLEARANCE_TIERS.SMALL];

        let arrowColor = "rgba(14, 165, 233, 0.6)";
        let lineWidth = 1.5;
        let headLen = 4;

        if (targetFaction === "red") {
            if (targetTier === CLEARANCE_TIERS.HUGE) {
                arrowColor = "rgba(185, 28, 28, 0.95)";
                lineWidth = 3.0;
                headLen = 6.5;
            } else if (targetTier === CLEARANCE_TIERS.MEDIUM) {
                arrowColor = "rgba(220, 38, 38, 0.8)";
                lineWidth = 2.2;
                headLen = 5.0;
            } else {
                arrowColor = "rgba(239, 68, 68, 0.6)";
                lineWidth = 1.5;
                headLen = 4.0;
            }
        } else {
            if (targetTier === CLEARANCE_TIERS.HUGE) {
                arrowColor = "rgba(3, 105, 161, 0.95)";
                lineWidth = 3.0;
                headLen = 6.5;
            } else if (targetTier === CLEARANCE_TIERS.MEDIUM) {
                arrowColor = "rgba(2, 132, 199, 0.8)";
                lineWidth = 2.2;
                headLen = 5.0;
            } else {
                arrowColor = "rgba(14, 165, 233, 0.6)";
                lineWidth = 1.5;
                headLen = 4.0;
            }
        }

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

                const cost = costField[idx];
                if (cost === 255) {
                    const blockFill = targetTier === CLEARANCE_TIERS.HUGE
                        ? "rgba(127, 29, 29, 0.35)"
                        : (targetTier === CLEARANCE_TIERS.MEDIUM ? "rgba(153, 27, 27, 0.25)" : "rgba(51, 65, 85, 0.25)");
                    ctx.fillStyle = blockFill;
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
                        ctx.lineWidth = lineWidth;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(toX, toY);
                        ctx.stroke();

                        const angle = Math.atan2(vy, vx);
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
