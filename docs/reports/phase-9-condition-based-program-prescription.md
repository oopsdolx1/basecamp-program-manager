# Phase 9 ? Condition-Based Program Prescription

## 변경 목적

기존 BaseCamp 출력 흐름은 회원 선택 후 프로그램을 수동으로 고르는 구조였다.
이번 Phase에서는 회원 선택 이후 오늘의 컨디션을 입력하고, 기존 Program Repository 안에서 조건 기반으로 프로그램을 추천한 뒤 Snapshot만 수정해서 출력하는 흐름으로 변경했다.

## 구현 내용

- `QuickPrintFlow`를 4단계 흐름으로 재구성했다.
  - Step1: 기존 회원 검색 재사용
  - Step2: 오늘의 컨디션 입력
  - Step3: 조건 기반 추천 결과 표시
  - Step4: Snapshot 운동 수정 후 출력 미리보기 이동
- 기존 Program Repository는 읽기 전용으로 유지했다.
- 추천 결과는 원본 Program이 아니라 편집 가능한 Snapshot form으로 복사해 사용했다.
- 출력 미리보기는 기존 route와 Print History 저장 구조를 유지하면서, Snapshot일 때만 세션 저장값을 복구하도록 확장했다.
- 최근 운동 정보는 Firestore logs 경로를 우선 조회하고, 실패 시 기존 print history를 fallback으로 사용하는 fail-soft 구조로 구현했다.

## 추천 알고리즘

추천 엔진은 새 Program을 생성하지 않고 기존 Program 목록만 점수화한다.

반영 요소:
- 최근 운동 부위
- 오늘 컨디션
- 수면
- 스트레스
- 피로 부위
- 음주 여부
- Program category
- Program difficulty
- 즐겨찾기 및 usageCount 보정

예시 규칙:
- 컨디션 나쁨: 고강도 프로그램 감점, Recovery 가점
- 수면 부족: 고강도 감점, Recovery 가점
- 스트레스 높음: Recovery 우선
- 음주 있음: 고강도 감점, Recovery 또는 저강도 우선
- 피로 부위 선택: 같은 부위 category 감점
- 최근 같은 부위 운동: 동일 category 우선순위 하향

추천 이유는 사람이 읽을 수 있는 문장으로 생성되며, 최근 운동과 피로 부위, 회복 우선 이유를 함께 설명한다.

## UI

- Condition Lab Dark Theme를 유지했다.
- Gold accent, dark card, large touch button 스타일을 유지했다.
- Step2 입력은 키오스크 사용을 고려해 큰 선택 카드, 56px 이상 chip/button 중심으로 구성했다.
- Keyboard/Enter/Tab 기반 포커스 이동과 aria-label을 유지했다.

## Snapshot 구조

Snapshot은 세션 저장소에 다음 정보를 보관한다.
- sourceProgramId
- sourceProgramTitle
- recommendationReasons
- condition
- recentWorkout
- formValues

실제 출력 시에는 세션의 Snapshot formValues를 Program 형태로 복원해 기존 print mapper에 전달한다.
원본 Program 문서는 수정하지 않는다.

## 회귀 테스트

코드 변경 범위는 Quick Print와 Print Preview, 조건 추천 서비스에 한정했다.
다음 항목은 설계상 유지했다.
- Member Search 재사용
- Exercise Catalog autocomplete 유지
- Exercise Resolver 유지
- Program Repository 수정 없음
- Print Workflow 유지
- Print History 저장 구조 유지
- A5 Template 유지
- Firestore collection 추가 없음
- Authentication 변경 없음

수동 확인이 추가로 필요한 영역:
- Firestore logs 실제 경로/필드명이 운영 데이터와 일치하는지 확인
- Print History, Archive/Restore, Statistics, Import/Export 화면 실사용 회귀 확인

## Build 결과

- `npm ci` 실행 완료
- `npm run build` 성공
- Vite production build 성공
- chunk size warning 1건 존재하나 build 실패는 아님

## TypeScript 결과

- `tsc -b` 통과
- TypeScript Error 0

## 남은 개선사항

- Firestore logs 경로와 실제 문서 필드명을 운영 데이터 기준으로 확정하면 최근 운동 카드 정확도를 높일 수 있다.
- Snapshot을 sessionStorage 대신 print request payload metadata와 연계하면 새로고침 복원성이 더 좋아질 수 있다.
- 추천 규칙을 설정화하면 센터별 운영 정책 반영이 쉬워진다.
