# 강의 아카이브 V1 디자인 아이디어

## 사용자 요구: Notion 스타일, 심플, 카드 기반, 모바일 대응, 반응형

---

<response>
<probability>0.08</probability>
<text>

## Idea A: 에디토리얼 미니멀리즘 (Editorial Minimalism)

**Design Movement:** 스위스 타이포그래피 + Notion 인스파이어드 에디토리얼

**Core Principles:**
1. 텍스트가 주인공 — 모든 UI 요소는 콘텐츠를 방해하지 않는다
2. 여백은 설계된 공간 — 빽빽함 없이 숨 쉬는 레이아웃
3. 기능이 곧 미학 — 장식 없이 구조 자체가 아름답다
4. 일관된 리듬 — 8px 그리드 기반 간격 시스템

**Color Philosophy:**
- 배경: #FAFAF9 (따뜻한 오프화이트, 눈 피로 최소화)
- 텍스트: #1A1A1A (순수 검정 대신 따뜻한 거의-검정)
- 강조: #2563EB (신뢰감 있는 블루)
- 보조: #6B7280 (중간 회색, 메타 정보)
- 카드 테두리: #E5E7EB (연한 회색)
- 감정: 전문적, 신뢰, 깔끔

**Layout Paradigm:**
- 좌측 고정 사이드바 (240px) + 우측 메인 컨텐츠 영역
- 사이드바: 네비게이션 + 통계 미니 카드
- 메인: 카드 그리드 (2열 → 1열 모바일)
- 상단 헤더 없음, 사이드바가 브랜딩 담당

**Signature Elements:**
1. 얇은 1px 구분선으로 섹션 분리 (그림자 대신)
2. 호버 시 좌측 3px 컬러 바 등장 (Notion 스타일)
3. 태그/배지는 배경 없이 텍스트+언더라인 스타일

**Interaction Philosophy:**
- 클릭 가능한 모든 요소는 150ms ease-out 전환
- 카드 호버: translateY(-2px) + 그림자 강화
- 버튼: scale(0.97) active 피드백

**Animation:**
- 페이지 진입: opacity 0→1, translateY 8px→0, 200ms
- 카드 목록: stagger 40ms 간격 순차 등장
- 모달: scale(0.96)→1 + opacity, 220ms

**Typography System:**
- 헤딩: Pretendard 700 (한국어 최적화)
- 본문: Pretendard 400
- 메타: Pretendard 500, text-gray-500
- 코드/날짜: JetBrains Mono (숫자 정렬)

</text>
</response>

<response>
<probability>0.07</probability>
<text>

## Idea B: 따뜻한 종이 질감 (Warm Paper Archive)

**Design Movement:** 아날로그 아카이브 + 현대 디지털 UI의 혼합

**Core Principles:**
1. 물리적 기록의 따뜻함을 디지털로 — 종이, 잉크, 도장 느낌
2. 계층적 정보 구조 — 중요도에 따른 명확한 시각적 위계
3. 손으로 쓴 듯한 자연스러움 — 완벽한 정렬보다 인간적 불완전함
4. 기억을 소환하는 색감 — 세피아, 크림, 먹색

**Color Philosophy:**
- 배경: #F5F0E8 (크림색 종이)
- 텍스트: #2C2416 (진한 먹색)
- 강조: #8B4513 (새들 브라운, 도장/스탬프 느낌)
- 보조: #A0956B (황토색)
- 카드: #FFFDF7 (밝은 크림)
- 감정: 따뜻함, 향수, 기록의 소중함

**Layout Paradigm:**
- 전통적인 서류 폴더 구조 시각화
- 카드가 약간 기울어진 듯한 느낌 (1-2도 rotation)
- 탭 인터페이스로 카테고리 전환

**Signature Elements:**
1. 카드 상단에 컬러 스티커 도트 (강의 분야 구분)
2. 날짜는 도장 스탬프 스타일 (원형 테두리)
3. 구분선은 점선 (---) 스타일

**Interaction Philosophy:**
- 카드 선택 시 "집어드는" 느낌 (scale up + shadow)
- 삭제는 "찢는" 애니메이션
- 저장은 "도장 찍는" 효과

**Animation:**
- 카드 등장: rotateZ(2deg)→0 + opacity, 자연스러운 착지
- 호버: 카드가 살짝 들리는 느낌

**Typography System:**
- 헤딩: Noto Serif KR (세리프, 격식)
- 본문: Noto Sans KR
- 날짜: 모노스페이스

</text>
</response>

<response>
<probability>0.06</probability>
<text>

## Idea C: 클린 대시보드 (Clean Dashboard Pro)

**Design Movement:** 모던 SaaS 대시보드 + 한국형 업무 도구

**Core Principles:**
1. 데이터 우선 — 통계와 수치가 시각적으로 두드러짐
2. 효율적인 공간 활용 — 밀도 있지만 복잡하지 않음
3. 진행 상태 가시화 — 강의 이력이 성취감으로 느껴지도록
4. 다크/라이트 모드 완벽 지원

**Color Philosophy:**
- 배경: #F8FAFC (쿨 그레이 화이트)
- 강조: #6366F1 (인디고, 현대적 SaaS 느낌)
- 성공: #10B981 (에메랄드)
- 경고: #F59E0B (앰버)
- 카드: 흰색 + 미묘한 그림자
- 감정: 전문적, 성취, 데이터 중심

**Layout Paradigm:**
- 상단 헤더 + 좌측 사이드바 + 메인 콘텐츠
- 대시보드 첫 화면에 KPI 카드 3개 + 차트
- 목록 페이지는 테이블 + 카드 뷰 전환 가능

**Signature Elements:**
1. 통계 카드에 트렌드 화살표 (↑↓)
2. 강의 카드에 컬러 카테고리 배지
3. 진행 바로 연간 강의 목표 시각화

**Interaction Philosophy:**
- 데이터 변경 시 숫자 카운트업 애니메이션
- 필터/검색 실시간 반응

**Animation:**
- 숫자: countUp 효과
- 차트: 좌→우 그리기 애니메이션

**Typography System:**
- 헤딩: Pretendard 800
- 본문: Pretendard 400
- 숫자: tabular-nums

</text>
</response>

---

## 선택: Idea A — 에디토리얼 미니멀리즘

Notion 스타일 요구사항에 가장 부합하며, 초보 사용자가 코드를 이해하기 쉬운 구조.
좌측 사이드바 + 메인 콘텐츠 레이아웃으로 모든 기능에 빠르게 접근 가능.
