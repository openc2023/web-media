const STORAGE_KEY = "inno-things-locale";
const DEFAULT_LOCALE = "zh-CN";

const DICTIONARIES = {
    "zh-CN": {
        page: {
            title: "TOP | Recognition Entry",
            description: "TOP 画作识别入口。",
        },
        top: {
            eyebrow: "TOP",
            code: "000-top",
            index: "01",
            heading: "先看画作",
            lead: "确认画作后，再开始识别。",
            start: "开始识别",
            metaTargetLabel: "识别图",
            metaTargetValue: "000-top",
            metaModelLabel: "模型",
            metaModelValue: "box.glb",
            metaModeLabel: "模式",
            metaModeValue: "AR",
            noteTitle: "识别前",
            noteItem1: "尽量让整幅画进入取景框",
            noteItem2: "保持镜头稳定，慢慢靠近",
            statusIdle: "等待开始识别。",
            artworkAlt: "000-top 画作",
            artworkCaption: "000-top",
            closeAria: "关闭识别",
            badgeLoading: "加载中…",
            badgeScanning: "扫描中，请对准画作",
            badgeFound: "已识别",
            badgeLost: "目标离开，请重新对准",
            statusFound: "已识别到 000-top。",
            statusLost: "目标暂时离开画面，请重新对准 000-top 画作。",
            statusNeedHttps: "请用 HTTPS 或 localhost 访问，不能直接打开本地 HTML。",
            statusNeedSecureContext: "当前不是安全环境，请改用 HTTPS 或 localhost 打开。",
            statusNoCameraSupport: "当前浏览器不支持摄像头调用。",
            statusLoadingEngine: "正在加载识别引擎，请稍候…",
            statusCameraReady: "摄像头已就绪，请对准 000-top 画作。",
            statusPermissionDenied: "未获得摄像头权限，请在浏览器里允许相机访问。",
            statusCameraBusy: "摄像头被其他应用占用，关闭后再试。",
            statusCameraAborted: "相机启动被系统中断，请重新点击开始识别。",
            statusMindMissing: "找不到 000-top.mind，请确认 target 文件已上传到服务器。",
            statusStartTimeout: "启动超时，MindAR 初始化或相机握手卡住，请刷新重试。",
            statusStartFailed: "启动失败：{message}，请刷新后重试。",
        },
    },
    en: {
        page: {
            title: "TOP | Recognition Entry",
            description: "Recognition entry for the TOP artwork.",
        },
        top: {
            eyebrow: "TOP",
            code: "000-top",
            index: "01",
            heading: "View The Artwork First",
            lead: "Check the artwork, then start recognition.",
            start: "Start Recognition",
            metaTargetLabel: "Target",
            metaTargetValue: "000-top",
            metaModelLabel: "Model",
            metaModelValue: "box.glb",
            metaModeLabel: "Mode",
            metaModeValue: "AR",
            noteTitle: "Before Scan",
            noteItem1: "Keep the whole artwork inside the frame",
            noteItem2: "Hold the camera steady and move in slowly",
            statusIdle: "Waiting to start recognition.",
            artworkAlt: "000-top artwork",
            artworkCaption: "000-top",
            closeAria: "Close recognition",
            badgeLoading: "Loading…",
            badgeScanning: "Scanning, align with the artwork",
            badgeFound: "Recognized",
            badgeLost: "Target lost, align again",
            statusFound: "000-top recognized.",
            statusLost: "The target left the frame. Align with the 000-top artwork again.",
            statusNeedHttps: "Use HTTPS or localhost. Do not open the local HTML file directly.",
            statusNeedSecureContext: "This is not a secure context. Open it with HTTPS or localhost.",
            statusNoCameraSupport: "This browser does not support camera access.",
            statusLoadingEngine: "Loading the recognition engine…",
            statusCameraReady: "Camera is ready. Align with the 000-top artwork.",
            statusPermissionDenied: "Camera permission was denied. Allow camera access in the browser.",
            statusCameraBusy: "The camera is being used by another app. Close it and try again.",
            statusCameraAborted: "Camera startup was interrupted. Tap Start Recognition again.",
            statusMindMissing: "000-top.mind is missing. Make sure the target file is uploaded.",
            statusStartTimeout: "Startup timed out. MindAR or the camera handshake is stuck. Refresh and try again.",
            statusStartFailed: "Startup failed: {message}. Refresh and try again.",
        },
    },
    ko: {
        page: {
            title: "TOP | Recognition Entry",
            description: "TOP 작품 인식 진입 페이지입니다.",
        },
        top: {
            eyebrow: "TOP",
            code: "000-top",
            index: "01",
            heading: "먼저 작품을 보세요",
            lead: "작품을 확인한 뒤 인식을 시작하세요.",
            start: "인식 시작",
            metaTargetLabel: "인식 이미지",
            metaTargetValue: "000-top",
            metaModelLabel: "모델",
            metaModelValue: "box.glb",
            metaModeLabel: "모드",
            metaModeValue: "AR",
            noteTitle: "인식 전",
            noteItem1: "작품 전체가 프레임 안에 들어오게 맞춰 주세요",
            noteItem2: "카메라를 안정적으로 들고 천천히 가까이 가세요",
            statusIdle: "인식을 시작할 준비가 되었습니다.",
            artworkAlt: "000-top 작품",
            artworkCaption: "000-top",
            closeAria: "인식 닫기",
            badgeLoading: "불러오는 중…",
            badgeScanning: "스캔 중, 작품에 맞춰 주세요",
            badgeFound: "인식됨",
            badgeLost: "대상이 벗어났습니다. 다시 맞춰 주세요",
            statusFound: "000-top이 인식되었습니다.",
            statusLost: "대상이 화면을 벗어났습니다. 000-top 작품에 다시 맞춰 주세요.",
            statusNeedHttps: "HTTPS 또는 localhost로 접속해 주세요. 로컬 HTML 파일을 직접 열면 안 됩니다.",
            statusNeedSecureContext: "보안 컨텍스트가 아닙니다. HTTPS 또는 localhost로 열어 주세요.",
            statusNoCameraSupport: "현재 브라우저는 카메라 접근을 지원하지 않습니다.",
            statusLoadingEngine: "인식 엔진을 불러오는 중입니다…",
            statusCameraReady: "카메라 준비가 완료되었습니다. 000-top 작품에 맞춰 주세요.",
            statusPermissionDenied: "카메라 권한이 없습니다. 브라우저에서 카메라 접근을 허용해 주세요.",
            statusCameraBusy: "다른 앱이 카메라를 사용 중입니다. 종료한 뒤 다시 시도해 주세요.",
            statusCameraAborted: "카메라 시작이 중단되었습니다. 인식 시작을 다시 눌러 주세요.",
            statusMindMissing: "000-top.mind 파일을 찾을 수 없습니다. target 파일 업로드를 확인해 주세요.",
            statusStartTimeout: "시작 시간이 초과되었습니다. MindAR 또는 카메라 초기화가 멈췄습니다. 새로고침 후 다시 시도해 주세요.",
            statusStartFailed: "시작 실패: {message}. 새로고침 후 다시 시도해 주세요.",
        },
    },
};

const LOCALE_ALIASES = {
    zh: "zh-CN",
    "zh-cn": "zh-CN",
    "zh-hans": "zh-CN",
    en: "en",
    "en-us": "en",
    "en-gb": "en",
    ko: "ko",
    "ko-kr": "ko",
};

const getByPath = (object, path) =>
    path.split(".").reduce((value, segment) => (value && segment in value ? value[segment] : undefined), object);

const formatTemplate = (template, vars = {}) =>
    template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : ""));

const normalizeLocale = (input) => {
    if (!input) return null;
    const lowered = String(input).trim().toLowerCase();
    return LOCALE_ALIASES[lowered] || LOCALE_ALIASES[lowered.split("-").slice(0, 2).join("-")] || LOCALE_ALIASES[lowered.split("-")[0]] || null;
};

const resolvePreferredLocale = () => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");
    const storedLocale = window.localStorage.getItem(STORAGE_KEY);
    const browserLocales = [...(navigator.languages || []), navigator.language];
    const candidates = [urlLocale, storedLocale, ...browserLocales];

    for (const candidate of candidates) {
        const normalized = normalizeLocale(candidate);
        if (normalized && DICTIONARIES[normalized]) {
            return normalized;
        }
    }

    return DEFAULT_LOCALE;
};

export const createI18n = () => {
    let locale = resolvePreferredLocale();

    const t = (key, vars) => {
        const localized = getByPath(DICTIONARIES[locale], key);
        const fallback = getByPath(DICTIONARIES[DEFAULT_LOCALE], key);
        const template = localized ?? fallback ?? key;
        return typeof template === "string" ? formatTemplate(template, vars) : template;
    };

    const applyPageTranslations = (root = document) => {
        root.querySelectorAll("[data-i18n]").forEach((element) => {
            element.textContent = t(element.dataset.i18n);
        });

        root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
            element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
        });

        root.querySelectorAll("[data-i18n-alt]").forEach((element) => {
            element.setAttribute("alt", t(element.dataset.i18nAlt));
        });

        const description = document.querySelector('meta[name="description"]');
        if (description) {
            description.setAttribute("content", t("page.description"));
        }

        document.title = t("page.title");
        document.documentElement.lang = locale;
    };

    const setLocale = (nextLocale, { persist = true } = {}) => {
        const normalized = normalizeLocale(nextLocale) || DEFAULT_LOCALE;
        locale = DICTIONARIES[normalized] ? normalized : DEFAULT_LOCALE;

        if (persist) {
            window.localStorage.setItem(STORAGE_KEY, locale);
        }

        applyPageTranslations();
        return locale;
    };

    return {
        t,
        getLocale: () => locale,
        setLocale,
        applyPageTranslations,
        locales: Object.keys(DICTIONARIES),
    };
};
