window.SealApp = window.SealApp || {};

(function() {
    const search = window.SealApp.search;
    const materialsData = window.SealApp.materialsData;
    const collectFluidOptionsForCategory =
        search && search.collectFluidOptionsForCategory
            ? search.collectFluidOptionsForCategory
            : (() => []);
    const TEMP_THRESHOLDS = [175, 225, 300, 400, 450, 500];
    const UNSPECIFIED_DIM_VALUE = window.SealApp.UNSPECIFIED_DIM_VALUE || "__UNSPECIFIED__";

    function getCurrentDimFilters() {
        const shaftSel = document.getElementById("shaft-size-select");
        const matingSel = document.getElementById("mating-od-select");
        const headSel = document.getElementById("head-type-select");
        const designSel = document.getElementById("mating-design-select");

        return {
            shaft: shaftSel.value || "",
            matingOd: matingSel.value || "",
            headType: headSel.value || "",
            matingDesign: designSel.value || ""
        };
    }

    function getCurrentAdvancedFilters() {
        const secSel = document.getElementById("secondary-material-select");
        const faceSel = document.getElementById("face-material-select");
        const metalSel = document.getElementById("metal-material-select");
        const tempSel = document.getElementById("temp-rating-select");

        const fluidSecSel = document.getElementById("fluid-secondary-select");
        const fluidFaceSel = document.getElementById("fluid-faces-select");
        const fluidMetalSel = document.getElementById("fluid-metals-select");

        function parseFluidIndex(sel) {
            if (!sel || sel.value === "" || sel.value == null) return null;
            const parsed = parseInt(sel.value, 10);
            return Number.isNaN(parsed) ? null : parsed;
        }

        return {
            secondaryMaterial: secSel ? secSel.value || "" : "",
            faceMaterial: faceSel ? faceSel.value || "" : "",
            metalMaterial: metalSel ? metalSel.value || "" : "",
            minTempF: tempSel ? tempSel.value || "" : "",
            fluidSecondaryIndex: parseFluidIndex(fluidSecSel),
            fluidFacesIndex: parseFluidIndex(fluidFaceSel),
            fluidMetalsIndex: parseFluidIndex(fluidMetalSel)
        };
    }


    function buildEmptyFilters(unit) {
        return {
            unit,
            shaft: "",
            matingOd: "",
            headType: "",
            matingDesign: "",
            secondaryMaterial: "",
            faceMaterial: "",
            metalMaterial: "",
            minTempF: "",
            fluidSecondaryIndex: null,
            fluidFacesIndex: null,
            fluidMetalsIndex: null
        };
    }


    function createDesignCard(item) {
        const card = document.createElement("div");
        card.className = "design-chart-card";

        if (item.image) {
            const img = document.createElement("img");
            img.src = item.image;
            img.alt = item.label;
            card.appendChild(img);
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "design-chart-card__placeholder";
            placeholder.textContent = "Image unavailable";
            card.appendChild(placeholder);
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

        return card;
    }

    function renderDesignChartSection(items, containerId, fallbackText) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";
        if (!items || !items.length) {
            const p = document.createElement("p");
            p.className = "tiny-help";
            p.textContent = fallbackText;
            container.appendChild(p);
            return;
        }

        for (const item of items) {
            container.appendChild(createDesignCard(item));
        }
    }

    function renderDesignChart() {
        const assets = window.SealApp.designAssets || {};
        renderDesignChartSection(
            assets.headTypes,
            "design-chart-head-grid",
            "Head type reference not available."
        );
        renderDesignChartSection(
            assets.matingDesigns,
            "design-chart-ring-grid",
            "Mating ring design reference not available."
        );
    }

    function collectMaterialOptions(fieldKey, filters) {
        const results = search.filterSeals(filters);
        const set = new Set();
        for (const seal of results) {
            const mats = seal.materials || {};
            const list = mats[fieldKey] || [];
            list.forEach(item => set.add(item));
        }
        return Array.from(set).sort();
    }

    function collectTempOptions(filters) {
        const results = search.filterSeals(filters);
        const available = new Set();
        for (const seal of results) {
            const maxT = seal.max_temp_f;
            if (maxT == null) continue;
            TEMP_THRESHOLDS.forEach(threshold => {
                if (maxT >= threshold) available.add(threshold);
            });
        }
        return TEMP_THRESHOLDS.filter(t => available.has(t));
    }

    function isSealCompatibleWithFluid(seal, fluidRec) {
        if (!fluidRec) return false;
        const mats = seal.materials || {};
        const secOk = new Set(fluidRec.secondary_ok || []);
        const faceOk = new Set(fluidRec.faces_ok || []);
        const metalOk = new Set(fluidRec.metals_ok || []);
        const secList = mats.secondary || [];
        const faceList = mats.faces || [];
        const metalList = mats.metals || [];
        if (secList.length && !secList.some(m => secOk.has(m))) return false;
        if (faceList.length && !faceList.some(m => faceOk.has(m))) return false;
        if (metalList.length && !metalList.some(m => metalOk.has(m))) return false;
        return true;
    }

    function collectFluidOptions(filters) {
        const results = search.filterSeals(filters);
        const fluids = materialsData.fluids || [];
        const available = [];
        for (let idx = 0; idx < fluids.length; idx++) {
            const rec = fluids[idx];
            if (!rec) continue;
            const hasMatch = results.some(seal => isSealCompatibleWithFluid(seal, rec));
            if (hasMatch) {
                available.push({ value: idx, label: rec.fluid });
            }
        }
        return available;
    }

    function fillSimpleSelect(selectEl, placeholder, values, previousValue) {
        selectEl.innerHTML = "";
        const baseOpt = document.createElement("option");
        baseOpt.value = "";
        baseOpt.textContent = placeholder;
        selectEl.appendChild(baseOpt);

        values.forEach(val => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            selectEl.appendChild(opt);
        });

        if (previousValue && Array.from(selectEl.options).some(opt => opt.value === previousValue)) {
            selectEl.value = previousValue;
        } else {
            selectEl.value = "";
        }
    }

    function fillTempSelect(selectEl, values, previousValue) {
        selectEl.innerHTML = '<option value="">Any</option>';
        values.forEach(val => {
            const opt = document.createElement("option");
            opt.value = String(val);
            opt.textContent = ">= " + val + "°F";
            selectEl.appendChild(opt);
        });

        if (previousValue && Array.from(selectEl.options).some(opt => opt.value === previousValue)) {
            selectEl.value = previousValue;
        } else {
            selectEl.value = "";
        }
    }

    function fillFluidSelect(selectEl, options, previousValue) {
        selectEl.innerHTML = '<option value="">Any</option>';
        options.forEach(item => {
            const opt = document.createElement("option");
            opt.value = String(item.value);
            opt.textContent = item.label;
            selectEl.appendChild(opt);
        });

        if (previousValue && Array.from(selectEl.options).some(opt => opt.value === previousValue)) {
            selectEl.value = previousValue;
        } else {
            selectEl.value = "";
        }
    }

    function rebuildAdvancedOptions(unit, filters) {
        const mergedFilters = Object.assign({ unit }, filters || {});
        const secSel = document.getElementById("secondary-material-select");
        const faceSel = document.getElementById("face-material-select");
        const metalSel = document.getElementById("metal-material-select");
        const tempSel = document.getElementById("temp-rating-select");

        const fluidSecSel = document.getElementById("fluid-secondary-select");
        const fluidFaceSel = document.getElementById("fluid-faces-select");
        const fluidMetalSel = document.getElementById("fluid-metals-select");

        if (!secSel || !faceSel || !metalSel || !tempSel ||
            !fluidSecSel || !fluidFaceSel || !fluidMetalSel) {
            return;
        }

        const prevSec = secSel.value;
        const prevFace = faceSel.value;
        const prevMetal = metalSel.value;
        const prevTemp = tempSel.value;

        const prevFluidSec = fluidSecSel.value;
        const prevFluidFace = fluidFaceSel.value;
        const prevFluidMetal = fluidMetalSel.value;

        const secondaryOpts = collectMaterialOptions(
            "secondary",
            Object.assign({}, mergedFilters, { secondaryMaterial: "" })
        );
        const faceOpts = collectMaterialOptions(
            "faces",
            Object.assign({}, mergedFilters, { faceMaterial: "" })
        );
        const metalOpts = collectMaterialOptions(
            "metals",
            Object.assign({}, mergedFilters, { metalMaterial: "" })
        );
        const tempOpts = collectTempOptions(
            Object.assign({}, mergedFilters, { minTempF: "" })
        );

        // Build fluid lists per category without their own fluid filters applied
        const fluidSecondaryOpts = collectFluidOptionsForCategory(
            "secondary",
            Object.assign({}, mergedFilters, { fluidSecondaryIndex: null })
        );
        const fluidFacesOpts = collectFluidOptionsForCategory(
            "faces",
            Object.assign({}, mergedFilters, { fluidFacesIndex: null })
        );
        const fluidMetalsOpts = collectFluidOptionsForCategory(
            "metals",
            Object.assign({}, mergedFilters, { fluidMetalsIndex: null })
        );

        fillSimpleSelect(secSel, "Any", secondaryOpts, prevSec);
        fillSimpleSelect(faceSel, "Any", faceOpts, prevFace);
        fillSimpleSelect(metalSel, "Any", metalOpts, prevMetal);
        fillTempSelect(tempSel, tempOpts, prevTemp);

        fillFluidSelect(fluidSecSel, fluidSecondaryOpts, prevFluidSec);
        fillFluidSelect(fluidFaceSel, fluidFacesOpts, prevFluidFace);
        fillFluidSelect(fluidMetalSel, fluidMetalsOpts, prevFluidMetal);
    }



    /**
     * Rebuild all dimensional dropdowns based on:
     *  - selected unit (inch/mm)
     *  - current combination of dimensional filters
     *
     * IMPORTANT: for each dropdown, we ignore its own current value when
     * building its *options*, and only apply constraints from the other filters.
     * This way:
     *   - selecting 1.250" will not collapse the shaft dropdown to only 1.250",
     *     but will shrink the other filters.
     *   - if another filter is set (e.g. head type = A), the shaft dropdown
     *     will only show shaft sizes that exist with head type A.
     */
    function rebuildDimensionalOptions(unit, filters) {
        filters = filters || {};

        const shaftSel = document.getElementById("shaft-size-select");
        const matingSel = document.getElementById("mating-od-select");
        const headSel = document.getElementById("head-type-select");
        const designSel = document.getElementById("mating-design-select");

        const prevShaft = shaftSel.value;
        const prevMating = matingSel.value;
        const prevHead = headSel.value;
        const prevDesign = designSel.value;

        // Build option sets for each dropdown with its own filter cleared
        const filtersForShaft = Object.assign({}, filters, { shaft: "" });
        const filtersForMating = Object.assign({}, filters, { matingOd: "" });
        const filtersForHead = Object.assign({}, filters, { headType: "" });
        const filtersForDesign = Object.assign({}, filters, { matingDesign: "" });

        const optsForShaft = search.getUniqueOptions(unit, filtersForShaft);
        const optsForMating = search.getUniqueOptions(unit, filtersForMating);
        const optsForHead = search.getUniqueOptions(unit, filtersForHead);
        const optsForDesign = search.getUniqueOptions(unit, filtersForDesign);

        // ---- Shaft / Seal Size ----
        shaftSel.innerHTML = "";
        const shaftPlaceholder = document.createElement("option");
        shaftPlaceholder.value = "";
        shaftPlaceholder.textContent = "Select shaft size...";
        shaftSel.appendChild(shaftPlaceholder);

        for (const item of optsForShaft.shaft) {
            const opt = document.createElement("option");
            opt.value = item.value.toFixed(4);
            opt.textContent = (unit === "inch"
                ? item.value.toFixed(3)
                : item.value.toFixed(2)
            ).replace(/0+$/,"").replace(/\.$/,"") + (unit === "inch" ? " in" : " mm");
            if (item.converted) {
                opt.classList.add("converted-option");
                opt.textContent += " *";
            }
            shaftSel.appendChild(opt);
        }
        if (optsForShaft.includeUnspecifiedShaft) {
            const opt = document.createElement("option");
            opt.value = UNSPECIFIED_DIM_VALUE;
            opt.textContent = "Unspecified";
            shaftSel.appendChild(opt);
        }
        shaftSel.disabled = false;

        if (prevShaft && shaftSel.querySelector('option[value="' + prevShaft + '"]')) {
            shaftSel.value = prevShaft;
        } else if (filters.shaft === UNSPECIFIED_DIM_VALUE) {
            shaftSel.value = UNSPECIFIED_DIM_VALUE;
        } else if (!filters.shaft) {
            shaftSel.value = "";
        }

        // ---- Mating OD / Seat OD ----
        matingSel.innerHTML = "";
        const matingPlaceholder = document.createElement("option");
        matingPlaceholder.value = "";
        matingPlaceholder.textContent = "(optional)";
        matingSel.appendChild(matingPlaceholder);

        for (const item of optsForMating.matingOd) {
            const opt = document.createElement("option");
            opt.value = item.value.toFixed(4);
            opt.textContent = (unit === "inch"
                ? item.value.toFixed(3)
                : item.value.toFixed(2)
            ).replace(/0+$/,"").replace(/\.$/,"") + (unit === "inch" ? " in" : " mm");
            if (item.converted) {
                opt.classList.add("converted-option");
                opt.textContent += " *";
            }
            matingSel.appendChild(opt);
        }
        if (optsForMating.includeUnspecifiedMating) {
            const opt = document.createElement("option");
            opt.value = UNSPECIFIED_DIM_VALUE;
            opt.textContent = "Unspecified";
            matingSel.appendChild(opt);
        }
        matingSel.disabled = false;

        if (prevMating && matingSel.querySelector('option[value="' + prevMating + '"]')) {
            matingSel.value = prevMating;
        } else if (filters.matingOd === UNSPECIFIED_DIM_VALUE) {
            matingSel.value = UNSPECIFIED_DIM_VALUE;
        } else if (!filters.matingOd) {
            matingSel.value = "";
        }

        // ---- Head Type ----
        headSel.innerHTML = '<option value="">(optional)</option>';
        for (const t of optsForHead.headTypes) {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            headSel.appendChild(opt);
        }
        headSel.disabled = false;

        if (prevHead && headSel.querySelector('option[value="' + prevHead + '"]')) {
            headSel.value = prevHead;
        } else if (!filters.headType) {
            headSel.value = "";
        }

        // ---- Mating Ring Design ----
        designSel.innerHTML = '<option value="">(optional)</option>';
        for (const d of optsForDesign.matingDesigns) {
            const opt = document.createElement("option");
            opt.value = d;
            opt.textContent = d;
            designSel.appendChild(opt);
        }
        designSel.disabled = false;

        if (prevDesign && designSel.querySelector('option[value="' + prevDesign + '"]')) {
            designSel.value = prevDesign;
        } else if (!filters.matingDesign) {
            designSel.value = "";
        }

        // Remember last dim filters for detail view (so details know
        // which dimensional row is relevant to the current search).
        window.SealApp.lastDimFilters = Object.assign({}, filters);
        window.SealApp.lastDimUnit = unit;
    }

    function cascadeFilters() {
        const unit = document.querySelector('input[name="unit"]:checked')?.value || "inch";
        const currentFilters = Object.assign({}, getCurrentDimFilters(), getCurrentAdvancedFilters());
        rebuildDimensionalOptions(unit, currentFilters);
        rebuildAdvancedOptions(unit, Object.assign({ unit }, currentFilters));
    }

    function initUnitListener() {
        const radios = document.querySelectorAll('input[name="unit"]');
        radios.forEach(r => {
            r.addEventListener("change", () => {
                const unit = r.value;
                const advanced = getCurrentAdvancedFilters();
                const filters = Object.assign({
                    shaft: "",
                    matingOd: "",
                    headType: "",
                    matingDesign: ""
                }, advanced);

                document.getElementById("shaft-size-select").value = "";
                document.getElementById("mating-od-select").value = "";
                document.getElementById("head-type-select").value = "";
                document.getElementById("mating-design-select").value = "";

                rebuildDimensionalOptions(unit, filters);
                rebuildAdvancedOptions(unit, filters);
            });
        });
    }

    function initDimFilterListeners() {
        const shaftSel = document.getElementById("shaft-size-select");
        const matingSel = document.getElementById("mating-od-select");
        const headSel = document.getElementById("head-type-select");
        const designSel = document.getElementById("mating-design-select");

        [shaftSel, matingSel, headSel, designSel].forEach(sel => {
            sel.addEventListener("change", cascadeFilters);
        });
    }

    function initAdvancedFilterListeners() {
        const secSel = document.getElementById("secondary-material-select");
        const faceSel = document.getElementById("face-material-select");
        const metalSel = document.getElementById("metal-material-select");
        const tempSel = document.getElementById("temp-rating-select");
        const fluidSecSel = document.getElementById("fluid-secondary-select");
        const fluidFaceSel = document.getElementById("fluid-faces-select");
        const fluidMetalSel = document.getElementById("fluid-metals-select");

        [secSel, faceSel, metalSel, tempSel, fluidSecSel, fluidFaceSel, fluidMetalSel]
            .forEach(sel => {
                if (sel) sel.addEventListener("change", cascadeFilters);
            });
    }


    function initDesignChart() {
        const btn = document.getElementById("design-chart-button");
        const modal = document.getElementById("design-chart-modal");
        const overlay = document.getElementById("design-chart-overlay");
        const closeBtn = document.getElementById("design-chart-close");
        if (!btn || !modal) return;

        function openModal() {
            renderDesignChart();
            modal.classList.add("open");
            modal.setAttribute("aria-hidden", "false");
        }

        function closeModal() {
            modal.classList.remove("open");
            modal.setAttribute("aria-hidden", "true");
        }

        btn.addEventListener("click", openModal);
        if (overlay) overlay.addEventListener("click", closeModal);
        if (closeBtn) closeBtn.addEventListener("click", closeModal);

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal.classList.contains("open")) {
                closeModal();
            }
        });
    }

    /**
     * Reset button: clears all filters (dimensional + advanced)
     * but keeps the current unit selection.
     */
    function initResetButton() {
        const btn = document.getElementById("dim-reset-btn");
        if (!btn) return;

        btn.addEventListener("click", () => {
            const unit = document.querySelector('input[name="unit"]:checked')?.value || "inch";

            // Clear dimensional selects
            document.getElementById("shaft-size-select").value = "";
            document.getElementById("mating-od-select").value = "";
            document.getElementById("head-type-select").value = "";
            document.getElementById("mating-design-select").value = "";

            // Clear advanced material / temperature / fluid filters if present
            const secSel = document.getElementById("secondary-material-select");
            const faceSel = document.getElementById("face-material-select");
            const metalSel = document.getElementById("metal-material-select");
            const fluidSel = document.getElementById("fluid-select");
            const minTemp = document.getElementById("min-temp-input");
            const maxTemp = document.getElementById("max-temp-input");
            const chemInput = document.getElementById("chemical-search-input");

            if (secSel) secSel.value = "";
            if (faceSel) faceSel.value = "";
            if (metalSel) metalSel.value = "";
            if (fluidSel) fluidSel.value = "";
            if (minTemp) minTemp.value = "";
            if (maxTemp) maxTemp.value = "";
            if (chemInput) chemInput.value = "";

            // Clear any remembered filters
            const emptyFilters = {
                shaft: "",
                matingOd: "",
                headType: "",
                matingDesign: "",
                secondaryMaterial: "",
                faceMaterial: "",
                metalMaterial: "",
                minTempF: "",
                fluidIndex: null
            };
            rebuildDimensionalOptions(unit, emptyFilters);
            rebuildAdvancedOptions(unit, emptyFilters);

            window.SealApp.lastDimFilters = Object.assign({}, emptyFilters);
            window.SealApp.lastDimUnit = unit;

            // Optionally clear results panel(s)
            const list = document.getElementById("dim-results-list");
            const details = document.getElementById("dim-detail-panel");
            if (list) list.innerHTML = "";
            if (details) details.innerHTML = "<p class=\"muted\">No seal selected.</p>";
        });
    }

    function init() {
        const initialUnit = document.querySelector('input[name="unit"]:checked')?.value || "inch";
        const baseFilters = buildEmptyFilters(initialUnit);
        rebuildDimensionalOptions(initialUnit, baseFilters);
        rebuildAdvancedOptions(initialUnit, baseFilters);
        initUnitListener();
        initDimFilterListeners();
        initAdvancedFilterListeners();
        initDesignChart();
        initResetButton();
    }

    document.addEventListener("DOMContentLoaded", init);

    window.SealApp.uiFilters = {
        rebuildDimensionalOptions,
        rebuildAdvancedOptions
    };
})();
