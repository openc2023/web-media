/* home/data.js — 个人主页的唯一内容来源（中 / EN / 한）
   三种语言字段结构保持一致；三语共用的年份、链接与联系方式放在 shared。 */
window.ASCII_DATA = {
    shared: {
        email: "angel1993@naver.com",
        phone: "010-2576-9886",
        portfolio: "https://art717.notion.site/box",
        stats: [["09", "projects"], ["09", "papers"], ["02", "awards"], ["04", "books"]],
        papers: [
            { year: "2020.09", award: true },
            { year: "2021.03" },
            { year: "2021.08" },
            { year: "2022.03" },
            { year: "2022.04" },
            { year: "2023.02" },
            { year: "2023.10", award: true },
            { year: "2024.04" },
            { year: "2025.02" }
        ],
        links: [
            { href: "../works/top/", key: "top" },
            { href: "../works/shanhai/", key: "shanhai" },
            { href: "../works/ar-compare/", key: "arcompare" },
            { href: "../../neu/voice-three-control/", key: "voice" },
            { href: "https://art717.notion.site/box", key: "notion", external: true }
        ]
    },

    zh: {
        htmlLang: "zh-CN",
        name: "田漢",
        alias: "Tian Han · 티앤한",
        roles: ["动画博士", "媒体艺术家", "制作总监"],
        lead: "研究韩中漫画动画图像、沉浸式媒体艺术与城市再生。把论文里的方法带进美术馆、博物馆和公共空间的影像里。",
        base: "釜山 · 2015 至今",
        quote: "让不可见之物成为必然。",
        statLabels: { projects: "项目", papers: "论文", awards: "奖项", books: "出版" },
        hint: "移动 = 点亮　点击 = 涟漪　M = 切换渲染",
        sections: { about: "关于", path: "路径", papers: "论文", works: "作品", books: "出版", elsewhere: "别处", contact: "联系" },
        about: [
            "1993 年生于中国，2015 年起在韩国釜山学习与工作，至今十年。",
            "2025 年 2 月于釜山大学取得动画方向博士学位，论文研究城市再生中的新媒体艺术应用。",
            "现任 SUPERROOKIZ（슈퍼루키즈）制作总监，兼任东明大学网络漫画动画学科讲师。",
            "中文母语，韩语熟练，可做中韩双语的研究、翻译与内容协作。"
        ],
        skills: ["沉浸式媒体", "投影映射", "生成艺术", "动画研究", "互动装置"],
        path: [
            { date: "2025.02 —", title: "东明大学 · 兼任教授", body: "网络漫画动画学科，讲授动画课程" },
            { date: "2024.02 —", title: "SUPERROOKIZ · 制作总监", body: "媒体影像制作与技术研究" },
            { date: "2021.09 — 2025.02", title: "釜山大学 · 博士", body: "城市再生语境中的沉浸式媒体艺术" },
            { date: "2020.09 — 2023.02", title: "釜山大学设计学科 · 研究助教", body: "研究辅助、教学支撑、影像制作" },
            { date: "2019.09 — 2021.09", title: "釜山大学 · 硕士", body: "韩中日漫画动画中的九尾狐形象研究" },
            { date: "2015.03 — 2019.03", title: "釜山大学 · 动画学士", body: "绘画、叙事与影像的基础训练" }
        ],
        papers: [
            ["韩国漫画动画学会 学术大会", "韩中日漫画动画中的九尾狐形象比较分析"],
            ["Animation Research", "韩中日漫画动画中的九尾狐形象意义分析"],
            ["硕士论文", "韩中日漫画动画中的九尾狐形象意义研究"],
            ["Animation Research", "公共项目中的沉浸式媒体内容案例研究"],
            ["韩中日国际论坛 春季学术大会", "城市再生与媒体内容分析"],
            ["AFCC 2023", "Chinese Nationalism Represented by New Media Art"],
            ["IAFCC 2023", "2022 北京冬奥会开幕式新媒体表演中的中国民族主义再现"],
            ["韩国网络漫画学会", "城市再生与漫画媒体空间分析"],
            ["博士论文", "城市再生中的新媒体艺术应用研究"]
        ],
        awardLabel: "优秀发表奖",
        works: [
            { year: "2025", title: "中国长白山博物馆 · 华城中央图书馆", body: "媒体动画制作" },
            { year: "2024", title: "蔚山博物馆", body: "以漫画为基础的媒体艺术" },
            { year: "2024", title: "釜山现代美术馆", body: "影像制作 ——《这不是釜山：战术性实践》" },
            { year: "2023", title: "福泉博物馆 · 临时首都纪念馆", body: "媒体影像制作" },
            { year: "2022", title: "釜山现代美术馆", body: "新媒体影像 ——《新的媒介们》釜山媒体艺术的起点与谱系" },
            { year: "2021—23", title: "元宇宙 + AI 公园平台", body: "扩展型公园平台的内容策划与实证" },
            { year: "2020—24", title: "BK21 地域故事内容人才培养", body: "地方叙事内容设计与研究支持" }
        ],
        books: [
            { year: "2024", title: "《照明店》姜草 · 中文版", body: "韩译中" },
            { year: "2022·23", title: "地域故事丛书 1·2", body: "章节作者 · 釜山大学出版" },
            { year: "2020", title: "1951，少年漫画列传", body: "协助制作" },
            { year: "2020", title: "漫画看国债补偿运动 1907 大邱", body: "协助制作" }
        ],
        links: {
            top: ["TOP", "《童趣里的暴力》图像识别 AR"],
            shanhai: ["山海", "水墨与声音的网页作品"],
            arcompare: ["WebAR 对比", "MindAR、8th Wall 与 Zappar 路线实验"],
            voice: ["Voice Three Control", "声音驱动的三维交互实验 · NEU"],
            notion: ["作品集", "art717.notion.site/box"]
        },
        contact: { email: "邮箱", phone: "电话", base: "所在", baseValue: "釜山，韩国", org: "机构", orgValue: "SUPERROOKIZ · 东明大学" },
        prompt: {
            placeholder: "输入 help",
            help: "可用命令：about path papers works books elsewhere contact · zh en ko · light dark · dither halftone ascii braille · clear",
            unknown: "找不到命令：",
            lang: "语言已切换",
            theme: "主题已切换"
        },
        footer: "© 2026 田漢 · 文字即像素"
    },

    en: {
        htmlLang: "en",
        name: "田漢",
        alias: "Tian Han · 티앤한",
        roles: ["Animation PhD", "Media Artist", "Production Director"],
        lead: "Researching Korean and Chinese comics and animation imagery, immersive media art, and urban regeneration, and carrying those methods into moving images for museums, galleries and public space.",
        base: "Busan · since 2015",
        quote: "Making the invisible feel inevitable.",
        statLabels: { projects: "projects", papers: "papers", awards: "awards", books: "books" },
        hint: "move = light　click = ripple　M = next render",
        sections: { about: "About", path: "Path", papers: "Papers", works: "Works", books: "Books", elsewhere: "Elsewhere", contact: "Contact" },
        about: [
            "Born in China in 1993; studying and working in Busan, South Korea since 2015.",
            "PhD in Animation, Pusan National University (Feb 2025), with a thesis on new media art in urban regeneration.",
            "Production Director at SUPERROOKIZ and Adjunct Professor of Webtoon & Animation at Dongmyeong University.",
            "Chinese (native) and Korean (proficient): research, translation and content work across both languages."
        ],
        skills: ["Immersive media", "Projection mapping", "Generative art", "Animation research", "Interactive installation"],
        path: [
            { date: "2025.02 —", title: "Dongmyeong Univ. · Adjunct Professor", body: "Teaching animation, Webtoon & Animation Dept." },
            { date: "2024.02 —", title: "SUPERROOKIZ · Production Director", body: "Media production and technology research" },
            { date: "2021.09 — 2025.02", title: "Pusan National Univ. · PhD", body: "Immersive media art in urban regeneration" },
            { date: "2020.09 — 2023.02", title: "PNU Design · Research Assistant", body: "Research, teaching support, video production" },
            { date: "2019.09 — 2021.09", title: "Pusan National Univ. · MA", body: "The nine-tailed fox in K/C/J comics and animation" },
            { date: "2015.03 — 2019.03", title: "Pusan National Univ. · BA Animation", body: "Drawing, narrative and moving image" }
        ],
        papers: [
            ["Korean Society of Cartoon & Animation", "Comparative Analysis of Nine-Tailed Fox Imagery in K/C/J Comics and Animation"],
            ["Animation Research", "Meaning of Nine-Tailed Fox Imagery in K/C/J Comics and Animation"],
            ["MA thesis", "A Study on the Meaning of Nine-Tailed Fox Imagery in K/C/J Comics and Animation"],
            ["Animation Research", "Case Studies of Immersive Media Content in Public Projects"],
            ["K/C/J International Forum, Spring", "Urban Regeneration and Media Content Analysis"],
            ["AFCC 2023", "Chinese Nationalism Represented by New Media Art"],
            ["IAFCC 2023", "Reproduction of Chinese Nationalism in the 2022 Beijing Winter Olympics Opening Ceremony"],
            ["Korean Webtoon Society", "Urban Regeneration and Comics Media Space Analysis"],
            ["PhD thesis", "Application of New Media Art in Urban Regeneration"]
        ],
        awardLabel: "Outstanding Presentation Award",
        works: [
            { year: "2025", title: "Changbaishan Museum · Hwaseong Central Library", body: "Media animation" },
            { year: "2024", title: "Ulsan Museum", body: "Comics-based media art" },
            { year: "2024", title: "Busan Museum of Contemporary Art", body: "Film — This Is Not Busan: Tactical Practice" },
            { year: "2023", title: "Bokcheon Museum · Provisional Capital Memorial", body: "Media films" },
            { year: "2022", title: "Busan Museum of Contemporary Art", body: "New media film — origins and genealogy of Busan media art" },
            { year: "2021—23", title: "Metaverse + AI Park Platform", body: "Content planning and field testing" },
            { year: "2020—24", title: "BK21 Local Storytelling Content", body: "Narrative content design and research support" }
        ],
        books: [
            { year: "2024", title: "The Light Shop, Kang Full · Chinese edition", body: "Korean → Chinese translation" },
            { year: "2022·23", title: "Local Storytelling Series 1 & 2", body: "Chapter author · PNU Press" },
            { year: "2020", title: "1951, Boys' Comics Chronicle", body: "Assistant" },
            { year: "2020", title: "Comics: Debt Repayment Movement, Daegu 1907", body: "Assistant" }
        ],
        links: {
            top: ["TOP", "Image-tracking AR, Violence in Childlike Play"],
            shanhai: ["Shanhai", "Ink and sound on the web"],
            arcompare: ["WebAR compare", "MindAR, 8th Wall and Zappar tests"],
            voice: ["Voice Three Control", "Voice-driven 3D interaction · NEU"],
            notion: ["Portfolio", "art717.notion.site/box"]
        },
        contact: { email: "Email", phone: "Phone", base: "Base", baseValue: "Busan, South Korea", org: "With", orgValue: "SUPERROOKIZ · Dongmyeong Univ." },
        prompt: {
            placeholder: "type help",
            help: "commands: about path papers works books elsewhere contact · zh en ko · light dark · dither halftone ascii braille · clear",
            unknown: "command not found: ",
            lang: "language switched",
            theme: "theme switched"
        },
        footer: "© 2026 Tian Han · text is the pixel"
    },

    ko: {
        htmlLang: "ko",
        name: "田漢",
        alias: "티앤한 · Tian Han",
        roles: ["애니메이션 박사", "미디어 아티스트", "제작감독"],
        lead: "한중 만화·애니메이션 이미지, 몰입형 미디어아트, 도시재생을 연구하고, 그 방법을 미술관·박물관·공공공간의 영상으로 옮깁니다.",
        base: "부산 · 2015년부터",
        quote: "보이지 않는 것을 필연으로 만든다.",
        statLabels: { projects: "프로젝트", papers: "논문", awards: "수상", books: "출판" },
        hint: "이동 = 점등　클릭 = 물결　M = 렌더 전환",
        sections: { about: "소개", path: "경로", papers: "논문", works: "작업", books: "출판", elsewhere: "다른 곳", contact: "연락" },
        about: [
            "1993년 중국 출생. 2015년부터 부산에서 공부하고 일하고 있습니다.",
            "2025년 2월 부산대학교 애니메이션 박사. 도시재생에서의 뉴미디어아트 적용을 연구했습니다.",
            "슈퍼루키즈(SUPERROOKIZ) 제작감독, 동명대학교 웹툰애니메이션학과 겸임교수.",
            "중국어(모국어)와 한국어(능숙)로 연구·번역·콘텐츠 협업이 가능합니다."
        ],
        skills: ["몰입형 미디어", "프로젝션 매핑", "제너러티브 아트", "애니메이션 연구", "인터랙티브 설치"],
        path: [
            { date: "2025.02 —", title: "동명대학교 · 겸임교수", body: "웹툰애니메이션학과 애니메이션 수업" },
            { date: "2024.02 —", title: "슈퍼루키즈 · 제작감독", body: "미디어 영상 제작과 기술 연구" },
            { date: "2021.09 — 2025.02", title: "부산대학교 · 박사", body: "도시재생 맥락의 몰입형 미디어아트" },
            { date: "2020.09 — 2023.02", title: "부산대학교 디자인학과 · 연구조교", body: "연구 보조, 수업 지원, 영상 제작" },
            { date: "2019.09 — 2021.09", title: "부산대학교 · 석사", body: "한중일 만화·애니메이션의 구미호 이미지 연구" },
            { date: "2015.03 — 2019.03", title: "부산대학교 · 애니메이션 학사", body: "드로잉, 서사, 영상의 기초" }
        ],
        papers: [
            ["한국만화애니메이션학회 학술대회", "한중일 만화애니메이션에서의 구미호 이미지 비교 분석"],
            ["Animation Research", "한중일 만화애니메이션에서의 구미호 이미지 의미 분석"],
            ["석사 학위 논문", "한중일 만화애니메이션에서의 구미호 이미지 의미 연구"],
            ["Animation Research", "공공 프로젝트에서의 실감형 미디어 콘텐츠 사례 연구"],
            ["한중일 국제포럼 춘계학술대회", "도시재생과 연계한 미디어 콘텐츠 분석"],
            ["AFCC 2023", "Chinese Nationalism Represented by New Media Art"],
            ["IAFCC 2023", "2022 베이징 동계올림픽 개막식 뉴미디어 공연의 중국 민족주의 재현"],
            ["한국웹툰학회", "도시재생과 웹툰 미디어 공간 분석"],
            ["박사 학위 논문", "도시재생에서의 뉴미디어아트 적용 연구"]
        ],
        awardLabel: "우수발표상",
        works: [
            { year: "2025", title: "중국 장백산 박물관 · 화성중앙도서관", body: "미디어 애니메이션 제작" },
            { year: "2024", title: "울산박물관", body: "만화 기반 미디어아트" },
            { year: "2024", title: "부산현대미술관", body: "영상 제작 — 《이것은 부산이 아니다: 전술적 실천》" },
            { year: "2023", title: "복천박물관 · 임시수도기념관", body: "미디어 영상 제작" },
            { year: "2022", title: "부산현대미술관", body: "뉴미디어 영상 — 《새로운 매개들》 부산 미디어아트의 시작과 계보" },
            { year: "2021—23", title: "메타버스 + AI 공원 플랫폼", body: "확장형 공원 플랫폼 콘텐츠 기획과 실증" },
            { year: "2020—24", title: "BK21 지역 스토리텔링 콘텐츠", body: "지역 서사 콘텐츠 디자인과 연구 지원" }
        ],
        books: [
            { year: "2024", title: "《조명가게》 강풀 · 중국어판", body: "한국어 → 중국어 번역" },
            { year: "2022·23", title: "지역 스토리텔링 총서 1·2", body: "장 저자 · 부산대학교 출판" },
            { year: "2020", title: "1951, 소년만화열전", body: "어시스턴트" },
            { year: "2020", title: "만화로 보는 국채보상운동 1907 대구!", body: "어시스턴트" }
        ],
        links: {
            top: ["TOP", "《동심 속의 폭력》 이미지 인식 AR"],
            shanhai: ["산해", "수묵과 소리의 웹 작품"],
            arcompare: ["WebAR 비교", "MindAR, 8th Wall, Zappar 실험"],
            voice: ["Voice Three Control", "목소리로 움직이는 3D 인터랙션 · NEU"],
            notion: ["포트폴리오", "art717.notion.site/box"]
        },
        contact: { email: "이메일", phone: "전화", base: "소재지", baseValue: "부산, 대한민국", org: "소속", orgValue: "슈퍼루키즈 · 동명대학교" },
        prompt: {
            placeholder: "help 입력",
            help: "명령어: about path papers works books elsewhere contact · zh en ko · light dark · dither halftone ascii braille · clear",
            unknown: "명령어를 찾을 수 없음: ",
            lang: "언어 변경됨",
            theme: "테마 변경됨"
        },
        footer: "© 2026 티앤한 · 글자가 곧 픽셀"
    }
};
