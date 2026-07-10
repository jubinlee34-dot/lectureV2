/**
 * 강의 아카이브 V2 - 템플릿 생성 유틸리티 V2
 *
 * AI 없이 입력 데이터를 기반으로 규칙에 입각한 전문 텍스트를 자동 생성합니다.
 */

import type { Lecture } from "../types/lecture";
import { formatDate } from "./format";

function detectOrgType(organization: string): "welfare" | "teacher_training" | "school" | "public" | "startup" | "general" {
  const name = organization.toLowerCase();
  if (/복지관|복지원|노인|어르신|시니어/.test(name)) return "welfare";
  if (/교원|교사연수|교원연수|연수원/.test(name)) return "teacher_training";
  if (/학교|초등|중학|고등|대학/.test(name)) return "school";
  if (/시청|구청|군청|도청|공단|공사|공무원|정부|국가|국립/.test(name)) return "public";
  if (/스타트업|창업|벤처|인큐베이터/.test(name)) return "startup";
  return "general";
}

function getLectureTopic(lecture: Lecture): string {
  return lecture.topic?.trim() || lecture.title?.trim() || "교육";
}

function makeHashtag(value?: string | null): string | null {
  const tag = value?.replace(/\s+/g, "").trim();
  return tag ? `#${tag.substring(0, 20)}` : null;
}


function buildBackground(lecture: Lecture, orgType: ReturnType<typeof detectOrgType>): string {
  const topic = getLectureTopic(lecture);
  const { target, organization } = lecture;

  switch (orgType) {
    case "welfare":
      return `고령층 등 디지털 취약계층의 디지털 격차를 해소하고 실생활과 연계된 스마트기기 및 주요 애플리케이션 활용 능력을 제고하고자 본 교육을 기획하였다. ${organization}의 교육 요구사항에 부합하도록 실생활 필수 기능 위주로 실습 과정을 편성하여 교육 전이도를 높이고자 하였다.`;
    case "teacher_training":
      return `학교 교실 현장에서의 즉각적인 수업 적용 및 학교 교육과정 연계를 목적으로 교원 대상의 ${topic} 연수를 운영하였다. 참여 교원들이 실제 교수설계에 바로 활용할 수 있도록 실제 사례 분석과 설계 워크숍 단계를 중심으로 교수안을 마련하였다.`;
    case "school":
      return `학생들의 주도적인 학습 참여를 유도하고 체계적인 디지털 역량 향상을 기하고자 ${target} 대상의 ${topic} 교육을 운영하였다. 학습 동기를 자극하는 참여형 활동과 진로 연계 실습 과정을 구성하여 기초 지식을 고루 체득할 수 있도록 유도하였다.`;
    case "public":
      return `공공 행정 업무 현장에서의 실무 활용성 극대화와 디지털 실무 적용을 목적으로 ${organization} 소속 ${target} 대상의 ${topic} 교육을 운영하였다. 기관의 실무 데이터 흐름을 사전에 분석하여 교육 수강 직후 실무 프로세스에 직접 도입 가능한 핵심 모듈로 과정을 설계하였다.`;
    case "startup":
      return `초기 비즈니스 모델 구축과 실무 검증 과정에서 실질적인 성과를 도출할 수 있도록 ${target}을 대상으로 한 ${topic} 교육을 설계하였다. 이론 중심의 강연을 탈피하고, 즉각적이고 가시적인 성과 검증이 가능한 사례 분석 및 실전 프로젝트 실습 위주로 운영하였다.`;
    default:
      return `${target}의 업무 생산성 및 학습 목적을 충족하기 위한 ${topic} 교육을 운영하였다. ${organization}과의 긴밀한 사전 협의를 거쳐 교육 참여자의 기기 숙련도와 활용 목적에 맞춰 맞춤형 교육 자료를 준비하였다.`;
  }
}

function buildContentNarrative(lecture: Lecture): string {
  const cleanLines = lecture.content
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•\d.]+\s*/, ""))
    .filter(Boolean);

  if (cleanLines.length === 0) {
    return `교육은 ${getLectureTopic(lecture)}에 관한 기초 개념 설명과 주요 도구 소개로 시작하여 개별 실습을 거쳐 질의응답 및 개별 피드백 순으로 차례대로 조율하며 진행되었다.`;
  }

  const [firstStep, ...subsequentSteps] = cleanLines;
  if (subsequentSteps.length > 0) {
    return `교육은 ${firstStep} 과정에 대한 실습으로 시작하였다. 참여자들은 직접 도구와 데이터를 다루며 활용법을 학습하였다. 이후 ${subsequentSteps.join(", ")} 과정을 단계별로 연계 실습하며 배운 기능의 이해도를 차근차근 다져나갔다.`;
  }

  return `교육은 ${firstStep} 중심의 개별 맞춤형 실습으로 시작하여 참여자가 막힘없이 핵심 프로세스를 이해하고 실무에 직접 활용해볼 수 있도록 진행되었다.`;
}

function buildParticipantSection(lecture: Lecture): string {
  const parts: string[] = [];
  const reaction = lecture.participantReaction?.trim();
  const question = lecture.memorableQuestion?.trim();

  if (reaction) {
    parts.push(`교육 진행 과정에서 관찰된 참여자들의 반응과 분위기는 매우 고무적이었다. 구체적으로는 ${reaction}`);
  } else {
    parts.push("참여자들은 교육 초반 낯선 기능에 대한 기기 조작을 일부 낯설어하였으나, 강사 피드백과 실습이 반복됨에 따라 높은 주의집중 상태를 유지하며 적극적인 실습 의지를 보여주었다.");
  }

  if (question) {
    parts.push(`특히 병원 예약 등 실무 활용 단계에서 한 참여자가 "${question}"와 같은 질문을 제기하였으며, 이는 교육 내용을 실무 및 실생활과 연계하려는 적극적인 학습 동기를 보여주었다.`);
  }


  return parts.join("\n\n");
}

function buildSummarySection(lecture: Lecture): string {
  const parts: string[] = [];
  const date = formatDate(lecture.date);
  const reflection = lecture.reflection?.trim() || lecture.afterMemo?.trim();

  parts.push(`${date}에 진행된 본 교육은 참여자들의 고른 참여 속에서 준비된 과정을 질서 있게 소화하였다. 실습 위주의 진행과 개별 피드백 시간이 적절하게 배분되어 대다수 인원이 주요 핵심 단계를 수강 시간 내 성공적으로 실행하는 정량적 성과를 거두었다.`);
  parts.push(reflection || "한계점으로는 수강생 간 개인별 이해 속도 및 기기 활용 수준의 차이로 인해 진행 속도의 유연한 조율이 수시로 요구되었으며, 차기 교육 구성 시 난이도별 분반 편성을 검토하거나 보조 강사 인력이 배치된다면 더욱 완성도 높은 수업이 될 것으로 예상된다.");

  return parts.join("\n\n");
}

function buildNextPlan(lecture: Lecture, orgType: ReturnType<typeof detectOrgType>): string {
  switch (orgType) {
    case "welfare":
      return "본 교육의 성과와 현장 분석을 토대로 향후 계획 및 후속 조치를 제안한다.\n\n1. 실생활 중심의 1:1 집중 보완 지도 및 소그룹형 심화 과정 개설\n2. 교육 내용을 정리하여 기기 조작법을 도식화한 시니어 맞춤형 큰 글씨 가이드 배포\n3. 지속적인 질의응답 및 보완 실습을 돕는 봉사자 및 멘토 프로그램 연계";
    case "teacher_training":
      return "연수 내용의 교실 현장 연계성을 향상하고 지속적인 교육과정 연계를 이끌기 위한 제언을 제시한다.\n\n1. 교과별 실제 수업 모델 설계 워크숍 및 보완 심화 연수 개설\n2. 수업 진행에 활용 가능한 교수학습 과정안 설계 샘플 및 템플릿 배포\n3. 교사 학습공동체 연계를 통한 지속적인 실천 및 온·오프라인 피드백 창구 제공";
    case "school":
      return "학생들의 지속적인 동기 유발과 실무 지식 연계를 이끌기 위해 다음과 같은 프로그램을 제안한다.\n\n1. 개별 포트폴리오를 작성하는 성과 창출형 중장기 프로젝트 과정 마련\n2. 학생 스스로 막힘없이 실습을 따라 할 수 있는 자율형 보조 학습 카드 배포\n3. 결과 공유회 및 피드백 데이 개최를 통한 동료 학습 성과 공유 유도";
    case "public":
      return "업무 프로세스 상의 완벽한 적용과 업무 효율성 배가를 위해 다음과 같은 후속 지원을 제안한다.\n\n1. 세부 직무 맞춤형 실전 시나리오 중심의 고난도 과정 마련\n2. 즉시 실무에 복사해 쓸 수 있는 공공 표준 템플릿 및 업무 자동화 서식지 배포\n3. 기술적 애로사항을 접수하고 신속히 대응할 수 있는 Q&A 메일링 서비스 지원";
    default:
      return "본 교육 과정의 정성·정량적 효과를 지속하기 위해 다음과 같은 조치를 제언한다.\n\n1. 난이도별 분할 학습 경로 설계 및 심화 과정 순차적 개설\n2. 모니터링 만족도 평가를 기반으로 한 추가 교육 필요 영역 식별\n3. 수시 질문과 기술적 피드백 제공이 가능한 소통 채널 운영";
  }
}

export function generateReport(lecture: Lecture): string {
  const date = formatDate(lecture.date);
  const orgType = detectOrgType(lecture.organization);
  const lectureTopic = getLectureTopic(lecture);

  return `# 교육 결과보고서

---

## 1. 교육 개요

| 항목 | 내용 |
|------|------|
| 기관명 | ${lecture.organization} |
| 교육명 | ${lecture.title} |
| 교육일자 | ${date} |
| 교육대상 | ${lecture.target} |
| 참여인원 | ${lecture.participants}명 |
| 교육장소 | ${lecture.location} |
| 교육시간 | ${lecture.duration} |
| 교육주제 | ${lectureTopic} |

---

## 2. 교육 추진 배경 및 목적

${buildBackground(lecture, orgType)}

---

## 3. 교육 진행 내용

${buildContentNarrative(lecture)}

---

## 4. 참여자 반응 및 교육 성과

${buildParticipantSection(lecture)}

---

## 5. 종합 평가

${buildSummarySection(lecture)}

---

## 6. 향후 계획 및 제언

${buildNextPlan(lecture, orgType)}
`;
}

function buildSeoTitle(lecture: Lecture, orgType: ReturnType<typeof detectOrgType>): string {
  const topic = getLectureTopic(lecture);
  const { title, target, organization } = lecture;

  switch (orgType) {
    case "welfare":
      return `어르신들도 스마트하게 건강 관리할 수 있을까? ${organization} 디지털 건강관리 실습 후기`;
    case "teacher_training":
      return `교육과정에 바로 적용하는 에듀테크 수업 모델, ${organization} ${title} 연수 후기`;
    case "school":
      return `수동적인 수업은 그만! ${target} 참여를 2배 끌어올린 ${organization} ${topic} 강의 이야기`;
    case "startup":
      return `비즈니스 생존을 위한 실무 마케팅 전략, ${organization} ${title} 실전 코칭 후기`;
    case "public":
      return `행정 업무 효율을 2배 높이는 비결, ${organization} ${topic} 직무 연수 강의 현장`;
    default:
      return `${target}과 함께 달린 하루, ${organization} ${title} 교육 실전 후기`;
  }
}

function buildIntro(lecture: Lecture, orgType: ReturnType<typeof detectOrgType>): string {
  const topic = getLectureTopic(lecture);
  const { organization, target, location } = lecture;

  const openings: Record<string, string> = {
    welfare: `${organization}에서 ${target} 분들과 함께 ${topic} 수업을 열었다. 사전에 참여자 대상 정보를 검토할 때, 스마트폰 화면 글씨 조작이나 앱 설치 단계를 처음 마주하실 때 겪으실 생경함이 걱정되었다. 일상생활과 직결되는 아주 단순하고 명쾌한 프로세스로 강의의 초점을 다시 설정하고 실습실로 들어섰다.`,
    teacher_training: `${organization}의 지원 아래 교원 분들을 대상으로 한 ${topic} 연수를 열었다. 교단에서 수많은 학생을 지도하고 계시는 배테랑 교원들이 주 수강생이었기에, 단편적인 사용법 나열식 수업을 하면 설득력이 떨어질 것이 뻔했다. 학교 수업 현장과 실제 행정에서 마주하는 병목을 어떻게 해결할 것인지 예제를 다듬어 강단에 섰다.`,
    school: `${organization}의 의뢰로 ${target} 대상 ${topic} 교실을 진행했다. 주입식 학습에 길들여진 참여자들을 어떻게 하면 적극적으로 컴퓨터 화면 앞으로 끌어당겨 참여하게 만들 것인지에 대한 설계가 가장 핵심 고민이었다. 손으로 직접 만지고 즉시 피드백을 확인하는 구조로 첫 판을 짰다.`,
    startup: `${organization} 예비 창업자 및 대표들과 함께 ${topic} 실전 특강을 설계했다. 대표들의 시시각각 흐르는 생존의 시간 앞에서 원론적인 개념만 읊다가는 바로 시선을 뺏길 수밖에 없다. 당장 마케팅 비용을 아끼고 실적을 검증할 수 있는 맞춤형 사례로 가득 채워 현장으로 향했다.`,
    default: `${organization} 교육장에서 ${target} 대상의 ${topic} 강의를 올렸다. ${location}에 일찍 도착해 빔프로젝트와 실습 기기를 대조해 보며, 어떻게 해야 참여 주체들이 낯선 주제를 어색하지 않게 체득해 갈 수 있을지 생각했다.`,
  };

  return openings[orgType] ?? openings.default;
}

function buildFieldStory(lecture: Lecture): string {
  if (lecture.participantReaction?.trim()) {
    return `강의 시작 직후 수강생들이 기기에 집중하는 분위기를 유심히 체크했다. 처음에는 화면을 누르는 법이나 초기 설정에서 손끝이 어색해 보여 긴장감이 흘렀지만, 한 단계씩 따라 할 수 있게 찬찬히 보조하자 강의실에 점차 생기가 돌았다. 참여자들이 스스로 실습 화면을 성공적으로 넘기며 자신감을 드러냈다.`;
  }
  return "처음 실습을 위해 첫 예제를 띄웠을 때 강의실 내부에는 묘한 적막감이 감돌았다. 새로운 프로세스를 손수 실행해야 하는 첫 단계에서 다들 조심스러워하는 기색이 역력했다. 하지만 쉬운 부분부터 화면을 짚어가며 진행하자, 여기저기서 고개를 끄덕이며 점차 활발한 실습이 펼쳐졌다.";
}

function buildBestActivity(lecture: Lecture): string {
  const cleanLines = lecture.content
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•\d.]+\s*/, ""))
    .filter(Boolean);
  const mainPoint = cleanLines.length > 0 ? cleanLines[0] : getLectureTopic(lecture);

  return `가장 뜨거운 관심이 쏠렸던 부분은 역시 실제 활용 사례와 연동된 '${mainPoint}' 실습 시간이었다. 단순 시청에서 벗어나 손가락으로 옵션을 조작하고 입력값을 직접 입력해 나가면서 강의실 데시벨이 부쩍 커졌다. 스스로 실행 결과를 눈앞에 확인하자 여기저기서 질문의 수위도 함께 깊어졌다.`;
}

function buildMemorable(lecture: Lecture): string {
  const question = lecture.memorableQuestion?.trim();
  const afterMemo = lecture.afterMemo?.trim();

  if (question || afterMemo) {
    const parts: string[] = [];
    if (question) {
      parts.push(`중간에 한 참여자가 손을 번쩍 들며 "${question}"라고 날카로운 의문을 던진 순간이 백미였다. 이 돌발 질문 하나 덕택에 다른 참여자들도 고개를 끄덕이며 수업 몰입도가 최고조에 달했다.`);
    }
    if (afterMemo) {
      parts.push(`강의 후 돌아보니 다음 수업을 위해 남겨둘 지점이 분명했다. ${afterMemo}`);
    }
    return parts.join("\n\n");
  }

  return "실습 도중 수강생 중 한 분이 \"오늘 배운 방식을 실제 업무와 생활에 그대로 접목하면 시간 낭비가 획기적으로 줄겠다\"며 환한 미소와 함께 옆 동료와 노하우를 주고받으시던 장면이 가장 긴 여운으로 남는다.";
}

function buildClosing(lecture: Lecture): string {
  const reflection = lecture.reflection?.trim();
  if (reflection) {
    return `${reflection}\n\n이번 교육 여정을 매듭지으며 강단에서의 강의 구성을 한층 더 참여 주체 중심으로 설계해야겠다는 과제를 얻었다. 다음 교육 때는 현장의 목소리를 모아 실생활 적용 포인트를 더욱 정밀하게 개량하여 선보이고자 한다.`;
  }
  return "이번 강의를 마치고 강의실 문을 나서면서 강사로서 중요한 인사이트를 담았다. 현장에서 직접 부딪치며 확인한 참여자들의 표정과 반응 속에서 다음 과정에 어떠한 실질적인 개선점을 덧붙여야 할지 설계 방향이 뚜렷해졌다. 차기 교육에서는 실습 보완 시간을 확보하여 더욱 높은 만족감을 전달할 계획이다.";
}

function buildHashtags(lecture: Lecture): string {
  const tags: string[] = [];

  [makeHashtag(getLectureTopic(lecture)), makeHashtag(lecture.title), makeHashtag(lecture.organization)]
    .filter((tag): tag is string => Boolean(tag))
    .forEach((tag) => tags.push(tag));

  tags.push("#강의후기", "#강사기록", "#교육후기", "#실습교육", "#디지털리터러시");

  const orgType = detectOrgType(lecture.organization);
  if (orgType === "welfare") {
    tags.push("#시니어교육", "#디지털격차해소", "#평생교육");
  } else if (orgType === "teacher_training" || orgType === "school") {
    tags.push("#교사연수", "#학교수업", "#에듀테크");
  } else if (orgType === "startup") {
    tags.push("#창업교육", "#비즈니스실무", "#마케팅강의");
  } else {
    tags.push("#직무교육", "#실무적용");
  }

  return Array.from(new Set(tags)).slice(0, 14).join(" ");
}

export function generateBlogDraft(lecture: Lecture): string {
  const orgType = detectOrgType(lecture.organization);

  return `# ${buildSeoTitle(lecture, orgType)}

---

# 도입
${buildIntro(lecture, orgType)}

---

# 교육 현장 이야기
[사진1 - 강의실 전체 실습 및 시작 전 전경]
${buildFieldStory(lecture)}

---

# 가장 반응이 좋았던 활동
[사진2 - 몰입해서 실습을 따라 하는 역동적인 장면]
${buildBestActivity(lecture)}

---

# 기억에 남는 순간
[사진3 - 참여자와 1:1로 소통하며 가이드 해주는 장면]
${buildMemorable(lecture)}

---

# 교육을 마치며
${buildClosing(lecture)}

---

# 해시태그
${buildHashtags(lecture)}
`;
}
