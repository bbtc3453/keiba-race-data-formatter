// ============================================
// JRA Data Extractor - Popup Controller
// ============================================

(function () {
  "use strict";

  // --- Config ---
  // Payhip 販売ページ URL（商品作成後に差し替え）
  const STORE_URL = "https://payhip.com/b/0E3rn";

  // --- Config ---
  const HISTORY_MAX = 10;
  const AI_FREE_LIMIT = 3; // Free 版 AI プロンプト月次上限

  // --- State ---
  let currentFormat = "markdown";
  let extractedData = null;
  let formattedOutput = "";
  let isPro = false;

  // --- Funnel instrumentation (Phase 0) ---
  // ローカル集計のみ（ chrome.storage.local ・外部送信なし・製品リスクゼロ）。
  // どこで離脱するか（ popup 開封→フォーマット選択→ Pro ロック接触→アップグレード→店舗）を
  // n=1 の当て推量から実数に変えるための計測。読み出し: DevTools コンソールで
  //   chrome.storage.local.get("funnelEvents", console.log)
  // 注: 全ユーザー横断の集計（リモート送信）が必要になったら、その時点で
  //   host_permissions 追加 + privacy policy 更新 + 送信処理の実装をセットで行う。
  //   審査リスク回避のため、送信先が未確定の現状ではリモート送信コードは持たない。
  const FUNNEL_KEY = "funnelEvents";
  const FUNNEL_BYDAY_RETENTION = 90; // byDay は直近 N 日のみ保持（ storage 肥大化を防ぐ）

  // 同一クリックで track() が連続発火しても storage の read-modify-write が
  // 競合しないよう、全 track 呼び出しを 1 本のチェーンで直列化する
  // （単一 popup プロセス内なら取りこぼしゼロ）。
  let _trackChain = Promise.resolve();

  async function _trackImpl(event, meta) {
    try {
      const store = await chrome.storage.local.get([FUNNEL_KEY]);
      const data = store[FUNNEL_KEY] || {};
      const day = new Date().toISOString().slice(0, 10);
      const rec = data[event] || { count: 0, byDay: {} };
      rec.count += 1;
      rec.byDay[day] = (rec.byDay[day] || 0) + 1;
      rec.lastTs = Date.now();
      // byDay を直近 N 日に刈り取り（集計値 count/lastTs は別途保持済み）
      const days = Object.keys(rec.byDay).sort();
      if (days.length > FUNNEL_BYDAY_RETENTION) {
        for (const d of days.slice(0, days.length - FUNNEL_BYDAY_RETENTION)) {
          delete rec.byDay[d];
        }
      }
      data[event] = rec;
      await chrome.storage.local.set({ [FUNNEL_KEY]: data });
      // リモート送信は意図的に未実装（外部送信ゼロ）。 meta 引数は将来の
      // リモート集計時に使う想定で各呼び出し側に残しているが、現状は記録しない。
    } catch (_) {
      // 計測の失敗で本体機能を止めない
    }
  }

  function track(event, meta) {
    _trackChain = _trackChain.then(() => _trackImpl(event, meta)).catch(() => {});
    return _trackChain;
  }

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
  const btnDownloadCsv = document.getElementById("btnDownloadCsv");
  const btnCollect = document.getElementById("btnCollect");
  const collectionSection = document.getElementById("collectionSection");
  const collectionList = document.getElementById("collectionList");
  const collectionCount = document.getElementById("collectionCount");
  const btnCollectionExport = document.getElementById("btnCollectionExport");
  const btnCollectionClear = document.getElementById("btnCollectionClear");
  const previewSection = document.getElementById("previewSection");
  const previewBox = document.getElementById("previewBox");
  const previewMeta = document.getElementById("previewMeta");
  const formatBtns = document.querySelectorAll(".format-btn");
  const aiTemplateSection = document.getElementById("aiTemplateSection");
  const aiTemplateOptions = document.getElementById("aiTemplateOptions");

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

  // Upgrade card (Pro ペイウォール・v1.3.3)
  const upgradeCard = document.getElementById("upgradeCard");
  const ucTitle = document.getElementById("ucTitle");
  const btnUpgradeBuy = document.getElementById("btnUpgradeBuy");
  const btnHaveKey = document.getElementById("btnHaveKey");
  const btnUpgradeClose = document.getElementById("btnUpgradeClose");

  // History DOM
  const historySection = document.getElementById("historySection");
  const historyList = document.getElementById("historyList");
  const btnClearHistory = document.getElementById("btnClearHistory");

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
      pattern: /^https:\/\/nar\.netkeiba\.com\/race\/shutuba\.html/,
      site: "netkeiba.com (地方)",
      type: "出馬表",
    },
    {
      pattern: /^https:\/\/nar\.netkeiba\.com\/race\/result\.html/,
      site: "netkeiba.com (地方)",
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

  // 購入後、popup が閉じて再度開いた購入者にキー入力を復元（fable5 レビュー(a)）
  async function maybeRestorePurchaseFlow() {
    try {
      const { purchaseClickedAt } = await chrome.storage.local.get(["purchaseClickedAt"]);
      if (!isPro && purchaseClickedAt &&
          Date.now() - Date.parse(purchaseClickedAt) < 48 * 3600 * 1000) {
        licenseFree.style.display = "none";
        licenseForm.style.display = "block";
        if (!document.getElementById("purchaseHint")) {
          const hint = document.createElement("div");
          hint.id = "purchaseHint";
          hint.className = "purchase-hint";
          hint.textContent = "ご購入ありがとうございます。メールに届いたライセンスキーを貼り付けてください。";
          licenseForm.insertBefore(hint, licenseForm.firstChild);
        }
      }
    } catch (e) {}
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
      try { await chrome.storage.local.remove("purchaseClickedAt"); } catch (e) {}
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
      aiTemplateSection.style.display = "none";
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
    if (upgradeCard) upgradeCard.style.display = "none";

    // Unlock pro format buttons
    document.querySelectorAll(".format-btn.pro-only").forEach((btn) => {
      btn.classList.add("unlocked");
    });
  }

  function updateFreeUI() {
    licenseFree.style.display = "flex";
    licensePro.style.display = "none";
    licenseForm.style.display = "none";
    if (upgradeCard) upgradeCard.style.display = "none";

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

  function showUpgradeCard(context) {
    const kind = context && context.kind ? context.kind : "general";
    let title = "Pro プランのご案内";
    if (kind === "csv") title = "CSV 出力は Pro 機能です";
    else if (kind === "template") title = "「" + (context.label || "この") + "」プロンプトは Pro 機能です";
    else if (kind === "limit") title = "今月の無料枠（3 回）を使い切りました";
    else if (kind === "collection") title = "複数レースの収集・一括出力は Pro 機能です";
    if (ucTitle) ucTitle.textContent = title;
    track("upgrade_card_shown", { context: kind });
    licenseFree.style.display = "none";
    licenseForm.style.display = "none";
    if (licensePro) licensePro.style.display = "none";
    upgradeCard.style.display = "block";
  }

  function hideUpgradeCard() {
    upgradeCard.style.display = "none";
    if (!isPro) licenseFree.style.display = "flex";
  }

  function setupLicenseUI() {
    btnBuyLink.addEventListener("click", (e) => {
      e.preventDefault();
      track("store_url_click", { from: "license" });
      chrome.tabs.create({ url: STORE_URL });
    });

    btnShowLicense.addEventListener("click", () => {
      track("upgrade_click");
      showUpgradeCard({ kind: "general" });
    });

    btnUpgradeBuy.addEventListener("click", () => {
      track("store_url_click", { from: "upgrade_card" });
      // DOM 更新を先に（chrome 呼び出しが失敗しても購入手順へ確実に遷移）
      upgradeCard.style.display = "none";
      licenseForm.style.display = "block";
      // 購入後の迷子防止 + Payhip を開く（guard）
      try {
        chrome.storage.local.set({ purchaseClickedAt: new Date().toISOString() }).catch(() => {});
        chrome.tabs.create({ url: STORE_URL });
      } catch (e) {}
    });

    btnHaveKey.addEventListener("click", (e) => {
      e.preventDefault();
      upgradeCard.style.display = "none";
      licenseForm.style.display = "block";
      licenseKeyInput.focus();
    });

    btnUpgradeClose.addEventListener("click", (e) => {
      e.preventDefault();
      hideUpgradeCard();
    });

    btnCancelLicense.addEventListener("click", () => {
      licenseForm.style.display = "none";
      licenseFree.style.display = "flex";
      licenseKeyInput.value = "";
      hideLicenseError();
      const h = document.getElementById("purchaseHint");
      if (h) h.remove();
      try { chrome.storage.local.remove("purchaseClickedAt").catch(() => {}); } catch (e) {}
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
    track("popup_open");
    setupLicenseUI();
    setupFormatButtons();
    setupExtractButton();
    setupCopyButton();
    setupDownloadCsvButton();
    setupCollectionUI();
    setupHistoryUI();
    await loadLicense();
    await maybeRestorePurchaseFlow();
    await checkCurrentPage();
    await renderHistory();
    renderCollection(await loadCollection());
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
        track("format_click", { format });

        // Pro-only format check
        if (btn.classList.contains("pro-only") && !isPro) {
          track("pro_locked_click", { kind: "format", format });
          showUpgradeCard({ kind: "csv" });
          return;
        }

        hideUpgradeCard();
        formatBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFormat = format;

        // Show/hide AI template selector
        if (format === "ai") {
          renderAITemplates();
          aiTemplateSection.style.display = "block";
          loadAiUsageDisplay();
        } else {
          aiTemplateSection.style.display = "none";
        }

        // Show/hide CSV download button
        if (format === "csv") {
          btnDownloadCsv.classList.add("visible");
        } else {
          btnDownloadCsv.classList.remove("visible");
          btnDownloadCsv.style.display = "";
        }

        // Re-format if data already extracted
        if (extractedData) {
          formattedOutput = formatData(extractedData, currentFormat);
          showPreview(formattedOutput);
        }
      });
    });
  }

  // --- AI Template Selector ---
  function renderAITemplates() {
    const isResult = extractedData ? !!extractedData.raceInfo?.isResult : false;
    aiTemplateOptions.innerHTML = "";

    for (const [key, tpl] of Object.entries(AI_TEMPLATES)) {
      if (tpl.forResult !== isResult) continue;

      const btn = document.createElement("button");
      btn.className = "ai-tpl-btn" + (key === currentAITemplate ? " active" : "");
      btn.dataset.template = key;

      // Pro-only badge
      if (!tpl.free) {
        btn.innerHTML = `${tpl.label} <span class="pro-badge">PRO</span>`;
        if (!isPro) btn.classList.add("ai-tpl-locked");
      } else {
        btn.textContent = tpl.label;
      }

      btn.addEventListener("click", async () => {
        // Pro-only check
        if (!tpl.free && !isPro) {
          track("pro_template_locked_click", { template: key });
          showUpgradeCard({ kind: "template", label: tpl.label });
          return;
        }
        hideUpgradeCard();
        track("ai_template_select", { template: key, pro: isPro });

        // Free 版 月次使用回数制限チェック
        if (!isPro) {
          const allowed = await checkAndIncrementAiUsage();
          if (!allowed) return;
        }

        // Select this template
        aiTemplateOptions.querySelectorAll(".ai-tpl-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentAITemplate = key;

        // Re-format if data already extracted
        if (extractedData) {
          formattedOutput = formatData(extractedData, currentFormat);
          showPreview(formattedOutput);
        }
      });

      aiTemplateOptions.appendChild(btn);
    }
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
          track("extract_success", { horseCount: data.horses.length });
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
        data.raceInfo.raceNumber,
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
    if (btnCollect) btnCollect.style.display = "block";
    saveHistory(data);
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

      // AI 形式のとき、コピー後に「貼り付けが必要」と伝える補足ラベルを用意
      const isAiFormat = currentFormat === "ai";
      const copiedLabel = isAiFormat
        ? "コピー完了！ ChatGPT/Claude に貼り付けてください"
        : "コピーしました!";

      try {
        await navigator.clipboard.writeText(formattedOutput);
        track("copy_success", { format: currentFormat });
        btnCopy.textContent = copiedLabel;
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
        track("copy_success", { format: currentFormat });
        btnCopy.textContent = copiedLabel;
        btnCopy.classList.add("copied");
        setTimeout(() => {
          btnCopy.textContent = "クリップボードにコピー";
          btnCopy.classList.remove("copied");
        }, 2000);
      }
    });
  }

  // --- CSV Download Button ---
  function setupDownloadCsvButton() {
    btnDownloadCsv.addEventListener("click", () => {
      if (!formattedOutput) return;
      const ri = extractedData?.raceInfo || {};
      const raceName = ri.raceName || "race";
      const date = ri.date ? ri.date.replace(/\//g, "-") : new Date().toISOString().slice(0, 10);
      const filename = `${date}_${raceName}.csv`;
      const blob = new Blob(["﻿" + formattedOutput], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download(
        {
          url,
          filename,
          saveAs: true,
        },
        () => {
          URL.revokeObjectURL(url);
        }
      );
    });
  }

  // ============================================
  // Multi-race Collection (v1.4 / Pro)
  //   ユーザーが開いた各レースを端末内(chrome.storage.local)に貯めて一括出力。
  //   自動取得は一切しない＝「見ているページの DOM」のみが対象（privacy/規約の足場を維持）。
  // ============================================
  const COLLECTION_KEY = "collectedRaces";

  function raceKey(data) {
    const ri = (data && data.raceInfo) || {};
    return [ri.date, ri.track, ri.raceNumber, ri.raceName].filter(Boolean).join("|");
  }

  function raceLabel(data) {
    const ri = (data && data.raceInfo) || {};
    const head = [ri.track, ri.raceNumber].filter(Boolean).join(" ");
    return (head ? head + " " : "") + (ri.raceName || "レース");
  }

  async function loadCollection() {
    try {
      const r = await chrome.storage.local.get([COLLECTION_KEY]);
      return Array.isArray(r[COLLECTION_KEY]) ? r[COLLECTION_KEY] : [];
    } catch {
      return [];
    }
  }

  async function saveCollection(list) {
    try {
      await chrome.storage.local.set({ [COLLECTION_KEY]: list });
    } catch (e) {}
  }

  function flashCollect(msg) {
    if (!btnCollect) return;
    const orig = btnCollect.innerHTML;
    btnCollect.textContent = msg;
    setTimeout(() => {
      btnCollect.innerHTML = orig;
    }, 1500);
  }

  async function addToCollection(data) {
    const list = await loadCollection();
    const key = raceKey(data);
    if (list.some((d) => raceKey(d) === key)) {
      flashCollect("このレースは収集済みです");
      return;
    }
    list.push(data);
    await saveCollection(list);
    track("collect_add", { count: list.length });
    flashCollect("追加しました（" + list.length + " レース）");
    renderCollection(list);
  }

  async function clearCollection() {
    await saveCollection([]);
    renderCollection([]);
  }

  function renderCollection(list) {
    if (!collectionSection) return;
    if (!list || list.length === 0) {
      collectionSection.style.display = "none";
      return;
    }
    collectionSection.style.display = "block";
    collectionCount.textContent = String(list.length);
    collectionList.innerHTML = "";
    list.forEach((data, i) => {
      const row = document.createElement("div");
      row.className = "collection-item";
      const span = document.createElement("span");
      span.className = "collection-item-name";
      span.textContent = raceLabel(data);
      const del = document.createElement("button");
      del.className = "collection-item-del";
      del.textContent = "×";
      del.title = "削除";
      del.addEventListener("click", async () => {
        const cur = await loadCollection();
        cur.splice(i, 1);
        await saveCollection(cur);
        renderCollection(cur);
      });
      row.appendChild(span);
      row.appendChild(del);
      collectionList.appendChild(row);
    });
  }

  // 複数レースを 1 つの出力に結合。AI 形式は「全レース比較→今日の1本を選ぶ」プロンプトに。
  function buildCombined(list, format) {
    if (format === "ai") {
      const isResult = !!(list[0] && list[0].raceInfo && list[0].raceInfo.isResult);
      let out =
        "以下は本日注目している " + list.length + " レースの" +
        (isResult ? "結果" : "出馬表") + "データです。\n" +
        "各レースを比較し、最も“買い”に値する 1 レース・1 頭を、根拠とともに 1 つだけ選んでください。\n";
      list.forEach((data, i) => {
        out += "\n=== レース" + (i + 1) + "：" + raceLabel(data) + " ===\n";
        out += formatMarkdown(data) + "\n";
      });
      return out;
    }
    return list.map((d) => formatData(d, format)).join("\n\n---\n\n");
  }

  function setupCollectionUI() {
    if (btnCollect) {
      btnCollect.addEventListener("click", async () => {
        if (!extractedData) return;
        if (!isPro) {
          track("pro_locked_click", { kind: "collection" });
          showUpgradeCard({ kind: "collection" });
          return;
        }
        await addToCollection(extractedData);
      });
    }
    if (btnCollectionClear) {
      btnCollectionClear.addEventListener("click", () => clearCollection());
    }
    if (btnCollectionExport) {
      btnCollectionExport.addEventListener("click", async () => {
        const list = await loadCollection();
        if (!list.length) return;
        const out = buildCombined(list, currentFormat);
        try {
          await navigator.clipboard.writeText(out);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = out;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        track("collection_export", { count: list.length, format: currentFormat });
        const orig = btnCollectionExport.textContent;
        btnCollectionExport.textContent =
          currentFormat === "ai"
            ? "コピー完了！ ChatGPT/Claude に貼り付け"
            : list.length + " レースをコピーしました！";
        btnCollectionExport.classList.add("copied");
        setTimeout(() => {
          btnCollectionExport.textContent = orig;
          btnCollectionExport.classList.remove("copied");
        }, 2000);
      });
    }
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

  // ============================================
  // AI Prompt Templates
  // ============================================

  const AI_TEMPLATES = {
    // --- 出馬表用テンプレート ---
    general: {
      label: "総合分析",
      forResult: false,
      free: true,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n` +
        `このデータを分析し、以下の観点から予想してください：\n` +
        `1. 各馬の能力評価（前走成績・クラス実績から）\n` +
        `2. 展開予想（脚質・枠順から）\n` +
        `3. 馬場適性\n` +
        `4. 推奨買い目（単勝・複勝・馬連）\n\n`,
    },
    // --- 判断エンジン（ブランドの核「買わない理由を探せ」・ Pro 看板）---
    checklist_verdict: {
      label: "買う/見送り判定",
      forResult: false,
      free: false,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n` +
        `このツールの思想は「買う馬を探す」のではなく「買わない理由を探す」。\n` +
        `下のチェックリストで 1 番人気（軸候補）を機械的に評価し、最後に結論を 1 つ出してください。\n` +
        `※必勝法ではありません。規律で危ない馬券を見送るためのフィルターです。\n\n` +
        `■ 絶対条件（ 1 つでも × なら結論は必ず「見送り」）\n` +
        `1. 1 番人気か（前日〜当日で人気の入れ替わりがない）\n` +
        `2. 確定単勝オッズが 1.5 〜 2.0 倍に収まるか（ 1.4 倍以下は妙味なし／ 2.1 倍以上は断然軸でない）\n` +
        `3. 途中オッズから 30% 以上の急落がないか（急落は危険サイン）\n` +
        `4. 2 クラス以上の昇級戦でないか\n\n` +
        `■ 強い条件（複数 × なら「見送り」、 1 つ × は「警戒」）\n` +
        `5. 連対率 60% 以上、または直近 5 走で 3 勝以上か\n` +
        `6. 当該コース・距離で好走歴があるか\n` +
        `7. 前走大敗（ 5 着以下）からの巻き返し狙いでないか\n\n` +
        `■ 出力フォーマット\n` +
        `- 各条件を ○ / × / 不明 で判定（データに無い項目は「不明」とし、推測で ○ にしない）\n` +
        `- 総合判定：【買う】/【警戒】/【見送り】 を必ず 1 つ\n` +
        `- 判定理由を 3 行以内で\n` +
        `- 「警戒」「見送り」の場合は "買わない理由" を具体的に明記\n` +
        `- 確定オッズがデータに無い場合は「オッズ確定後に再評価」と明記する\n` +
        `- 出力の最後に必ず次の一文をそのまま添える：\n` +
        `  「※これは"買っていい条件を満たすか"の判定であり、的中保証ではありません。 1 番人気 1.5-2.0 倍でも約 4 割は飛びます。最終判断は自己責任で。」\n\n`,
    },
    pace: {
      label: "展開予想",
      forResult: false,
      free: false,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n` +
        `展開予想に特化して分析してください：\n` +
        `1. 各馬の脚質（逃げ・先行・差し・追込）を分類\n` +
        `2. テンの速い馬（逃げ・先行馬）を特定し、ペースを予測（ハイペース/ミドル/スロー）\n` +
        `3. 枠順の有利不利（内枠先行有利か、外枠差し有利か）\n` +
        `4. 展開が向く馬と向かない馬を明確に分類\n` +
        `5. 展開を踏まえた推奨馬を 3 頭ピックアップ\n\n`,
    },
    longshot: {
      label: "穴馬発掘",
      forResult: false,
      free: false,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n` +
        `穴馬発掘に特化して分析してください：\n` +
        `1. 単勝オッズ 10 倍以上の馬の中から、実力とオッズに乖離がある馬を特定\n` +
        `2. 人気薄でも好走できる根拠（コース適性、距離実績、騎手力、斤量恩恵など）を具体的に示す\n` +
        `3. 人気馬の死角（過剰人気の根拠）があれば指摘\n` +
        `4. 穴馬を軸にした馬券戦略（単勝・複勝・ワイドなど低リスク馬券）を提案\n\n`,
    },
    blood: {
      label: "血統分析",
      forResult: false,
      free: false,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n` +
        `血統分析に特化して予想してください：\n` +
        `1. 各馬の父・母父から距離適性を評価（短距離型/中距離型/長距離型）\n` +
        `2. 馬場適性を血統から推定（芝向き/ダート向き、重馬場適性）\n` +
        `3. コース適性（${ri.track || ""}${ri.distance || ""}に合う血統パターン）\n` +
        `4. 血統的に過小評価されている馬がいれば指摘\n` +
        `5. 血統面から推奨する馬を 3 頭ピックアップ\n\n`,
    },
    bias: {
      label: "馬場バイアス",
      forResult: false,
      free: false,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）の出馬表データです。\n` +
        `馬場バイアスを考慮して分析してください：\n` +
        `1. ${ri.track || ""}${ri.surface || ""}${ri.distance || ""}のコース形態（直線の長さ、コーナー数、坂の有無）\n` +
        `2. 想定される馬場バイアス（内有利/外有利、前有利/差し有利）\n` +
        `3. 各馬の枠順と脚質がバイアスに合うかを評価\n` +
        `4. バイアスが向く馬と向かない馬を分類\n` +
        `5. 馬場バイアスを最大限活かせる馬を 3 頭推奨\n\n`,
    },
    // --- レース結果用テンプレート ---
    review: {
      label: "レース回顧",
      forResult: true,
      free: true,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）のレース結果データです。\n` +
        `このデータを分析し、以下の観点からレース回顧を行ってください：\n` +
        `1. 勝ち馬の評価（ペース、展開利、能力評価）\n` +
        `2. 各馬の次走への展望\n` +
        `3. 上がり 3F と通過順からの脚質分析\n` +
        `4. 次走で狙える馬のピックアップ\n\n`,
    },
    nextrun: {
      label: "次走注目馬",
      forResult: true,
      free: false,
      prompt: (ri) =>
        `以下は${ri.raceName || "レース"}（${ri.date || ""} ${ri.track || ""} ${ri.distance || ""}）のレース結果データです。\n` +
        `次走で狙える馬の発掘に特化して分析してください：\n` +
        `1. 不利や展開負けで実力を出し切れなかった馬を特定（通過順と上がり 3F に注目）\n` +
        `2. 上がり 3F 上位なのに着順が悪い馬（差し届かず・出遅れなど）をリストアップ\n` +
        `3. クラス昇級初戦で経験不足だった馬（次走同クラスで巻き返す可能性）\n` +
        `4. 各注目馬について、次走で好走するための条件（距離・コース・馬場）を具体的に提示\n\n`,
    },
  };

  // Current AI template selection
  let currentAITemplate = "general";

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
    const pro = isPro;
    let output = "";

    // Race header
    output += `## ${ri.raceName || "レース"}\n\n`;
    const meta = [ri.date, ri.track, ri.distance, ri.surface, ri.condition, ri.raceClass]
      .filter(Boolean)
      .join(" | ");
    if (meta) output += `**${meta}**\n\n`;

    if (isResult) {
      // Free: 着順, 枠, 馬番, 馬名, 性齢, 斤量, 騎手, タイム, 単勝, 人気
      // Pro adds: 着差, 通過, 上がり, 馬体重
      const headers = pro
        ? ["着順", "枠", "馬番", "馬名", "性齢", "斤量", "騎手", "タイム", "着差", "通過", "上がり", "単勝", "人気", "馬体重"]
        : ["着順", "枠", "馬番", "馬名", "性齢", "斤量", "騎手", "タイム", "単勝", "人気"];
      const separator = headers.map(() => "---");
      output += `| ${headers.join(" | ")} |\n`;
      output += `| ${separator.join(" | ")} |\n`;

      for (const h of data.horses) {
        const row = pro
          ? [
              h.finishPosition || "", h.bracketNumber || "", h.horseNumber || "",
              h.horseName || "", h.sexAge || "", h.weight || "", h.jockey || "",
              h.time || "", h.margin || "", h.passage || "", h.lastThreeF || "",
              h.odds || "", h.popularity || "", h.bodyWeight || "",
            ]
          : [
              h.finishPosition || "", h.bracketNumber || "", h.horseNumber || "",
              h.horseName || "", h.sexAge || "", h.weight || "", h.jockey || "",
              h.time || "", h.odds || "", h.popularity || "",
            ];
        output += `| ${row.join(" | ")} |\n`;
      }
    } else {
      // Free: 枠, 馬番, 馬名, 性齢, 斤量, 騎手, 単勝, 人気
      // Pro adds: 調教師, 馬体重
      const headers = pro
        ? ["枠", "馬番", "馬名", "性齢", "斤量", "騎手", "調教師", "馬体重", "単勝", "人気"]
        : ["枠", "馬番", "馬名", "性齢", "斤量", "騎手", "単勝", "人気"];
      const separator = headers.map(() => "---");
      output += `| ${headers.join(" | ")} |\n`;
      output += `| ${separator.join(" | ")} |\n`;

      for (const h of data.horses) {
        const row = pro
          ? [
              h.bracketNumber || "", h.horseNumber || "", h.horseName || "",
              h.sexAge || "", h.weight || "", h.jockey || "", h.trainer || "",
              h.bodyWeight || "", h.odds || "", h.popularity || "",
            ]
          : [
              h.bracketNumber || "", h.horseNumber || "", h.horseName || "",
              h.sexAge || "", h.weight || "", h.jockey || "",
              h.odds || "", h.popularity || "",
            ];
        output += `| ${row.join(" | ")} |\n`;
      }
    }

    // Pedigree (Pro only)
    if (pro && data.horses.some((h) => h.sire || h.dam || h.damSire)) {
      output += `\n### 血統\n\n`;
      output += `| 馬番 | 馬名 | 父 | 母 | 母父 |\n`;
      output += `| --- | --- | --- | --- | --- |\n`;
      for (const h of data.horses) {
        output += `| ${h.horseNumber || ""} | ${h.horseName || ""} | ${h.sire || "-"} | ${h.dam || "-"} | ${h.damSire || "-"} |\n`;
      }
    }

    // Previous races (Pro only, JRA)
    if (pro && data.horses.some((h) => h.prevResults && h.prevResults.length > 0)) {
      output += `\n### 前走成績\n\n`;
      output += `| 馬番 | 馬名 | 前走 | 2 走前 | 3 走前 | 4 走前 |\n`;
      output += `| --- | --- | --- | --- | --- | --- |\n`;
      for (const h of data.horses) {
        const pr = h.prevResults || [];
        const cols = [h.horseNumber || "", h.horseName || ""];
        for (let i = 0; i < 4; i++) {
          cols.push(pr[i] ? `${pr[i].rank || ""}着 ${pr[i].raceName || ""}` : "-");
        }
        output += `| ${cols.join(" | ")} |\n`;
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
    const tpl = AI_TEMPLATES[currentAITemplate];

    // Fallback if template doesn't match result/shutuba
    const fallbackKey = isResult ? "review" : "general";
    const activeTpl = (tpl && tpl.forResult === isResult) ? tpl : AI_TEMPLATES[fallbackKey];

    let output = activeTpl.prompt(ri);
    output += formatMarkdown(data);

    return output;
  }

  // ============================================
  // History (抽出履歴 — 最大 HISTORY_MAX 件)
  // ============================================

  async function saveHistory(data) {
    try {
      const ri = data.raceInfo || {};
      const entry = {
        id: Date.now(),
        raceName: ri.raceName || "レース名不明",
        track: ri.track || "",
        raceNumber: ri.raceNumber || "",
        date: ri.date || "",
        horseCount: data.horses.length,
        data: data,
      };

      const result = await chrome.storage.local.get(["extractHistory"]);
      const history = result.extractHistory || [];
      history.unshift(entry);
      if (history.length > HISTORY_MAX) history.splice(HISTORY_MAX);
      await chrome.storage.local.set({ extractHistory: history });
      await renderHistory();
    } catch {
      // storage unavailable
    }
  }

  async function renderHistory() {
    try {
      const result = await chrome.storage.local.get(["extractHistory"]);
      const history = result.extractHistory || [];
      if (history.length === 0) {
        historySection.style.display = "none";
        return;
      }

      historySection.style.display = "block";
      historyList.innerHTML = "";
      history.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "history-item";

        const nameEl = document.createElement("span");
        nameEl.className = "history-item-name";
        nameEl.textContent = [entry.track, entry.raceNumber, entry.raceName]
          .filter(Boolean)
          .join(" ");

        const metaEl = document.createElement("span");
        metaEl.className = "history-item-meta";
        metaEl.textContent = `${entry.horseCount}頭`;

        item.appendChild(nameEl);
        item.appendChild(metaEl);

        item.addEventListener("click", () => {
          extractedData = entry.data;
          formattedOutput = formatData(extractedData, currentFormat);
          showExtractSuccessFromHistory(entry);
          showPreview(formattedOutput);
        });

        historyList.appendChild(item);
      });
    } catch {
      historySection.style.display = "none";
    }
  }

  function showExtractSuccessFromHistory(entry) {
    statusBanner.className = "status-banner supported";
    statusText.textContent = "履歴から復元";
    btnExtract.disabled = false;

    raceName.textContent = entry.raceName;
    const details = [entry.date, entry.track, entry.raceNumber]
      .filter(Boolean)
      .join(" / ");
    raceDetail.textContent = details;
    horseCount.textContent = `${entry.horseCount} 頭`;
    raceSummary.classList.add("visible");
    btnCopy.classList.add("visible");
  }

  function setupHistoryUI() {
    btnClearHistory.addEventListener("click", async () => {
      await chrome.storage.local.remove(["extractHistory"]);
      await renderHistory();
    });
  }

  // ============================================
  // AI Usage Limit (Free 版 月次カウンター)
  // ============================================

  async function checkAndIncrementAiUsage() {
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const result = await chrome.storage.local.get(["aiUsage"]);
      const usage = result.aiUsage || {};

      const count = usage[monthKey] || 0;

      if (count >= AI_FREE_LIMIT) {
        track("ai_limit_reached", { limit: AI_FREE_LIMIT });
        showAiLimitReached(count);
        return false;
      }

      usage[monthKey] = count + 1;
      await chrome.storage.local.set({ aiUsage: usage });
      updateAiUsageDisplay(usage[monthKey]);
      return true;
    } catch {
      return true; // storage エラー時は制限しない
    }
  }

  async function loadAiUsageDisplay() {
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const result = await chrome.storage.local.get(["aiUsage"]);
      const usage = result.aiUsage || {};
      const count = usage[monthKey] || 0;
      updateAiUsageDisplay(count);
    } catch {
      // ignore
    }
  }

  function updateAiUsageDisplay(count) {
    // 既存の表示を削除
    document.querySelectorAll(".ai-usage-info").forEach((el) => el.remove());

    if (isPro) return;

    const info = document.createElement("div");
    info.className =
      "ai-usage-info" + (count >= AI_FREE_LIMIT ? " limit-reached" : "");

    if (count >= AI_FREE_LIMIT) {
      info.innerHTML = `今月の AI プロンプト上限（${AI_FREE_LIMIT}回）に達しました。<br><a href="#" id="usageBuyLink">Pro にアップグレード &rarr;</a>`;
      aiTemplateSection.appendChild(info);
      const link = info.querySelector("#usageBuyLink");
      if (link) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          showUpgradeCard({ kind: "limit" });
        });
      }
    } else {
      info.innerHTML = `今月の使用回数: <span class="usage-count">${count} / ${AI_FREE_LIMIT}</span> 回`;
      aiTemplateSection.appendChild(info);
    }
  }

  function showAiLimitReached(count) {
    updateAiUsageDisplay(count);
    showUpgradeCard({ kind: "limit" });
  }

  // --- Start ---
  init();
})();
