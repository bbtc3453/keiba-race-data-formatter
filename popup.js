// ============================================
// JRA Data Extractor - Popup Controller
// ============================================

(function () {
  "use strict";

  // --- Config ---
  // Payhip 販売ページ URL（商品作成後に差し替え）
  const STORE_URL = "https://payhip.com/b/0E3rn";

  // --- State ---
  let currentFormat = "markdown";
  let extractedData = null;
  let formattedOutput = "";
  let isPro = false;

  // --- DOM Elements ---
  const statusBanner = document.getElementById("statusBanner");
  const statusText = document.getElementById("statusText");
  const pageInfo = document.getElementById("pageInfo");
  const siteName = document.getElementById("siteName");
  const pageType = document.getElementById("pageType");
  const raceSummary = document.getElementById("raceSummary");
  const raceName = document.getElementById("raceName");
  const raceDetail = document.getElementById("raceDetail");
  const horseCount = document.getElementById("horseCount");
  const formatSection = document.getElementById("formatSection");
  const btnExtract = document.getElementById("btnExtract");
  const btnCopy = document.getElementById("btnCopy");
  const previewSection = document.getElementById("previewSection");
  const previewBox = document.getElementById("previewBox");
  const previewMeta = document.getElementById("previewMeta");
  const formatBtns = document.querySelectorAll(".format-btn");

  // License DOM
  const licenseFree = document.getElementById("licenseFree");
  const licensePro = document.getElementById("licensePro");
  const licenseForm = document.getElementById("licenseForm");
  const licenseKeyInput = document.getElementById("licenseKeyInput");
  const licenseError = document.getElementById("licenseError");
  const btnShowLicense = document.getElementById("btnShowLicense");
  const btnActivate = document.getElementById("btnActivate");
  const btnCancelLicense = document.getElementById("btnCancelLicense");
  const btnDeactivate = document.getElementById("btnDeactivate");
  const btnBuyLink = document.getElementById("btnBuyLink");

  // --- Supported URL patterns ---
  const SUPPORTED_SITES = [
    {
      pattern: /^https:\/\/race\.netkeiba\.com\/race\/shutuba\.html/,
      site: "netkeiba.com",
      type: "出馬表",
    },
    {
      pattern: /^https:\/\/race\.netkeiba\.com\/race\/result\.html/,
      site: "netkeiba.com",
      type: "レース結果",
    },
    {
      pattern: /^https:\/\/www\.jra\.go\.jp\/JRADB\/accessD\.html/,
      site: "JRA 公式",
      type: "出馬表",
    },
    {
      pattern: /^https:\/\/www\.jra\.go\.jp\/JRADB\/accessS\.html/,
      site: "JRA 公式",
      type: "レース結果",
    },
  ];

  // ============================================
  // License Management
  // ============================================

  async function loadLicense() {
    try {
      const result = await chrome.storage.local.get(["licenseKey", "isPro"]);
      if (result.isPro && result.licenseKey) {
        isPro = true;
        updateProUI();
      }
    } catch {
      // storage not available
    }
  }

  async function activateLicense(key) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      showLicenseError("ライセンスキーを入力してください");
      return;
    }

    btnActivate.textContent = "認証中...";
    btnActivate.disabled = true;

    // Payhip ライセンスキー形式: 英数字 8 桁 x4（ハイフン区切り）
    const isValid = /^[A-Z0-9]{4,8}(-[A-Z0-9]{4,8}){2,3}$/i.test(trimmedKey);

    if (isValid) {
      isPro = true;
      await chrome.storage.local.set({
        licenseKey: trimmedKey,
        isPro: true,
        activatedAt: new Date().toISOString(),
      });
      updateProUI();
      hideLicenseError();
    } else {
      showLicenseError("無効なライセンスキーです。もう一度ご確認ください。");
    }

    btnActivate.textContent = "認証";
    btnActivate.disabled = false;
  }

  async function deactivateLicense() {
    isPro = false;
    await chrome.storage.local.remove(["licenseKey", "isPro", "activatedAt"]);
    updateFreeUI();

    // Reset to markdown if currently on a pro format
    if (currentFormat !== "markdown") {
      currentFormat = "markdown";
      formatBtns.forEach((b) => b.classList.remove("active"));
      formatBtns[0].classList.add("active");
      if (extractedData) {
        formattedOutput = formatData(extractedData, currentFormat);
        showPreview(formattedOutput);
      }
    }
  }

  function updateProUI() {
    licenseFree.style.display = "none";
    licensePro.style.display = "flex";
    licenseForm.style.display = "none";

    // Unlock pro format buttons
    document.querySelectorAll(".format-btn.pro-only").forEach((btn) => {
      btn.classList.add("unlocked");
    });
  }

  function updateFreeUI() {
    licenseFree.style.display = "flex";
    licensePro.style.display = "none";
    licenseForm.style.display = "none";

    // Lock pro format buttons
    document.querySelectorAll(".format-btn.pro-only").forEach((btn) => {
      btn.classList.remove("unlocked");
    });
  }

  function showLicenseError(msg) {
    licenseError.textContent = msg;
    licenseError.style.display = "block";
  }

  function hideLicenseError() {
    licenseError.style.display = "none";
  }

  function setupLicenseUI() {
    btnBuyLink.href = STORE_URL;

    btnShowLicense.addEventListener("click", () => {
      licenseFree.style.display = "none";
      licenseForm.style.display = "block";
      licenseKeyInput.focus();
    });

    btnCancelLicense.addEventListener("click", () => {
      licenseForm.style.display = "none";
      licenseFree.style.display = "flex";
      licenseKeyInput.value = "";
      hideLicenseError();
    });

    btnActivate.addEventListener("click", () => {
      activateLicense(licenseKeyInput.value);
    });

    licenseKeyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        activateLicense(licenseKeyInput.value);
      }
    });

    btnDeactivate.addEventListener("click", () => {
      deactivateLicense();
    });
  }

  // ============================================
  // Initialize
  // ============================================

  async function init() {
    setupLicenseUI();
    setupFormatButtons();
    setupExtractButton();
    setupCopyButton();
    await loadLicense();
    await checkCurrentPage();
  }

  // --- Check if current page is supported ---
  async function checkCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || !tab.url) {
        setUnsupported();
        return;
      }

      const matched = SUPPORTED_SITES.find((s) => s.pattern.test(tab.url));
      if (matched) {
        setSupported(matched.site, matched.type);
      } else {
        setUnsupported();
      }
    } catch {
      setUnsupported();
    }
  }

  function setSupported(site, type) {
    statusBanner.className = "status-banner supported";
    statusText.textContent = "対応ページを検出しました";

    siteName.textContent = site;
    pageType.textContent = type;
    pageInfo.style.display = "block";

    formatSection.style.display = "block";
    btnExtract.disabled = false;
  }

  function setUnsupported() {
    statusBanner.className = "status-banner unsupported";
    statusText.textContent = "このページには対応していません";
    pageInfo.style.display = "none";
    formatSection.style.display = "none";
    btnExtract.disabled = true;
  }

  function setLoading(msg) {
    statusBanner.className = "status-banner loading";
    statusText.textContent = msg || "抽出中...";
    btnExtract.disabled = true;
  }

  // --- Format Buttons ---
  function setupFormatButtons() {
    formatBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const format = btn.dataset.format;

        // Pro-only format check
        if (btn.classList.contains("pro-only") && !isPro) {
          // Show license form
          licenseFree.style.display = "none";
          licenseForm.style.display = "block";
          licenseKeyInput.focus();
          return;
        }

        formatBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFormat = format;

        // Re-format if data already extracted
        if (extractedData) {
          formattedOutput = formatData(extractedData, currentFormat);
          showPreview(formattedOutput);
        }
      });
    });
  }

  // --- Extract Button ---
  function setupExtractButton() {
    btnExtract.addEventListener("click", async () => {
      setLoading("データを抽出中...");
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            if (typeof window.__jraExtractData === "function") {
              return window.__jraExtractData();
            }
            return null;
          },
        });

        const data = results?.[0]?.result;

        if (data && data.horses && data.horses.length > 0) {
          extractedData = data;
          formattedOutput = formatData(data, currentFormat);
          showExtractSuccess(data);
          showPreview(formattedOutput);
        } else {
          showExtractError("データを取得できませんでした。ページを再読み込みしてお試しください。");
        }
      } catch (err) {
        showExtractError("抽出エラー: " + err.message);
      }
    });
  }

  function showExtractSuccess(data) {
    statusBanner.className = "status-banner supported";
    statusText.textContent = "抽出完了";
    btnExtract.disabled = false;

    // Show race summary
    if (data.raceInfo) {
      raceName.textContent = data.raceInfo.raceName || "レース名不明";
      const details = [
        data.raceInfo.date,
        data.raceInfo.track,
        data.raceInfo.distance,
        data.raceInfo.surface,
        data.raceInfo.raceClass,
      ]
        .filter(Boolean)
        .join(" / ");
      raceDetail.textContent = details;
      horseCount.textContent = `${data.horses.length} 頭`;
      raceSummary.classList.add("visible");
    }

    btnCopy.classList.add("visible");
  }

  function showExtractError(msg) {
    statusBanner.className = "status-banner unsupported";
    statusText.textContent = msg;
    btnExtract.disabled = false;
  }

  // --- Copy Button ---
  function setupCopyButton() {
    btnCopy.addEventListener("click", async () => {
      if (!formattedOutput) return;

      try {
        await navigator.clipboard.writeText(formattedOutput);
        btnCopy.textContent = "コピーしました!";
        btnCopy.classList.add("copied");
        setTimeout(() => {
          btnCopy.textContent = "クリップボードにコピー";
          btnCopy.classList.remove("copied");
        }, 2000);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = formattedOutput;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        btnCopy.textContent = "コピーしました!";
        btnCopy.classList.add("copied");
        setTimeout(() => {
          btnCopy.textContent = "クリップボードにコピー";
          btnCopy.classList.remove("copied");
        }, 2000);
      }
    });
  }

  // --- Preview ---
  function showPreview(text) {
    previewBox.textContent = text;
    const lines = text.split("\n").length;
    const chars = text.length;
    previewMeta.textContent = `${lines} 行 / ${chars.toLocaleString()} 文字`;
    previewSection.classList.add("visible");
  }

  // ============================================
  // Data Formatting
  // ============================================

  function formatData(data, format) {
    switch (format) {
      case "markdown":
        return formatMarkdown(data);
      case "csv":
        return formatCSV(data);
      case "ai":
        return formatAI(data);
      default:
        return formatMarkdown(data);
    }
  }

  // --- Markdown Table ---
  function formatMarkdown(data) {
    const ri = data.raceInfo || {};
    const isResult = !!ri.isResult;
    let output = "";

    // Race header
    output += `## ${ri.raceName || "レース"}\n\n`;
    const meta = [ri.date, ri.track, ri.distance, ri.surface, ri.condition, ri.raceClass]
      .filter(Boolean)
      .join(" | ");
    if (meta) output += `**${meta}**\n\n`;

    if (isResult) {
      const headers = ["着順", "枠", "馬番", "馬名", "性齢", "斤量", "騎手", "タイム", "着差", "通過", "上がり", "単勝", "人気", "馬体重"];
      const separator = headers.map(() => "---");
      output += `| ${headers.join(" | ")} |\n`;
      output += `| ${separator.join(" | ")} |\n`;

      for (const h of data.horses) {
        const row = [
          h.finishPosition || "",
          h.bracketNumber || "",
          h.horseNumber || "",
          h.horseName || "",
          h.sexAge || "",
          h.weight || "",
          h.jockey || "",
          h.time || "",
          h.margin || "",
          h.passage || "",
          h.lastThreeF || "",
          h.odds || "",
          h.popularity || "",
          h.bodyWeight || "",
        ];
        output += `| ${row.join(" | ")} |\n`;
      }
    } else {
      const headers = ["枠", "馬番", "馬名", "性齢", "斤量", "騎手", "調教師", "馬体重", "単勝", "人気"];
      const separator = headers.map(() => "---");
      output += `| ${headers.join(" | ")} |\n`;
      output += `| ${separator.join(" | ")} |\n`;

      for (const h of data.horses) {
        const row = [
          h.bracketNumber || "",
          h.horseNumber || "",
          h.horseName || "",
          h.sexAge || "",
          h.weight || "",
          h.jockey || "",
          h.trainer || "",
          h.bodyWeight || "",
          h.odds || "",
          h.popularity || "",
        ];
        output += `| ${row.join(" | ")} |\n`;
      }
    }

    // Pedigree
    if (data.horses.some((h) => h.sire || h.dam || h.damSire)) {
      output += `\n### 血統\n\n`;
      output += `| 馬番 | 馬名 | 父 | 母 | 母父 |\n`;
      output += `| --- | --- | --- | --- | --- |\n`;
      for (const h of data.horses) {
        output += `| ${h.horseNumber || ""} | ${h.horseName || ""} | ${h.sire || "-"} | ${h.dam || "-"} | ${h.damSire || "-"} |\n`;
      }
    }

    return output;
  }

  // --- CSV ---
  function formatCSV(data) {
    const ri = data.raceInfo || {};
    const isResult = !!ri.isResult;
    let output = "";

    output += `# ${ri.raceName || "レース"},${ri.date || ""},${ri.track || ""},${ri.distance || ""},${ri.surface || ""},${ri.condition || ""},${ri.raceClass || ""}\n`;

    if (isResult) {
      const headers = ["着順", "枠番", "馬番", "馬名", "性齢", "斤量", "騎手", "タイム", "着差", "通過順", "上がり 3F", "単勝オッズ", "人気", "馬体重", "調教師"];
      output += headers.join(",") + "\n";

      for (const h of data.horses) {
        const row = [
          h.finishPosition || "",
          h.bracketNumber || "",
          h.horseNumber || "",
          csvEscape(h.horseName || ""),
          h.sexAge || "",
          h.weight || "",
          csvEscape(h.jockey || ""),
          h.time || "",
          csvEscape(h.margin || ""),
          h.passage || "",
          h.lastThreeF || "",
          h.odds || "",
          h.popularity || "",
          csvEscape(h.bodyWeight || ""),
          csvEscape(h.trainer || ""),
        ];
        output += row.join(",") + "\n";
      }
    } else {
      const headers = ["枠番", "馬番", "馬名", "性齢", "斤量", "騎手", "調教師", "馬体重", "単勝オッズ", "人気"];
      output += headers.join(",") + "\n";

      for (const h of data.horses) {
        const row = [
          h.bracketNumber || "",
          h.horseNumber || "",
          csvEscape(h.horseName || ""),
          h.sexAge || "",
          h.weight || "",
          csvEscape(h.jockey || ""),
          csvEscape(h.trainer || ""),
          csvEscape(h.bodyWeight || ""),
          h.odds || "",
          h.popularity || "",
        ];
        output += row.join(",") + "\n";
      }
    }

    return output;
  }

  function csvEscape(val) {
    if (typeof val !== "string") return val;
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

  // --- AI Analysis Prompt ---
  function formatAI(data) {
    const ri = data.raceInfo || {};
    const isResult = !!ri.isResult;
    let output = "";

    if (isResult) {
      output += `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）のレース結果データです。\n`;
      output += `このデータを分析し、以下の観点からレース回顧を行ってください：\n`;
      output += `1. 勝ち馬の評価（ペース、展開利、能力評価）\n`;
      output += `2. 各馬の次走への展望\n`;
      output += `3. 上がり 3F と通過順からの脚質分析\n`;
      output += `4. 次走で狙える馬のピックアップ\n\n`;
    } else {
      output += `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n`;
      output += `このデータを分析し、以下の観点から予想してください：\n`;
      output += `1. 各馬の能力評価（前走成績・クラス実績から）\n`;
      output += `2. 展開予想（脚質・枠順から）\n`;
      output += `3. 馬場適性\n`;
      output += `4. 推奨買い目（単勝・複勝・馬連）\n\n`;
    }

    output += formatMarkdown(data);

    return output;
  }

  // --- Start ---
  init();
})();
