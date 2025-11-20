window.SealApp = window.SealApp || {};

(function() {
    const search = window.SealApp.search;
    const TEMP_THRESHOLDS = [175, 225, 300, 400, 450, 500];
    const UNSPECIFIED_DIM_VALUE = window.SealApp.UNSPECIFIED_DIM_VALUE || "__UNSPECIFIED__";

    function getSelectedFamilies(context) {
        if (window.SealApp && window.SealApp.familyFilters) {
            return window.SealApp.familyFilters.getSelectedFamilies(context);
        }
        return null;
    }

    function getCurrentDimFilters() {
        return {
            shaft: document.getElementById("shaft-size-select")?.value || "",
            matingOd: document.getElementById("mating-od-select")?.value || "",
            headType: document.getElementById("head-type-select")?.value || "",
            matingDesign: document.getElementById("mating-design-select")?.value || ""
        };
    }

    function getCurrentAdvancedFilters() {
        const fluidSecondarySelect = document.getElementById("fluid-secondary-select");
        const fluidFacesSelect = document.getElementById("fluid-faces-select");
        const fluidMetalsSelect = document.getElementById("fluid-metals-select");

        function parseFluid(sel) {
            if (!sel || sel.value === "") return null;
            const idx = parseInt(sel.value, 10);
            return Number.isNaN(idx) ? null : idx;
        }

        return {
            secondaryMaterial: document.getElementById("secondary-material-select")?.value || "",
            faceMaterial: document.getElementById("face-material-select")?.value || "",
            metalMaterial: document.getElementById("metal-material-select")?.value || "",
            minTempF: document.getElementById("temp-rating-select")?.value || "",
            fluidSecondaryIndex: parseFluid(fluidSecondarySelect),
            fluidFacesIndex: parseFluid(fluidFacesSelect),
            fluidMetalsIndex: parseFluid(fluidMetalsSelect)
        };
    }

    function buildFilters(unit) {
        return Object.assign({ unit }, getCurrentDimFilters(), getCurrentAdvancedFilters(), {
            allowedFamilies: getSelectedFamilies("dim")
        });
    }

    function formatDimNumberLocal(value, unit) {
        const num = Number(value);
        if (!Number.isFinite(num)) return "";
        const digits = unit === "mm" ? 2 : 3;
        const fixed = num.toFixed(digits);
        if (num === 0) {
            return digits === 3 ? "0.000" : "0.00";
        }
        if (Math.abs(num) < 1) {
            const dotIdx = fixed.indexOf(".");
            if (dotIdx >= 0) {
                return (num < 0 ? "-" : "") + fixed.slice(dotIdx);
            }
            return (num < 0 ? "-0." : "0.") + "0".repeat(digits);
        }
        return fixed.replace(/0+$/, "").replace(/\.$/, "");
    }

    function formatDimensionOption(value, unit) {
        if (value == null) return "";
        return formatDimNumberLocal(value, unit);
    }

    function fillDimensionSelect(selectEl, placeholder, entries, previousValue, includeUnspecified, unit) {
        if (!selectEl) return;
        const current = previousValue || selectEl.value || "";
        selectEl.innerHTML = "";
        const baseOpt = document.createElement("option");
        baseOpt.value = "";
        baseOpt.textContent = placeholder;
        selectEl.appendChild(baseOpt);
        if (includeUnspecified) {
            const unspec = document.createElement("option");
            unspec.value = UNSPECIFIED_DIM_VALUE;
            unspec.textContent = "Unspecified";
            selectEl.appendChild(unspec);
        }
        (entries || []).forEach(entry => {
            const opt = document.createElement("option");
            opt.value = entry.value;
            opt.textContent = formatDimensionOption(entry.value, unit);
            if (entry.converted) {
                opt.classList.add("option-converted");
                opt.style.backgroundColor = "#fff7cc";
                opt.style.fontWeight = "600";
            }
            selectEl.appendChild(opt);
        });
        if (current && Array.from(selectEl.options).some(opt => opt.value === current)) {
            selectEl.value = current;
        } else {
            selectEl.value = "";
        }
        selectEl.disabled = selectEl.options.length <= 1;
    }

    function fillSimpleSelect(selectEl, placeholder, values, previousValue) {
        if (!selectEl) return;
        const current = previousValue || selectEl.value || "";
        selectEl.innerHTML = "";
        const anyOpt = document.createElement("option");
        anyOpt.value = "";
        anyOpt.textContent = placeholder;
        selectEl.appendChild(anyOpt);
        (values || []).forEach(val => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            selectEl.appendChild(opt);
        });
        if (current && Array.from(selectEl.options).some(opt => opt.value === current)) {
            selectEl.value = current;
        } else {
            selectEl.value = "";
        }
    }

    function fillTempSelect(selectEl, values, previousValue) {
        if (!selectEl) return;
        const current = previousValue || selectEl.value || "";
        selectEl.innerHTML = "";
        const anyOpt = document.createElement("option");
        anyOpt.value = "";
        anyOpt.textContent = "Any";
        selectEl.appendChild(anyOpt);
        (values || []).forEach(temp => {
            const opt = document.createElement("option");
            opt.value = String(temp);
            opt.textContent = "≥ " + temp + "°F";
            selectEl.appendChild(opt);
        });
        if (current && Array.from(selectEl.options).some(opt => opt.value === current)) {
            selectEl.value = current;
        } else {
            selectEl.value = "";
        }
    }

    function fillFluidSelect(selectEl, options, previousValue) {
        if (!selectEl) return;
        const current = previousValue != null ? String(previousValue) : selectEl.value || "";
        selectEl.innerHTML = "";
        const anyOpt = document.createElement("option");
        anyOpt.value = "";
        anyOpt.textContent = "Any";
        selectEl.appendChild(anyOpt);
        (options || []).forEach(entry => {
            const opt = document.createElement("option");
            opt.value = String(entry.value);
            opt.textContent = entry.label;
            selectEl.appendChild(opt);
        });
        if (current && Array.from(selectEl.options).some(opt => opt.value === current)) {
            selectEl.value = current;
        } else {
            selectEl.value = "";
        }
    }

    function collectMaterialOptions(categoryKey, filters) {
        if (!search || !search.filterSeals) return [];
        const clone = Object.assign({}, filters);
        if (categoryKey === "secondary") clone.secondaryMaterial = "";
        if (categoryKey === "faces") clone.faceMaterial = "";
        if (categoryKey === "metals") clone.metalMaterial = "";
        const set = new Set();
        (search.filterSeals(clone) || []).forEach(seal => {
            const list = seal.materials && seal.materials[categoryKey];
            if (!list) return;
            list.forEach(val => { if (val) set.add(val); });
        });
        return Array.from(set).sort();
    }

    function collectTempOptions(filters) {
        const seals = search ? search.filterSeals(Object.assign({}, filters, { minTempF: "" })) : [];
        const temps = new Set();
        (seals || []).forEach(seal => {
            if (seal.max_temp_f != null) temps.add(seal.max_temp_f);
        });
        const list = Array.from(temps).sort((a, b) => a - b);
        return list.length ? list : TEMP_THRESHOLDS;
    }

    function rebuildDimensionalOptions(unit, filters) {
        if (!search || !search.getUniqueOptions) return;
        const baseFilters = Object.assign({}, filters);

        const shaftSel = document.getElementById("shaft-size-select");
        const shaftResult = search.getUniqueOptions(
            unit,
            Object.assign({}, baseFilters, { shaft: "" })
        );
        fillDimensionSelect(
            shaftSel,
            unit === "inch" ? "Select shaft (inch)" : "Select shaft (mm)",
            (shaftResult && shaftResult.shaft) || [],
            filters.shaft,
            shaftResult && shaftResult.includeUnspecifiedShaft,
            unit
        );

        const matingSel = document.getElementById("mating-od-select");
        const matingResult = search.getUniqueOptions(
            unit,
            Object.assign({}, baseFilters, { matingOd: "" })
        );
        fillDimensionSelect(
            matingSel,
            "(optional)",
            (matingResult && matingResult.matingOd) || [],
            filters.matingOd,
            matingResult && matingResult.includeUnspecifiedMating,
            unit
        );

        const headSel = document.getElementById("head-type-select");
        const headResult = search.getUniqueOptions(
            unit,
            Object.assign({}, baseFilters, { headType: "" })
        );
        fillSimpleSelect(
            headSel,
            "(optional)",
            (headResult && headResult.headTypes) || [],
            filters.headType
        );
        if (headSel) headSel.disabled = headSel.options.length <= 1;

        const designSel = document.getElementById("mating-design-select");
        const designResult = search.getUniqueOptions(
            unit,
            Object.assign({}, baseFilters, { matingDesign: "" })
        );
        fillSimpleSelect(
            designSel,
            "(optional)",
            (designResult && designResult.matingDesigns) || [],
            filters.matingDesign
        );
        if (designSel) designSel.disabled = designSel.options.length <= 1;
    }

    function rebuildAdvancedOptions(unit, filters) {
        const secOpts = collectMaterialOptions("secondary", filters);
        const faceOpts = collectMaterialOptions("faces", filters);
        const metalOpts = collectMaterialOptions("metals", filters);
        const tempOpts = collectTempOptions(filters);

        fillSimpleSelect(document.getElementById("secondary-material-select"), "Any", secOpts, filters.secondaryMaterial);
        fillSimpleSelect(document.getElementById("face-material-select"), "Any", faceOpts, filters.faceMaterial);
        fillSimpleSelect(document.getElementById("metal-material-select"), "Any", metalOpts, filters.metalMaterial);
        fillTempSelect(document.getElementById("temp-rating-select"), tempOpts, filters.minTempF);

        if (search && search.collectFluidOptionsForCategory) {
            fillFluidSelect(
                document.getElementById("fluid-secondary-select"),
                search.collectFluidOptionsForCategory("secondary", Object.assign({}, filters, { fluidSecondaryIndex: null })),
                filters.fluidSecondaryIndex
            );
            fillFluidSelect(
                document.getElementById("fluid-faces-select"),
                search.collectFluidOptionsForCategory("faces", Object.assign({}, filters, { fluidFacesIndex: null })),
                filters.fluidFacesIndex
            );
            fillFluidSelect(
                document.getElementById("fluid-metals-select"),
                search.collectFluidOptionsForCategory("metals", Object.assign({}, filters, { fluidMetalsIndex: null })),
                filters.fluidMetalsIndex
            );
        }
    }

    function cascadeFilters() {
        const unit = document.querySelector('input[name="unit"]:checked')?.value || "inch";
        const filters = buildFilters(unit);
        rebuildDimensionalOptions(unit, filters);
        rebuildAdvancedOptions(unit, filters);
    }

    function initUnitListener() {
        document.querySelectorAll('input[name="unit"]').forEach(radio => {
            radio.addEventListener("change", cascadeFilters);
        });
    }

    function initDimFilterListeners() {
        ["shaft-size-select", "mating-od-select", "head-type-select", "mating-design-select"].forEach(id => {
            const sel = document.getElementById(id);
            if (sel) sel.addEventListener("change", cascadeFilters);
        });
    }

    function initAdvancedFilterListeners() {
        [
            "secondary-material-select",
            "face-material-select",
            "metal-material-select",
            "temp-rating-select",
            "fluid-secondary-select",
            "fluid-faces-select",
            "fluid-metals-select"
        ].forEach(id => {
            const sel = document.getElementById(id);
            if (sel) sel.addEventListener("change", cascadeFilters);
        });
    }

    function initFamilyCheckboxes() {
        document.querySelectorAll('.family-checkbox[data-context="dim"]').forEach(box => {
            box.addEventListener("change", cascadeFilters);
        });
        document.querySelectorAll('.family-checkbox[data-context="pn"]').forEach(box => {
            box.addEventListener("change", () => {
                if (window.SealApp.familyFilters) {
                    window.SealApp.familyFilters.handleFamilyChange("pn");
                }
            });
        });
        document.querySelectorAll('.family-checkbox[data-context="mfg"]').forEach(box => {
            box.addEventListener("change", () => {
                if (window.SealApp.familyFilters) {
                    window.SealApp.familyFilters.handleFamilyChange("mfg");
                }
            });
        });
    }

    function renderDesignChart() {
        const assets = window.SealApp.designAssets || {};
        const headContainer = document.getElementById("design-chart-head-grid");
        const ringContainer = document.getElementById("design-chart-ring-grid");
        if (headContainer) {
            headContainer.innerHTML = "";
            (assets.headTypes || []).forEach(item => {
                const card = document.createElement("div");
                card.className = "design-chart-card";
                if (item.image) {
                    const img = document.createElement("img");
                    img.src = item.image;
                    img.alt = item.label || item.code;
                    card.appendChild(img);
                }
                const label = document.createElement("div");
                label.className = "design-chart-card__label";
                label.textContent = item.label || item.code;
                card.appendChild(label);
                if (item.detail) {
                    const detail = document.createElement("div");
                    detail.className = "design-chart-card__detail";
                    detail.textContent = item.detail;
                    card.appendChild(detail);
                }
                headContainer.appendChild(card);
            });
        }
        if (ringContainer) {
            ringContainer.innerHTML = "";
            (assets.matingDesigns || []).forEach(item => {
                const card = document.createElement("div");
                card.className = "design-chart-card";
                if (item.image) {
                    const img = document.createElement("img");
                    img.src = item.image;
                    img.alt = item.label || item.code;
                    card.appendChild(img);
                }
                const label = document.createElement("div");
                label.className = "design-chart-card__label";
                label.textContent = item.label || item.code;
                card.appendChild(label);
                if (item.detail) {
                    const detail = document.createElement("div");
                    detail.className = "design-chart-card__detail";
                    detail.textContent = item.detail;
                    card.appendChild(detail);
                }
                ringContainer.appendChild(card);
            });
        }
    }

    function initDesignChart() {
        const btn = document.getElementById("design-chart-button");
        const modal = document.getElementById("design-chart-modal");
        const overlay = document.getElementById("design-chart-overlay");
        const closeBtn = document.getElementById("design-chart-close");
        if (!btn || !modal) return;

        function closeModal() {
            modal.classList.remove("open");
            modal.setAttribute("aria-hidden", "true");
        }

        btn.addEventListener("click", () => {
            renderDesignChart();
            modal.classList.add("open");
            modal.setAttribute("aria-hidden", "false");
        });
        if (overlay) overlay.addEventListener("click", closeModal);
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal.classList.contains("open")) {
                closeModal();
            }
        });
    }

    function initResetButton() {
        const btn = document.getElementById("dim-reset-button");
        if (!btn) return;
        btn.addEventListener("click", () => {
            document.querySelector('input[name="unit"][value="inch"]')?.click();
            document.querySelectorAll('.family-checkbox[data-context="dim"]').forEach(box => box.checked = true);
            [
                "shaft-size-select",
                "mating-od-select",
                "head-type-select",
                "mating-design-select",
                "secondary-material-select",
                "face-material-select",
                "metal-material-select",
                "temp-rating-select",
                "fluid-secondary-select",
                "fluid-faces-select",
                "fluid-metals-select"
            ].forEach(id => {
                const sel = document.getElementById(id);
                if (sel) sel.value = "";
            });
            cascadeFilters();
        });
    }

    function init() {
        const initialUnit = document.querySelector('input[name="unit"]:checked')?.value || "inch";
        const baseFilters = buildFilters(initialUnit);
        rebuildDimensionalOptions(initialUnit, baseFilters);
        rebuildAdvancedOptions(initialUnit, baseFilters);
        initUnitListener();
        initDimFilterListeners();
        initAdvancedFilterListeners();
        initFamilyCheckboxes();
        initDesignChart();
        initResetButton();
    }

    document.addEventListener("DOMContentLoaded", init);

    window.SealApp.uiFilters = {
        rebuildDimensionalOptions,
        rebuildAdvancedOptions
    };
})();
