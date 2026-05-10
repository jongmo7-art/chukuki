# 측우기 시뮬레이션

조선 세종 시대의 측우기(測雨器) 웹 시뮬레이션. Three.js + vanilla JS.

## 파일 구조
- `index.html` — HTML 구조 (상단 바, 좌측 강수 패널, 우측 정보 패널, 하단 컨트롤, 모달)
- `styles.css` — CSS (혼천의 스타일 기반, 파란색 강수 테마)
- `main.js` — Three.js 씬, 3D 모델, 강수 시뮬레이션, UI 이벤트
- `data.js` — 부속 데이터, 역사 연표, 퀴즈

## 좌표계
- world y=0 = 측우대 상단 = 측우기 바닥
- world y=V.height(0.305) = 측우기 상단 테두리
- world y=-STAND.h(-0.14) = 측우대 하단
- 측우침 resting: x=0.145, y=RULER.len/2=0.18, z=0

## 실행
```
python -m http.server 8091
# → http://localhost:8091
```

## 작업 기록

### v1.0 — 최초 제작 (2026-05-10)
- 4개 파일 신규 생성 (index.html, styles.css, main.js, data.js)
- 혼천의·앙부일구·자격루 시리즈와 동일한 Three.js CDN + vanilla JS 방식 채택
- 측우기·측우대·측우침·구연부 3D 모델 (역사적 치수 기준)
- 가이드 투어 5단계 / 역사 연표 7항목 / 퀴즈 7문제

### v1.1 — HD 레이아웃 + 비 시각화 개선 (2026-05-10)
- 패널 폭 확대 (좌 275px, 우 315px), 폰트·간격 전반 조정
- 빗줄기 1400개, 강도별 streak 길이·각도·투명도 차등 적용
- 측우기 내부 splash 파티클 시스템 (최대 80개) 신규 추가
- 판석 바닥 ring splash 12개 순환, 파문(ripple) 강도별 색상·속도 개선
- 강수율 배지·강도 게이지·HUD 누계 표시 추가

### v1.2 — 전체 밝기 개선 (2026-05-10)
- 배경색 #0b1018 → #1a2e50 (남청색 계열로 밝게)
- Tone mapping exposure 1.15 → 1.55
- Ambient 0.65 → 1.2, 태양광 1.3 → 2.2, 보조광 0.4 → 0.9, 정수리 조명 추가
- 안개 밀도 0.55 → 0.35, 비 올 때 어두워지는 정도 완화
- UI 패널·텍스트 밝기 전반 상향

## 컨텍스트 앵커
- intent: 측우기 3D 시뮬 완성 및 배포
- changes_made: v1.0~v1.2 순차 완성
- decisions: Three.js CDN + vanilla JS, 좌표 기준 y=0 = 측우대 상단
- next_steps: 필요 시 추가 기능 (소리, 절기별 강수 데이터 등)
