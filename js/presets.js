/**
 * presets.js - 유튜브 영상 제작용 원클릭 시나리오 프리셋 정의
 */

import { SCENARIOS } from './scenarioData.js';

export const YOUTUBE_PRESETS = [
    {
        id: "outpost_defense",
        title: "1. 300 방어선 vs 5,000 좀비 웨이브",
        scenarioId: "outpost_defense",
        thumbnailIcon: "🛡️",
        hotkey: "1",
        description: "외곽 콘크리트 골목에서 샷건과 화염방사기로 웨이브를 저지하고 타이탄 지원군을 요청하는 명장면"
    },
    {
        id: "david_vs_goliath",
        title: "2. 다윗과 골리앗 (타이탄 vs 3,000 크롤러)",
        scenarioId: "david_vs_goliath",
        thumbnailIcon: "🤖",
        hotkey: "2",
        description: "단 1기의 결전 병기가 3,000마리의 붉은 벌레 군집을 레이저로 소거하는 압도적 비주얼"
    },
    {
        id: "four_way_siege",
        title: "3. 사방 포위전 (동서남북 4방향 협공)",
        scenarioId: "four_way_siege",
        thumbnailIcon: "⚔️",
        hotkey: "3",
        description: "십자로 벙커에서 4면 포위를 버텨내는 처절한 방어전"
    },
    {
        id: "sniper_vs_brutes",
        title: "4. 관통 화력전 (저격수 50 vs 브루트 30)",
        scenarioId: "sniper_vs_brutes",
        thumbnailIcon: "🎯",
        hotkey: "4",
        description: "레이저 트레이서 관통탄과 괴수들의 저돌적인 돌진 맞대결"
    },
    {
        id: "free_sandbox",
        title: "5. 자유 샌드박스 (백지 실험 모드)",
        scenarioId: "free_sandbox",
        thumbnailIcon: "✨",
        hotkey: "5",
        description: "원하는 병종과 맵을 마음대로 배치하고 실험하는 모드"
    }
];
