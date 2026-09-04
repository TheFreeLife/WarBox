# WarBox (워박스)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![60 FPS](https://img.shields.io/badge/Performance-60_FPS-00c853.svg)](#1-초고성능-바닐라-js-엔진-zero-gc--spatial-hashing)

> **Zero-Dependency, 60 FPS Mass Battle Sandbox Simulator**  
> 외부 프레임워크 없이 순수 HTML5 Canvas와 Vanilla JS로 구현된 초고성능 대규모 군단 배틀 샌드박스 시뮬레이터입니다.

---

## 주요 특징 (Key Features)

### 1. 초고성능 바닐라 JS 엔진 (Zero-GC & Spatial Hashing)
- **5,000 ~ 10,000+ 유닛 동시 전투**: 브라우저 Canvas 2D 환경에서 프레임 드랍 없이 60 FPS 사수.
- **$O(N)$ Spatial Hash Grid**: $O(N^2)$ 브루트포스 거리 연산 대신 격자 분할을 통해 충돌/타겟 탐색 연산 부하 98% 절감.
- **Zero-GC 오브젝트 풀링**: 탄환, 산탄, 로켓, 파티클 등을 사전 생성된 배열 풀에서 재사용하여 가비지 컬렉션(GC) 렉 제로.
- **배경 오프스크린 스탬프(Stamp Buffer)**: 핏자국, 파편, 폭발 그을음을 배경 캔버스에 영구 누적하여 렌더링 비용 최소화.

### 2. 시네마틱 연출 & 뷰 모드 (Cinematic & View Modes)
- **원클릭 화면비 전환 (`R` 키)**: 가로 모드(16:9) ↔ 세로 모드(9:16) 캔버스 종횡비 즉시 변경.
- **클린 뷰 모드 (`H` 키)**: 화면 내 모든 HUD와 UI를 숨겨 몰입감 높은 전장 관전 지원.
- **다이내믹 연출 도구**: 0.2x 슬로우 모션(`Z`), 고속 배속(`X`), 카메라 스크린 셰이크(Screen Shake), 적 피격 섬광.

### 3. 2대 진영 및 다채로운 병종
- **BLUE 진영 (현대 군대 & 하이테크)**:
  - `소총수 (Rifleman)`: 균형 잡힌 주력 원거리 보병
  - `샷건 특공대 (Shotgunner)`: 부채꼴 산탄 및 강력한 넉백 저지선 형성
  - `저격수 (Sniper)`: 초장거리 다중 관통탄 & 실시간 레이저 조준선
  - `화염방사기병 (Flamethrower)`: 밀집 군중 광역 지속 화상 피해
  - `미니건 터렛 (Minigun Turret)`: 거치형 중화기, 초당 20발 탄막 난사
  - `로켓 포병 (Rocket Artillery)`: 장거리 광역 대폭발 및 넉백
  - `메카 타이탄 (Mecha Titan)`: 보스급 결전 병기, 짓밟기 및 트윈 레이저 빔
- **RED 진영 (감염체 & 괴수 군단)**:
  - `러너 좀비 (Runner Zombie)`: 빠른 속도로 떼를 지어 덮치는 표준 감염체
  - `탱커 브루트 (Tanker Brute)`: 높은 체력과 광역 지면 강타
  - `자폭체 (Exploder)`: 붉게 박동 후 대폭발 및 연쇄 폭발
  - `스피터 괴물 (Spitter)`: 포물선 산성액 투척 및 지면 독 장판 형성
  - `스웜 크롤러 (Swarm Crawler)`: 수천 마리가 파도처럼 쏟아지는 초소형 군집체

### 4. 샌드박스 & 인게임 맵 에디터
- **스폰 브러시**: 마우스 드래그로 수백 마리의 병력을 붓칠하듯 배치.
- **인게임 맵 에디터 (`E` 키)**: 콘크리트 벽, 바리케이드, 폭발 지뢰, 좀비 포탈 실시간 건설/삭제 및 JSON 내보내기.
- **신의 권능 (God Mode)**: 전술 핵(Nuke), 블랙홀(Blackhole) 즉시 투하.
- **사운드**: 외부 오디오 파일 없이 Web Audio API로 신시사이징되는 실시간 프로시저럴 효과음.

---

## 빠른 시작 (Quick Start)

별도의 빌드나 의존성 설치가 필요하지 않습니다.

### 1. 로컬 실행
Windows 환경에서 `run.bat`을 더블 클릭하면 로컬 웹 서버가 실행되고 브라우저가 자동으로 열립니다.

```bash
# Windows
run.bat

# 또는 Python http.server
python -m http.server 8080

# 또는 npx serve
npx serve .
```

브라우저에서 `http://localhost:8080`에 접속합니다.

---

## 조작법 및 단축키 (Controls)

| 키 / 마우스 | 기능 |
| :--- | :--- |
| **마우스 좌클릭 + 드래그** | 선택한 유닛 브러시 대량 스폰 / 맵 에디터 도구 배치 |
| **마우스 우클릭 / 휠 드래그** | 카메라 패닝 (시점 이동) |
| **마우스 휠 스크롤** | 줌 인 / 줌 아웃 (Zoom In/Out) |
| <kbd>H</kbd> | **클린 뷰 모드** (모든 UI / HUD 숨김 토글) |
| <kbd>Space</kbd> | 시뮬레이션 일시정지 / 재개 |
| <kbd>Z</kbd> | **0.2x 슬로우 모션** 토글 |
| <kbd>X</kbd> | 2.5x 배속 토글 |
| <kbd>R</kbd> | **16:9 (가로) ↔ 9:16 (세로)** 화면 비율 전환 |
| <kbd>C</kbd> | 전장의 모든 유닛 즉시 클리어 |
| <kbd>E</kbd> | 인게임 맵 에디터 패널 열기/닫기 |
| <kbd>T</kbd> | 시뮬레이터 변수 조절 패널 열기/닫기 |
| <kbd>1</kbd> ~ <kbd>5</kbd> | 기본 시나리오 프리셋 즉시 로드 |

---

## 프로젝트 구조 (Architecture)

유지보수와 모딩의 편의를 위해 **단일 책임 원칙(SRP)**에 기반하여 모듈이 분리되어 있습니다:

```
C:/Coding/WarBox/
├── index.html                 # 메인 화면 및 뷰포트 레이아웃
├── run.bat                    # 로컬 실행 배치 파일
├── css/
│   └── style.css              # 다크 테마 & 글래스모피즘 스타일
└── js/
    ├── main.js                # 앱 진입점 및 이벤트 리스너 바인딩
    ├── engine.js              # 메인 루프 (BattleEngine) & 60 FPS 프로파일러
    ├── unitData.js            # [User Config] 유닛 스탯, 외형, 무기 정의
    ├── scenarioData.js        # [User Config] 웨이브/이벤트 타임라인 스크립트
    ├── presets.js             # [User Config] 시나리오 맵 프리셋
    ├── config.js              # [User Config] 물리 상수 및 글로벌 설정
    ├── units.js               # Unit 클래스, AI 로직, 물리 충돌 처리
    ├── projectiles.js         # 투사체 오브젝트 풀링 (총알/로켓/산탄/화염)
    ├── particles.js           # 파티클 풀링 및 바닥 스탬프 버퍼
    ├── spatialGrid.js         # O(N) Spatial Hash Grid 공간 분할
    ├── obstacles.js           # 벽, 바리케이드, 지뢰, 좀비 포탈
    ├── mapEditor.js           # 맵 에디터 컨트롤러
    ├── camera.js              # 줌/패닝/스크린 셰이크/비율 전환
    ├── audio.js               # Web Audio API 프로시저럴 효과음
    ├── tweaker.js             # 감염 모드/넉백/전술핵/블랙홀
    └── scenarioDirector.js    # 시나리오 타임라인 연출 디렉터
```

---

## 나만의 유닛 추가하기 (Modding)

`js/unitData.js` 파일의 `UNIT_TYPES` 객체에 새로운 유닛 스탯을 작성하면 게임 UI 덱과 스폰 시스템에 자동으로 등록됩니다:

```javascript
// js/unitData.js 예시:
cyborg_ninja: {
    id: "cyborg_ninja",
    name: "사이보그 닌자",
    desc: "초고속 이동과 카타나 연속 베기",
    faction: "blue",
    role: "melee",
    icon: "ninja",
    hp: 220,
    speed: 3.0,
    radius: 10,
    sightRange: 350,
    attackRange: 20,
    damage: 45,
    attackSpeed: 2.5,
    weapon: "melee",
    shape: "soldier",
    color: "#06b6d4"
}
```

---

## 라이선스 (License)

이 프로젝트는 [MIT 라이선스](LICENSE)에 따라 자유롭게 수정 및 배포할 수 있습니다.
