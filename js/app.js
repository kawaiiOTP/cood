
(() => {
  "use strict";

  /* ========================================
     GOOGLE SPREADSHEET
  ======================================== */

  const COOD_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRSW-3YJKD20TCNdoWflL4jSyspFUtiAeiNLXFuUP1hduT_w_h2j7uL30Xs0q1aSbivDu8yIdL8-6gV/pub?gid=0&single=true&output=csv";

  const EVENT_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRSW-3YJKD20TCNdoWflL4jSyspFUtiAeiNLXFuUP1hduT_w_h2j7uL30Xs0q1aSbivDu8yIdL8-6gV/pub?gid=180598715&single=true&output=csv";


  /* ========================================
     ELEMENTS
  ======================================== */

  const coodList = document.getElementById("cood-list");
  const eventList = document.getElementById("event-list");

  // 件数表示はHTMLから削除されていても動作する
  const coodCount = document.getElementById("cood-count");
  const eventCount = document.getElementById("event-count");


  /* ========================================
     CSV PARSER
  ======================================== */

  function parseCSV(text) {
    const rows = [];

    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") {
          i++;
        }

        row.push(value);

        if (row.some(cell => cell.trim() !== "")) {
          rows.push(row);
        }

        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    row.push(value);

    if (row.some(cell => cell.trim() !== "")) {
      rows.push(row);
    }

    if (!rows.length) {
      return [];
    }

    const headers = rows[0].map(header =>
      header.replace(/^\uFEFF/, "").trim()
    );

    return rows.slice(1).map(cells => {
      const item = {};

      headers.forEach((header, index) => {
        item[header] = (cells[index] || "").trim();
      });

      return item;
    });
  }


  /* ========================================
     FETCH CSV
  ======================================== */

  async function fetchCSV(url) {
    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`CSV取得エラー: ${response.status}`);
    }

    const text = await response.text();

    // Google Sheets側のエラーページなどを検出
    if (
      /^\s*<!doctype html/i.test(text) ||
      /^\s*<html/i.test(text)
    ) {
      throw new Error("CSVではなくHTMLが返されました。公開設定を確認してください。");
    }

    return parseCSV(text);
  }


  /* ========================================
     DATE PARSER
     Google Sheets dates are treated as JST.
  ======================================== */

  function parseDate(value) {
    if (!value) return null;

    const text = String(value).trim();

    // タイムゾーンが明示されている場合
    if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(text)) {
      const date = new Date(text);

      return Number.isNaN(date.getTime()) ? null : date;
    }

    // YYYY/MM/DD または YYYY-MM-DD
    // 時刻は省略可能
    const match = text.match(
      /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );

    if (match) {
      const [
        ,
        year,
        month,
        day,
        hour = "0",
        minute = "0",
        second = "0"
      ] = match;

      const iso =
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` +
        `T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+09:00`;

      const date = new Date(iso);

      return Number.isNaN(date.getTime()) ? null : date;
    }

    // その他の日付形式
    const fallback = new Date(text);

    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }


  /* ========================================
     FORMAT DATE
  ======================================== */

  function formatDate(date) {
    if (!date) return "日時未設定";

    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }


  /* ========================================
     COUNTDOWN
  ======================================== */

  function formatCountdown(targetDate) {
    const now = Date.now();
    const remaining = targetDate.getTime() - now;

    if (remaining <= 0) {
      return "終了";
    }

    const totalMinutes = Math.floor(remaining / 60000);

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `残り ${days}日 ${hours}時間 ${minutes}分`;
    }

    if (hours > 0) {
      return `残り ${hours}時間 ${minutes}分`;
    }

    return `残り ${minutes}分`;
  }


  /* ========================================
     HTML ESCAPE
  ======================================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[char];
    });
  }


  /* ========================================
     URL VALIDATION
  ======================================== */

  function safeURL(value) {
    if (!value) return "";

    try {
      const url = new URL(value);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }


  /* ========================================
     IMAGE
  ======================================== */

  function createImage(imageURL, title) {
    const url = safeURL(imageURL);

    if (!url) {
      return `
        <div class="cood-card__image cood-card__image--empty">
          ✧
        </div>
      `;
    }

    return `
      <div class="cood-card__image">
        <img
          src="${escapeHTML(url)}"
          alt="${escapeHTML(title)}"
          loading="lazy"
          onerror="this.parentElement.innerHTML='<span>✧</span>';this.parentElement.classList.add('cood-card__image--empty');"
        >
      </div>
    `;
  }


  /* ========================================
     OFFICIAL LINK
  ======================================== */

  function createOfficialLink(url) {
    const safe = safeURL(url);

    if (!safe) return "";

    return `
      <div class="cood-card__footer">
        <a
          class="cood-card__official"
          href="${escapeHTML(safe)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          詳細を見る
          <span class="material-symbols-rounded">open_in_new</span>
        </a>
      </div>
    `;
  }


  /* ========================================
     COOD CARD
  ======================================== */

  function createCoodCard(item) {
    const title = item.title || "名称未設定";
    const description = item.description || "";
    const code = item.code || "";
    const endDate = parseDate(item.endDate);

    if (!endDate || !code) {
      return "";
    }

    return `
      <article class="cood-card">

        ${createImage(item.image, title)}

        <div class="cood-card__body">

          <h3 class="cood-card__title">
            ${escapeHTML(title)}
          </h3>

          ${
            description
              ? `<p class="cood-card__description">${escapeHTML(description)}</p>`
              : ""
          }

          <span class="cood-code-label">
            COUPON CODE
          </span>

          <button
            type="button"
            class="cood-code-copy"
            data-copy="${escapeHTML(code)}"
            aria-label="クーポンコードをコピー"
          >
            <span class="cood-code-copy__value">
              ${escapeHTML(code)}
            </span>

            <span class="cood-code-copy__action">
              <span class="material-symbols-rounded">content_copy</span>
              COPY
            </span>
          </button>

          <div class="cood-card__date">

            <span class="cood-card__date-label">
              有効期限
            </span>

            <span class="cood-card__date-value">
              ${escapeHTML(formatDate(endDate))}
            </span>

            <div class="cood-card__countdown">
              <span class="cood-card__countdown-label">
                終了まで残り
              </span>

              <span
                class="cood-card__countdown-value"
                data-countdown="${endDate.getTime()}"
              >
                ${formatCountdown(endDate)}
              </span>
            </div>

          </div>

          ${createOfficialLink(item.officialUrl)}

        </div>

      </article>
    `;
  }


  /* ========================================
     EVENT CARD
  ======================================== */

  function createEventCard(item) {
    const title = item.title || "名称未設定";
    const description = item.description || "";

    const startDate = parseDate(item.startDate);
    const endDate = parseDate(item.endDate);

    if (!startDate || !endDate) {
      return "";
    }

    const now = Date.now();

    const isUpcoming = now < startDate.getTime();

    const status = isUpcoming
      ? "開催予定"
      : "開催中";

    const statusClass = isUpcoming
      ? "cood-card__status--upcoming"
      : "cood-card__status--live";

    return `
      <article class="cood-card">

        ${createImage(item.image, title)}

        <div class="cood-card__body">

          <span class="cood-card__status ${statusClass}">
            ${escapeHTML(status)}
          </span>

          <h3 class="cood-card__title">
            ${escapeHTML(title)}
          </h3>

          ${
            description
              ? `<p class="cood-card__description">${escapeHTML(description)}</p>`
              : ""
          }

          <div class="cood-card__date">

            <span class="cood-card__date-label">
              開催期間
            </span>

            <span class="cood-card__date-value">
              ${escapeHTML(formatDate(startDate))}
              <br>
              〜
              <br>
              ${escapeHTML(formatDate(endDate))}
            </span>

            <div class="cood-card__countdown">
              <span class="cood-card__countdown-label">
                終了まで残り
              </span>

              <span
                class="cood-card__countdown-value"
                data-countdown="${endDate.getTime()}"
              >
                ${formatCountdown(endDate)}
              </span>
            </div>

          </div>

          ${createOfficialLink(item.officialUrl)}

        </div>

      </article>
    `;
  }


  /* ========================================
     UPDATE COUNTDOWN
  ======================================== */

  function updateCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach(element => {
      const timestamp = Number(element.dataset.countdown);

      if (!Number.isFinite(timestamp)) return;

      element.textContent = formatCountdown(new Date(timestamp));
    });
  }


  /* ========================================
     COPY BUTTON
  ======================================== */

  document.addEventListener("click", async event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const button = target.closest(".cood-code-copy");

    if (!button) return;

    const code = button.dataset.copy;

    if (!code) return;

    const action = button.querySelector(".cood-code-copy__action");

    if (!action) return;

    const showCopied = () => {
      action.innerHTML = `
        <span class="material-symbols-rounded">check</span>
        COPIED
      `;

      button.classList.add("is-copied");

      setTimeout(() => {
        action.innerHTML = `
          <span class="material-symbols-rounded">content_copy</span>
          COPY
        `;

        button.classList.remove("is-copied");
      }, 1800);
    };

    try {
      await navigator.clipboard.writeText(code);
      showCopied();

    } catch (error) {
      // Clipboard APIが使えない場合の代替処理
      const textarea = document.createElement("textarea");

      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);

      textarea.select();

      const copied = document.execCommand("copy");

      textarea.remove();

      if (copied) {
        showCopied();
      } else {
        action.textContent = "コピーできません";
      }
    }
  });


  /* ========================================
     LOAD COOD
  ======================================== */

  async function loadCood() {
    if (!coodList) {
      console.warn("COOD表示先 #cood-list が見つかりません。");
      return;
    }

    try {
      const items = await fetchCSV(COOD_CSV_URL);

      const now = Date.now();

      const activeItems = items
        .map(item => ({
          ...item,
          parsedEndDate: parseDate(item.endDate)
        }))
        .filter(item =>
          item.parsedEndDate &&
          item.parsedEndDate.getTime() > now &&
          item.code
        );

      const html = activeItems
        .map(createCoodCard)
        .filter(Boolean)
        .join("");

      coodList.innerHTML = html || `
        <div class="cood-empty">
          現在掲載中のクーポンはありません。
        </div>
      `;

      // 件数表示がHTMLに存在する場合だけ更新
      if (coodCount) {
        coodCount.textContent = `${activeItems.length} ITEMS`;
      }

    } catch (error) {
      console.error("COOD読み込みエラー:", error);

      coodList.innerHTML = `
        <div class="cood-error">
          クーポン情報を読み込めませんでした。<br>
          時間をおいて再度アクセスしてください。
        </div>
      `;

      if (coodCount) {
        coodCount.textContent = "ERROR";
      }
    }
  }


  /* ========================================
     LOAD EVENT
  ======================================== */

  async function loadEvent() {
    if (!eventList) {
      console.warn("EVENT表示先 #event-list が見つかりません。");
      return;
    }

    try {
      const items = await fetchCSV(EVENT_CSV_URL);

      const now = Date.now();

      const activeItems = items
        .map(item => ({
          ...item,
          parsedStartDate: parseDate(item.startDate),
          parsedEndDate: parseDate(item.endDate)
        }))
        .filter(item =>
          item.parsedStartDate &&
          item.parsedEndDate &&
          item.parsedEndDate.getTime() > now &&
          item.parsedEndDate.getTime() > item.parsedStartDate.getTime()
        )
        .sort((a, b) =>
          a.parsedStartDate.getTime() - b.parsedStartDate.getTime()
        );

      const html = activeItems
        .map(createEventCard)
        .filter(Boolean)
        .join("");

      eventList.innerHTML = html || `
        <div class="cood-empty">
          現在掲載中・開催予定のイベントはありません。
        </div>
      `;

      // 件数表示がHTMLに存在する場合だけ更新
      if (eventCount) {
        eventCount.textContent = `${activeItems.length} ITEMS`;
      }

    } catch (error) {
      console.error("EVENT読み込みエラー:", error);

      eventList.innerHTML = `
        <div class="cood-error">
          イベント情報を読み込めませんでした。<br>
          時間をおいて再度アクセスしてください。
        </div>
      `;

      if (eventCount) {
        eventCount.textContent = "ERROR";
      }
    }
  }


  /* ========================================
     INITIALIZE
  ======================================== */

  async function init() {
    await Promise.all([
      loadCood(),
      loadEvent()
    ]);

    updateCountdowns();
  }

  init();


  /* ========================================
     AUTO UPDATE
  ======================================== */

  // カウントダウンを30秒ごとに更新
  setInterval(updateCountdowns, 30000);

  // 60秒ごとにデータを再取得し、終了済み情報を非表示にする
  setInterval(() => {
    loadCood();
    loadEvent();
  }, 60000);

})();
