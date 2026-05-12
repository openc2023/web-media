/* ══════════════════════════════════════════
   app.js — Main Logic | 主逻辑 | 메인 로직
   田汉 · Tian Han · 티앤한 — RPG Resume v3.1
   Languages: 中文 / English / 한국어
   New in v3.1: BGM · NPC Dialog · EXP Bar
               Damage Floaters · Save System
══════════════════════════════════════════ */
(function () {
    'use strict';

    var Audio  = window.RPG && window.RPG.Audio;
    var BG     = window.RPG && window.RPG.BG;
    var _ready = false;
    var _lang  = 'zh';

    /* ══════════════════════════════════════════
       FULL RESUME DATA — 3 LANGUAGES
    ══════════════════════════════════════════ */
    var DATA = {

        /* ── 中文 ── */
        zh: {
            hudTitle:  'RPG简历 v3.1',
            nameZh:    '田漢',
            nameEn:    'TIAN HAN · 釜山大學',
            charClass: '动画博士 · 媒体艺术家 · 制作总监',
            charDesc:  '研究方向：韩中漫画动画比较、沉浸式媒体艺术与城市再生。2025年2月取得博士学位。现任슈퍼루키즈制作总监、东明大学兼任教授。',
            stats:     [['PROJECTS','9','件作品'],['PAPERS','9','篇论文'],['AWARDS','2','项荣誉']],
            quote:     '「 让不可见之物成为必然。Making the invisible feel inevitable. 」',
            quoteSrc:  '— 田汉 TIAN HAN',
            controls:  ['切换任务','存档','重置全部','关闭面板'],
            actions:   ['邮件','电话','作品集','存档','学术'],
            footer:    ['© 2025 田漢 · 保留所有权利', '像素与墨 · PIXELS & INK'],
            langLabel: '中',
            saveSlot:  'SLOT 1 — 田漢 · LV32',
            saveOk:    '▼ 数据已保存至本地',
            dialogSpeaker: '▶ 系统',
            dialogIdle: [
                '欢迎来到田漢的RPG简历世界…',
                '博士研究：沉浸式媒体 × 城市再生',
                'ART+99 · INK+99 · CODE+88 已解锁！',
                '点击技能标签可发动攻击！',
                '最新装备：슈퍼루키즈 制作总监',
                '2025年2月 — 博士学位获得！ LV+1',
                '按 Q 键切换任务 · S 键存档',
                '点击头像可获得 EXP！'
            ],
            dialogQuest: {
                quest1: '这位冒险者来自中国，旅居釜山已有十年…',
                quest2: '学历树已全部解锁！博士之路耗时十年。',
                quest3: '当前装备：制作总监 × 兼任教授 双持！',
                quest4: '学术成就：2项优秀发表奖 · 9篇论文！',
                quest5: '作品遍布美术馆与博物馆，媒体艺术家！',
                quest6: '著作解锁：4册出版物 · 翻译家技能+1',
                quest7: '联络方式已显示。发起对话吧！'
            },
            quests: [
                {
                    id: 'quest1', status: 'active', statusLabel: 'ACTIVE',
                    title: '关于我 · Profile', icon: '◎',
                    paras: [
                        '<strong>田汉（Tian Han / 티앤한）</strong>，1993年7月17日生，中国人，旅居韩国釜山。',
                        '2025年2月于<strong>釜山大学</strong>取得<strong>动画专业博士学位</strong>，博士论文研究城市再生中的新媒体艺术应用。',
                        '现任<strong>슈퍼루키즈（SUPERROOKIZ）制作总监</strong>，兼任<strong>东明大学</strong>网络漫画动画学科讲师。',
                        '使用语言：<strong>中文（母语）</strong>、<strong>韩语（熟练）</strong>'
                    ],
                    skills: ['沉浸式媒体','投影映射','生成艺术','动画研究','互动装置']
                },
                {
                    id: 'quest2', status: 'done', statusLabel: 'CLEARED',
                    title: '教育背景 · Education', icon: '◆',
                    paras: [
                        '<strong>釜山大学 · 动画学部</strong>　2015.03 — 2019.03<br>本科毕业 · Undergraduate',
                        '<strong>釜山大学 · 动画专业</strong>　2019.09 — 2021.09<br>硕士学位 · Master\'s Degree<br><em>论文：韩中日漫画动画中九尾狐形象意义分析</em>',
                        '<strong>釜山大学 · 动画专业</strong>　2021.09 — 2025.02<br>博士学位 · PhD ✓<br><em>论文：城市再生中新媒体艺术应用研究——以釜山龙头山媒体公园为中心</em>'
                    ],
                    skills: ['釜山大学','动画专业','10年釜山']
                },
                {
                    id: 'quest3', status: 'active', statusLabel: 'ACTIVE',
                    title: '职业经历 · Career', icon: '▶',
                    paras: [
                        '<strong>슈퍼루키즈 · 制作总监</strong>　2024.02 — 현재<br>SUPERROOKIZ · Production Director',
                        '<strong>东明大学 · 兼任教授</strong>　2025.02 — 现在<br>网络漫画动画学科讲师',
                        '<strong>釜山大学设计学科 · 研究助教</strong>　2020.09 — 2023.02<br>学科事务室辅助 · 媒体影像制作/技术研究'
                    ],
                    skills: ['制作总监','动画讲师','研究助教']
                },
                {
                    id: 'quest4', status: 'active', statusLabel: 'ACTIVE',
                    title: '学术成果 · Academic', icon: '✦',
                    paras: [
                        '<strong>★ 优秀发表奖</strong> 2020 · 韩国漫画动画学会<br>韩中日漫画动画中九尾狐形象比较分析',
                        '<strong>★ 优秀发表奖</strong> 2023 · IAFCC2023<br>2022北京冬奥会开幕式新媒体表演艺术中中国民族主义再现分析',
                        '2022 · 韩国漫画学会国际学术大会<br>都市再生结合的沉浸型媒体内容分析——以釜山民主公园为中心',
                        '2024 · 韩国网络漫画学会<br>都市再生与沉浸式媒体观众体验分析（釜山龙头山公园案例）',
                        '<em>共9篇学术论文/发表，含2项优秀发表奖</em>'
                    ],
                    skills: ['优秀发表奖×2','9篇论文','国际学会']
                },
                {
                    id: 'quest5', status: 'active', statusLabel: 'ACTIVE',
                    title: '代表作品 · Projects', icon: '◈',
                    paras: [
                        '<strong>釜山现代美术馆</strong> 2022<br>新媒体影像制作 — 釜山媒体艺术溯源与谱系',
                        '<strong>釜山现代美术馆</strong> 2024<br>影像制作 — 「这不是釜山：战术性实践」',
                        '<strong>福泉博物馆</strong> 2023 · <strong>临时首都纪念馆</strong> 2023<br>媒体影像制作',
                        '<strong>蔚山博物馆</strong> 2024<br>漫画基础媒体艺术',
                        '<strong>中国长白山博物馆</strong> 2025 · <strong>华城中央图书馆</strong> 2025<br>媒体动画制作',
                        '<em>另参与BK21地域故事内容专业培养团（2020—2024）、元宇宙AI融合公园平台开发（2021—2023）</em>'
                    ],
                    skills: ['美术馆','博物馆','媒体艺术','BK21','元宇宙']
                },
                {
                    id: 'quest6', status: 'done', statusLabel: 'CLEARED',
                    title: '著作出版 · Publications', icon: '≡',
                    paras: [
                        '<strong>漫画看国债补偿运动1907大邱</strong> 2020.12<br>协助制作 · 助理',
                        '<strong>1951，少年漫画列传</strong> 2020.12<br>协助制作 · 助理',
                        '<strong>地域故事丛书 1·2</strong> 2022·2023<br>章节作者 — 釜山大学出版',
                        '<strong>照明店——姜培（中文版）</strong> 2024<br>韩中翻译 · 韩国漫画中文发行'
                    ],
                    skills: ['章节作者','韩中翻译','共4册']
                },
                {
                    id: 'quest7', status: 'active', statusLabel: 'CONTACT',
                    title: '联络方式 · Contact', icon: '✉',
                    paras: [
                        '<strong>邮箱</strong><br><a href="mailto:angell1993@naver.com" class="quest-link">angell1993@naver.com</a>',
                        '<strong>电话</strong><br><a href="tel:010-2576-9886" class="quest-link">010-2576-9886</a>',
                        '<strong>所在地</strong><br>釜山，韩国 · Busan, South Korea',
                        '<strong>作品集</strong><br><a href="https://art717.notion.site/box" target="_blank" class="quest-link">art717.notion.site/box</a>',
                        '<strong>机构</strong><br>슈퍼루키즈（SUPERROOKIZ）· 东明大学'
                    ],
                    skills: ['釜山','韩国','🇨🇳→🇰🇷']
                }
            ]
        },

        /* ── English ── */
        en: {
            hudTitle:  'RPG RESUME v3.1',
            nameZh:    '田漢',
            nameEn:    'TIAN HAN · PNU PhD',
            charClass: 'Animation PhD · Media Artist · Production Director',
            charDesc:  'Researcher in immersive media art & urban regeneration. PhD in Animation, Pusan National University (Feb 2025). Production Director at SUPERROOKIZ. Adjunct Professor at Dongmyeong University.',
            stats:     [['PROJECTS','9','works'],['PAPERS','9','articles'],['AWARDS','2','honors']],
            quote:     '「 Making the invisible feel inevitable. 」',
            quoteSrc:  '— Tian Han',
            controls:  ['toggle quest','save','reset all','close'],
            actions:   ['MAIL','CALL','WORKS','SAVE','SCHOLAR'],
            footer:    ['© 2025 TIAN HAN · ALL RIGHTS RESERVED', 'BUILT WITH PIXELS & INK'],
            langLabel: 'EN',
            saveSlot:  'SLOT 1 — TIAN HAN · LV32',
            saveOk:    '▼ Data saved to local storage',
            dialogSpeaker: '▶ SYSTEM',
            dialogIdle: [
                'Welcome to Tian Han\'s RPG Resume world…',
                'PhD research: Immersive Media × Urban Regeneration',
                'ART+99 · INK+99 · CODE+88 unlocked!',
                'Click skill tags to launch an attack!',
                'Latest equip: SUPERROOKIZ Production Director',
                'Feb 2025 — PhD obtained! LV+1',
                'Press Q to cycle quests · S to save',
                'Click the avatar for EXP!'
            ],
            dialogQuest: {
                quest1: 'This adventurer hails from China, based in Busan for 10 years…',
                quest2: 'Full education tree unlocked! The PhD path took a decade.',
                quest3: 'Current gear: Production Director × Adjunct Professor dual-wield!',
                quest4: 'Academic achievement: 2 outstanding awards · 9 papers!',
                quest5: 'Works span museums and galleries — true media artist!',
                quest6: 'Publications unlocked: 4 books · Translator skill+1',
                quest7: 'Contact info revealed. Initiate dialogue!'
            },
            quests: [
                {
                    id: 'quest1', status: 'active', statusLabel: 'ACTIVE',
                    title: 'About · Profile', icon: '◎',
                    paras: [
                        '<strong>Tian Han (田漢 · 티앤한)</strong>, born July 17, 1993, is a Chinese media artist and animation researcher based in Busan, South Korea.',
                        'She earned her <strong>PhD in Animation from Pusan National University</strong> in February 2025. Her doctoral thesis focused on the application of New Media Art in urban regeneration contexts.',
                        'Currently serving as <strong>Production Director at SUPERROOKIZ</strong> and <strong>Adjunct Professor</strong> (Webtoon Animation) at Dongmyeong University.',
                        'Languages: <strong>Chinese (native)</strong>, <strong>Korean (proficient)</strong>'
                    ],
                    skills: ['Immersive Media','Projection Mapping','Generative Art','Animation Research','Interactive Installation']
                },
                {
                    id: 'quest2', status: 'done', statusLabel: 'CLEARED',
                    title: 'Education', icon: '◆',
                    paras: [
                        '<strong>Pusan National University · Animation</strong>　2015.03 — 2019.03<br>Bachelor\'s Degree',
                        '<strong>Pusan National University · Animation</strong>　2019.09 — 2021.09<br>Master\'s Degree<br><em>Thesis: Comparative Analysis of the Nine-Tailed Fox in Korean, Chinese & Japanese Animation</em>',
                        '<strong>Pusan National University · Animation</strong>　2021.09 — 2025.02<br>PhD ✓<br><em>Thesis: Application of New Media Art in Urban Regeneration — Centered on Busan Yongdusan Media Park</em>'
                    ],
                    skills: ['PNU','Animation','10 Years Busan']
                },
                {
                    id: 'quest3', status: 'active', statusLabel: 'ACTIVE',
                    title: 'Career', icon: '▶',
                    paras: [
                        '<strong>SUPERROOKIZ · Production Director</strong>　Feb 2024 — Present',
                        '<strong>Dongmyeong University · Adjunct Professor</strong>　Feb 2025 — Present<br>Webtoon & Animation Department',
                        '<strong>PNU Design Dept. · Research Assistant</strong>　Sep 2020 — Feb 2023<br>Administrative support · Media production & technology research'
                    ],
                    skills: ['Production Director','Animation Lecturer','Research Assistant']
                },
                {
                    id: 'quest4', status: 'active', statusLabel: 'ACTIVE',
                    title: 'Academic Works', icon: '✦',
                    paras: [
                        '<strong>★ Outstanding Presentation Award</strong> 2020 · Korean Comics & Animation Society<br>Comparative Analysis of the Nine-Tailed Fox in K/C/J Animation',
                        '<strong>★ Outstanding Presentation Award</strong> 2023 · IAFCC2023<br>Reproduction of Chinese Nationalism in 2022 Beijing Winter Olympics Opening Ceremony: New Media Performing Arts Analysis',
                        '2022 · International Conference — Immersive Media Content Analysis in Urban Regeneration: Busan Democracy Park',
                        '2024 · Korean Webtoon Society — Immersive Media and Audience Experience in Urban Regeneration (Yongdusan Park, Busan)',
                        '<em>9 total academic papers/presentations · 2 outstanding awards</em>'
                    ],
                    skills: ['2× Best Paper','9 Papers','International']
                },
                {
                    id: 'quest5', status: 'active', statusLabel: 'ACTIVE',
                    title: 'Projects · Works', icon: '◈',
                    paras: [
                        '<strong>Busan Museum of Contemporary Art</strong> 2022<br>New Media Film — "Origins & Genealogy of Busan Media Art"',
                        '<strong>Busan Museum of Contemporary Art</strong> 2024<br>Film — "This is Not Busan: Tactical Practice"',
                        '<strong>Bokcheon Museum</strong> 2023 · <strong>Provisional Capital Memorial</strong> 2023<br>Media film production',
                        '<strong>Ulsan Museum</strong> 2024 · Comics-based Media Art',
                        '<strong>Changbaishan Museum, China</strong> 2025 · <strong>Hwaseong Central Library</strong> 2025<br>Media animation production',
                        '<em>+ BK21 Local Storytelling Content Team (2020–24) · Metaverse/AI Park Platform (2021–23)</em>'
                    ],
                    skills: ['Art Museum','Media Film','Museum Art','BK21','Metaverse/AI']
                },
                {
                    id: 'quest6', status: 'done', statusLabel: 'CLEARED',
                    title: 'Publications', icon: '≡',
                    paras: [
                        '<strong>Comics Guide to National Debt Repayment Movement 1907 Daegu</strong> 2020<br>Assistant',
                        '<strong>1951, Boys\' Comics Chronicle</strong> 2020<br>Assistant',
                        '<strong>Local Storytelling Series Vol. 1 & 2</strong> 2022 · 2023<br>Chapter Author — Pusan National University',
                        '<strong>The Light Shop by Kang Full (Chinese Edition)</strong> 2024<br>Korean→Chinese Translation'
                    ],
                    skills: ['Chapter Author','KR→CN Translation','4 Books']
                },
                {
                    id: 'quest7', status: 'active', statusLabel: 'CONTACT',
                    title: 'Contact', icon: '✉',
                    paras: [
                        '<strong>Email</strong><br><a href="mailto:angell1993@naver.com" class="quest-link">angell1993@naver.com</a>',
                        '<strong>Phone</strong><br><a href="tel:010-2576-9886" class="quest-link">010-2576-9886</a>',
                        '<strong>Location</strong><br>Busan, South Korea',
                        '<strong>Portfolio</strong><br><a href="https://art717.notion.site/box" target="_blank" class="quest-link">art717.notion.site/box</a>',
                        '<strong>Affiliation</strong><br>SUPERROOKIZ · Dongmyeong University'
                    ],
                    skills: ['Busan','South Korea','🇨🇳→🇰🇷']
                }
            ]
        },

        /* ── 한국어 ── */
        ko: {
            hudTitle:  'RPG 이력서 v3.1',
            nameZh:    '田漢',
            nameEn:    '티앤한 · 부산대학교',
            charClass: '애니메이션 박사 · 미디어 아티스트 · 제작감독',
            charDesc:  '도시재생과 뉴미디어 아트 연구자. 2025년 2월 부산대학교 애니메이션 전공 박사학위 취득. 슈퍼루키즈 제작감독 · 동명대학교 겸임교수.',
            stats:     [['프로젝트','9','작품'],['논문','9','편'],['수상','2','회']],
            quote:     '「 보이지 않는 것을 필연으로 만든다. 」',
            quoteSrc:  '— 티앤한 田汉',
            controls:  ['퀘스트 전환','저장','전체 초기화','닫기'],
            actions:   ['이메일','전화','작품집','저장','학술'],
            footer:    ['© 2025 티앤한 · 모든 권리 보유', '픽셀과 먹 · PIXELS & INK'],
            langLabel: '한',
            saveSlot:  'SLOT 1 — 티앤한 · LV32',
            saveOk:    '▼ 데이터가 로컬에 저장되었습니다',
            dialogSpeaker: '▶ 시스템',
            dialogIdle: [
                '티앤한의 RPG 이력서 세계에 오신 것을 환영합니다…',
                '박사 연구: 몰입형 미디어 × 도시재생',
                'ART+99 · INK+99 · CODE+88 해금 완료!',
                '스킬 태그를 클릭하면 공격 발동!',
                '최신 장비: 슈퍼루키즈 제작감독',
                '2025년 2월 — 박사학위 취득! LV+1',
                'Q키로 퀘스트 전환 · S키로 저장',
                '아바타를 클릭하면 EXP 획득!'
            ],
            dialogQuest: {
                quest1: '이 모험가는 중국 출신으로 부산에서 10년을 보냈습니다…',
                quest2: '학력 트리 전체 해금! 박사까지 10년의 여정.',
                quest3: '현재 장비: 제작감독 × 겸임교수 쌍수 장비!',
                quest4: '학술 업적: 우수발표상 2회 · 논문 9편!',
                quest5: '미술관과 박물관에 작품 — 진정한 미디어 아티스트!',
                quest6: '출판물 해금: 4권 · 번역가 스킬+1',
                quest7: '연락처가 공개되었습니다. 대화를 시작하세요!'
            },
            quests: [
                {
                    id: 'quest1', status: 'active', statusLabel: 'ACTIVE',
                    title: '나에 대해 · 프로필', icon: '◎',
                    paras: [
                        '<strong>티앤한（田漢 · Tian Han）</strong>은 1993년 7월 17일생으로, 중국 출신 미디어 아티스트이자 애니메이션 연구자입니다. 현재 부산에 거주 중입니다.',
                        '2025년 2월 <strong>부산대학교 애니메이션 전공 박사학위</strong>를 취득했습니다. 박사논문은 도시재생과 뉴미디어 아트 적용에 관한 연구입니다.',
                        '현재 <strong>슈퍼루키즈(SUPERROOKIZ) 제작감독</strong>으로 재직 중이며, <strong>동명대학교 웹툰애니메이션학과 겸임교수</strong>로 활동하고 있습니다.',
                        '사용 언어: <strong>중국어(모국어)</strong>, <strong>한국어(능숙)</strong>'
                    ],
                    skills: ['몰입형 미디어','프로젝션 맵핑','생성 예술','애니메이션 연구','인터랙티브 설치']
                },
                {
                    id: 'quest2', status: 'done', statusLabel: 'CLEARED',
                    title: '학력', icon: '◆',
                    paras: [
                        '<strong>부산대학교 · 애니메이션 학부</strong>　2015.03 — 2019.03<br>학사 졸업',
                        '<strong>부산대학교 · 애니메이션</strong>　2019.09 — 2021.09<br>석사 졸업<br><em>논문: 한·중·일 만화, 애니메이션에서의 구미호 이미지 의미 분석</em>',
                        '<strong>부산대학교 · 애니메이션</strong>　2021.09 — 2025.02<br>박사 졸업 ✓<br><em>논문: 도시재생에서의 뉴미디어 아트 적용 연구 — 부산 용두산 미디어파크 중심</em>'
                    ],
                    skills: ['부산대학교','애니메이션','부산 10년']
                },
                {
                    id: 'quest3', status: 'active', statusLabel: 'ACTIVE',
                    title: '경력', icon: '▶',
                    paras: [
                        '<strong>슈퍼루키즈 · 제작감독</strong>　2024.02 — 현재',
                        '<strong>동명대학교 · 겸임교수</strong>　2025.02 — 현재<br>웹툰애니메이션학과',
                        '<strong>부산대학교 디자인학과 · 연구조교</strong>　2020.09 — 2023.02<br>학과사무실 보조 · 미디어 영상 제작/기술 연구'
                    ],
                    skills: ['제작감독','겸임교수','연구조교']
                },
                {
                    id: 'quest4', status: 'active', statusLabel: 'ACTIVE',
                    title: '학술 이력', icon: '✦',
                    paras: [
                        '<strong>★ 우수발표상</strong> 2020 · 한국만화애니메이션학회<br>한·중·일 만화애니메이션에서 구미호 이미지 비교 분석',
                        '<strong>★ 우수발표상</strong> 2023 · IAFCC2023 제2회 학술포럼<br>2022 베이징 동계올림픽 개막식 뉴미디어 공연예술 중 중국 민족주의 재현 분석',
                        '2022 · 국제학술대회 — 도시재생과 연계한 실감형 미디어 콘텐츠 분석 (부산 민주공원)',
                        '2024 · 한국웹툰학회 — 도시재생과 몰입형 미디어 관람자 경험 분석 (부산 용두산공원)',
                        '<em>총 9편 학술논문/발표 · 우수발표상 2회</em>'
                    ],
                    skills: ['우수발표상×2','논문 9편','국제학회']
                },
                {
                    id: 'quest5', status: 'active', statusLabel: 'ACTIVE',
                    title: '작품 · 프로젝트', icon: '◈',
                    paras: [
                        '<strong>부산현대미술관</strong> 2022<br>새로운 매개들 — 부산 미디어아트의 시작과 계보 영상 제작',
                        '<strong>부산현대미술관</strong> 2024<br>이것은 부산이 아니다: 전술적 실천 영상 제작',
                        '<strong>복천박물관</strong> 2023 · <strong>임시수도기념관</strong> 2023<br>미디어 영상 제작',
                        '<strong>울산박물관</strong> 2024 · 만화 기반 미디어아트',
                        '<strong>중국 장백산 박물관</strong> 2025 · <strong>화성중앙도서관</strong> 2025<br>미디어 애니메이션 제작',
                        '<em>+ BK21 지역 스토리텔링 전문인력 양성팀 (2020–24) · 메타버스·AI 공원 플랫폼 (2021–23)</em>'
                    ],
                    skills: ['현대미술관','미디어영상','박물관','BK21','메타버스/AI']
                },
                {
                    id: 'quest6', status: 'done', statusLabel: 'CLEARED',
                    title: '저서 · 출판', icon: '≡',
                    paras: [
                        '<strong>만화로 보는 국채 보상운동 1907 대구!</strong> 2020.12<br>어시스턴트',
                        '<strong>1951, 소년만화열전</strong> 2020.12<br>어시스턴트',
                        '<strong>지역 스토리텔링 총서 1·2권</strong> 2022·2023<br>장(章) 저자 — 부산대학교',
                        '<strong>조명가게 — 강풀 (중국어 발행판)</strong> 2024<br>한국어→중국어 번역'
                    ],
                    skills: ['장(章) 저자','한→중 번역','총 4권']
                },
                {
                    id: 'quest7', status: 'active', statusLabel: 'CONTACT',
                    title: '연락처', icon: '✉',
                    paras: [
                        '<strong>이메일</strong><br><a href="mailto:angell1993@naver.com" class="quest-link">angell1993@naver.com</a>',
                        '<strong>전화</strong><br><a href="tel:010-2576-9886" class="quest-link">010-2576-9886</a>',
                        '<strong>소재지</strong><br>부산광역시, 대한민국',
                        '<strong>포트폴리오</strong><br><a href="https://art717.notion.site/box" target="_blank" class="quest-link">art717.notion.site/box</a>',
                        '<strong>소속</strong><br>슈퍼루키즈(SUPERROOKIZ) · 동명대학교'
                    ],
                    skills: ['부산','대한민국','🇨🇳→🇰🇷']
                }
            ]
        }
    };

    /* ══════════════════════════════════════════
       RENDERER
    ══════════════════════════════════════════ */
    function render(lang) {
        var d = DATA[lang];
        if (!d) return;

        var hudTitleEl = document.getElementById('hudTitle');
        if (hudTitleEl) hudTitleEl.textContent = d.hudTitle;

        var nameEnEl = document.getElementById('nameEn');
        var classEl  = document.getElementById('charClass');
        var descEl   = document.getElementById('charDesc');
        if (nameEnEl) nameEnEl.textContent = d.nameEn;
        if (classEl)  classEl.textContent  = d.charClass;
        if (descEl)   descEl.textContent   = d.charDesc;

        var statCards = document.querySelectorAll('.stat-card');
        d.stats.forEach(function (s, i) {
            if (!statCards[i]) return;
            var lbl = statCards[i].querySelector('.s-label');
            var unt = statCards[i].querySelector('.s-unit');
            if (lbl) lbl.textContent = s[0];
            if (unt) unt.textContent = s[2];
        });

        var qtext = document.querySelector('.gq-text');
        var qsrc  = document.querySelector('.gq-src');
        if (qtext) qtext.textContent = d.quote;
        if (qsrc)  qsrc.textContent  = d.quoteSrc;

        /* controls — now 4 hints */
        var hints = document.querySelectorAll('.key-hint-label');
        d.controls.forEach(function (c, i) { if (hints[i]) hints[i].textContent = c; });

        var actBtns = document.querySelectorAll('.action-btn .btn-label');
        d.actions.forEach(function (a, i) { if (actBtns[i]) actBtns[i].textContent = a; });

        var footers = document.querySelectorAll('.game-footer p');
        d.footer.forEach(function (f, i) { if (footers[i]) footers[i].textContent = f; });

        document.querySelectorAll('.lang-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        /* save popup text */
        var slotEl = document.getElementById('saveSlotText');
        var okEl   = document.querySelector('.save-ok');
        if (slotEl) slotEl.textContent = d.saveSlot;
        if (okEl)   okEl.textContent   = d.saveOk;

        /* NPC dialog speaker label */
        var spkEl = document.getElementById('dialogSpeaker');
        if (spkEl) spkEl.textContent = d.dialogSpeaker;

        buildQuests(d.quests);
    }

    /* ══════════════════════════════════════════
       QUEST BUILDER
    ══════════════════════════════════════════ */
    var QUESTS   = [];
    var questIdx = 0;

    function buildQuests(quests) {
        var list = document.getElementById('questList');
        if (!list) return;

        var wasOpen = {};
        QUESTS.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && el.classList.contains('open')) wasOpen[id] = true;
        });

        list.innerHTML = '';
        QUESTS = [];

        quests.forEach(function (q, qi) {
            QUESTS.push(q.id);
            var isOpen = wasOpen[q.id] || (qi === 4);

            var item = document.createElement('div');
            item.className = 'quest-item' + (isOpen ? ' open' : '');
            item.id = q.id;

            var hdr = document.createElement('div');
            hdr.className     = 'quest-header';
            hdr.dataset.quest = q.id;
            hdr.innerHTML =
                '<span class="quest-status ' + q.status + '">' + q.statusLabel + '</span>' +
                '<span class="quest-icon">' + q.icon + '</span>' +
                '<span class="quest-title">' + q.title + '</span>' +
                '<span class="quest-arrow">▶</span>';
            item.appendChild(hdr);

            var body = document.createElement('div');
            body.className = 'quest-body';
            q.paras.forEach(function (p) {
                var el = document.createElement('p');
                el.className = 'tw-para';
                el.innerHTML = p;
                body.appendChild(el);
            });
            if (q.skills && q.skills.length) {
                var grid = document.createElement('div');
                grid.className = 'tw-para skills-grid';
                q.skills.forEach(function (sk) {
                    var tag = document.createElement('span');
                    tag.className = 'skill-tag';
                    tag.textContent = sk;
                    /* damage floater on skill-tag click */
                    tag.addEventListener('click', function (e) {
                        e.stopPropagation();
                        spawnDamage(e.clientX, e.clientY);
                        if (Audio) Audio.hit();
                    });
                    grid.appendChild(tag);
                });
                body.appendChild(grid);
            }
            item.appendChild(body);
            list.appendChild(item);

            hdr.addEventListener('click', function (e) {
                e.stopPropagation();
                var opening = !item.classList.contains('open');
                if (opening) {
                    openQuest(item);
                    if (Audio) Audio.open();
                    showDialog(q.id);
                } else {
                    closeQuest(item);
                    if (Audio) Audio.close();
                    showIdleDialog();
                }
            });

            /* NPC dialog on hover */
            hdr.addEventListener('mouseenter', function () {
                if (Audio) Audio.hover();
                peekDialog(q.id);
            });
            hdr.addEventListener('mouseleave', function () {
                scheduleIdleDialog();
            });

            if (isOpen) {
                setTimeout(function () { typewriterIn(item); }, 600);
            }
        });

        bindCursorHover('.quest-header');
    }

    /* ══════════════════════════════════════════
       DUAL-RING CURSOR
    ══════════════════════════════════════════ */
    var ciEl = document.getElementById('cursorInner');
    var coEl = document.getElementById('cursorOuter');
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var ix = mx, iy = my, ox = mx, oy = my;

    document.addEventListener('mousemove', function (e) {
        mx = e.clientX; my = e.clientY;
        if (BG) BG.addTrail(mx, my);
    });

    (function cursorLoop() {
        ix += (mx - ix) * 0.28;
        iy += (my - iy) * 0.28;
        ox += (mx - ox) * 0.10;
        oy += (my - oy) * 0.10;
        if (ciEl) { ciEl.style.left = ix + 'px'; ciEl.style.top = iy + 'px'; }
        if (coEl) { coEl.style.left = ox + 'px'; coEl.style.top = oy + 'px'; }
        requestAnimationFrame(cursorLoop);
    })();

    function bindCursorHover(selector) {
        document.querySelectorAll(selector).forEach(function (el) {
            el.addEventListener('mouseenter', function () {
                if (ciEl) ciEl.classList.add('cursor-hover');
                if (coEl) coEl.classList.add('cursor-hover');
            });
            el.addEventListener('mouseleave', function () {
                if (ciEl) ciEl.classList.remove('cursor-hover');
                if (coEl) coEl.classList.remove('cursor-hover');
            });
        });
    }
    bindCursorHover('a, button, .stat-card, .action-btn, .pixel-avatar, .lang-btn, .bgm-btn');

    /* ══════════════════════════════════════════
       SCREEN FLASH
    ══════════════════════════════════════════ */
    function flash(cls) {
        var el = document.getElementById('screenFlash');
        if (!el) return;
        el.className = '';
        void el.offsetWidth;
        el.className = cls || 'do-flash';
    }

    /* ══════════════════════════════════════════
       HUD — LV + SEGMENTED BARS
    ══════════════════════════════════════════ */
    function buildHUD() {
        /* Level count-up */
        var lvEl = document.getElementById('lvDisplay');
        var targetLV = new Date().getFullYear() - 1993;
        if (lvEl) {
            lvEl.textContent = '0';
            var n = 0;
            var t = setInterval(function () {
                n++;
                lvEl.textContent = n;
                if (Audio) Audio.segFill(n % 8);
                if (n >= targetLV) {
                    clearInterval(t);
                    setTimeout(function () { if (Audio) Audio.levelUp(); }, 200);
                }
            }, 45);
        }

        function buildBar(id, onCls, offCls, total, filled) {
            var el = document.getElementById(id);
            if (!el) return;
            for (var i = 0; i < total; i++) {
                (function (idx) {
                    var s = document.createElement('div');
                    s.className = 'seg ' + offCls;
                    el.appendChild(s);
                    if (idx < filled) {
                        setTimeout(function () {
                            s.className = 'seg ' + onCls;
                            s.classList.add('seg-pop');
                            if (Audio) Audio.segFill(idx);
                        }, idx * 100);
                    }
                })(i);
            }
        }
        buildBar('hpBar', 'hp-on', 'hp-off', 9, 8);
        buildBar('mpBar', 'mp-on', 'mp-off', 9, 7);

        /* Stat count-up */
        document.querySelectorAll('.stat-card .s-value').forEach(function (el, i) {
            var raw    = el.textContent.trim();
            var suffix = raw.replace(/[0-9]/g, '');
            var num    = parseInt(raw, 10);
            if (isNaN(num)) return;
            el.textContent = '0' + suffix;
            setTimeout(function () {
                var t0 = null;
                (function step(ts) {
                    if (!t0) t0 = ts;
                    var prog = Math.min((ts - t0) / 900, 1);
                    var ease = 1 - Math.pow(1 - prog, 3);
                    el.textContent = Math.floor(ease * num) + suffix;
                    if (prog < 1) requestAnimationFrame(step);
                    else el.textContent = raw;
                })(performance.now());
            }, 300 + i * 180);
        });

        /* EXP bar */
        buildEXP();
    }

    /* ══════════════════════════════════════════
       EXP BAR
       Papers 9×120 + Projects 9×150 + Awards 2×400 + Pubs 4×200 = 4030
    ══════════════════════════════════════════ */
    var EXP_TOTAL  = 5000;
    var EXP_EARNED = 9*120 + 9*150 + 2*400 + 4*200; /* 4030 */

    function buildEXP() {
        var fill = document.getElementById('expFill');
        var val  = document.getElementById('expVal');
        if (!fill) return;
        var pct = (EXP_EARNED / EXP_TOTAL * 100).toFixed(1);
        if (val) val.textContent = '0 / ' + EXP_TOTAL;
        setTimeout(function () {
            fill.style.width = pct + '%';
            /* count-up EXP value */
            var t0 = null;
            (function step(ts) {
                if (!t0) t0 = ts;
                var prog = Math.min((ts - t0) / 1400, 1);
                var ease = 1 - Math.pow(1 - prog, 3);
                var cur  = Math.floor(ease * EXP_EARNED);
                if (val) val.textContent = cur + ' / ' + EXP_TOTAL;
                if (prog < 1) requestAnimationFrame(step);
                else if (val) val.textContent = EXP_EARNED + ' / ' + EXP_TOTAL;
            })(performance.now());
        }, 800);
    }

    /* ══════════════════════════════════════════
       FLOATING DAMAGE NUMBERS
    ══════════════════════════════════════════ */
    var DMG_TYPES = [
        { text: '-52 DEF', cls: 'type-atk' },
        { text: '+ART',    cls: 'type-art' },
        { text: '+EXP',    cls: 'type-exp' },
        { text: 'CRIT!',   cls: 'type-crit' },
        { text: '-INK',    cls: 'type-art' },
        { text: '+99 ART', cls: 'type-art' },
        { text: 'MISS…',   cls: 'type-exp' },
        { text: '+SOUL',   cls: 'type-exp' }
    ];

    function spawnDamage(x, y) {
        var d     = DMG_TYPES[Math.floor(Math.random() * DMG_TYPES.length)];
        var el    = document.createElement('div');
        el.className = 'damage-num ' + d.cls;
        el.textContent = d.text;
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 950);
        if (BG) BG.explode(x, y);
        /* occasional crit flash */
        if (d.cls === 'type-crit') flash('do-flash');
    }

    /* ══════════════════════════════════════════
       NPC DIALOG BOX
    ══════════════════════════════════════════ */
    var _dialogEl   = document.getElementById('npcDialog');
    var _dialogText = document.getElementById('dialogText');
    var _idleTimer  = null;
    var _idleIdx    = 0;
    var _dialogVisible = false;

    function showDialog(questId) {
        var d = DATA[_lang];
        if (!d) return;
        var msg = (d.dialogQuest && d.dialogQuest[questId]) || d.dialogIdle[0];
        setDialogText(d.dialogSpeaker || '▶ SYSTEM', msg);
    }

    function peekDialog(questId) {
        if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
        var d = DATA[_lang];
        if (!d) return;
        var title = '';
        (d.quests || []).forEach(function (q) { if (q.id === questId) title = q.title; });
        setDialogText(d.dialogSpeaker || '▶ SYSTEM', '❯ ' + title);
    }

    function showIdleDialog() {
        var d = DATA[_lang];
        if (!d) return;
        setDialogText(d.dialogSpeaker || '▶ SYSTEM', d.dialogIdle[_idleIdx % d.dialogIdle.length]);
        _idleIdx++;
    }

    function scheduleIdleDialog() {
        if (_idleTimer) clearTimeout(_idleTimer);
        _idleTimer = setTimeout(showIdleDialog, 1800);
    }

    function setDialogText(speaker, text) {
        var spkEl = document.getElementById('dialogSpeaker');
        if (spkEl) spkEl.textContent = speaker;
        if (!_dialogText) return;

        /* typewriter effect */
        if (_dialogVisible) {
            _dialogText.textContent = '';
            typewriterDialog(text);
        } else {
            _dialogEl.classList.add('visible');
            _dialogVisible = true;
            _dialogText.textContent = '';
            setTimeout(function () { typewriterDialog(text); }, 80);
        }
    }

    function typewriterDialog(text) {
        if (!_dialogText) return;
        var i = 0;
        var chars = text.split('');
        _dialogText.textContent = '';
        (function next() {
            if (i >= chars.length) return;
            _dialogText.textContent += chars[i++];
            setTimeout(next, 22);
        })();
    }

    /* Start idle dialog cycling after main content loads */
    function startIdleDialog() {
        showIdleDialog();
        setInterval(function () {
            /* only rotate if no quest is open/hovered */
            scheduleIdleDialog();
        }, 6000);
    }

    /* ══════════════════════════════════════════
       CLICK EFFECTS
    ══════════════════════════════════════════ */
    document.addEventListener('click', function (e) {
        if (Audio) Audio.click();
        if (BG) BG.explode(e.clientX, e.clientY);
        flash('do-flash');
    });

    document.querySelectorAll('.action-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (Audio) Audio.select();
            if (BG) BG.explode(e.clientX, e.clientY);
            flash('do-flash');
            var ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            var rect = btn.getBoundingClientRect();
            var size = Math.max(rect.width, rect.height) * 2.2;
            ripple.style.cssText =
                'width:' + size + 'px;height:' + size + 'px;' +
                'left:' + (e.clientX - rect.left - size/2) + 'px;' +
                'top:'  + (e.clientY - rect.top  - size/2) + 'px;';
            btn.appendChild(ripple);
            setTimeout(function () { ripple.remove(); }, 650);
        });
    });

    document.querySelectorAll('.action-btn, .stat-card').forEach(function (el) {
        el.addEventListener('mouseenter', function () { if (Audio) Audio.hover(); });
    });

    /* ══════════════════════════════════════════
       SAVE SYSTEM
    ══════════════════════════════════════════ */
    function triggerSave() {
        var popup = document.getElementById('savePopup');
        if (!popup) return;
        if (Audio) Audio.save();
        flash('do-flash-hard');
        popup.classList.remove('show');
        void popup.offsetWidth;
        popup.classList.add('show');
        /* save timestamp to localStorage */
        try {
            localStorage.setItem('rpgSave', JSON.stringify({
                ts: Date.now(), lang: _lang, lv: new Date().getFullYear() - 1993
            }));
        } catch (e) {}
        setTimeout(function () { popup.classList.remove('show'); }, 2500);
    }

    var saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            triggerSave();
        });
    }

    /* ══════════════════════════════════════════
       BGM TOGGLE
    ══════════════════════════════════════════ */
    var bgmBtn = document.getElementById('bgmBtn');
    if (bgmBtn) {
        bgmBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!Audio) return;
            if (Audio.bgmIsOn()) {
                Audio.bgmStop();
                bgmBtn.classList.remove('on');
                bgmBtn.textContent = '♪ BGM';
            } else {
                Audio.bgmStart();
                bgmBtn.classList.add('on');
                bgmBtn.textContent = '♫ BGM';
            }
        });
        bgmBtn.addEventListener('mouseenter', function () { if (Audio) Audio.hover(); });
    }

    /* ══════════════════════════════════════════
       LANGUAGE SWITCHER
    ══════════════════════════════════════════ */
    function setLang(lang) {
        _lang = lang;
        render(lang);
        if (Audio) Audio.select();
    }

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setLang(btn.dataset.lang);
        });
        btn.addEventListener('mouseenter', function () { if (Audio) Audio.hover(); });
    });

    /* ══════════════════════════════════════════
       QUEST SYSTEM
    ══════════════════════════════════════════ */
    function typewriterIn(item) {
        item.querySelectorAll('.tw-para').forEach(function (p, i) {
            setTimeout(function () { p.classList.add('visible'); }, i * 80);
        });
        item.querySelectorAll('.skill-tag').forEach(function (t, i) {
            setTimeout(function () {
                t.classList.add('popped');
                if (i === 0 && Audio) Audio.equip();
            }, 120 + i * 50);
        });
    }
    function typewriterOut(item) {
        item.querySelectorAll('.tw-para').forEach(function (p) { p.classList.remove('visible'); });
        item.querySelectorAll('.skill-tag').forEach(function (t) { t.classList.remove('popped'); });
    }
    function openQuest(item) {
        item.classList.add('open');
        item.classList.add('quest-flash');
        setTimeout(function () { item.classList.remove('quest-flash'); }, 350);
        setTimeout(function () { typewriterIn(item); }, 80);
    }
    function closeQuest(item) {
        item.classList.remove('open');
        typewriterOut(item);
    }

    /* Keyboard */
    document.addEventListener('keydown', function (e) {
        if (!_ready) return;
        var key = e.key.toLowerCase();
        if (key === 'q') {
            var item = document.getElementById(QUESTS[questIdx]);
            if (item) {
                var opening = !item.classList.contains('open');
                if (opening) { openQuest(item); if (Audio) Audio.open(); showDialog(QUESTS[questIdx]); }
                else          { closeQuest(item); if (Audio) Audio.close(); showIdleDialog(); }
            }
            questIdx = (questIdx + 1) % QUESTS.length;
        }
        if (key === 's') {
            triggerSave();
        }
        if (key === 'r' || key === 'escape') {
            QUESTS.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) closeQuest(el);
            });
            questIdx = 0;
            if (Audio) Audio.close();
            showIdleDialog();
        }
    });

    /* ══════════════════════════════════════════
       NAME MAGNET
    ══════════════════════════════════════════ */
    var nameEl = document.getElementById('charName');
    var nmx = 0, nmy = 0;
    if (nameEl) {
        document.addEventListener('mousemove', function (e) {
            var r    = nameEl.getBoundingClientRect();
            var dx   = e.clientX - (r.left + r.width / 2);
            var dy   = e.clientY - (r.top  + r.height / 2);
            var dist = Math.hypot(dx, dy);
            if (dist < 200) {
                var f = (1 - dist / 200) * 7;
                nmx += (-dx * f - nmx) * 0.08;
                nmy += (-dy * f - nmy) * 0.08;
            } else { nmx *= 0.92; nmy *= 0.92; }
            nameEl.style.transform = 'translate(' + nmx.toFixed(2) + 'px,' + nmy.toFixed(2) + 'px)';
        });
    }

    /* ══════════════════════════════════════════
       STAT CARDS — damage floater on click
    ══════════════════════════════════════════ */
    document.querySelectorAll('.stat-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
            e.stopPropagation();
            spawnDamage(e.clientX, e.clientY);
            if (Audio) Audio.crit();
        });
    });

    /* ══════════════════════════════════════════
       INTRO SCREEN
    ══════════════════════════════════════════ */
    var introEl    = document.getElementById('introScreen');
    var iCanvas    = document.getElementById('introStars');
    var iCtx       = iCanvas ? iCanvas.getContext('2d') : null;
    var iStars     = [], inkBlobs = [], iT = 0, iRunning = true;

    function iResize() {
        if (!iCanvas) return;
        iCanvas.width  = window.innerWidth;
        iCanvas.height = window.innerHeight;
        inkBlobs = [
            { cx: 0.25, cy: 0.35, r: 180, ph: 0 },
            { cx: 0.75, cy: 0.65, r: 220, ph: 1.5 },
            { cx: 0.50, cy: 0.15, r: 160, ph: 3.0 }
        ];
        iStars = [];
        for (var i = 0; i < 160; i++) {
            iStars.push({
                x: Math.random() * iCanvas.width,
                y: Math.random() * iCanvas.height,
                sz: Math.random() < 0.08 ? 3 : 1,
                spd: 0.22 + Math.random() * 0.65,
                a: 0.15 + Math.random() * 0.75
            });
        }
    }
    iResize();
    window.addEventListener('resize', iResize);

    (function iTick() {
        if (!iRunning || !iCtx) return;
        iT++;
        iCtx.fillStyle = '#000';
        iCtx.fillRect(0, 0, iCanvas.width, iCanvas.height);
        inkBlobs.forEach(function (b) {
            var pulse = 0.028 + 0.018 * Math.sin(iT * 0.012 + b.ph);
            var grd = iCtx.createRadialGradient(b.cx*iCanvas.width, b.cy*iCanvas.height, 0,
                                                b.cx*iCanvas.width, b.cy*iCanvas.height, b.r);
            grd.addColorStop(0, 'rgba(74,158,158,' + pulse.toFixed(3) + ')');
            grd.addColorStop(1, 'rgba(74,158,158,0)');
            iCtx.fillStyle = grd;
            iCtx.fillRect(0, 0, iCanvas.width, iCanvas.height);
        });
        iStars.forEach(function (s) {
            s.x -= s.spd;
            if (s.x < 0) { s.x = iCanvas.width; s.y = Math.random() * iCanvas.height; }
            var a = s.a * (0.6 + 0.4 * Math.sin(iT * 0.038 + s.y * 0.01));
            iCtx.fillStyle = 'rgba(188,208,204,' + a.toFixed(2) + ')';
            iCtx.fillRect(Math.floor(s.x), Math.floor(s.y), s.sz, s.sz);
        });
        requestAnimationFrame(iTick);
    })();

    document.querySelectorAll('.intro-lang-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            _lang = btn.dataset.lang;
            if (Audio) { Audio.init(); Audio.select(); }
            document.querySelectorAll('.intro-lang-btn').forEach(function (b) {
                b.classList.toggle('selected', b.dataset.lang === _lang);
            });
            var ps = document.getElementById('introPressStart');
            if (ps) ps.style.display = 'block';
        });
        btn.addEventListener('mouseenter', function () { if (Audio) Audio.hover(); });
    });

    function dismissIntro() {
        if (_ready) return;
        _ready = true;
        iRunning = false;
        if (Audio) Audio.start();
        flash('do-flash-hard');
        introEl.style.transition = 'opacity 0.75s ease';
        introEl.style.opacity    = '0';
        setTimeout(function () {
            introEl.style.display = 'none';
            render(_lang);
            buildHUD();
            setTimeout(startIdleDialog, 1400);
        }, 780);
    }

    if (introEl) {
        introEl.addEventListener('click', function (e) {
            if (e.target.classList.contains('intro-lang-btn')) return;
            dismissIntro();
        });
        document.addEventListener('keydown', function handler() {
            if (!_ready) { dismissIntro(); document.removeEventListener('keydown', handler); }
        });
    } else {
        _ready = true;
        render(_lang);
        buildHUD();
        setTimeout(startIdleDialog, 1400);
    }

    /* ══════════════════════════════════════════
       SCREEN SHAKE
    ══════════════════════════════════════════ */
    function screenShake() {
        var el = document.querySelector('.game-frame');
        if (!el) return;
        el.classList.remove('screen-shake');
        void el.offsetWidth;
        el.classList.add('screen-shake');
        setTimeout(function () { el.classList.remove('screen-shake'); }, 340);
    }

    /* ══════════════════════════════════════════
       ENCOUNTER FLASH
    ══════════════════════════════════════════ */
    var _encounterEl   = document.getElementById('encounterFlash');
    var _encounterText = document.getElementById('encounterText');

    var ENCOUNTER_MSGS = {
        zh: ['⚔ 遭遇战！', '★ 新任务解锁！', '◆ 情报获取！', '⚡ 技能激活！'],
        en: ['⚔ ENCOUNTER!', '★ QUEST UNLOCK!', '◆ DATA FOUND!',  '⚡ SKILL ACTIVE!'],
        ko: ['⚔ 인카운터!', '★ 퀘스트 해금!', '◆ 정보 취득!', '⚡ 스킬 발동!']
    };

    function triggerEncounter(msgIdx) {
        if (!_encounterEl) return;
        var msgs = ENCOUNTER_MSGS[_lang] || ENCOUNTER_MSGS.zh;
        var msg  = msgs[msgIdx !== undefined ? msgIdx % msgs.length : Math.floor(Math.random() * msgs.length)];
        if (_encounterText) _encounterText.textContent = msg;
        _encounterEl.classList.remove('show');
        void _encounterEl.offsetWidth;
        _encounterEl.classList.add('show');
        setTimeout(function () { _encounterEl.classList.remove('show'); }, 950);
        screenShake();
        flash('do-flash-red');
    }

    /* Patch openQuest to trigger encounter */
    var _origOpenQuest = openQuest;
    openQuest = function (item) {
        _origOpenQuest(item);
        triggerEncounter(0);
    };

    /* ══════════════════════════════════════════
       COMBO COUNTER
    ══════════════════════════════════════════ */
    var _comboEl    = document.getElementById('comboDisplay');
    var _comboNum   = document.getElementById('comboNum');
    var _comboBar   = document.getElementById('comboBar');
    var _comboCount = 0;
    var _comboTimer = null;
    var _COMBO_TTL  = 1200; /* ms window to extend combo */

    var COMBO_LABELS = {
        zh: ['COMBO！','大 COMBO！','超级 COMBO！','MAX COMBO！！！'],
        en: ['COMBO!','GREAT COMBO!','SUPER COMBO!','MAX COMBO!!!'],
        ko: ['콤보!','대 콤보!','슈퍼 콤보!','맥스 콤보!!!']
    };

    function incrementCombo() {
        _comboCount++;
        if (_comboTimer) clearTimeout(_comboTimer);

        if (_comboEl) _comboEl.classList.add('visible');

        var tier  = Math.min(Math.floor((_comboCount - 1) / 3), 3);
        var labels = COMBO_LABELS[_lang] || COMBO_LABELS.zh;

        if (_comboNum) {
            _comboNum.textContent = _comboCount + '×';
            /* re-trigger pop animation */
            _comboNum.style.animation = 'none';
            void _comboNum.offsetWidth;
            _comboNum.style.animation = '';
        }

        /* color escalation */
        var colors = ['var(--gold)', '#ffaa00', '#ff8800', '#ff4444'];
        if (_comboNum) _comboNum.style.color = colors[tier] || colors[3];

        /* bar drains over TTL */
        if (_comboBar) {
            _comboBar.style.transition = 'none';
            _comboBar.style.width = '100%';
            _comboBar.style.background = colors[tier] || colors[3];
            setTimeout(function () {
                _comboBar.style.transition = 'width ' + (_COMBO_TTL / 1000) + 's linear';
                _comboBar.style.width = '0%';
            }, 20);
        }

        /* audio escalation */
        if (Audio) {
            if (_comboCount >= 10)      Audio.victory();
            else if (_comboCount >= 5)  Audio.crit();
            else                        Audio.hit();
        }

        /* crit flash for high combos */
        if (_comboCount >= 5) {
            screenShake();
            flash('do-flash');
        }

        /* decay after TTL */
        _comboTimer = setTimeout(function () {
            _comboCount = 0;
            if (_comboEl) _comboEl.classList.remove('visible');
        }, _COMBO_TTL);
    }

    /* Wire combo to skill-tag and stat-card clicks (already spawn damage — extend) */
    document.addEventListener('click', function (e) {
        /* Only count clicks on interactive game elements */
        var t = e.target;
        if (t.classList.contains('skill-tag')  ||
            t.classList.contains('stat-card')   ||
            t.closest('.stat-card')             ||
            t.closest('.skill-tag')) {
            incrementCombo();
        }
    }, true);

    /* ══════════════════════════════════════════
       ACHIEVEMENT SYSTEM
    ══════════════════════════════════════════ */
    var _achievements = {};
    var _achieveY     = 80; /* stack offset */

    var ACH_DATA = {
        first_click:   { icon: '👆', zh: '第一次点击！',       en: 'FIRST CLICK!',       ko: '첫 클릭!' },
        first_quest:   { icon: '📜', zh: '任务日志已开启！',   en: 'QUEST LOG OPENED!',  ko: '퀘스트 해금!' },
        skill_warrior: { icon: '⚔',  zh: '技能战士！',         en: 'SKILL WARRIOR!',     ko: '스킬 전사!' },
        save_master:   { icon: '💾', zh: '存档大师！',         en: 'SAVE MASTER!',       ko: '저장 달인!' },
        combo5:        { icon: '🔥', zh: '5连击达成！',        en: '5× COMBO!',          ko: '5콤보 달성!' },
        combo10:       { icon: '💥', zh: '10连击！MAX COMBO！',en: '10× MAX COMBO!',     ko: '10콤보 MAX!' },
        lang_switch:   { icon: '🌐', zh: '多语言解锁！',       en: 'MULTILINGUAL!',      ko: '다국어 해금!' },
        all_quests:    { icon: '🏆', zh: '全任务完成！',       en: 'ALL QUESTS!',        ko: '전 퀘스트!' }
    };

    function unlockAchievement(id) {
        if (_achievements[id]) return;
        _achievements[id] = true;

        var data = ACH_DATA[id];
        if (!data) return;

        var title = data[_lang] || data.en;
        var toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.style.bottom = _achieveY + 'px';
        toast.innerHTML =
            '<span class="a-icon">' + data.icon + '</span>' +
            '<span class="a-label">ACHIEVEMENT UNLOCKED</span>' +
            '<span class="a-title">' + title + '</span>';
        document.body.appendChild(toast);
        _achieveY += 100;
        setTimeout(function () {
            toast.remove();
            _achieveY = Math.max(80, _achieveY - 100);
        }, 3300);

        if (Audio) Audio.equip();
    }

    /* Achievement triggers */
    var _firstClick = false;
    document.addEventListener('click', function () {
        if (!_firstClick && _ready) {
            _firstClick = true;
            setTimeout(function () { unlockAchievement('first_click'); }, 300);
        }
    });

    /* Track quest opens */
    var _questsOpened = {};
    var _origBuildQuests = buildQuests;
    /* We wire achievements via quest open events in the keyboard/click handlers */
    document.addEventListener('questOpened', function (e) {
        if (!_questsOpened[e.detail]) {
            _questsOpened[e.detail] = true;
            if (!_achievements.first_quest) unlockAchievement('first_quest');
            if (Object.keys(_questsOpened).length >= QUESTS.length) {
                unlockAchievement('all_quests');
            }
        }
    });

    /* Skill warrior: click 3+ skill tags */
    var _skillClicks = 0;
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('skill-tag') || e.target.closest('.skill-tag')) {
            _skillClicks++;
            if (_skillClicks >= 3) unlockAchievement('skill_warrior');
        }
    }, true);

    /* Combo achievements */
    var _origIncrementCombo = incrementCombo;
    var _comboAch5  = false;
    var _comboAch10 = false;
    var _realIncrementCombo = function () {
        _origIncrementCombo();
        if (_comboCount >= 5  && !_comboAch5)  { _comboAch5 = true;  unlockAchievement('combo5'); }
        if (_comboCount >= 10 && !_comboAch10) { _comboAch10 = true; unlockAchievement('combo10'); }
    };

    /* Save achievement */
    var _origTriggerSave = triggerSave;
    triggerSave = function () {
        _origTriggerSave();
        unlockAchievement('save_master');
    };

    /* Lang switch achievement */
    var _langSwitched = false;
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!_langSwitched) {
                _langSwitched = true;
                setTimeout(function () { unlockAchievement('lang_switch'); }, 400);
            }
        });
    });

    /* Dispatch questOpened event from openQuest */
    var _openQuestFinal = openQuest;
    openQuest = function (item) {
        _openQuestFinal(item);
        var evt = new CustomEvent('questOpened', { detail: item.id });
        document.dispatchEvent(evt);
    };

}());
