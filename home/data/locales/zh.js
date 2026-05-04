import { media } from "../shared/media.js";

export const zhContent = {
    locale: "zh",
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
        paperMetaLabel: "发表 / 论文 / 论坛",
        projectMetaLabel: "Project Details",
        projectLinkLabel: "查看相关页面",
        portraitCaption: "头像 / 个人照片占位",
        thumbnailReadyTitle: "Thumbnail Ready",
        thumbnailReadyBody: "占位缩略图已经接入，后续只需要替换本地资源。",
        moduleFriendlyTitle: "Module Friendly",
        moduleFriendlyBody: "项目数据、图像路径和按钮链接都可以在 locale 数据里继续增加。"
    },
    nav: [
        { href: "#about", label: "简介" },
        { href: "#timeline", label: "经历" },
        { href: "#papers", label: "论文" },
        { href: "#projects", label: "项目" },
        { href: "#contact", label: "联系" }
    ],
    hero: {
        eyebrow: "Busan / Seoul / New Media Practice",
        title: "田汉",
        subtitle: "티앤한 / TIAN HAN",
        lead: "动画研究者、媒体艺术创作者与内容制作实践者，长期关注城市叙事、漫画动画图像研究、沉浸式媒体内容，以及面向展览、博物馆与公共空间的视觉表达。",
        actions: [
            { href: "mailto:angel1993@naver.com", label: "联系邮箱", kind: "button" },
            { href: "#projects", label: "查看作品集", kind: "ghost" }
        ],
        stats: [
            { title: "Ph.D. in Design", body: "Pusan National University" },
            { title: "2015 - 2025", body: "本硕博持续深耕动画与设计研究" },
            { title: "中文 / 한국어 / English", body: "跨语种研究与内容协作" }
        ],
        overview: [
            { title: "研究主题", body: "韩中漫画动画比较、城市再生、沉浸式媒体艺术与新媒体表演。" },
            { title: "实践方向", body: "博物馆媒体动画、展览影像、公园平台内容设计、课程教学与学术写作。" },
            { title: "当前状态", body: "参与媒体视频制作与技术研究，并在大学开展动画相关课程教学。" }
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
            body: "釜山大学动画学士、硕士、设计博士背景。"
        },
        gallery: [
            { src: media.profileStudio, alt: "Workspace placeholder", caption: "个人照 / 工作照 / 讲座照可直接替换到这里" },
            { src: media.researchShelf, alt: "Research shelf placeholder", caption: "研究、论文、出版物相关封面占位" }
        ]
    },
    sections: {
        about: {
            label: "About",
            title: "以动画为起点，延伸到研究、展览与数字内容实践",
            desc: "第二版开始把首页整理成更接近个人作品站的结构：加入个人视觉区、独立论文页、双语切换和项目画廊。"
        },
        timeline: {
            label: "Timeline",
            title: "教育与职业路径"
        },
        papers: {
            label: "Papers",
            title: "论文与发表",
            desc: "先整理一版代表性论文与论坛发表，后续可以继续补 DOI、PDF 链接、期刊封面和引用格式。"
        },
        projects: {
            label: "Projects",
            title: "项目作品集",
            desc: "项目区已经改成缩略图 + 信息卡的作品集形式，后面替换真实缩略图就能直接上线。"
        },
        contact: {
            label: "Contact",
            title: "如果你想一起做研究、展览或内容项目"
        }
    },
    about: {
        intro: {
            title: "个人简介",
            body: "田汉，1993 年 7 月 17 日生。拥有釜山大学动画学士、硕士与设计博士背景，研究与实践围绕韩中漫画动画图像、地域叙事内容设计、城市再生语境中的媒体艺术，以及面向公共空间的沉浸式影像表达展开。",
            items: [
                { title: "工作方式", body: "把学术研究方法转化为实际项目输出，在论文、课程与媒体制作之间建立连接。" },
                { title: "语言背景", body: "中文母语，长期在韩国学习与工作，可进行中韩双语内容协作。" }
            ]
        },
        facts: {
            title: "关键信息",
            items: [
                { title: "最高学历", body: "釜山大学 设计学博士（动画方向）" },
                { title: "教学", body: "2025 年起在东明大学网页动画相关专业讲授动画课程。" },
                { title: "资格", body: "韩国语能力考试 182 分（4 级）。" }
            ]
        },
        gallery: [
            { src: media.researchShelf, alt: "Research shelf placeholder", caption: "论文、讲座、发表可以在这里替换为真实封面或照片" },
            { src: media.pnuBadge, alt: "PNU badge placeholder", caption: "学校、学位或博士阶段标识位" }
        ]
    },
    timeline: [
        { date: "2015.03 - 2019.03", title: "釜山大学 · 动画学士", body: "完成动画专业基础训练，建立绘画、叙事、影像与视觉表达的核心能力。" },
        { date: "2019.09 - 2021.09", title: "釜山大学 · 动画硕士", body: "从创作训练进一步转入系统研究，形成韩中漫画动画比较分析的学术方向。" },
        { date: "2021.09 - 2025.02", title: "釜山大学 · 设计博士", body: "聚焦城市再生中的沉浸式媒体艺术、地方叙事与公共文化空间内容表达。" },
        { date: "2020.09 - 2023.02", title: "釜山大学设计学科 · 研究助教", body: "参与研究辅助与教学支撑工作，积累学术项目组织和协作经验。" },
        { date: "2024.02 - 至今", title: "媒体制作与技术研究", body: "持续参与媒体视频制作、技术研究与数字内容开发。" },
        { date: "2025.02 - 至今", title: "东明大学 · 动画课程教学", body: "将研究训练与实际制作经验带入教学现场，连接学生学习与产业实践。" }
    ],
    papersFeature: {
        badge: "Selected Papers",
        title: "从漫画动画图像到城市再生中的媒体艺术",
        body: "研究路径大致分成三条线：韩中漫画动画中的鬼怪图像比较、新媒体仪式与表演中的民族叙事，以及城市再生语境中的沉浸式媒体内容。",
        media: media.papersDesk,
        meta: [
            { title: "方向 01", body: "韩中漫画动画比较研究" },
            { title: "方向 02", body: "新媒体表演与民族叙事" },
            { title: "方向 03", body: "城市再生与媒体艺术分析" }
        ]
    },
    papers: [
        { year: "2020.09", venue: "韩国漫画动画学会 学术大会", title: "韩中日漫画动画中的鬼怪图像比较分析", note: "学会发表 / 图像比较研究" },
        { year: "2021.03", venue: "Animation Research / 韩国动画学会", title: "韩中日漫画动画中的鬼怪图像意义分析", note: "期刊论文 / 视觉文化分析" },
        { year: "2021.08", venue: "硕士毕业论文", title: "韩中日漫画动画中的鬼怪图像意义研究", note: "硕士论文 / 动画研究" },
        { year: "2022.03", venue: "Animation Research / 韩国动画学会", title: "公共项目中的沉浸式媒体内容案例研究", note: "案例研究 / 沉浸式媒体" },
        { year: "2022.04", venue: "韩中日国际论坛春季学术大会", title: "城市再生与媒体内容分析：以釜山民主公园项目为中心", note: "论坛发表 / 城市再生" },
        { year: "2023.02", venue: "AFCC 2023", title: "Chinese Nationalism Represented by New Media Art", note: "Conference paper / New media art" },
        { year: "2023.10", venue: "IAFCC 2023", title: "Reproduction of Chinese Nationalism in the 2022 Beijing Winter Olympics Opening Ceremony", note: "Conference presentation / Performance analysis" },
        { year: "2024.04", venue: "韩国Webtoon学会", title: "城市再生与漫画媒体空间分析：以釜山影岛蓬莱山为例", note: "学会发表 / 媒体空间研究" },
        { year: "2025.02", venue: "博士论文", title: "城市再生中的新媒体艺术应用研究：以釜山影岛媒体园为中心", note: "博士论文 / 城市媒体艺术" }
    ],
    projects: [
        { tone: "blue", tag: "2020 - 2024", title: "地域叙事内容设计人才培养", body: "参与以地方叙事为核心的内容设计与研究支持，服务于釜山大学 BK21 项目。", media: media.projectBk21, details: ["Client: BK21", "Role: Research / Content Support", "Focus: Storytelling"], href: null },
        { tone: "pink", tag: "2021 - 2023", title: "Metaverse + AI 公园平台", body: "参与元宇宙与 AI 融合的扩展型公园平台技术开发与实证项目。", media: media.projectPark, details: ["Client: Busan IT Agency", "Role: Content Planning", "Focus: Spatial Platform"], href: null },
        { tone: "red", tag: "2022", title: "《新的媒介们》展览影像", body: "参与釜山现代美术馆相关展览项目的影像制作与内容呈现。", media: media.projectMuseum, details: ["Client: Museum Project", "Role: Video Production", "Focus: Exhibition Media"], href: null },
        { tone: "blue", tag: "2023", title: "博物馆与纪念馆媒体视频", body: "为博物馆、纪念馆与公共文化空间制作多方向媒体影像内容。", media: media.projectArchive, details: ["Client: Museum / Memorial", "Role: Media Production", "Focus: Cultural Narrative"], href: null },
        { tone: "pink", tag: "2024", title: "《这不是釜山》接触式实践影像", body: "围绕展览空间中的感知、城市经验与影像介入展开内容实践。", media: media.researchPerformance, details: ["Type: Exhibition Practice", "Role: Visual Direction", "Focus: Urban Experience"], href: null },
        { tone: "red", tag: "2024 - 2025", title: "博物馆媒体动画与图书馆项目", body: "包括蔚山博物馆漫画媒体艺术、中国长白山博物馆媒体动画与图书馆类项目。", media: media.projectLibrary, details: ["Client: Museum / Library", "Role: Animation Production", "Focus: Media Installation"], href: null }
    ],
    repoLinks: {
        title: "仓库内页面入口",
        items: [
            { href: "inno-things/", title: "Inno Things", body: "创新媒体方向入口" },
            { href: "shanhaiart/", title: "Shanhai Art", body: "艺术网页实验入口" },
            { href: "neu/voice-three-control/", title: "Voice Three Control", body: "交互式数字媒体实验" }
        ]
    },
    contact: {
        intro: {
            title: "合作方向",
            body: "后续可以继续把这个首页扩展为完整作品站，补充论文 PDF、CV 下载、项目图集和外部链接。",
            items: [
                { title: "学术合作", body: "动画研究、视觉文化、韩中文化比较、城市叙事与公共空间内容研究。" },
                { title: "项目合作", body: "展览影像、博物馆媒体动画、城市内容设计、教育与课程开发。" }
            ]
        },
        info: {
            title: "联系信息",
            items: [
                { label: "Name", value: "田汉 / 티앤한 / TIAN HAN" },
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
