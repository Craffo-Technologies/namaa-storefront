(function () {
  "use strict";

  var VERSION = "0.3.10";
  var DEFAULT_APP_ID = 616179871;
  var STYLE_ID = "namaa-widget-styles";
  var pendingAction = null;
  var interceptBound = false;
  var currencyBound = false;
  var productFormBound = false;
  var cartWatchBound = false;
  var cartUiLock = false;
  var modalEl = null;
  var widgetState = {
    config: null,
    productId: null,
    storePrice: 0,
    listPrice: 0,
    regularPrice: 0,
    selectedOffer: null,
    cartRecurring: [],
    buyMode: "subscribe",
    couponEnsured: "",
    pendingCoupon: null,
  };

  function configGet(key) {
    try {
      if (window.salla && window.salla.config && typeof window.salla.config.get === "function") {
        return window.salla.config.get(key);
      }
    } catch (error) {
      console.warn("[Namaa] config get failed", key, error);
    }

    return null;
  }

  function apiOrigin() {
    var scripts = document.getElementsByTagName("script");
    var i;
    var src;

    for (i = 0; i < scripts.length; i += 1) {
      src = scripts[i].src || "";
      if (src.indexOf("namaa-storefront") !== -1) {
        try {
          return new URL(src).origin;
        } catch (error) {
          break;
        }
      }
    }

    return "https://nama.craffo.com";
  }

  function cssVar(name) {
    try {
      return String(getComputedStyle(document.documentElement).getPropertyValue(name) || "").trim();
    } catch (error) {
      return "";
    }
  }

  function themeOnPrimary() {
    var fromTheme = configGet("theme.color.text");
    var reverse = cssVar("--color-primary-reverse");
    var primary = cssVar("--color-primary") || configGet("theme.color.primary") || "";
    var hex = String(fromTheme || "").replace("#", "");

    if (fromTheme && /^[0-9a-fA-F]{3,8}$/.test(hex)) {
      return String(fromTheme);
    }

    if (reverse && reverse.toLowerCase() !== primary.toLowerCase()) {
      return reverse;
    }

    return "#ffffff";
  }

  function injectStyles() {
    var el = document.getElementById(STYLE_ID);
    var onPrimary = themeOnPrimary();

    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      el.type = "text/css";
      document.head.appendChild(el);
    }

    el.textContent = [
      ".namaa-widget, .namaa-banner, .namaa-cart-badge, .namaa-modal, .namaa-account { --namaa-primary: var(--color-primary, var(--theme-primary-color, #111111)); --namaa-primary-dark: var(--color-primary-dark, var(--namaa-primary)); --namaa-on-primary: " +
        onPrimary +
        "; --namaa-text: var(--main-text-color, inherit); --namaa-muted: var(--color-text, #6b7280); --namaa-bg: var(--color-grey, #f5f7f9); --namaa-border: var(--color-light-grey, #eeeeee); --namaa-radius: var(--s-radius, 12px); --namaa-font: var(--font-main, inherit); }",
      "html.namaa-active[data-namaa-product] salla-add-product-button[type='submit'], html.namaa-active[data-namaa-product] salla-add-product-button[data-testid='store-product-add-to-cart'] { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:-1px !important; overflow:hidden !important; clip:rect(0,0,0,0) !important; white-space:nowrap !important; border:0 !important; }",
      "html.namaa-active[data-namaa-product] salla-installment { display:none !important; }",
      ".namaa-widget { font-family: var(--namaa-font); color: var(--namaa-text); margin: 12px 0 16px; direction: rtl; text-align: right; }",
      ".namaa-widget * { box-sizing: border-box; }",
      ".namaa-choices { display: grid; gap: 8px; }",
      ".namaa-choice { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; width: 100%; border: 1px solid var(--namaa-border); background: #fff; border-radius: var(--namaa-radius); padding: 12px 14px; cursor: pointer; text-align: right; font: inherit; color: inherit; }",
      ".namaa-choice:hover { border-color: var(--namaa-primary); }",
      ".namaa-choice.is-selected { border-color: var(--namaa-primary); box-shadow: 0 0 0 1px var(--namaa-primary); }",
      ".namaa-choice__main { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }",
      ".namaa-radio { flex: 0 0 18px; width: 18px; height: 18px; margin-top: 2px; border: 2px solid var(--namaa-border); border-radius: 999px; }",
      ".namaa-choice.is-selected .namaa-radio { border-color: var(--namaa-primary); box-shadow: inset 0 0 0 4px var(--namaa-primary); }",
      ".namaa-choice__copy { display: grid; gap: 6px; min-width: 0; }",
      ".namaa-choice__label { font-weight: 700; }",
      ".namaa-choice__hint { font-size: 12px; color: var(--namaa-muted); }",
      ".namaa-learn { display: block; width: 100%; margin-top: 10px; background: none; border: 0; padding: 0; font: inherit; font-size: 12px; font-weight: 600; color: var(--namaa-muted); cursor: pointer; text-align: center; text-decoration: none; }",
      ".namaa-learn:hover { color: var(--namaa-primary); text-decoration: underline; }",
      ".namaa-money { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex-shrink: 0; }",
      ".namaa-money strong { font-size: 15px; font-weight: 800; }",
      ".namaa-money s { color: var(--namaa-muted); font-size: 12px; }",
      ".namaa-save { display: inline-flex; align-items: center; width: fit-content; max-width: 100%; background: var(--namaa-bg); border-radius: 999px; padding-block: 3px; padding-inline: 8px; font-size: 12px; line-height: 1.3; color: var(--namaa-primary); }",
      ".namaa-save__pct { font-weight: 800; }",
      ".namaa-save__amt { font-weight: 600; color: var(--namaa-muted); margin-inline-start: 8px; padding-inline-start: 8px; border-inline-start: 1px solid var(--namaa-border); }",
      ".namaa-sub-extra { margin: 8px 0 0; }",
      ".namaa-chips { display: flex; flex-wrap: wrap; gap: 8px; }",
      ".namaa-chip { appearance: none; border: 1px solid var(--namaa-border); background: #fff; border-radius: 999px; padding: 8px 12px; cursor: pointer; font: inherit; font-size: 13px; color: inherit; }",
      ".namaa-chip.is-selected { border-color: var(--namaa-primary); box-shadow: 0 0 0 1px var(--namaa-primary); font-weight: 700; }",
      ".namaa-actions { margin-top: 12px; }",
      ".namaa-btn { appearance: none; border: 0; border-radius: var(--namaa-radius); padding: 13px 16px; font: inherit; font-weight: 800; cursor: pointer; width: 100%; }",
      ".namaa-btn:disabled { opacity: .65; cursor: wait; }",
      ".namaa-btn--primary { background: var(--namaa-primary); color: var(--namaa-on-primary); }",
      ".namaa-btn--primary:hover { background: var(--namaa-primary-dark); }",
      ".namaa-banner { background: var(--namaa-bg); border: 1px solid var(--namaa-border); border-radius: var(--namaa-radius); padding: 14px 16px; margin: 0 0 20px; direction: rtl; text-align: right; display: block; font-family: var(--namaa-font); color: var(--namaa-text); }",
      ".namaa-banner strong { display: block; color: var(--namaa-primary); margin-bottom: 4px; }",
      ".namaa-banner p { margin: 0; font-size: 13px; line-height: 1.7; color: var(--namaa-muted); }",
      ".namaa-banner button { background: none; border: 0; padding: 0; font: inherit; color: var(--namaa-primary); font-weight: 700; cursor: pointer; text-decoration: underline; }",
      ".namaa-account { position: relative; overflow: hidden; width: 100%; max-width: 760px; margin: 0 0 24px; padding: 22px; border: 1px solid #e8e5ef; border-radius: 16px; background: #fff; box-shadow: 0 10px 30px rgba(21,4,67,.07); direction: rtl; text-align: right; font-family: var(--namaa-font); color: var(--namaa-text); box-sizing: border-box; }",
      ".namaa-account::before { content: ''; position: absolute; inset: 0 0 auto; height: 4px; background: var(--namaa-primary); }",
      ".namaa-account h2 { display: flex; align-items: center; gap: 9px; margin: 0 0 5px; font-size: 19px; line-height: 1.5; font-weight: 800; color: var(--namaa-text); }",
      ".namaa-account h2::before { content: ''; width: 10px; height: 10px; flex: 0 0 10px; border-radius: 50%; background: var(--namaa-primary); box-shadow: 0 0 0 5px color-mix(in srgb, var(--namaa-primary) 12%, transparent); }",
      ".namaa-account > p { margin: 0 0 18px; max-width: 620px; font-size: 13px; line-height: 1.8; color: #706b7a; }",
      ".namaa-account__row { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 16px; border: 1px solid #ece9f1; border-radius: 13px; background: #fbfafd; }",
      ".namaa-account__row + .namaa-account__row { margin-top: 10px; }",
      ".namaa-account__row strong { display: block; margin-bottom: 7px; font-size: 15px; font-weight: 800; color: var(--namaa-text); }",
      ".namaa-account__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }",
      ".namaa-account__amount { color: #706b7a; font-size: 13px; font-variant-numeric: tabular-nums; }",
      ".namaa-account__status { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 9px; border-radius: 999px; background: #ecfdf3; color: #18794e; font-size: 12px; font-weight: 700; }",
      ".namaa-account__status[data-status='cancelled'], .namaa-account__status[data-status='past_due'] { background: #fff1f2; color: #b42318; }",
      ".namaa-account__cancel { appearance: none; min-height: 44px; flex: 0 0 auto; border: 1px solid #f1c7ca; background: #fff7f7; color: #b42318; border-radius: 10px; padding: 9px 14px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; transition: background-color .18s ease, border-color .18s ease, color .18s ease; }",
      ".namaa-account__cancel:hover { border-color: #dc7c83; background: #fff0f1; }",
      ".namaa-account__cancel:focus-visible { outline: 3px solid color-mix(in srgb, var(--namaa-primary) 30%, transparent); outline-offset: 2px; }",
      ".namaa-account__cancel[data-confirm='1'] { border-color: #b42318; background: #b42318; color: #fff; }",
      ".namaa-account__cancel:disabled { opacity: .65; cursor: wait; }",
      ".namaa-account__orders { display: grid; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #ece9f1; }",
      ".namaa-account__order { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; color: #706b7a; font-size: 12px; line-height: 1.6; }",
      ".namaa-account__order strong { color: var(--namaa-text); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }",
      "@media (max-width: 520px) { .namaa-account { padding: 18px; border-radius: 14px; } .namaa-account__row { align-items: stretch; flex-direction: column; gap: 14px; } .namaa-account__cancel { width: 100%; } }",
      ".namaa-cart-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: var(--namaa-bg); color: var(--namaa-primary); border: 1px solid var(--namaa-border); font-family: var(--namaa-font); font-size: 12px; font-weight: 700; line-height: 1.4; }",
      ".namaa-modal { position: fixed; inset: 0; z-index: 99999; display: none; }",
      ".namaa-modal.is-open { display: flex; align-items: flex-end; justify-content: center; }",
      ".namaa-modal__backdrop { position: absolute; inset: 0; background: rgba(17,24,39,.5); }",
      ".namaa-modal__dialog { position: relative; width: 100%; max-width: 420px; background: #fff; border-radius: 16px 16px 0 0; padding: 22px 20px calc(16px + env(safe-area-inset-bottom, 0px)); direction: rtl; text-align: right; box-shadow: 0 -12px 40px rgba(17,24,39,.18); font-family: var(--font-main, inherit); color: var(--main-text-color, inherit); }",
      ".namaa-modal__kicker { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--color-primary, inherit); }",
      ".namaa-modal__dialog h3 { margin: 0 0 16px; font-size: 20px; font-weight: 800; padding-left: 36px; }",
      ".namaa-modal__steps { list-style: none; margin: 0 0 18px; padding: 0; display: grid; gap: 14px; }",
      ".namaa-modal__steps li { display: flex; gap: 12px; align-items: flex-start; }",
      ".namaa-modal__step-n { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 999px; background: var(--color-primary, #111); color: var(--namaa-on-primary, #fff); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; }",
      ".namaa-modal__steps strong { display: block; margin: 0 0 2px; font-size: 14px; }",
      ".namaa-modal__steps p { margin: 0; font-size: 13px; line-height: 1.7; color: var(--color-text, #6b7280); }",
      ".namaa-modal__close { position: absolute; top: 14px; left: 14px; border: 0; background: var(--color-grey, #F3F4F6); width: 32px; height: 32px; border-radius: 999px; cursor: pointer; font-size: 18px; line-height: 32px; }",
      "@media (min-width: 640px) { .namaa-modal.is-open { align-items: center; } .namaa-modal__dialog { border-radius: var(--s-radius, 16px); margin: 0 16px 24px; box-shadow: 0 20px 50px rgba(17,24,39,.2); } }",
      "html.namaa-has-sub-cart label[for='coupon'], html.namaa-has-sub-cart input[name='coupon'], html.namaa-has-sub-cart .coupon-form { display: none !important; }",
    ].join("\n");
  }

  function currentProductId() {
    var id = configGet("product.id") || configGet("item.id");
    var el;

    if (id) {
      return String(id);
    }

    el = document.querySelector('salla-add-product-button[type="submit"], salla-add-product-button[data-testid="store-product-add-to-cart"]');

    if (el) {
      return el.getAttribute("product-id") || el.getAttribute("data-product-id") || el.getAttribute("data-id");
    }

    return null;
  }

  function pageStorePrice(fallback) {
    if (fallback > 0) {
      return fallback;
    }

    var el =
      document.querySelector('salla-add-product-button[type="submit"]') ||
      document.querySelector('salla-add-product-button[data-testid="store-product-add-to-cart"]') ||
      document.querySelector("salla-installment");
    var amount;

    if (el) {
      amount = parseFloat(el.getAttribute("amount") || el.getAttribute("price") || "");
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }

    return 0;
  }

  function storeCurrencyCode() {
    var currencies = configGet("currencies") || {};
    var codes = Object.keys(currencies);
    var i;

    for (i = 0; i < codes.length; i += 1) {
      if (Number(currencies[codes[i]] && currencies[codes[i]].amount) === 1) {
        return String(codes[i]).toUpperCase();
      }
    }

    return String(configGet("store.currency") || "SAR").toUpperCase();
  }

  function currentCurrencyCode() {
    var currency = configGet("currency");
    var code;

    if (typeof currency === "string") {
      code = currency;
    } else if (currency && currency.code) {
      code = currency.code;
    } else {
      code = configGet("currency.code") || configGet("user.currency_code");
    }

    return code ? String(code).toUpperCase() : storeCurrencyCode();
  }

  function currencyRate(code) {
    var currencies = configGet("currencies") || {};
    var row = currencies[code] || currencies[String(code || "").toUpperCase()];
    var amount = row && row.amount != null ? Number(row.amount) : NaN;

    return amount > 0 ? amount : 1;
  }

  function toDisplayPrice(storeAmount) {
    var amount = Number(storeAmount);
    var current;
    var store;
    var rate;

    if (!(amount > 0)) {
      return 0;
    }

    current = currentCurrencyCode();
    store = storeCurrencyCode();
    rate = currencyRate(current);

    if (!current || current === store || rate === 1) {
      return amount;
    }

    return Math.round(amount * rate * 100) / 100;
  }

  function roundMoney(amount) {
    return Math.round(Number(amount) * 100) / 100;
  }

  function parseDisplayedMoney(text) {
    var normalized = String(text || "")
      .replace(/[٠-٩]/g, function (digit) {
        return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit));
      })
      .replace(/[۰-۹]/g, function (digit) {
        return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit));
      })
      .replace(/٫/g, ".")
      .replace(/,/g, "");
    var match = normalized.match(/(\d+(?:\.\d+)?)/);

    return match ? parseFloat(match[1]) : 0;
  }

  function parseSallaPricePayload(response) {
    var data = response && response.data ? response.data : response;
    var sale;
    var regular;
    var storeLine;

    if (!data || typeof data !== "object") {
      return null;
    }

    sale = Number(data.price);
    regular = Number(data.regular_price);
    storeLine = data.base_currency_price ? Number(data.base_currency_price.amount) : NaN;

    if (!(sale > 0)) {
      return null;
    }

    return {
      sale: roundMoney(sale),
      regular: regular > sale ? roundMoney(regular) : 0,
      storeLine: storeLine > 0 ? roundMoney(storeLine) : 0,
    };
  }

  function visibleSallaPrice() {
    var saleEl =
      document.querySelector(".price_is_on_sale:not(.hidden) .total-price") ||
      document.querySelector(".starting-or-normal-price:not(.hidden) .total-price") ||
      document.querySelector(".price-wrapper .total-price");
    var wasEl =
      document.querySelector(".price_is_on_sale:not(.hidden) .before-price") ||
      document.querySelector(".price-wrapper .before-price");
    var sale = saleEl ? parseDisplayedMoney(saleEl.textContent) : 0;
    var regular = wasEl ? parseDisplayedMoney(wasEl.textContent) : 0;

    if (!(sale > 0)) {
      return null;
    }

    return {
      sale: roundMoney(sale),
      regular: regular > sale ? roundMoney(regular) : 0,
      storeLine: 0,
    };
  }

  function applyLivePrice(parsed) {
    if (!parsed || !(parsed.sale > 0) || !widgetState.config) {
      return;
    }

    if (parsed.sale === widgetState.listPrice && parsed.regular === (widgetState.regularPrice || 0)) {
      return;
    }

    widgetState.listPrice = parsed.sale;
    widgetState.regularPrice = parsed.regular || 0;
    if (parsed.storeLine > 0) {
      widgetState.storePrice = parsed.storeLine;
    }
    widgetState.selectedOffer = decorateOffer(
      widgetState.selectedOffer || widgetState.config.offers[0],
      widgetState.listPrice
    );

    if (typeof widgetState.paint === "function") {
      widgetState.paint();
    }
  }

  var livePriceTimer = null;

  function requestLivePrice() {
    window.clearTimeout(livePriceTimer);
    livePriceTimer = window.setTimeout(fetchLivePrice, 60);
  }

  function fetchLivePrice() {
    var productId = widgetState.productId || currentProductId();
    var product = window.salla && window.salla.product;

    if (!widgetState.config || !productId) {
      return;
    }

    if (!product || typeof product.getPrice !== "function") {
      applyLivePrice(visibleSallaPrice());
      return;
    }

    Promise.resolve(collectCartFields())
      .then(function (fields) {
        var payload = {
          id: Number(productId) || productId,
          quantity: fields.quantity || 1,
        };

        if (fields.options) {
          payload.options = fields.options;
        }

        return product.getPrice(payload);
      })
      .then(function (response) {
        applyLivePrice(parseSallaPricePayload(response) || visibleSallaPrice());
      })
      .catch(function () {
        applyLivePrice(visibleSallaPrice());
      });
  }

  function offerPrice(offer, listPrice) {
    var percent = offer && offer.discount_percent != null ? Number(offer.discount_percent) : 0;

    if (listPrice > 0) {
      var cents = Math.round(listPrice * 100);

      return Math.round((cents * (100 - percent)) / 100) / 100;
    }

    return offer && offer.price != null ? Number(offer.price) : 0;
  }

  function formatMoney(amount) {
    if (amount == null || isNaN(Number(amount))) {
      return "";
    }

    if (window.salla && typeof window.salla.money === "function") {
      try {
        return window.salla.money(amount);
      } catch (error) {}
    }

    return Number(amount).toFixed(2) + " ر.س";
  }

  function moneyStack(now, was) {
    var html = '<span class="namaa-money">';

    if (now > 0 || (was > 0 && now <= 0)) {
      html += "<strong>" + formatMoney(now) + "</strong>";
    }

    if (was > now && was > 0) {
      html += "<s>" + formatMoney(was) + "</s>";
    }

    html += "</span>";
    return html;
  }

  function savingsLine(offer, listPrice) {
    var now = offerPrice(offer, listPrice);
    var saved = listPrice > 0 ? Math.round((listPrice - now) * 100) / 100 : 0;
    var percent = offer && offer.discount_percent != null ? Number(offer.discount_percent) : 0;

    if (!(saved > 0)) {
      return "";
    }

    if (percent > 0) {
      return (
        '<span class="namaa-save"><span class="namaa-save__pct">وفر ' +
        percent +
        '%</span><span class="namaa-save__amt">' +
        formatMoney(saved) +
        "</span></span>"
      );
    }

    return '<span class="namaa-save"><span class="namaa-save__pct">وفر ' + formatMoney(saved) + "</span></span>";
  }

  function setOn(target, key, value) {
    if (!target) {
      return false;
    }

    if (typeof target.set === "function") {
      target.set(key, value);
      return true;
    }

    if (typeof target.append === "function") {
      target.append(key, value);
      return true;
    }

    if (typeof target === "object") {
      target[key] = value;
      return true;
    }

    return false;
  }

  function setPayload(item, key, value) {
    var ok = setOn(item, key, value);
    return setOn(item && item.payload, key, value) || ok;
  }

  function payloadId(item) {
    if (!item) {
      return "";
    }

    return String(item.id || (item.payload && (item.payload.id || item.payload.product_id)) || "");
  }

  function offerRecurring(offer) {
    return {
      app_id: Number((widgetState.config && widgetState.config.app_id) || DEFAULT_APP_ID),
      slug: "namaa-" + (offer.key || offer.interval_unit + "-" + offer.interval_count),
      interval_unit: offer.interval_unit,
      interval_count: Number(offer.interval_count),
      meta: {
        source: "namaa",
        offer_key: offer.key || "",
        coupon_id: widgetState.pendingCoupon && widgetState.pendingCoupon.coupon_id
          ? String(widgetState.pendingCoupon.coupon_id)
          : "",
      },
    };
  }

  function applyRecurring(item, offer) {
    var recurring = offerRecurring(offer);
    var wrote = [];
    var fields = [
      ["recurring[app_id]", recurring.app_id],
      ["recurring[slug]", recurring.slug],
      ["recurring[interval_unit]", recurring.interval_unit],
      ["recurring[interval_count]", recurring.interval_count],
      ["recurring[meta][source]", recurring.meta.source],
      ["recurring[meta][offer_key]", recurring.meta.offer_key],
      ["recurring[meta][coupon_id]", recurring.meta.coupon_id],
    ];

    fields.forEach(function (pair) {
      if (setPayload(item, pair[0], pair[1])) {
        wrote.push(pair[0]);
      }
    });

    console.info("[Namaa] attaching recurring", {
      wrote: wrote,
      recurring: recurring,
      raw: item && item.payload && typeof item.payload.toObject === "function" ? item.payload.toObject() : null,
    });
  }

  function productForm() {
    var btn =
      document.querySelector('salla-add-product-button[data-testid="store-product-add-to-cart"]') ||
      document.querySelector('salla-add-product-button[type="submit"]');

    return (
      document.querySelector('form[data-testid="store-product-form"]') ||
      document.querySelector("form.product-form") ||
      (btn && btn.closest("form")) ||
      null
    );
  }

  function productOptionsEl() {
    var productId = widgetState.productId || currentProductId();
    var scoped;

    if (productId) {
      scoped = document.querySelector('salla-product-options[product-id="' + productId + '"]');
    }

    return scoped || document.querySelector("salla-product-options");
  }

  function readQuantity() {
    var form = productForm();
    var el =
      (form && form.querySelector("salla-quantity-input")) ||
      document.querySelector('salla-quantity-input[data-testid="store-product-quantity"]') ||
      document.querySelector("salla-quantity-input:not([cart-item-id])");
    var input;
    var value;

    if (el) {
      input = el.querySelector('input[name="quantity"], input');
      value = (input && input.value) || el.value || el.getAttribute("value");
    } else {
      input = (form && form.querySelector('input[name="quantity"]')) || document.querySelector('input[name="quantity"]');
      value = input && input.value;
    }

    value = parseInt(value, 10);
    return value > 0 ? value : 1;
  }

  function readNotes() {
    var form = productForm();
    var input =
      (form && form.querySelector('[name="notes"], [name="note"], textarea[name="comment"]')) ||
      document.querySelector('form.product-form [name="notes"], form.product-form [name="note"]');

    return input && input.value ? String(input.value).trim() : "";
  }

  function readDonationAmount() {
    var form = productForm();
    var input = form && form.querySelector('[name="donation_amount"], [name="donating_amount"]');
    var amount = input ? parseFloat(input.value) : NaN;

    return amount > 0 ? amount : 0;
  }

  function appendOptionFields(payload, options, asFormData) {
    if (!options || typeof options !== "object") {
      return;
    }

    if (!asFormData) {
      payload.options = options;
      return;
    }

    Object.keys(options).forEach(function (key) {
      var val = options[key];

      if (val == null || val === "") {
        return;
      }

      if (Array.isArray(val)) {
        val.forEach(function (item) {
          if (item != null && item !== "") {
            payload.append("options[" + key + "][]", item);
          }
        });
        return;
      }

      payload.append("options[" + key + "]", val);
    });
  }

  function applyCartFields(payload, fields, asFormData) {
    fields = fields || {};

    if (asFormData) {
      payload.append("quantity", String(fields.quantity || 1));
      if (fields.notes) {
        payload.append("notes", fields.notes);
      }
      if (fields.donation_amount) {
        payload.append("donation_amount", String(fields.donation_amount));
      }
      appendOptionFields(payload, fields.options, true);
      return;
    }

    payload.quantity = fields.quantity || 1;
    if (fields.notes) {
      payload.notes = fields.notes;
    }
    if (fields.donation_amount) {
      payload.donation_amount = fields.donation_amount;
    }
    appendOptionFields(payload, fields.options, false);
  }

  function validateProductOptions() {
    var el = productOptionsEl();
    var validate;

    if (!el) {
      return Promise.resolve(true);
    }

    validate =
      (typeof el.validateAndScroll === "function" && el.validateAndScroll.bind(el)) ||
      (typeof el.reportValidity === "function" && el.reportValidity.bind(el)) ||
      (typeof el.reportValidty === "function" && el.reportValidty.bind(el));

    return Promise.resolve(validate ? validate() : true).then(function (valid) {
      if (valid === false) {
        throw new Error("الرجاء اختيار خيارات المنتج");
      }

      if (typeof el.hasOutOfStockOption !== "function") {
        return true;
      }

      return Promise.resolve(el.hasOutOfStockOption()).then(function (out) {
        if (out) {
          throw new Error("الخيار المختار غير متوفر");
        }

        return true;
      });
    });
  }

  function collectCartFields() {
    var fields = {
      quantity: readQuantity(),
      notes: readNotes(),
      donation_amount: readDonationAmount(),
      options: null,
    };
    var el = productOptionsEl();

    if (!el || typeof el.getSelectedOptionsData !== "function") {
      return Promise.resolve(fields);
    }

    return Promise.resolve(el.getSelectedOptionsData()).then(function (data) {
      fields.options = data && typeof data === "object" ? data : null;
      return fields;
    });
  }

  var pendingAddWait = null;
  var cartAddWaitBound = false;

  function cancelPendingAddWait() {
    if (!pendingAddWait) {
      return;
    }

    window.clearTimeout(pendingAddWait.timer);
    pendingAddWait = null;
  }

  function waitForCartAdd(productId) {
    bindCartAddWait();

    return new Promise(function (resolve, reject) {
      if (pendingAddWait && pendingAddWait.timer) {
        window.clearTimeout(pendingAddWait.timer);
      }

      pendingAddWait = {
        productId: productId,
        resolve: resolve,
        reject: reject,
        timer: window.setTimeout(function () {
          var waiter = pendingAddWait;
          pendingAddWait = null;
          if (waiter) {
            waiter.reject(new Error("تعذر الإضافة إلى السلة"));
          }
        }, 20000),
      };
    });
  }

  function bindCartAddWait() {
    var cart = window.salla && window.salla.cart;

    if (cartAddWaitBound || !cart || !cart.event) {
      return;
    }

    cartAddWaitBound = true;

    function matches(addedId, waiter) {
      return !addedId || !waiter.productId || String(addedId) === String(waiter.productId);
    }

    function settle(handlerName, value, addedId) {
      var waiter = pendingAddWait;

      if (!waiter || !matches(addedId, waiter)) {
        return;
      }

      pendingAddWait = null;
      window.clearTimeout(waiter.timer);
      waiter[handlerName](value);
    }

    if (typeof cart.event.onItemAdded === "function") {
      cart.event.onItemAdded(function (response, addedId) {
        settle("resolve", response, addedId);
      });
    }

    if (typeof cart.event.onItemAddedFailed === "function") {
      cart.event.onItemAddedFailed(function (error, addedId) {
        settle("reject", typeof error === "string" ? new Error(error) : error || new Error("تعذر الإضافة إلى السلة"), addedId);
      });
    }
  }

  function submitNativeProductForm() {
    var form = productForm();
    var event;

    if (!form) {
      return false;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    }

    event = document.createEvent("Event");
    event.initEvent("submit", true, true);
    form.dispatchEvent(event);
    return true;
  }

  function bindCartIntercept() {
    if (interceptBound || !window.salla || !window.salla.cart || !window.salla.cart.event) {
      return;
    }

    interceptBound = true;

    window.salla.cart.event.onBeforeAddItem(function (item) {
      var offer = widgetState.selectedOffer;
      var id = payloadId(item);
      var currentId = widgetState.productId ? String(widgetState.productId) : "";

      if (pendingAction === "one_time") {
        console.info("[Namaa] skip recurring (one-time)", id);
        return;
      }

      if (pendingAction !== "subscribe" && id && currentId && id !== currentId) {
        return;
      }

      if (pendingAction !== "subscribe" && !(widgetState.config && widgetState.config.enabled && id === currentId)) {
        return;
      }

      if (!offer) {
        console.warn("[Namaa] no selected offer for recurring add");
        return;
      }

      applyRecurring(item, offer);
    });
  }

  function nativeAddItem(productId, offer, fields) {
    var cart = window.salla && window.salla.cart;
    var api = cart && (cart.api || cart);
    var payload;
    var recurring;
    var id = Number(productId) || productId;
    fields = fields || { quantity: 1 };

    if (!api || typeof api.addItem !== "function") {
      return Promise.reject(new Error("Salla cart is not ready"));
    }

    if (offer) {
      recurring = offerRecurring(offer);
      payload = new FormData();
      payload.id = id;
      payload.append("id", String(id));
      applyCartFields(payload, fields, true);
      payload.append("recurring[app_id]", String(recurring.app_id));
      payload.append("recurring[slug]", recurring.slug);
      payload.append("recurring[interval_unit]", recurring.interval_unit);
      payload.append("recurring[interval_count]", String(recurring.interval_count));
      payload.append("recurring[meta][source]", recurring.meta.source);
      payload.append("recurring[meta][offer_key]", recurring.meta.offer_key);
      if (recurring.meta.coupon_id) {
        payload.append("recurring[meta][coupon_id]", recurring.meta.coupon_id);
      }
      console.info("[Namaa] addItem", Array.from(payload.entries()));
    } else {
      payload = { id: id };
      applyCartFields(payload, fields, false);
      console.info("[Namaa] addItem", payload);
    }

    return api.addItem(payload).then(function (response) {
      var item = response && response.data && response.data.cart && response.data.cart.items && response.data.cart.items[0];
      console.info("[Namaa] addItem response item", item);
      try {
        console.info("[Namaa] addItem response item json", JSON.stringify(item));
      } catch (error) {}

      return applyPendingCoupon().then(function () {
        return response;
      });
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function couponFailure(error) {
    var response = error && error.response;
    var data = response && response.data;
    var nested = data && data.error;
    var message = (nested && nested.message) || (data && data.message) || (error && error.message) || "";

    return {
      status: response && response.status,
      message: message,
      data: data,
      already: /already|applied|مطب|مستخدم/i.test(String(message)),
    };
  }

  function issueCheckoutCoupon(storeId, productId, offerKey) {
    if (!storeId || !productId || !offerKey) {
      return Promise.resolve(null);
    }

    return fetch(apiOrigin() + "/api/storefront/coupon", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        store_id: storeId,
        product_id: productId,
        offer_key: offerKey,
      }),
    }).then(function (response) {
      if (!response.ok) {
        return null;
      }

      return response.json();
    }).catch(function () {
      return null;
    });
  }

  function prepareCheckoutCoupon(offer) {
    var storeId = configGet("store.id");
    var productId = widgetState.productId || currentProductId();

    widgetState.pendingCoupon = null;

    if (!offer || !(Number(offer.discount_percent) > 0)) {
      return Promise.resolve(null);
    }

    return issueCheckoutCoupon(storeId, productId, offer.key).then(function (coupon) {
      if (!coupon || !coupon.coupon_code) {
        return Promise.reject(new Error("تعذر تطبيق الخصم"));
      }

      widgetState.pendingCoupon = coupon;
      return coupon;
    });
  }

  function applyPendingCoupon() {
    var coupon = widgetState.pendingCoupon;

    if (!coupon || !coupon.coupon_code) {
      return Promise.resolve();
    }

    return delay(350).then(function () {
      return applyOfferCoupon(coupon.coupon_code);
    });
  }

  function applyOfferCoupon(code, attempt) {
    var cart = window.salla && window.salla.cart;
    var request;
    attempt = attempt || 0;

    if (!code || !cart || typeof cart.addCoupon !== "function") {
      console.warn("[Namaa] addCoupon skipped", { code: code, hasCart: Boolean(cart) });
      return Promise.resolve();
    }

    request = attempt % 2 === 1 ? cart.addCoupon(code) : cart.addCoupon({ coupon: code });

    return Promise.resolve(request)
      .then(function (result) {
        console.info("[Namaa] addCoupon", code, result);
        return result;
      })
      .catch(function (error) {
        var fail = couponFailure(error);
        console.warn("[Namaa] addCoupon failed", code, fail.status, fail.message || error);

        if (fail.already) {
          return { skipped: true };
        }

        if (attempt < 4) {
          return delay(400 * (attempt + 1)).then(function () {
            return applyOfferCoupon(code, attempt + 1);
          });
        }

        return null;
      });
  }

  function notifySuccess(message) {
    if (window.salla && typeof window.salla.success === "function") {
      window.salla.success(message);
    }
  }

  function notifyError(message) {
    if (window.salla && typeof window.salla.error === "function") {
      window.salla.error(message);
    } else {
      console.warn("[Namaa]", message);
    }
  }

  function ensureModal() {
    if (modalEl) {
      return modalEl;
    }

    modalEl = document.createElement("div");
    modalEl.className = "namaa-modal";
    modalEl.innerHTML =
      '<div class="namaa-modal__backdrop" data-namaa-close="1"></div>' +
      '<div class="namaa-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="namaa-modal-title">' +
      '<button type="button" class="namaa-modal__close" data-namaa-close="1" aria-label="إغلاق">×</button>' +
      '<p class="namaa-modal__kicker">نما</p>' +
      '<h3 id="namaa-modal-title">كيف يعمل الاشتراك؟</h3>' +
      '<div class="namaa-modal__body"></div>' +
      '<button type="button" class="namaa-btn namaa-btn--primary" data-namaa-close="1">حسناً، فهمت</button>' +
      "</div>";

    modalEl.addEventListener("click", function (event) {
      if (event.target && event.target.getAttribute("data-namaa-close")) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });

    document.body.appendChild(modalEl);
    return modalEl;
  }

  function openLearnMoreModal() {
    var modal = ensureModal();
    modal.querySelector(".namaa-modal__body").innerHTML = subscriptionExplainerHtml();
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    var closeBtn = modal.querySelector(".namaa-btn--primary");
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closeModal() {
    if (modalEl) {
      modalEl.classList.remove("is-open");
    }

    document.body.style.overflow = "";
  }

  function subscriptionExplainerHtml() {
    return (
      '<ol class="namaa-modal__steps">' +
      "<li><span class=\"namaa-modal__step-n\" aria-hidden=\"true\">1</span><div><strong>تدفع الآن كالمعتاد</strong><p>الطلب الأول يُدفع في سلة، بنفس طريقة الدفع في المتجر.</p></div></li>" +
      "<li><span class=\"namaa-modal__step-n\" aria-hidden=\"true\">2</span><div><strong>يتجدد تلقائياً</strong><p>من الطلب الثاني، الدفع والتوصيل يصيران تلقائيين حسب الخطة التي اخترتها.</p></div></li>" +
      "<li><span class=\"namaa-modal__step-n\" aria-hidden=\"true\">3</span><div><strong>بدون التزام</strong><p>عدّل أو ألغِ اشتراكك في أي وقت. لا يوجد عقد ملزم.</p></div></li>" +
      "</ol>"
    );
  }

  function hideNativeAtc(productId) {
    document.documentElement.classList.add("namaa-active");
    document.documentElement.setAttribute("data-namaa-product", productId);
  }

  function mountAfterAnchor(node) {
    var qtyBox = document.querySelector(".sticky-product-bar__quantity");
    var submitBtn = document.querySelector('salla-add-product-button[type="submit"]');
    var installment = document.querySelector("salla-installment");
    var sticky = document.querySelector(".sticky-product-bar");

    if (qtyBox) {
      qtyBox.insertAdjacentElement("afterend", node);
      return true;
    }

    if (submitBtn) {
      submitBtn.insertAdjacentElement("beforebegin", node);
      return true;
    }

    if (installment) {
      installment.insertAdjacentElement("afterend", node);
      return true;
    }

    if (sticky) {
      sticky.appendChild(node);
      return true;
    }

    console.warn("[Namaa] no mount target found");
    return false;
  }

  function renderProductWidget(force) {
    var config = widgetState.config;
    var root;
    var listPrice;
    var existing;
    var isBoth;

    if (!config || !config.offers || !config.offers.length) {
      return;
    }

    listPrice = widgetState.listPrice;
    existing = document.getElementById("namaa-widget-container");
    isBoth = config.mode === "both";

    if (existing) {
      if (!force) {
        return;
      }

      existing.parentNode.removeChild(existing);
    }

    hideNativeAtc(widgetState.productId);
    injectStyles();

    root = document.createElement("div");
    root.id = "namaa-widget-container";
    root.className = "namaa-widget namaa-widget-container";
    root.innerHTML = '<div class="namaa-choices"></div><div class="namaa-sub-extra"></div><div class="namaa-actions"></div>';

    widgetState.buyMode = widgetState.buyMode || "subscribe";
    if (!widgetState.selectedOffer) {
      widgetState.selectedOffer = decorateOffer(config.offers[0], listPrice);
    }

    function paint() {
      var choices = root.querySelector(".namaa-choices");
      var extra = root.querySelector(".namaa-sub-extra");
      var actions = root.querySelector(".namaa-actions");
      var listPrice = widgetState.listPrice;
      var offer = widgetState.selectedOffer;
      var subPrice = offerPrice(offer, listPrice);
      var subscribeSelected = widgetState.buyMode === "subscribe";
      var cta;

      choices.innerHTML = "";
      extra.innerHTML = "";
      actions.innerHTML = "";

      if (isBoth) {
        choices.appendChild(
          choiceButton({
            selected: !subscribeSelected,
            label: "شراء لمرة واحدة",
            priceHtml: moneyStack(listPrice, widgetState.regularPrice),
            onClick: function () {
              widgetState.buyMode = "one_time";
              paint();
            },
          })
        );
      }

      choices.appendChild(
        choiceButton({
          selected: subscribeSelected,
          label: config.offers.length === 1 ? "اشتراك · " + (offer.label || "اشتراك دوري") : "اشتراك دوري",
          saveHtml: savingsLine(offer, listPrice),
          priceHtml: moneyStack(subPrice, listPrice),
          onClick: function () {
            widgetState.buyMode = "subscribe";
            paint();
          },
        })
      );

      if (subscribeSelected && config.offers.length > 1) {
        var chips = document.createElement("div");
        chips.className = "namaa-chips";
        chips.setAttribute("role", "listbox");
        chips.setAttribute("aria-label", "عروض الاشتراك");

        config.offers.forEach(function (raw) {
          var decorated = decorateOffer(raw, listPrice);
          var chip = document.createElement("button");
          chip.type = "button";
          chip.className = "namaa-chip" + (decorated.key === offer.key ? " is-selected" : "");
          chip.textContent = decorated.label || "";
          chip.addEventListener("click", function (event) {
            event.stopPropagation();
            widgetState.selectedOffer = decorated;
            paint();
          });
          chips.appendChild(chip);
        });

        extra.appendChild(chips);
      }

      cta = document.createElement("button");
      cta.type = "button";
      cta.className = "namaa-btn namaa-btn--primary";
      cta.textContent = subscribeSelected ? "اشترك" : "أضف للسلة";
      cta.addEventListener("click", function () {
        addWithAction(subscribeSelected ? "subscribe" : "one_time", cta);
      });
      actions.appendChild(cta);

      var learn = document.createElement("button");
      learn.type = "button";
      learn.className = "namaa-learn";
      learn.setAttribute("data-namaa-learn", "1");
      learn.textContent = "كيف تعمل الاشتراكات؟";
      learn.addEventListener("click", function (event) {
        event.stopPropagation();
        openLearnMoreModal();
      });
      actions.appendChild(learn);
    }

    function choiceButton(opts) {
      var row = document.createElement("div");
      row.className = "namaa-choice" + (opts.selected ? " is-selected" : "");
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", opts.selected ? "true" : "false");
      row.tabIndex = 0;
      row.innerHTML =
        '<span class="namaa-choice__main"><span class="namaa-radio" aria-hidden="true"></span><span class="namaa-choice__copy"><span class="namaa-choice__label">' +
        opts.label +
        "</span>" +
        (opts.saveHtml || "") +
        (opts.hintHtml ? '<span class="namaa-choice__hint">' + opts.hintHtml + "</span>" : "") +
        "</span></span>" +
        (opts.priceHtml || "");
      row.addEventListener("click", opts.onClick);
      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          opts.onClick();
        }
      });
      return row;
    }

    paint();
    widgetState.paint = paint;
    requestLivePrice();

    if (!mountAfterAnchor(root)) {
      return;
    }

    bindCartIntercept();
    bindProductFormWatch();
  }

  function decorateOffer(offer, listPrice) {
    var copy = offer ? Object.assign({}, offer) : {};
    copy.resolvedPrice = offerPrice(copy, listPrice);
    return copy;
  }

  function addWithAction(action, button) {
    var productId = currentProductId() || widgetState.productId;
    var offer = action === "subscribe" ? widgetState.selectedOffer : null;

    if (!productId) {
      notifyError("تعذر تحديد المنتج");
      return;
    }

    pendingAction = action;
    button.disabled = true;

    validateProductOptions()
      .then(function () {
        return prepareCheckoutCoupon(offer);
      })
      .then(function () {
        var waiting;

        if (productForm()) {
          waiting = waitForCartAdd(productId);
          if (submitNativeProductForm()) {
            return waiting.then(function (response) {
              return applyPendingCoupon().then(function () {
                return response;
              });
            });
          }

          cancelPendingAddWait();
        }

        return collectCartFields().then(function (cartFields) {
          return nativeAddItem(productId, offer, cartFields);
        });
      })
      .then(function () {
        if (action === "subscribe") {
          try {
            sessionStorage.setItem("namaa-has-subscription-cart", "1");
          } catch (error) {}
        }
        notifySuccess(action === "subscribe" ? "تمت إضافة الاشتراك إلى السلة" : "تمت الإضافة إلى السلة");
      })
      .catch(function (error) {
        notifyError((error && error.message) || "تعذر الإضافة إلى السلة");
      })
      .then(function () {
        pendingAction = null;
        button.disabled = false;
      });
  }

  function extractCartItems(payload) {
    var data = payload && payload.data ? payload.data : payload;
    var cart = data && data.cart ? data.cart : data;

    if (!cart) {
      return [];
    }

    if (Array.isArray(cart.items)) {
      return cart.items;
    }

    if (Array.isArray(cart)) {
      return cart;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    return [];
  }

  function recurringRecord(value) {
    var nested;
    var slug;

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    nested = value.meta && typeof value.meta === "object" ? value.meta : {};
    slug = String(value.slug || "");

    if (value.interval_unit || slug.indexOf("namaa-") === 0 || nested.offer_key || nested.source === "namaa") {
      return value;
    }

    return null;
  }

  function itemRecurringMeta(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    return (
      recurringRecord(item.recurring_metadata) ||
      recurringRecord(item.recurring) ||
      recurringRecord(item.product && item.product.recurring) ||
      null
    );
  }

  function itemLooksRecurring(item) {
    return Boolean(itemRecurringMeta(item));
  }

  function recurringLabel(item) {
    var meta = itemRecurringMeta(item) || {};
    var nested = meta.meta && typeof meta.meta === "object" ? meta.meta : {};
    var key = nested.offer_key || meta.slug || "";
    var unit = meta.interval_unit;
    var count = Number(meta.interval_count);

    if (key.indexOf("week-1") !== -1 || (unit === "week" && count === 1)) {
      return "كل أسبوع";
    }

    if (key.indexOf("month-3") !== -1 || (unit === "month" && count === 3)) {
      return "كل 3 أشهر";
    }

    if (key.indexOf("month-1") !== -1 || (unit === "month" && count === 1)) {
      return "كل شهر";
    }

    if (key.indexOf("year-1") !== -1 || (unit === "year" && count === 1)) {
      return "كل سنة";
    }

    return "";
  }

  function cartBannerHost() {
    return (
      document.querySelector(".main-content") ||
      document.querySelector(".cart-items, #cart-products, salla-cart-items, .cart-content") ||
      document.querySelector("main")
    );
  }

  function renderCartBanner() {
    var existing = document.getElementById("namaa-cart-banner");
    var host = cartBannerHost();
    var banner;

    if (existing) {
      if (host && existing.parentElement !== host) {
        host.insertBefore(existing, host.firstChild);
      }

      return;
    }

    if (!host) {
      return;
    }

    injectStyles();

    banner = document.createElement("div");
    banner.id = "namaa-cart-banner";
    banner.className = "namaa-banner";
    banner.innerHTML =
      "<strong>سلتك تحتوي على اشتراكات</strong>" +
      "<p>ستدفع الآن كالمعتاد. ابتداءً من الطلب الثاني، يتم الدفع والتوصيل تلقائياً. لا يوجد التزام — يمكنك التعديل أو الإلغاء في أي وقت. " +
      '<button type="button" data-namaa-learn="1">كيف تعمل الاشتراكات؟</button></p>';

    banner.querySelector("[data-namaa-learn]").addEventListener("click", function () {
      openLearnMoreModal();
    });

    host.insertBefore(banner, host.firstChild);
  }

  function markSubscriptionLines(items) {
    var recurring = (items || []).filter(itemLooksRecurring);

    document.querySelectorAll(".cart-item, [data-testid^='store-cart-item']").forEach(function (row) {
      var idInput = row.querySelector("input[name='id']");
      var lineId = idInput ? String(idInput.value) : "";
      var link = row.querySelector("a[href]");
      var href = link && link.getAttribute("href") ? link.getAttribute("href") : "";
      var match = recurring.filter(function (item) {
        if (lineId && String(item.id) === lineId) {
          return true;
        }

        return Boolean(item.product_id && href.indexOf("p" + item.product_id) !== -1);
      })[0];
      var host = row.querySelector(".space-y-1") || row;
      var existing = host.querySelector(".namaa-cart-badge");
      var badge;
      var freq;

      if (!match) {
        if (existing) {
          existing.remove();
        }

        return;
      }

      freq = recurringLabel(match);

      if (existing) {
        existing.textContent = freq ? "اشتراك · " + freq : "اشتراك";
        return;
      }

      badge = document.createElement("span");
      badge.className = "namaa-cart-badge";
      badge.textContent = freq ? "اشتراك · " + freq : "اشتراك";
      host.appendChild(badge);
    });
  }

  function hideNativeCouponField() {
    var label = document.querySelector('label[for="coupon"]');
    var field = label && label.parentElement;

    if (field) {
      field.style.setProperty("display", "none", "important");
    }
  }

  function isCartPage() {
    var page = String(configGet("page.type") || configGet("page.slug") || "");

    if (page === "cart" || page.indexOf("cart") !== -1) {
      return true;
    }

    if (/\/cart\/?$/.test(window.location.pathname)) {
      return true;
    }

    return Boolean(document.querySelector(".cart-item, [data-testid^='store-cart-item'], salla-cart-items"));
  }

  function isProductPage() {
    var page = String(configGet("page.type") || configGet("page.slug") || "");

    if (page.indexOf("product") !== -1) {
      return true;
    }

    return Boolean(document.querySelector('salla-add-product-button[type="submit"]'));
  }

  function hasCartLineDom() {
    return Boolean(
      document.querySelector(
        ".cart-item, [data-testid^='store-cart-item'], salla-cart-item, [data-testid='cart-item']"
      )
    );
  }

  function isEmptyCartDom() {
    return Boolean(document.querySelector('[data-testid="store-cart-empty"], .no-content-placeholder')) && !hasCartLineDom();
  }

  function clearSubscriptionCartUi() {
    try {
      sessionStorage.removeItem("namaa-has-subscription-cart");
    } catch (error) {}

    document.documentElement.classList.remove("namaa-has-sub-cart");
    widgetState.cartRecurring = [];

    var banner = document.getElementById("namaa-cart-banner");
    if (banner) {
      banner.remove();
    }

    document.querySelectorAll(".namaa-cart-badge").forEach(function (el) {
      el.remove();
    });
  }

  function fetchCartDetails() {
    var cart = window.salla && window.salla.cart;
    var api = cart && (cart.api || cart);

    if (cart && typeof cart.details === "function") {
      return cart.details();
    }

    if (api && typeof api.details === "function") {
      return api.details();
    }

    if (api && typeof api.latest === "function") {
      return api.latest();
    }

    return Promise.resolve(null);
  }

  function maybeShowCartBanner(attempt) {
    attempt = attempt || 0;

    if (!isCartPage()) {
      return;
    }

    bindCartPageWatch();

    if (isEmptyCartDom()) {
      clearSubscriptionCartUi();
      return;
    }

    if (!hasCartLineDom()) {
      if (attempt < 10) {
        window.setTimeout(function () {
          maybeShowCartBanner(attempt + 1);
        }, 250);
      }

      return;
    }

    fetchCartDetails()
      .then(function (payload) {
        var items = extractCartItems(payload);
        var recurring = items.filter(itemLooksRecurring);

        console.info("[Namaa] cart inspect", {
          items: items.length,
          recurring: recurring.length,
        });

        if (recurring.length) {
          try {
            sessionStorage.setItem("namaa-has-subscription-cart", "1");
          } catch (error) {}
          widgetState.cartRecurring = recurring;
          markSubscriptionCart(recurring);
          ensureCartCoupon(payload, recurring);
          return;
        }

        widgetState.cartRecurring = [];
        clearSubscriptionCartUi();
      })
      .catch(function (error) {
        console.warn("[Namaa] cart inspect failed", error);
      });
  }

  function markSubscriptionCart(items) {
    cartUiLock = true;
    document.documentElement.classList.add("namaa-has-sub-cart");
    hideNativeCouponField();
    renderCartBanner();
    markSubscriptionLines(items || []);
    window.setTimeout(function () {
      cartUiLock = false;
    }, 0);
  }

  function bindCartPageWatch() {
    var cart;
    var target;

    if (cartWatchBound || !isCartPage()) {
      return;
    }

    cartWatchBound = true;
    cart = window.salla && window.salla.cart;

    function restoreCartUi() {
      if (cartUiLock) {
        return;
      }

      if (!hasCartLineDom()) {
        return;
      }

      if (widgetState.cartRecurring && widgetState.cartRecurring.length) {
        markSubscriptionCart(widgetState.cartRecurring);
      }
    }

    function refreshFromApi() {
      if (cartUiLock) {
        return;
      }

      maybeShowCartBanner(0);
    }

    try {
      if (cart && cart.event) {
        if (typeof cart.event.onUpdated === "function") {
          cart.event.onUpdated(refreshFromApi);
        }

        if (typeof cart.event.onDeleted === "function") {
          cart.event.onDeleted(refreshFromApi);
        }

        if (typeof cart.event.onItemDeleted === "function") {
          cart.event.onItemDeleted(refreshFromApi);
        }
      }
    } catch (error) {}

    target = cartBannerHost() || document.body;

    if (target && window.MutationObserver) {
      new MutationObserver(function () {
        if (cartUiLock) {
          return;
        }

        window.clearTimeout(bindCartPageWatch._timer);
        bindCartPageWatch._timer = window.setTimeout(restoreCartUi, 200);
      }).observe(target, { childList: true, subtree: true });
    }
  }

  function cartCouponCode(payload) {
    var data = payload && payload.data ? payload.data : payload;
    var cart = data && data.cart ? data.cart : data;

    return (cart && cart.coupon) || (data && data.coupon) || null;
  }

  function itemNeedsCoupon(item) {
    if (!itemLooksRecurring(item)) {
      return false;
    }

    if (item.has_discount) {
      return false;
    }

    if (item.offer && Number(item.offer.discount) > 0) {
      return false;
    }

    return true;
  }

  function ensureCartCoupon(payload, items) {
    var needing = (items || []).filter(itemNeedsCoupon);
    var storeId;
    var productId;
    var key;

    if (!needing.length || cartCouponCode(payload)) {
      return Promise.resolve();
    }

    storeId = configGet("store.id");
    productId = needing[0].product_id || (needing[0].product && needing[0].product.id);

    if (!storeId || !productId) {
      return Promise.resolve();
    }

    key = String(storeId) + ":" + String(productId);

    if (widgetState.couponEnsured === key) {
      return Promise.resolve();
    }

    widgetState.couponEnsured = key;

    var meta = itemRecurringMeta(needing[0]) || {};
    var nested = meta.meta && typeof meta.meta === "object" ? meta.meta : {};
    var offerKey = nested.offer_key || "";

    return issueCheckoutCoupon(storeId, productId, offerKey)
      .then(function (coupon) {
        if (!coupon || !coupon.coupon_code) {
          return null;
        }

        widgetState.pendingCoupon = coupon;

        return applyOfferCoupon(coupon.coupon_code).then(function () {
          return fetchCartDetails().then(function (fresh) {
            var recurring = extractCartItems(fresh).filter(itemLooksRecurring);

            if (recurring.length) {
              widgetState.cartRecurring = recurring;
              markSubscriptionCart(recurring);
            }
          });
        });
      })
      .catch(function (error) {
        console.warn("[Namaa] cart coupon ensure failed", error);
      });
  }

  function storefrontConfigUrl(storeId, productId) {
    return (
      apiOrigin() +
      "/api/storefront/config?store_id=" +
      encodeURIComponent(storeId) +
      "&product_id=" +
      encodeURIComponent(productId) +
      "&t=" +
      Date.now()
    );
  }

  function loadStorefrontConfig(storeId, productId) {
    return fetch(storefrontConfigUrl(storeId, productId), { cache: "no-store", credentials: "omit" }).then(function (response) {
      return response.json();
    });
  }

  function fetchStorefrontConfig(storeId, productId) {
    if (!storeId || !productId) {
      console.info("[Namaa] storefront config skipped", { storeId: storeId, productId: productId });
      maybeShowCartBanner();
      return;
    }

    loadStorefrontConfig(storeId, productId)
      .then(function (payload) {
        var listPrice;

        if (window.Namaa) {
          window.Namaa.config = payload;
        }

        console.info("[Namaa] storefront config", payload);

        if (!payload || !payload.enabled || !payload.offers || !payload.offers.length) {
          maybeShowCartBanner();
          return;
        }

        listPrice = pageStorePrice(payload.product && payload.product.price);
        widgetState.config = payload;
        widgetState.productId = String(productId);
        widgetState.storePrice = listPrice;
        widgetState.listPrice = toDisplayPrice(listPrice);
        widgetState.selectedOffer = decorateOffer(payload.offers[0], widgetState.listPrice);

        console.info("[Namaa] offer price", {
          storePrice: widgetState.storePrice,
          listPrice: widgetState.listPrice,
          currency: currentCurrencyCode(),
        });

        if (isProductPage()) {
          renderProductWidget();
        }

        maybeShowCartBanner();
      })
      .catch(function (error) {
        console.warn("[Namaa] config fetch failed", error);
        maybeShowCartBanner();
      });
  }

  function markReady(storeId, username) {
    window.Namaa = {
      version: VERSION,
      storeId: storeId,
      username: username,
    };

    window.NamaaStorefrontSDK = window.Namaa;

    document.documentElement.setAttribute("data-namaa", VERSION);

    console.info("[Namaa] storefront SDK ready", {
      version: VERSION,
      storeId: storeId,
      username: username,
    });

    injectStyles();
    bindCartIntercept();
    bindCurrencyWatch();
    bindProductFormWatch();
    bindCartPageWatch();
    fetchStorefrontConfig(storeId, currentProductId());
    renderAccountSubscriptions(storeId);
  }

  // TEMP_ACCOUNT_TEST — delete later. Sample card so an account with no subscription can see the block.
  function mountAccountTest(storeId) {
    var attempts = 0;

    if (String(storeId) !== "427664796" || !isAccountPage() || document.getElementById("namaa-account-test")) {
      return;
    }

    function place() {
      var heading = accountHeading();
      var root;
      var row;
      var copy;
      var title;
      var meta;
      var amount;
      var status;
      var button;

      attempts += 1;

      if (!heading) {
        if (attempts < 20) {
          window.setTimeout(place, 300);
        }
        return;
      }

      root = document.createElement("section");
      root.id = "namaa-account-test";
      root.className = "namaa-account";
      root.appendChild(document.createElement("h2")).textContent = "اشتراكاتك";
      root.appendChild(document.createElement("p")).textContent = "تجربة مؤقتة. الإلغاء يوقف التجديد القادم. الطلب المدفوع يبقى. لا يمكن التراجع.";
      row = document.createElement("div");
      row.className = "namaa-account__row";
      copy = document.createElement("div");
      title = document.createElement("strong");
      meta = document.createElement("div");
      amount = document.createElement("span");
      status = document.createElement("span");
      button = document.createElement("button");
      title.textContent = "الباقة الشهرية ( اشتراك )";
      meta.className = "namaa-account__meta";
      amount.className = "namaa-account__amount";
      amount.textContent = "كل شهر · 65.00 ر.س";
      status.className = "namaa-account__status";
      status.setAttribute("data-status", "active");
      status.textContent = "نشط";
      copy.appendChild(title);
      meta.appendChild(amount);
      meta.appendChild(status);
      copy.appendChild(meta);
      appendAccountOrders(copy, [
        { id: "1001", ordered_on: "28 سبتمبر 2026", kind_label: "أول طلب", amount_label: "65.00 ر.س" },
        { id: "1002", ordered_on: "28 أكتوبر 2026", kind_label: "تجديد", amount_label: "65.00 ر.س" },
      ]);
      button.type = "button";
      button.className = "namaa-account__cancel";
      button.textContent = "إلغاء الاشتراك";
      button.setAttribute("aria-label", "إلغاء الاشتراك الشهري");
      button.addEventListener("click", function () {
        if (button.getAttribute("data-confirm") !== "1") {
          button.setAttribute("data-confirm", "1");
          button.textContent = "تأكيد الإلغاء";
          return;
        }

        status.setAttribute("data-status", "cancelled");
        status.textContent = "ملغى";
        button.remove();
      });
      row.appendChild(copy);
      row.appendChild(button);
      root.appendChild(row);
      heading.parentNode.insertBefore(root, heading);
    }

    place();
  }

  function accountHeading() {
    var nodes = document.querySelectorAll("h1, h2, h3");
    var i;
    var node;
    var text;

    for (i = 0; i < nodes.length; i += 1) {
      node = nodes[i];
      text = (node.textContent || "").replace(/\s+/g, " ").trim();

      if ((text === "الطلبات" || text === "حسابي") && !node.closest("header, nav, a")) {
        return node;
      }
    }

    nodes = document.querySelectorAll("p, span, div");

    for (i = 0; i < nodes.length; i += 1) {
      node = nodes[i];

      if (node.children.length || node.closest("header, nav, a")) {
        continue;
      }

      text = (node.textContent || "").replace(/\s+/g, " ").trim();

      if (text === "الطلبات" || text === "حسابي") {
        return node;
      }
    }

    return null;
  }

  function isAccountPage() {
    var path = window.location.pathname || "";
    var page = String(configGet("page.type") || configGet("page.slug") || configGet("page.id") || "").toLowerCase();

    if (/\/profile\/?$/.test(path) || /\/orders\/?$/.test(path)) {
      return true;
    }

    return page === "profile" || page === "customer.profile" || page === "orders" || page === "customer.orders";
  }

  function customerAccessToken() {
    var stored = null;

    try {
      if (window.salla && window.salla.storage && typeof window.salla.storage.get === "function") {
        stored = window.salla.storage.get("token");
      }
    } catch (error) {}

    if (!stored) {
      return "";
    }

    if (typeof stored === "string") {
      return stored;
    }

    return String(stored.token || stored.access_token || "");
  }

  function accountStatusLabel(status) {
    if (status === "cancelled") {
      return "ملغى";
    }

    if (status === "past_due") {
      return "تعذّر التجديد";
    }

    return "نشط";
  }

  function mountAccount(node) {
    var existing = document.getElementById("namaa-account");
    var heading = accountHeading();
    var host = document.querySelector("main") || document.querySelector(".main-content") || document.body;

    if (existing) {
      existing.remove();
    }

    node.id = "namaa-account";
    node.className = "namaa-account";

    if (heading && heading.parentNode) {
      heading.parentNode.insertBefore(node, heading);
    } else if (host.firstChild) {
      host.insertBefore(node, host.firstChild);
    } else {
      host.appendChild(node);
    }
  }

  function renderAccountSubscriptions(storeId) {
    var token;
    var root;

    if (!isAccountPage() || !storeId) {
      return;
    }

    token = customerAccessToken();
    root = document.createElement("section");

    if (!token) {
      root.appendChild(document.createElement("h2")).textContent = "اشتراكاتك";
      root.appendChild(document.createElement("p")).textContent = "سجّل الدخول لإلغاء الاشتراك";
      mountAccount(root);
      return;
    }

    fetch(apiOrigin() + "/api/storefront/subscriptions?store_id=" + encodeURIComponent(storeId) + "&t=" + Date.now(), {
      headers: {
        Accept: "application/json",
        "X-Salla-Customer-Token": token,
      },
      cache: "no-store",
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("account subscriptions failed");
        }

        return response.json();
      })
      .then(function (payload) {
        var items = (payload && payload.subscriptions) || [];

        if (!items.length) {
          mountAccountTest(storeId);
          return;
        }

        root.appendChild(document.createElement("h2")).textContent = "اشتراكاتك";
        root.appendChild(document.createElement("p")).textContent = "الإلغاء يوقف التجديد القادم. الطلب المدفوع يبقى. لا يمكن التراجع.";
        items.forEach(function (item) {
          root.appendChild(accountRow(item, storeId, token));
        });
        mountAccount(root);
      })
      .catch(function (error) {
        console.warn("[Namaa] account subscriptions failed", error);
        mountAccountTest(storeId);
      });
  }

  function appendAccountOrders(parent, orders) {
    var list = document.createElement("div");
    var i;
    var order;
    var line;
    var number;
    var detail;

    if (!orders || !orders.length) {
      return;
    }

    list.className = "namaa-account__orders";

    for (i = 0; i < orders.length; i += 1) {
      order = orders[i];
      line = document.createElement("div");
      number = document.createElement("strong");
      detail = document.createElement("span");
      line.className = "namaa-account__order";
      number.textContent = "#" + (order.id || "");
      detail.textContent = [order.ordered_on, order.kind_label, order.amount_label].filter(Boolean).join(" · ");
      line.appendChild(number);
      line.appendChild(detail);
      list.appendChild(line);
    }

    parent.appendChild(list);
  }

  function accountRow(item, storeId, token) {
    var row = document.createElement("div");
    var copy = document.createElement("div");
    var title = document.createElement("strong");
    var meta = document.createElement("div");
    var amount = document.createElement("span");
    var status = document.createElement("span");
    var button = document.createElement("button");
    var summary = [];

    row.className = "namaa-account__row";
    title.textContent = item.product_name || item.interval_label || "اشتراك";
    meta.className = "namaa-account__meta";
    amount.className = "namaa-account__amount";

    if (item.interval_label && item.product_name) {
      summary.push(item.interval_label);
    }

    if (item.amount_label) {
      summary.push(item.amount_label);
    }

    amount.textContent = summary.join(" · ");
    status.className = "namaa-account__status";
    status.setAttribute("data-status", item.status || "active");
    status.textContent = accountStatusLabel(item.status);
    copy.appendChild(title);
    meta.appendChild(amount);
    meta.appendChild(status);
    copy.appendChild(meta);
    appendAccountOrders(copy, item.orders || []);
    row.appendChild(copy);

    if (!item.cancellable) {
      return row;
    }

    button.type = "button";
    button.className = "namaa-account__cancel";
    button.textContent = "إلغاء الاشتراك";
    button.setAttribute("aria-label", "إلغاء " + (item.interval_label || "الاشتراك"));
    button.addEventListener("click", function () {
      if (button.getAttribute("data-confirm") !== "1") {
        button.setAttribute("data-confirm", "1");
        button.textContent = "تأكيد الإلغاء";
        return;
      }

      button.disabled = true;
      fetch(apiOrigin() + "/api/storefront/subscriptions/" + encodeURIComponent(item.id) + "/cancel", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Salla-Customer-Token": token,
        },
        body: JSON.stringify({ store_id: String(storeId) }),
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("cancel failed");
          }

          status.setAttribute("data-status", "cancelled");
          status.textContent = "ملغى";
          button.remove();
        })
        .catch(function () {
          button.disabled = false;
          button.textContent = "تعذر الإلغاء";
        });
    });
    row.appendChild(button);

    return row;
  }

  function bindProductFormWatch() {
    if (productFormBound) {
      return;
    }

    productFormBound = true;

    function onDomPriceChange() {
      applyLivePrice(visibleSallaPrice());
    }

    try {
      if (window.salla && window.salla.event && window.salla.event.product && typeof window.salla.event.product.onPriceUpdated === "function") {
        window.salla.event.product.onPriceUpdated(function (response) {
          applyLivePrice(parseSallaPricePayload(response));
        });
      }
    } catch (error) {}

    try {
      if (window.salla && window.salla.event && typeof window.salla.event.on === "function") {
        window.salla.event.on("product-options::change", requestLivePrice);
      }
    } catch (error) {}

    document.addEventListener("changed", function (event) {
      var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tag === "salla-product-options" || tag === "salla-quantity-input") {
        requestLivePrice();
      }
    });

    document.addEventListener("input", function (event) {
      var target = event.target;
      if (!target) {
        return;
      }
      if (target.name === "quantity" || (target.closest && target.closest("salla-quantity-input"))) {
        requestLivePrice();
      }
    });

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("salla-quantity-input")) {
        requestLivePrice();
      }
    });

    if (window.MutationObserver) {
      var priceWrap = document.querySelector(".price-wrapper") || document.querySelector(".price_is_on_sale");
      if (priceWrap) {
        new MutationObserver(function () {
          window.clearTimeout(onDomPriceChange._timer);
          onDomPriceChange._timer = window.setTimeout(onDomPriceChange, 40);
        }).observe(priceWrap, { childList: true, subtree: true, characterData: true });
      }
    }
  }

  function bindCurrencyWatch() {
    if (currencyBound) {
      return;
    }

    currencyBound = true;

    function refreshPrices() {
      if (!widgetState.config) {
        return;
      }

      requestLivePrice();
    }

    try {
      if (
        window.salla &&
        window.salla.event &&
        window.salla.event.currency &&
        typeof window.salla.event.currency.onChanged === "function"
      ) {
        window.salla.event.currency.onChanged(refreshPrices);
      }
    } catch (error) {}
  }

  function boot(attempt) {
    if (!window.salla || !window.salla.config || typeof window.salla.config.get !== "function") {
      if (attempt === 0) {
        console.info("[Namaa] SDK loaded, waiting for salla.config…");
      }
      if (attempt > 100) {
        console.warn("[Namaa] timed out waiting for salla.config");
        markReady(null, null);
        return;
      }
      window.setTimeout(function () {
        boot(attempt + 1);
      }, 50);
      return;
    }

    markReady(configGet("store.id"), configGet("store.username"));
  }

  boot(0);
})();
