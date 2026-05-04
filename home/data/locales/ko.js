import { media } from "../shared/media.js";

export const koContent = {
    locale: "ko",
    brand: {
        title: "TIAN HAN",
        subtitle: "Animation / Media Art / Research"
    },
    ui: {
        languageLabel: "Language",
        locales: [
            { key: "zh", label: "中文" },
            { key: "ko", label: "한국어" }
        ],
        paperBadge: "Selected Papers",
        paperMetaLabel: "논문 / 발표 / 포럼",
        projectMetaLabel: "Project Details",
        projectLinkLabel: "페이지 열기",
        portraitCaption: "인물 사진 / 프로필 이미지 자리",
        thumbnailReadyTitle: "Thumbnail Ready",
        thumbnailReadyBody: "현재는 로컬 플레이스홀더 썸네일이 연결되어 있어 실제 이미지로 바로 교체할 수 있습니다.",
        moduleFriendlyTitle: "Module Friendly",
        moduleFriendlyBody: "프로젝트 데이터, 이미지 경로, 버튼 링크를 locale 데이터에서 계속 확장할 수 있습니다."
    },
    nav: [
        { href: "#about", label: "소개" },
        { href: "#timeline", label: "이력" },
        { href: "#papers", label: "논문" },
        { href: "#projects", label: "프로젝트" },
        { href: "#contact", label: "연락" }
    ],
    hero: {
        eyebrow: "Busan / Seoul / New Media Practice",
        title: "티앤한",
        subtitle: "田汉 / TIAN HAN",
        lead: "애니메이션 연구자이자 미디어아트 창작자, 그리고 콘텐츠 제작 실천가로서 도시 서사, 만화·애니메이션 이미지 연구, 몰입형 미디어 콘텐츠와 전시·박물관·공공공간의 시각 표현을 지속적으로 탐구하고 있습니다.",
        actions: [
            { href: "mailto:angel1993@naver.com", label: "이메일", kind: "button" },
            { href: "#projects", label: "프로젝트 보기", kind: "ghost" }
        ],
        stats: [
            { title: "Ph.D. in Design", body: "Pusan National University" },
            { title: "2015 - 2025", body: "학사부터 박사까지 애니메이션과 디자인 연구 지속" },
            { title: "中文 / 한국어 / English", body: "다국어 연구 및 콘텐츠 협업" }
        ],
        overview: [
            { title: "연구 주제", body: "한중 만화·애니메이션 비교, 도시재생, 몰입형 미디어아트, 뉴미디어 퍼포먼스." },
            { title: "실천 분야", body: "박물관 미디어 애니메이션, 전시 영상, 공원 플랫폼 콘텐츠 기획, 강의와 학술 글쓰기." },
            { title: "현재 활동", body: "미디어 영상 제작과 기술 연구에 참여하며 대학에서 애니메이션 관련 수업을 진행하고 있습니다." }
        ],
        portrait: {
            src: media.portraitHero,
            alt: "Portrait placeholder for TIAN HAN"
        },
        institution: {
            logo: media.pnuBadge,
            alt: "Pusan National University placeholder badge",
            label: "Academic Base",
            title: "Pusan National University",
            body: "부산대학교 애니메이션 학사, 석사, 디자인학 박사 배경."
        },
        gallery: [
            { src: media.profileStudio, alt: "Workspace placeholder", caption: "개인 사진, 작업 장면, 강연 사진 자리" },
            { src: media.researchShelf, alt: "Research shelf placeholder", caption: "논문, 출판물, 연구 자료 커버 자리" }
        ]
    },
    sections: {
        about: {
            label: "About",
            title: "애니메이션에서 출발해 연구, 전시, 디지털 콘텐츠 실천으로 확장한 작업",
            desc: "두 번째 버전에서는 개인 비주얼 영역, 독립 논문 섹션, 이중 언어 전환, 프로젝트 갤러리를 추가해 보다 완성도 높은 포트폴리오 구조로 정리했습니다."
        },
        timeline: {
            label: "Timeline",
            title: "학력과 경력의 흐름"
        },
        papers: {
            label: "Papers",
            title: "논문과 발표",
            desc: "대표 논문과 포럼 발표를 먼저 정리했습니다. 이후 PDF 링크, 저널 표지, 인용 형식 등을 더할 수 있습니다."
        },
        projects: {
            label: "Projects",
            title: "프로젝트 포트폴리오",
            desc: "프로젝트 영역은 썸네일과 정보 카드 중심의 갤러리 구조로 바꾸었습니다. 실제 이미지로 교체하면 바로 작품집처럼 사용할 수 있습니다."
        },
        contact: {
            label: "Contact",
            title: "연구, 전시, 콘텐츠 프로젝트 협업 제안"
        }
    },
    about: {
        intro: {
            title: "소개",
            body: "티앤한은 1993년 7월 17일생으로, 부산대학교 애니메이션 학사·석사 및 디자인학 박사 과정을 거쳤습니다. 한중 만화·애니메이션 이미지, 지역 서사 콘텐츠 디자인, 도시재생 맥락의 미디어아트, 공공공간을 위한 몰입형 영상 표현을 중심으로 연구와 실천을 이어가고 있습니다.",
            items: [
                { title: "작업 방식", body: "학술 연구 방법을 실제 프로젝트 제작으로 전환하며 논문, 수업, 미디어 제작을 연결합니다." },
                { title: "언어 배경", body: "중국어를 모국어로 사용하고 한국에서 오랜 기간 연구와 실무를 수행해 중한 이중언어 협업에 강점이 있습니다." }
            ]
        },
        facts: {
            title: "핵심 정보",
            items: [
                { title: "최종 학력", body: "부산대학교 디자인학 박사(애니메이션 방향)" },
                { title: "강의", body: "2025년부터 동명대학교 웹애니메이션 관련 전공에서 애니메이션 수업 진행." },
                { title: "자격", body: "한국어능력시험 182점(4급)." }
            ]
        },
        gallery: [
            { src: media.researchShelf, alt: "Research shelf placeholder", caption: "논문, 발표, 출판 이미지를 실제 자료로 교체 가능" },
            { src: media.pnuBadge, alt: "PNU badge placeholder", caption: "학교 및 학위 관련 시각 자료 자리" }
        ]
    },
    timeline: [
        { date: "2015.03 - 2019.03", title: "부산대학교 · 애니메이션 학사", body: "애니메이션 전공의 기초 훈련을 통해 드로잉, 서사, 영상, 시각 표현의 핵심 역량을 구축했습니다." },
        { date: "2019.09 - 2021.09", title: "부산대학교 · 애니메이션 석사", body: "창작 중심의 훈련에서 체계적인 연구 단계로 확장하며 한중 만화·애니메이션 비교 분석의 방향을 형성했습니다." },
        { date: "2021.09 - 2025.02", title: "부산대학교 · 디자인학 박사", body: "도시재생 맥락에서의 몰입형 미디어아트, 지역 서사, 공공문화공간 콘텐츠 표현을 집중적으로 연구했습니다." },
        { date: "2020.09 - 2023.02", title: "부산대학교 디자인학과 · 연구조교", body: "연구 보조 및 수업 지원 업무를 수행하며 학술 프로젝트 운영 경험을 쌓았습니다." },
        { date: "2024.02 - 현재", title: "미디어 제작 및 기술 연구", body: "미디어 영상 제작, 기술 연구, 디지털 콘텐츠 개발 프로젝트를 지속적으로 수행하고 있습니다." },
        { date: "2025.02 - 현재", title: "동명대학교 · 애니메이션 수업", body: "연구와 실무 경험을 교육 현장에 연결하며 학생들의 실천적 학습을 지원하고 있습니다." }
    ],
    papersFeature: {
        badge: "Selected Papers",
        title: "만화·애니메이션 이미지 연구에서 도시재생 미디어아트 연구로",
        body: "연구 흐름은 크게 세 갈래입니다. 한중 만화·애니메이션 이미지 비교, 뉴미디어 의식과 퍼포먼스의 민족 서사 분석, 도시재생 맥락의 몰입형 미디어 콘텐츠 연구입니다.",
        media: media.papersDesk,
        meta: [
            { title: "트랙 01", body: "한중 만화·애니메이션 비교" },
            { title: "트랙 02", body: "뉴미디어 퍼포먼스와 민족 서사" },
            { title: "트랙 03", body: "도시재생과 미디어아트 분석" }
        ]
    },
    papers: [
        { year: "2020.09", venue: "한국만화애니메이션학회 학술대회", title: "한중일 만화애니메이션에서의 귀괴 이미지 비교 분석", note: "학회 발표 / 이미지 비교 연구" },
        { year: "2021.03", venue: "Animation Research / 한국애니메이션학회", title: "한중일 만화애니메이션에서의 귀괴 이미지 의미 분석", note: "학술지 논문 / 시각문화 분석" },
        { year: "2021.08", venue: "석사 학위 논문", title: "한중일 만화애니메이션에서의 귀괴 이미지 의미 연구", note: "석사논문 / 애니메이션 연구" },
        { year: "2022.03", venue: "Animation Research / 한국애니메이션학회", title: "공공 프로젝트에서의 실감형 미디어 콘텐츠 사례 연구", note: "사례 연구 / 몰입형 미디어" },
        { year: "2022.04", venue: "한중일 국제포럼 춘계학술대회", title: "도시재생과 연계한 미디어 콘텐츠 분석", note: "포럼 발표 / 도시재생" },
        { year: "2023.02", venue: "AFCC 2023", title: "Chinese Nationalism Represented by New Media Art", note: "Conference paper / New media art" },
        { year: "2023.10", venue: "IAFCC 2023", title: "Reproduction of Chinese Nationalism in the 2022 Beijing Winter Olympics Opening Ceremony", note: "Conference presentation / Performance analysis" },
        { year: "2024.04", venue: "한국웹툰학회", title: "도시재생과 웹툰 미디어 공간 분석", note: "학회 발표 / 미디어 공간 연구" },
        { year: "2025.02", venue: "박사 학위 논문", title: "도시재생에서의 뉴미디어아트 적용 연구", note: "박사논문 / 도시 미디어아트" }
    ],
    projects: [
        { tone: "blue", tag: "2020 - 2024", title: "지역 스토리텔링 콘텐츠 디자인 인재양성", body: "지역 서사를 중심으로 한 콘텐츠 디자인 및 연구 지원 프로젝트에 참여했습니다.", media: media.projectBk21, details: ["Client: BK21", "Role: Research / Content Support", "Focus: Storytelling"], href: null },
        { tone: "pink", tag: "2021 - 2023", title: "Metaverse + AI 공원 플랫폼", body: "메타버스와 AI가 결합된 확장형 공원 플랫폼 개발 및 실증 프로젝트에 참여했습니다.", media: media.projectPark, details: ["Client: Busan IT Agency", "Role: Content Planning", "Focus: Spatial Platform"], href: null },
        { tone: "red", tag: "2022", title: "《새로운 매개들》 전시 영상", body: "부산현대미술관 관련 전시 프로젝트의 영상 제작과 콘텐츠 구현에 참여했습니다.", media: media.projectMuseum, details: ["Client: Museum Project", "Role: Video Production", "Focus: Exhibition Media"], href: null },
        { tone: "blue", tag: "2023", title: "박물관 및 기념관 미디어 영상", body: "박물관, 기념관, 공공문화공간을 위한 다양한 미디어 영상을 제작했습니다.", media: media.projectArchive, details: ["Client: Museum / Memorial", "Role: Media Production", "Focus: Cultural Narrative"], href: null },
        { tone: "pink", tag: "2024", title: "《이것은 부산이 아니다》 실천 영상", body: "전시 공간 안에서 도시 경험과 영상 개입을 다루는 실천 프로젝트입니다.", media: media.researchPerformance, details: ["Type: Exhibition Practice", "Role: Visual Direction", "Focus: Urban Experience"], href: null },
        { tone: "red", tag: "2024 - 2025", title: "박물관 미디어 애니메이션과 도서관 프로젝트", body: "울산박물관, 장백산박물관, 도서관 관련 미디어 애니메이션 프로젝트를 포함합니다.", media: media.projectLibrary, details: ["Client: Museum / Library", "Role: Animation Production", "Focus: Media Installation"], href: null }
    ],
    repoLinks: {
        title: "저장소 내부 페이지",
        items: [
            { href: "inno-things/", title: "Inno Things", body: "혁신 미디어 방향의 실험 페이지" },
            { href: "shanhaiart/", title: "Shanhai Art", body: "아트 웹 실험 페이지" },
            { href: "neu/voice-three-control/", title: "Voice Three Control", body: "인터랙티브 디지털 미디어 실험" }
        ]
    },
    contact: {
        intro: {
            title: "협업 방향",
            body: "이후에는 논문 PDF, CV 다운로드, 프로젝트 이미지 아카이브, 외부 링크 등을 더해 완전한 개인 포트폴리오 사이트로 확장할 수 있습니다.",
            items: [
                { title: "학술 협업", body: "애니메이션 연구, 시각문화, 한중 문화 비교, 도시 서사 및 공공공간 콘텐츠 연구." },
                { title: "프로젝트 협업", body: "전시 영상, 박물관 미디어 애니메이션, 도시 콘텐츠 디자인, 교육 및 커리큘럼 개발." }
            ]
        },
        info: {
            title: "연락 정보",
            items: [
                { label: "Name", value: "티앤한 / 田汉 / TIAN HAN" },
                { label: "Email", value: "angel1993@naver.com", href: "mailto:angel1993@naver.com" },
                { label: "Phone", value: "010-2576-9886", href: "tel:01025769886" },
                { label: "Base", value: "Korea / China collaborative context" }
            ]
        }
    },
    footer: [
        "TIAN HAN personal homepage, modular draft for direct GitHub hosting.",
        "Next: replace placeholders with real photos, paper covers, project stills, and a bilingual switch."
    ]
};
