/*
 * Browser side of the questionnaire file a client opens offline (RULE-ra-11).
 * Plain JavaScript, no network, no storage: the server inlines this file next to the catalog
 * (a JSON block with the id "fitpulse-data"). Text only ever goes in through `textContent`,
 * so a hostile company or brand name stays text.
 * Money and number masks are a port of `shared/format/money.ts` and the calculator block of
 * the app; `tests/unit/questionnaireFile.test.ts` keeps them in step.
 */
(function () {
  "use strict";

  const MONEY_MAX_DIGITS = 13;
  const MONEY_MAX_CENTS = 10 ** MONEY_MAX_DIGITS - 1;
  const NEW_CUSTOMERS_MAX = 1000000;
  const MARGIN_MAX = 100;

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  /* ---------- Masks (port of shared/format/money.ts) ---------- */

  function groupThousands(digits) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function formatMoney(cents) {
    const remainder = String(cents % 100);
    return "R$ " + groupThousands(String(Math.floor(cents / 100))) + "," + (remainder.length < 2 ? "0" + remainder : remainder);
  }

  const MONEY_MASK_LENGTH = formatMoney(MONEY_MAX_CENTS).length;

  function stripLeadingZeros(digits) {
    return digits.replace(/^0+(?=\d)/, "");
  }

  function digitsAfter(text, caret) {
    return (text.slice(caret).match(/\d/g) || []).length;
  }

  function caretWithDigitsAfter(masked, digitsToTheRight) {
    if (digitsToTheRight <= 0) return masked.length;
    let seen = 0;
    for (let index = masked.length - 1; index >= 0; index -= 1) {
      if (/\d/.test(masked.charAt(index))) {
        seen += 1;
        if (seen === digitsToTheRight) return index;
      }
    }
    return 0;
  }

  function maskedFromDigits(digits) {
    if (digits === "") return { value: "", cents: null };
    const cents = Number(digits);
    return { value: formatMoney(cents), cents: cents };
  }

  // Typed digits fill the cents from the right ("12" -> "R$ 0,12") and the caret keeps its place.
  function maskMoney(rawValue, caret, previous) {
    let raw = rawValue;
    let position = Math.min(Math.max(caret === undefined ? raw.length : caret, 0), raw.length);

    const separatorWasDeleted =
      previous !== undefined && raw.length < previous.length && raw.replace(/\D/g, "") === previous.replace(/\D/g, "");
    if (separatorWasDeleted) {
      const lastDigit = raw.slice(0, position).search(/\d(?!.*\d)/);
      if (lastDigit >= 0) {
        raw = raw.slice(0, lastDigit) + raw.slice(lastDigit + 1);
        position = lastDigit;
      }
    }

    const previousDigits = stripLeadingZeros((previous === undefined ? "" : previous).replace(/\D/g, ""));
    let digits = stripLeadingZeros(raw.replace(/\D/g, ""));
    if (digits.length > MONEY_MAX_DIGITS) {
      if (previous === undefined) {
        digits = digits.slice(0, MONEY_MAX_DIGITS);
      } else {
        const fallback = maskedFromDigits(previousDigits);
        return {
          value: fallback.value,
          cents: fallback.cents,
          caret: Math.max(Math.min(position - 1, fallback.value.length), 0),
        };
      }
    }
    const wasDeleted = previous !== undefined && raw.length < previous.length;
    if (wasDeleted && digits === "0" && previousDigits === "0") digits = "";

    const masked = maskedFromDigits(digits);
    return { value: masked.value, cents: masked.cents, caret: caretWithDigitsAfter(masked.value, digitsAfter(raw, position)) };
  }

  // A whole number typed by the client; null when empty or above the limit.
  function readWhole(text, max) {
    if (text === "") return null;
    const value = Number(text);
    return Number.isSafeInteger(value) && value <= max ? value : null;
  }

  const isCount = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;

  /* ---------- Answers and file (pure, shared with the unit test) ---------- */

  function emptyCalculator() {
    return {
      spendMode: null,
      spendParts: {},
      spendRange: null,
      newCustomersMode: null,
      newCustomers: null,
      newCustomersRange: null,
      averagePurchaseCents: null,
      purchasesPerYear: null,
      relationshipLength: null,
      marginPercent: null,
    };
  }

  // "Não sei" is a complete answer; exact and range need their own value.
  function isEntryComplete(mode, hasExact, hasRange) {
    if (mode === "unknown") return true;
    if (mode === "exact") return hasExact;
    if (mode === "range") return hasRange;
    return false;
  }

  function isCalculatorComplete(calc) {
    const margin = calc.marginPercent;
    return (
      isEntryComplete(calc.spendMode, Object.keys(calc.spendParts).length > 0, calc.spendRange !== null) &&
      isEntryComplete(calc.newCustomersMode, isCount(calc.newCustomers), calc.newCustomersRange !== null) &&
      isCount(calc.averagePurchaseCents) &&
      calc.purchasesPerYear !== null &&
      calc.relationshipLength !== null &&
      isCount(margin) &&
      margin <= MARGIN_MAX
    );
  }

  // Block 1 is the calculator; the others are answered when every question has a value.
  function isBlockAnswered(data, state, blockNumber) {
    if (blockNumber === 1) return isCalculatorComplete(state.calc);
    return data.questions.filter((q) => q.block === blockNumber).every((q) => hasOwn(state.answers, q.id));
  }

  function countAnsweredBlocks(data, state) {
    return data.blocks.filter((info) => isBlockAnswered(data, state, info.number)).length;
  }

  // Only the values of the mode the client picked travel in the file.
  function readCalculator(data, calc) {
    const out = {};
    if (calc.spendMode) {
      out.spendMode = calc.spendMode;
      if (calc.spendMode === "exact") {
        const parts = {};
        data.calculator.spendParts.forEach((part) => {
          if (isCount(calc.spendParts[part.key])) parts[part.key] = calc.spendParts[part.key];
        });
        if (Object.keys(parts).length > 0) out.spendParts = parts;
      } else if (calc.spendMode === "range" && calc.spendRange) {
        out.spendRange = calc.spendRange;
      }
    }
    if (calc.newCustomersMode) {
      out.newCustomersMode = calc.newCustomersMode;
      if (calc.newCustomersMode === "exact" && isCount(calc.newCustomers)) out.newCustomers = calc.newCustomers;
      else if (calc.newCustomersMode === "range" && calc.newCustomersRange) out.newCustomersRange = calc.newCustomersRange;
    }
    if (isCount(calc.averagePurchaseCents)) out.averagePurchaseCents = calc.averagePurchaseCents;
    if (calc.purchasesPerYear) out.purchasesPerYear = calc.purchasesPerYear;
    if (calc.relationshipLength) out.relationshipLength = calc.relationshipLength;
    if (isCount(calc.marginPercent) && calc.marginPercent <= MARGIN_MAX) out.marginPercent = calc.marginPercent;
    return out;
  }

  // The `.fitpulse` file: answers and calculator in the shape of the diagnosis PATCH.
  function buildAnswersFile(data, state, now) {
    const answers = {};
    data.questions.forEach((q) => {
      if (hasOwn(state.answers, q.id)) answers[q.id] = state.answers[q.id];
    });
    return {
      format: data.format,
      formatVersion: data.formatVersion,
      questionnaireVersion: data.questionnaireVersion,
      company: { id: data.company.id, name: data.company.name },
      savedAt: now.toISOString(),
      answers: answers,
      calculator: readCalculator(data, state.calc),
    };
  }

  // After saving: who gets the file. Without a brand it is "o seu consultor".
  function savedInstruction(brand) {
    let text = "Agora envie o arquivo para " + (brand && brand.name ? brand.name : "o seu consultor");
    if (brand && brand.phone) text += " pelo WhatsApp " + brand.phone;
    if (brand && brand.email) text += (brand.phone ? " ou" : "") + " por e-mail para " + brand.email;
    return text + ". Ele importa as respostas no FitPulse e revisa com você.";
  }

  const hook = typeof globalThis === "object" ? globalThis.__fitpulseQuestionnaireTestHook : undefined;
  if (typeof hook === "function") {
    hook({ maskMoney, readWhole, formatMoney, emptyCalculator, isBlockAnswered, countAnsweredBlocks, buildAnswersFile, savedInstruction });
    return;
  }

  /* ---------- Screen ---------- */

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.keys(props || {}).forEach((key) => {
      const value = props[key];
      if (value === null || value === undefined || value === false) return;
      if (key === "text") node.textContent = value;
      else if (key === "className") node.className = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    (children || []).forEach((child) => {
      if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function monogram(name) {
    const letters = (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0).toUpperCase());
    return letters.length > 0 ? letters.join("") : "FP";
  }

  function download(fileName, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
    const link = el("a", { href: url, download: fileName, style: "display:none" });
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // What every screen shares: the catalog, what the client answered so far and how to move.
  function createApp(root, data) {
    const app = {
      root: root,
      data: data,
      brand: data.brand,
      totalBlocks: data.blocks.length,
      state: { view: "block", block: 0, answers: {}, calc: emptyCalculator(), dirty: false },
      touch: () => {
        app.state.dirty = true;
      },
      go: (view, block) => {
        app.state.view = view;
        if (block !== undefined) app.state.block = block;
        renderApp(app);
      },
    };
    return app;
  }

  /* ----- Form controls ----- */

  function syncSelected(group) {
    group.querySelectorAll("label").forEach((label) => label.classList.toggle("selected", label.querySelector("input").checked));
  }

  function radioGroup(name, labelledBy, items, checkedKey, onPick, groupClass) {
    const group = el("div", { className: groupClass, role: "radiogroup", "aria-labelledby": labelledBy });
    items.forEach((item) => {
      const input = el("input", { type: "radio", name: name, value: item.key });
      input.checked = item.key === checkedKey;
      input.addEventListener("change", () => {
        onPick(item.key);
        syncSelected(group);
      });
      group.appendChild(el("label", { className: item.className }, [input, el("span", { text: item.label })]));
    });
    syncSelected(group);
    return group;
  }

  // Title row with the "?" button; the help text starts hidden.
  function titled(titleId, title, help) {
    const helpId = "help-" + titleId;
    const helpText = el("p", { className: "help-text", id: helpId, hidden: true, text: help });
    const toggle = el("button", { type: "button", className: "help-toggle", "aria-expanded": "false", "aria-controls": helpId, "aria-label": "Ajuda: " + title, text: "?" });
    toggle.addEventListener("click", () => {
      helpText.hidden = !helpText.hidden;
      toggle.setAttribute("aria-expanded", String(!helpText.hidden));
    });
    return [el("div", { className: "heading-row" }, [el("p", { className: "question-title", id: titleId, text: title }), toggle]), helpText];
  }

  function moneyInput(app, id, cents, labelProps, onCents) {
    const input = el("input", Object.assign({ id: id, className: "input mono", type: "text", inputmode: "decimal", autocomplete: "off", maxlength: MONEY_MASK_LENGTH, placeholder: "R$ 0,00" }, labelProps));
    let shown = isCount(cents) ? formatMoney(cents) : "";
    input.value = shown;
    input.addEventListener("input", () => {
      const masked = maskMoney(input.value, input.selectionStart === null ? undefined : input.selectionStart, shown);
      shown = masked.value;
      input.value = masked.value;
      try {
        input.setSelectionRange(masked.caret, masked.caret);
      } catch (error) {
        /* a browser that refuses to place the caret keeps it at the end */
      }
      app.touch();
      onCents(masked.cents);
    });
    return input;
  }

  // Digits only; a value above the limit shows the error and is not kept. `spec`: id, value, max, placeholder, errorText, labelledBy.
  function wholeInput(app, spec, onValue) {
    const error = el("p", { className: "field-error", id: spec.id + "-error" });
    const input = el("input", { id: spec.id, className: "input mono", type: "text", inputmode: "numeric", autocomplete: "off", maxlength: String(spec.max).length, placeholder: spec.placeholder, "aria-labelledby": spec.labelledBy, "aria-describedby": spec.id + "-error" });
    input.value = isCount(spec.value) ? String(spec.value) : "";
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "");
      const parsed = readWhole(digits, spec.max);
      const invalid = digits !== "" && parsed === null;
      input.value = digits;
      input.setAttribute("aria-invalid", String(invalid));
      error.textContent = invalid ? spec.errorText : "";
      app.touch();
      onValue(parsed);
    });
    return el("div", { className: "field narrow" }, [input, error]);
  }

  function optionSelect(app, labelledBy, placeholder, options, value, onValue) {
    const select = el("select", { "aria-labelledby": labelledBy }, [el("option", { value: "", text: placeholder })]);
    options.forEach((option) => select.appendChild(el("option", { value: option.key, text: option.label })));
    select.value = value || "";
    select.addEventListener("change", () => {
      app.touch();
      onValue(select.value === "" ? null : select.value);
    });
    return el("div", { className: "field medium" }, [select]);
  }

  function questionItem(app, question) {
    const answers = app.state.answers;
    const titleId = "q-" + question.id;
    const items = question.options.map((option) => ({ key: String(option.value), label: option.label, className: "choice" }));
    if (question.unknownLabel !== null) items.push({ key: "unknown", label: question.unknownLabel, className: "choice unknown" });
    let current = null;
    if (hasOwn(answers, question.id)) current = answers[question.id] === null ? "unknown" : String(answers[question.id]);
    const group = radioGroup("answer-" + question.id, titleId, items, current, (key) => {
      answers[question.id] = key === "unknown" ? null : Number(key);
      app.touch();
    }, "choices");
    return el("div", { className: "question" }, titled(titleId, question.text, question.help).concat([group]));
  }

  /* ----- Block 1: the six calculator fields ----- */

  function calculatorItem(app, fieldKey, buildBody) {
    const titleId = "calc-" + fieldKey;
    const copy = app.data.calculator.fields[fieldKey];
    return el("div", { className: "question", "data-field": fieldKey }, titled(titleId, copy.label, copy.help).concat(buildBody(titleId)));
  }

  // Mode radios plus the area for the picked mode ("sei os valores", "sei mais ou menos", "não sei").
  function entryItem(app, fieldKey, modes, modeKey, fillArea) {
    return calculatorItem(app, fieldKey, (titleId) => {
      const calc = app.state.calc;
      const area = el("div");
      const refill = () => {
        area.textContent = "";
        fillArea(app, titleId).forEach((node) => area.appendChild(node));
      };
      const items = modes.map((mode) => ({ key: mode.key, label: mode.label, className: "mode-option" }));
      const group = radioGroup("mode-" + fieldKey, titleId, items, calc[modeKey], (mode) => {
        calc[modeKey] = mode;
        app.touch();
        refill();
      }, "mode-row");
      refill();
      return [group, area];
    });
  }

  function spendExactFields(app) {
    const calc = app.state.calc;
    const total = el("output");
    const showTotal = () => {
      const values = Object.keys(calc.spendParts).map((key) => calc.spendParts[key]);
      total.textContent = formatMoney(values.reduce((sum, value) => sum + value, 0));
    };
    const fields = app.data.calculator.spendParts.map((part) => {
      const id = "spend-" + part.key;
      const input = moneyInput(app, id, calc.spendParts[part.key], {}, (cents) => {
        if (cents === null) delete calc.spendParts[part.key];
        else calc.spendParts[part.key] = cents;
        showTotal();
      });
      return el("div", { className: "field" }, [el("label", { for: id, text: part.label }), input]);
    });
    showTotal();
    return [
      el("div", { className: "field-grid" }, fields.concat([el("p", { className: "total-row" }, [el("span", { text: "Total em 3 meses" }), total])])),
      el("p", { className: "muted", text: "Deixe em branco o que você não usa. Contar só o anúncio deixa o custo do cliente menor do que é." }),
    ];
  }

  function spendArea(app, titleId) {
    const calc = app.state.calc;
    if (calc.spendMode === "range") {
      return [optionSelect(app, titleId, "Escolha uma faixa", app.data.calculator.spendRanges, calc.spendRange, (value) => { calc.spendRange = value; })];
    }
    return calc.spendMode === "exact" ? spendExactFields(app) : [];
  }

  function newCustomersArea(app, titleId) {
    const calc = app.state.calc;
    if (calc.newCustomersMode === "range") {
      return [optionSelect(app, titleId, "Escolha uma faixa", app.data.calculator.newCustomersRanges, calc.newCustomersRange, (value) => { calc.newCustomersRange = value; })];
    }
    if (calc.newCustomersMode !== "exact") return [];
    const spec = { id: "new-customers", value: calc.newCustomers, max: NEW_CUSTOMERS_MAX, placeholder: "Ex.: 40", errorText: "Use um número de 0 a 1.000.000.", labelledBy: titleId };
    return [wholeInput(app, spec, (value) => { calc.newCustomers = value; })];
  }

  function renderCalculator(app) {
    const calc = app.state.calc;
    const options = app.data.calculator;
    const marginSpec = (titleId) => ({ id: "margin", value: calc.marginPercent, max: MARGIN_MAX, placeholder: "Ex.: 35", errorText: "Use um número de 0 a 100.", labelledBy: titleId });
    return el("div", {}, [
      entryItem(app, "spend", options.spendModes, "spendMode", spendArea),
      entryItem(app, "newCustomers", options.newCustomersModes, "newCustomersMode", newCustomersArea),
      calculatorItem(app, "averagePurchase", (titleId) => [
        el("div", { className: "field narrow" }, [moneyInput(app, "average-purchase", calc.averagePurchaseCents, { "aria-labelledby": titleId }, (cents) => { calc.averagePurchaseCents = cents; })]),
      ]),
      calculatorItem(app, "purchasesPerYear", (titleId) => [optionSelect(app, titleId, "Escolha", options.purchasesPerYear, calc.purchasesPerYear, (value) => { calc.purchasesPerYear = value; })]),
      calculatorItem(app, "relationshipLength", (titleId) => [optionSelect(app, titleId, "Escolha", options.relationshipLength, calc.relationshipLength, (value) => { calc.relationshipLength = value; })]),
      calculatorItem(app, "margin", (titleId) => [
        wholeInput(app, marginSpec(titleId), (value) => { calc.marginPercent = value; }),
        el("p", { className: "muted", text: "Digite só o número: 35 quer dizer que sobram R$ 35." }),
      ]),
    ]);
  }

  /* ----- Screens ----- */

  function renderHead(app) {
    const brand = app.brand;
    const name = brand && brand.name ? brand.name : "Seu consultor";
    const contact = brand ? [brand.phone, brand.email].filter(Boolean).join(" · ") : "";
    const mark = el("span", { className: "brand-mark" });
    if (brand && brand.logo) mark.appendChild(el("img", { src: brand.logo, alt: "" }));
    else mark.textContent = monogram(brand ? brand.name : "");
    return el("header", { className: "client-head" }, [
      mark,
      el("div", {}, [el("div", { className: "brand-name", text: name }), el("div", { className: "muted", text: contact || "Questionário do FitPulse" })]),
    ]);
  }

  function renderIntro(app) {
    return [
      el("h1", { className: "title", text: "Questionário de crescimento" }),
      el("p", { className: "subtitle", text: app.data.company.name + " · leva uns 12 minutos" }),
    ];
  }

  function renderNotice(app) {
    return el("div", { className: "notice", role: "note" }, [el("span", { className: "notice-icon", "aria-hidden": "true", text: "!" }), el("span", { text: app.data.copy.desktopNotice })]);
  }

  function renderRail(app) {
    const state = app.state;
    const nav = el("nav", { className: "rail", "aria-label": "Blocos do questionário" });
    app.data.blocks.forEach((info, index) => {
      const answered = isBlockAnswered(app.data, state, info.number);
      const current = state.view === "block" && index === state.block;
      const link = el("a", {
        href: "#bloco-" + info.number,
        className: current ? "current" : answered ? "done" : "",
        "aria-label": "Bloco " + info.number + ": " + info.title + (answered ? " (respondido)" : ""),
        "aria-current": current ? "step" : null,
      });
      link.addEventListener("click", (event) => {
        event.preventDefault();
        app.go("block", index);
      });
      nav.appendChild(link);
    });
    return nav;
  }

  function renderBlock(app) {
    const state = app.state;
    const info = app.data.blocks[state.block];
    const children = [
      el("h2", { tabindex: "-1", "data-screen-title": "", text: info.number + ". " + info.title }),
      el("p", { className: "intro", text: info.intro }),
    ];
    if (info.number === 1) children.push(renderCalculator(app));
    else app.data.questions.filter((q) => q.block === info.number).forEach((q) => children.push(questionItem(app, q)));

    const back = el("button", { type: "button", className: "btn", text: "Voltar" });
    back.addEventListener("click", () => app.go("block", state.block - 1));
    const last = state.block === app.totalBlocks - 1;
    const next = el("button", { type: "button", className: "btn btn-primary", text: last ? "Revisar" : "Próximo bloco" });
    next.addEventListener("click", () => (last ? app.go("review") : app.go("block", state.block + 1)));
    children.push(el("div", { className: "actions" }, [state.block > 0 ? back : null, next]));
    return el("section", { className: "panel" }, children);
  }

  // A block that is answered shows a chip; one that is not links back to it.
  function reviewRow(app, info, index) {
    let status;
    if (isBlockAnswered(app.data, app.state, info.number)) {
      status = el("span", { className: "chip", text: "Respondido" });
    } else {
      status = el("a", { className: "link", href: "#bloco-" + info.number, "aria-label": "Responder o bloco " + info.number + ": " + info.title, text: "Responder" });
      status.addEventListener("click", (event) => {
        event.preventDefault();
        app.go("block", index);
      });
    }
    return el("li", {}, [el("span", { text: info.number + ". " + info.title }), status]);
  }

  function renderReview(app) {
    const answered = countAnsweredBlocks(app.data, app.state);
    const summary = answered + " de " + app.totalBlocks + " blocos respondidos." + (answered < app.totalBlocks ? " Você pode salvar assim mesmo; o consultor vê o que ficou faltando." : "");
    const back = el("button", { type: "button", className: "btn", text: "Voltar" });
    back.addEventListener("click", () => app.go("block", app.totalBlocks - 1));
    const save = el("button", { type: "button", className: "btn btn-gold", text: "Salvar minhas respostas" });
    save.addEventListener("click", () => saveAnswers(app));
    return el("section", { className: "panel" }, [
      el("h2", { tabindex: "-1", "data-screen-title": "", text: "Revise e salve" }),
      el("p", { className: "intro", text: summary }),
      el("ul", { className: "review-rows" }, app.data.blocks.map((info, index) => reviewRow(app, info, index))),
      el("div", { className: "actions" }, [back, save]),
    ]);
  }

  function renderSaved(app) {
    const again = el("button", { type: "button", className: "btn", text: "Baixar de novo" });
    again.addEventListener("click", () => writeFile(app));
    const edit = el("button", { type: "button", className: "btn", text: "Voltar às respostas" });
    edit.addEventListener("click", () => app.go("review"));
    return el("section", { className: "panel saved", role: "status" }, [
      el("h2", { tabindex: "-1", "data-screen-title": "", text: "Respostas salvas" }),
      el("p", {}, ["O arquivo foi para a pasta de downloads deste computador: ", el("span", { className: "file-path", text: app.data.answersFileName })]),
      el("p", { text: savedInstruction(app.brand) }),
      el("div", { className: "actions" }, [again, edit]),
    ]);
  }

  function writeFile(app) {
    download(app.data.answersFileName, JSON.stringify(buildAnswersFile(app.data, app.state, new Date()), null, 2));
  }

  function saveAnswers(app) {
    writeFile(app);
    app.state.dirty = false;
    app.go("saved");
  }

  function renderApp(app) {
    const state = app.state;
    app.root.textContent = "";
    const shell = el("div", { className: "shell" }, [renderHead(app)].concat(renderIntro(app)));
    if (state.view === "saved") {
      shell.appendChild(renderSaved(app));
    } else {
      const progress = state.view === "review" ? "Revisão" : "Bloco " + (state.block + 1) + " de " + app.totalBlocks + " · " + app.data.blocks[state.block].title;
      shell.appendChild(renderNotice(app));
      shell.appendChild(renderRail(app));
      shell.appendChild(el("p", { className: "progress", text: progress }));
      shell.appendChild(state.view === "review" ? renderReview(app) : renderBlock(app));
    }
    app.root.appendChild(shell);
    const heading = app.root.querySelector("[data-screen-title]");
    if (heading) heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function boot() {
    const root = document.getElementById("app");
    let data = null;
    try {
      data = JSON.parse(document.getElementById("fitpulse-data").textContent);
    } catch (error) {
      data = null;
    }
    if (data === null) {
      root.appendChild(el("p", { className: "fallback", text: "Este arquivo está incompleto. Peça um novo questionário a quem o enviou." }));
      return;
    }
    const app = createApp(root, data);
    // The approved warning says the answers are lost when the page closes before saving.
    window.addEventListener("beforeunload", (event) => {
      if (!app.state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
    renderApp(app);
  }

  boot();
})();
