window.SealApp = window.SealApp || {};

(function() {
    const search = window.SealApp.search;
    const config = window.SealApp.config;
    const materialsData = window.SealApp.materialsData;
    const designAssets = window.SealApp.designAssets || {};
    const sealsByPart = window.SealApp.sealsByPart;
    const PLACEHOLDER = "\u2014";
    const DEG_F = "\u00B0F";
    const SOURCE_SEPARATOR = " \u00B7 ";
    const FAMILY_LABELS = {
        standard_seal: "Standard Seal",
        hd_head: "HD Head",
        seal_head: "Seal Head Assembly",
        mating_ring: "Mating Ring",
        other: "Other"
    };
    const FAMILY_BADGE_CLASS = {
        standard_seal: "badge-standard",
        hd_head: "badge-hd",
        seal_head: "badge-seal-head",
        mating_ring: "badge-mating",
        other: "badge-other"
    };
    function buildDesignImageMap(list) {
        const map = new Map();
        (list || []).forEach(item => {
            if (!item || !item.code || !item.image) return;
            map.set(String(item.code).toUpperCase(), item.image);
        });
        return map;
    }
    const HEAD_IMAGE_MAP = buildDesignImageMap(designAssets.headTypes || []);
    const MATING_IMAGE_MAP = buildDesignImageMap(designAssets.matingDesigns || []);

    let currentDetailSeal = null;
    let compareSelection = [];

    function cleanLines(list) {
        const result = [];
        let buffer = "";

        function flushBuffer() {
            if (!buffer) return;
            const text = buffer.trim();
            buffer = "";
            if (!text || text.toLowerCase() === "nan") return;
            result.push(text);
        }

        (list || []).forEach(item => {
            if (item == null) {
                flushBuffer();
                return;
            }
            const raw = String(item);
            const trimmed = raw.trim();
            if (!trimmed) {
                if (raw && /\s/.test(raw)) buffer += " ";
                return;
            }
            if (
                trimmed.length === 1 &&
                raw.length === 1 &&
                /[A-Za-z0-9]/.test(trimmed)
            ) {
                buffer += trimmed;
                return;
            }
            flushBuffer();
            if (trimmed.toLowerCase() === "nan") return;
            result.push(trimmed);
        });

        flushBuffer();
        return result;
    }

    function normalizeFamilyValue(family) {
        return family || "other";
    }

    function getFamilyLabel(family) {
        const key = normalizeFamilyValue(family);
        return FAMILY_LABELS[key] || FAMILY_LABELS.other;
    }

    function getFamilyBadgeClass(family) {
        const key = normalizeFamilyValue(family);
        return FAMILY_BADGE_CLASS[key] || FAMILY_BADGE_CLASS.other;
    }

    function createFamilyBadge(family) {
        const span = document.createElement("span");
        span.className = "family-badge " + getFamilyBadgeClass(family);
        span.textContent = getFamilyLabel(family);
        return span;
    }

    function createDesignImageTooltip(code, label, typeLabel, map) {
        if (!code || !map || !map.size) return null;
        const imgSrc = map.get(String(code).toUpperCase());
        if (!imgSrc) return null;
        const wrapper = document.createElement("span");
        wrapper.className = "design-image-tooltip";
        wrapper.setAttribute("aria-label", "View " + (typeLabel || "design") + " image");
        wrapper.tabIndex = 0;

        const icon = document.createElement("span");
        icon.className = "design-image-tooltip__icon";
        icon.textContent = "i";
        wrapper.appendChild(icon);

        const preview = document.createElement("span");
        preview.className = "design-image-tooltip__preview";
        const image = document.createElement("img");
        image.src = imgSrc;
        image.alt = (label || typeLabel || "") + (code ? " (" + code + ")" : "");
        image.className = "design-image-tooltip__img";
        preview.appendChild(image);
        const caption = document.createElement("span");
        caption.className = "design-image-tooltip__caption";
        caption.textContent = (label || typeLabel || "Design") + (code ? " (" + code + ")" : "");
        preview.appendChild(caption);
        wrapper.appendChild(preview);
        return wrapper;
    }

    function getFamilyCheckboxes(context) {
        return Array.from(document.querySelectorAll(
            '.family-checkbox[data-context="' + context + '"]'
        ));
    }

    function getSelectedFamilies(context) {
        const boxes = getFamilyCheckboxes(context);
        if (!boxes.length) return null;
        const selected = boxes
            .filter(box => box.checked)
            .map(box => box.dataset.family || "other");
        if (selected.length === boxes.length) return null;
        return selected;
    }

    function isFamilyAllowedForContext(context, family) {
        const allowed = getSelectedFamilies(context);
        if (allowed === null) return true;
        if (!allowed.length) return false;
        return allowed.includes(normalizeFamilyValue(family));
    }

    function handleFamilyFilterChange(context) {
        if (context === "pn") {
            const panel = document.getElementById("pn-detail-panel");
            const placeholder = document.getElementById("pn-detail-placeholder");
            if (currentDetailSeal && !isFamilyAllowedForContext("pn", currentDetailSeal.family)) {
                if (panel) panel.classList.add("hidden");
                if (placeholder) placeholder.classList.remove("hidden");
                currentDetailSeal = null;
            }
        } else if (context === "dim") {
            const panel = document.getElementById("detail-panel");
            const placeholder = document.getElementById("detail-placeholder");
            if (currentDetailSeal && !isFamilyAllowedForContext("dim", currentDetailSeal.family)) {
                if (panel) panel.classList.add("hidden");
                if (placeholder) placeholder.classList.remove("hidden");
                currentDetailSeal = null;
            }
        } else if (context === "mfg") {
            const controller = window.SealApp && window.SealApp.mfgSearch;
            if (controller && typeof controller.rerun === "function") {
                controller.rerun();
            }
        }
    }

    window.SealApp.familyFilters = {
        getSelectedFamilies,
        isFamilyAllowed: isFamilyAllowedForContext,
        handleFamilyChange: handleFamilyFilterChange
    };

    function updateDetailHeaderBadge(titleElement, family) {
        if (!titleElement) return;
        const wrapper = titleElement.parentElement;
        if (!wrapper || !wrapper.classList.contains("detail-title-group")) return;
        const existing = wrapper.querySelector(".family-badge");
        if (existing) existing.remove();
        const badge = createFamilyBadge(family);
        if (badge) wrapper.appendChild(badge);
    }
    
    function getFluidCompatibilityForMaterial(categoryKey, materialName) {
        if (!materialsData || !materialsData.compatibleFluidsByMaterial) return null;
        if (!materialName) return null;
        const compat = materialsData.compatibleFluidsByMaterial[categoryKey];
        if (!compat) return null;
        const normalized = materialName.toUpperCase();
        const list = compat[normalized];
        return list && list.length ? list : null;
    }

    // NEW: choose which dimensional row to use for detail view,
    // trying to respect the last dimensional filters + unit.
    function pickRepresentativeDimRow(seal) {
        if (!seal.dimensional || !seal.dimensional.length) return null;

        const filters = window.SealApp.lastDimFilters || {};
        const unit = window.SealApp.lastDimUnit || "inch";
        const shaftTarget = filters.shaft ? parseFloat(filters.shaft) : null;
        const headTarget = (filters.headType || "").toUpperCase();
        const designTarget = (filters.matingDesign || "").toUpperCase();

        function approxEqualLocal(a, b, tol) {
            if (a == null || b == null) return false;
            return Math.abs(a - b) <= (window.SealApp.config?.toleranceDim || 0.001);
        }

        // Try to match current filters first
        for (const dim of seal.dimensional) {
            let shaft = unit === "inch" ? dim.shaft_in : dim.shaft_mm;
            if (shaftTarget != null && !approxEqualLocal(shaft, shaftTarget)) continue;

            if (headTarget) {
                const ht = (dim.head_type || "").toUpperCase();
                if (ht !== headTarget) continue;
            }

            if (designTarget) {
                const md = (dim.mating_design || "").toUpperCase();
                if (md !== designTarget) continue;
            }

            return dim;
        }

        // Fallback: just first entry
        return seal.dimensional[0];
    }

    function formatDimNumber(value, unit) {
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

    // NEW: format a specific dimensional field (in/mm) from a dimensional row
    function formatDimValue(dim, fieldIn, fieldMm, unit) {
        if (!dim) return null;
        const vIn = dim[fieldIn];
        const vMm = dim[fieldMm];

        if (unit === "inch" && vIn != null) {
            const formatted = formatDimNumber(vIn, "inch");
            return formatted ? formatted + " in" : null;
        }
        if (unit === "mm" && vMm != null) {
            const formatted = formatDimNumber(vMm, "mm");
            return formatted ? formatted + " mm" : null;
        }
        // fallback: whichever we have
        if (vIn != null) {
            const formatted = formatDimNumber(vIn, "inch");
            return formatted ? formatted + " in" : null;
        }
        if (vMm != null) {
            const formatted = formatDimNumber(vMm, "mm");
            return formatted ? formatted + " mm" : null;
        }
        return null;
    }

    // Renamed: scalar formatter used for list chips, etc.
    function formatScalarDim(value, unit) {
        return formatDimNumber(value, unit);
    }

    function buildResultItem(seal, unit) {
        const li = document.createElement("li");
        li.className = "result-item";
        li.dataset.partNumber = seal.part_number;
        const faData = seal.fa_data || {};
        const isFaSeal = !!faData.is_fa;

        const dim = (seal.dimensional || [])[0] || {};
        const shaft = unit === "inch" ? dim.shaft_in : dim.shaft_mm;
        let shaftLabel = "n/a";
        if (shaft != null) {
            const formatted = formatScalarDim(shaft, unit);
            if (formatted) {
                shaftLabel = formatted + (unit === "inch" ? " in" : " mm");
            }
        }
        if (isFaSeal && Array.isArray(faData.shaft_sizes) && faData.shaft_sizes.length) {
            shaftLabel = faData.shaft_sizes.join(", ");
        }

        let types = (seal.types || []).join(", ") || PLACEHOLDER;
        if (isFaSeal && Array.isArray(faData.head_types) && faData.head_types.length) {
            types = faData.head_types.join(", ");
        }
        const maxTemp = seal.max_temp_f != null ? seal.max_temp_f + DEG_F : PLACEHOLDER;

        const titleRow = document.createElement("div");
        titleRow.className = "result-title-row";

        const title = document.createElement("div");
        title.className = "result-title";
        title.textContent = seal.part_number;

        const titleGroup = document.createElement("div");
        titleGroup.className = "result-title-group";
        titleGroup.appendChild(title);
        const familyBadge = createFamilyBadge(seal.family);
        if (familyBadge) titleGroup.appendChild(familyBadge);

        const chips = document.createElement("div");
        chips.className = "result-meta";
        const chipSize = document.createElement("span");
        chipSize.className = "result-chip";
        chipSize.textContent = "Shaft " + shaftLabel;
        chips.appendChild(chipSize);

        const chipType = document.createElement("span");
        chipType.className = "result-chip";
        chipType.textContent = "Type " + types;
        chips.appendChild(chipType);

        const chipTemp = document.createElement("span");
        chipTemp.className = "result-chip";
        chipTemp.textContent = "Max temp " + maxTemp;
        chips.appendChild(chipTemp);

        titleRow.appendChild(titleGroup);
        titleRow.appendChild(chips);

        const foot = document.createElement("div");
        foot.className = "result-foot";
        const left = document.createElement("span");
        left.textContent = (seal.source_files || []).join(SOURCE_SEPARATOR) || "";
        const right = document.createElement("span");
        const rh = seal.right_hand === true ? "RH" : "";
        const lh = seal.left_hand === true ? "LH" : "";
        right.textContent = [rh, lh].filter(Boolean).join(" ");
        foot.appendChild(left);
        foot.appendChild(right);

        li.appendChild(titleRow);
        li.appendChild(foot);

        li.addEventListener("click", () => {
            showSealDetails(seal, "detail");
        });

        return li;
    }

    function renderResultsList(listElement, countElement, results, unit) {
        listElement.innerHTML = "";
        countElement.textContent = results.length + " result" + (results.length === 1 ? "" : "s");

        if (!results.length) return;

        for (const seal of results) {
            listElement.appendChild(buildResultItem(seal, unit));
        }
    }

    function createDetailGridRow(label, value) {
        const row = document.createElement("div");
        row.className = "detail-grid-row";
        const lab = document.createElement("div");
        lab.className = "detail-label";
        lab.textContent = label;
        const val = document.createElement("div");
        val.className = "detail-value";
        val.textContent = value || PLACEHOLDER;
        row.appendChild(lab);
        row.appendChild(val);
        return row;
    }

    function renderSealDetailsBody(container, seal) {
        container.innerHTML = "";
        const unit = document.querySelector('input[name="unit"]:checked')?.value || "inch";
        const faData = seal.fa_data || {};
        const isFaSeal = !!faData.is_fa;

        const dimGroup = document.createElement("div");
        dimGroup.className = "detail-group";
        const dimTitle = document.createElement("h4");
        dimTitle.textContent = "Dimensions";
        dimGroup.appendChild(dimTitle);

        const dimGrid = document.createElement("div");
        dimGrid.className = "detail-grid";

        // Use representative dimensional row based on last filters
        const dim = pickRepresentativeDimRow(seal);

        let shaftLabel = formatDimValue(dim, "shaft_in", "shaft_mm", unit) || PLACEHOLDER;
        const headOdLabel = formatDimValue(dim, "head_od_in", "head_od_mm", unit) || PLACEHOLDER;
        const boreLabel = formatDimValue(dim, "mating_bore_in", "mating_bore_mm", unit) || PLACEHOLDER;
        if (isFaSeal && Array.isArray(faData.shaft_sizes) && faData.shaft_sizes.length) {
            shaftLabel = faData.shaft_sizes.join(", ");
        }

        // Operating height (from mixed / metric data youve mapped into head_oper_*)
        let operLabel =
            formatDimValue(dim, "head_oper_in", "head_oper_mm", unit) ||
            formatDimValue(dim, "oper_hgt_in", "oper_hgt_mm", unit) || // if you later add these
            null;
        if (isFaSeal && Array.isArray(faData.oper_heights) && faData.oper_heights.length) {
            operLabel = faData.oper_heights.join(", ");
        }

        // Mating ring thickness (from mixed / metric data youve mapped into mating_thick_*)
        const thickLabel =
            formatDimValue(dim, "mating_thick_in", "mating_thick_mm", unit) ||
            null;

        dimGrid.appendChild(
            createDetailGridRow("Shaft / Seal Size", shaftLabel)
        );
        dimGrid.appendChild(
            createDetailGridRow("Head OD", headOdLabel)
        );
        dimGrid.appendChild(
            createDetailGridRow("Mating Ring Bore", boreLabel)
        );
        if (operLabel) {
            dimGrid.appendChild(
                createDetailGridRow("Operating Height", operLabel)
            );
        }
        if (thickLabel) {
            dimGrid.appendChild(
                createDetailGridRow("Mating Ring Thickness", thickLabel)
            );
        }

        let headTypeCode = dim && dim.head_type ? String(dim.head_type).toUpperCase() : "";
        let headTypeLabel =
            (dim && dim.head_type) ||
            (seal.types || []).join(", ") ||
            PLACEHOLDER;
        if (isFaSeal && Array.isArray(faData.head_types) && faData.head_types.length) {
            headTypeLabel = faData.head_types.join(", ");
            if (!headTypeCode) {
                headTypeCode = String(faData.head_types[0] || "").toUpperCase();
            }
        }
        const headRow = createDetailGridRow("Head Type", headTypeLabel);
        if (headRow) {
            const valueEl = headRow.querySelector(".detail-value");
            if (valueEl) {
                valueEl.textContent = headTypeLabel || PLACEHOLDER;
                const tooltip = createDesignImageTooltip(headTypeCode, headTypeLabel, "Head Type", HEAD_IMAGE_MAP);
                if (tooltip) valueEl.appendChild(tooltip);
            }
            dimGrid.appendChild(headRow);
        }

        let matingDesignCode = dim && dim.mating_design ? String(dim.mating_design).toUpperCase() : "";
        const designLabel = dim && dim.mating_design ? dim.mating_design : PLACEHOLDER;
        const designRow = createDetailGridRow("Mating Ring Design", designLabel);
        if (designRow) {
            const valueEl = designRow.querySelector(".detail-value");
            if (valueEl) {
                valueEl.textContent = designLabel || PLACEHOLDER;
                const tooltip = createDesignImageTooltip(matingDesignCode, designLabel, "Mating Ring Design", MATING_IMAGE_MAP);
                if (tooltip) valueEl.appendChild(tooltip);
            }
            dimGrid.appendChild(designRow);
        }

        const handLabel =
            (seal.right_hand === true ? "Right hand " : "") +
            (seal.left_hand === true ? "Left hand" : "");
        dimGrid.appendChild(
            createDetailGridRow("Hand", handLabel || PLACEHOLDER)
        );

        dimGroup.appendChild(dimGrid);

        const matGroup = document.createElement("div");
        matGroup.className = "detail-group";
        const matTitle = document.createElement("h4");
        matTitle.textContent = "Materials";
        matGroup.appendChild(matTitle);
        const matList = document.createElement("ul");
        matList.className = "detail-list";

        const mats = seal.materials || {};

        const matItems = [
            ["secondary", "Secondary Seals", mats.secondary || []],
            ["faces", "Seal Faces", mats.faces || []],
            ["metals", "Metal Parts", mats.metals || []],
            ["mating_rings", "Mating Rings", mats.mating_rings || []],
            ["springs", "Springs", mats.springs || []],
        ];

        for (const [key, label, values] of matItems) {
            const li = document.createElement("li");

            const labelSpan = document.createElement("span");
            labelSpan.textContent = label + ": ";
            li.appendChild(labelSpan);

            if (!values.length) {
                const placeholderSpan = document.createElement("span");
                placeholderSpan.textContent = PLACEHOLDER;
                li.appendChild(placeholderSpan);
            } else {
                values.forEach((matName, idx) => {
                    if (idx > 0) {
                        li.appendChild(document.createTextNode(", "));
                    }
                    const matSpan = document.createElement("span");
                    matSpan.textContent = matName;
                    li.appendChild(matSpan);

                    // Only show icons where we actually have compatibility data
                    const compatFluids = getFluidCompatibilityForMaterial(key, matName);
                    if (compatFluids && compatFluids.length) {
                        const icon = document.createElement("span");
                        icon.className = "material-chem-icon";
                        const tooltip = document.createElement("span");
                        tooltip.className = "chem-tooltip";
                        const title = document.createElement("strong");
                        title.textContent = "Compatible fluids";
                        tooltip.appendChild(title);
                        const list = document.createElement("ul");
                        const maxDisplay = 8;
                        compatFluids.slice(0, maxDisplay).forEach(fluid => {
                            const liFluid = document.createElement("li");
                            liFluid.textContent = fluid;
                            list.appendChild(liFluid);
                        });
                        if (compatFluids.length > maxDisplay) {
                            const more = document.createElement("li");
                            more.textContent = `+${compatFluids.length - maxDisplay} more`;
                            list.appendChild(more);
                        }
                        tooltip.appendChild(list);
                        icon.appendChild(tooltip);
                        li.appendChild(icon);
                    }
                });
            }

            matList.appendChild(li);
        }


        const code = (seal.materials_codes || []).join(", ");
        if (code) {
            const li = document.createElement("li");
            li.textContent = "Material Code(s): " + code;
            matList.appendChild(li);
        }

        const maxT = seal.max_temp_f != null ? seal.max_temp_f + DEG_F : PLACEHOLDER;
        const liTemp = document.createElement("li");
        liTemp.textContent = "Approx. Max Secondary Seal Temp: " + maxT;
        matList.appendChild(liTemp);

        matGroup.appendChild(matList);

        const featureGroup = document.createElement("div");
        featureGroup.className = "detail-group";
        const featTitle = document.createElement("h4");
        featTitle.textContent = "Features / Notes";
        featureGroup.appendChild(featTitle);

        const featList = document.createElement("ul");
        featList.className = "detail-list";
        const featureLines = cleanLines(seal.features || []);
        const noteLines = cleanLines(seal.notes || []);
        for (const line of featureLines) {
            const li = document.createElement("li");
            li.textContent = line;
            featList.appendChild(li);
        }
        for (const line of noteLines) {
            const li = document.createElement("li");
            li.textContent = line;
            featList.appendChild(li);
        }
        if (!featList.children.length) {
            const li = document.createElement("li");
            li.textContent = "No additional notes recorded.";
            featList.appendChild(li);
        }
        featureGroup.appendChild(featList);

        const typeGroup = document.createElement("div");
        typeGroup.className = "detail-group";
        const typeTitle = document.createElement("h4");
        typeTitle.textContent = "Seal Type Info";
        typeGroup.appendChild(typeTitle);

        const typeBox = document.createElement("div");
        typeBox.style.fontSize = "0.78rem";
        const typeInfo = seal.seal_type_info;
        const hasStructuredTypeInfo =
            typeInfo &&
            (
                (Array.isArray(typeInfo.head_types) && typeInfo.head_types.length) ||
                (Array.isArray(typeInfo.mating_designs) && typeInfo.mating_designs.length)
            );
        if (hasStructuredTypeInfo) {
            if (Array.isArray(typeInfo.head_types) && typeInfo.head_types.length) {
                const headHeader = document.createElement("p");
                headHeader.style.margin = "0 0 4px";
                headHeader.innerHTML = "<strong>Seal Head Types</strong>";
                typeBox.appendChild(headHeader);
                typeInfo.head_types.forEach(entry => {
                    const block = document.createElement("div");
                    block.style.margin = "0 0 8px";
                    const displayLabel = entry.label || entry.title || ("Head Type " + (entry.code || ""));
                    const titleLine = document.createElement("p");
                    titleLine.style.margin = "0 0 2px";
                    const codeText = entry.code ? " (" + entry.code + ")" : "";
                    titleLine.innerHTML = "<strong>" + displayLabel + codeText + "</strong>";
                    block.appendChild(titleLine);
                    if (entry.equivalent) {
                        const eq = document.createElement("p");
                        eq.style.margin = "0 0 2px";
                        eq.textContent = entry.equivalent;
                        block.appendChild(eq);
                    }
                    ["title", "range", "features", "services"].forEach(key => {
                        const val = entry[key];
                        if (!val) return;
                        if (key === "title" && val === displayLabel) return;
                        const line = document.createElement("p");
                        line.style.margin = "0 0 2px";
                        if (key === "title") {
                            line.textContent = val;
                        } else if (key === "range") {
                            line.textContent = "Range: " + val;
                        } else if (key === "features") {
                            line.textContent = val;
                        } else if (key === "services") {
                            line.innerHTML = "<em>" + val + "</em>";
                        }
                        block.appendChild(line);
                    });
                    typeBox.appendChild(block);
                });
            }
            if (Array.isArray(typeInfo.mating_designs) && typeInfo.mating_designs.length) {
                const matHeader = document.createElement("p");
                matHeader.style.margin = "8px 0 4px";
                matHeader.innerHTML = "<strong>Mating Ring Designs</strong>";
                typeBox.appendChild(matHeader);
                typeInfo.mating_designs.forEach(entry => {
                    const block = document.createElement("div");
                    block.style.margin = "0 0 6px";
                    const titleLine = document.createElement("p");
                    titleLine.style.margin = "0 0 2px";
                    const label = entry.label || ("Design " + (entry.code || ""));
                    const codeText = entry.code ? " (" + entry.code + ")" : "";
                    titleLine.innerHTML = "<strong>" + label + codeText + "</strong>";
                    block.appendChild(titleLine);
                    if (entry.description) {
                        const descLine = document.createElement("p");
                        descLine.style.margin = "0 0 2px";
                        descLine.textContent = entry.description;
                        block.appendChild(descLine);
                    }
                    typeBox.appendChild(block);
                });
            }
        } else {
            const types = seal.types || [];
            if (types.length) {
                for (const t of types) {
                    const desc = search.getTypeDescriptor(t);
                    const p = document.createElement("p");
                    p.style.margin = "0 0 4px";
                    if (desc) {
                        p.innerHTML =
                            "<strong>" +
                            desc.title +
                            "</strong> \u2014 " +
                            desc.features +
                            "<br><em>" +
                            desc.services +
                            "</em>";
                    } else {
                        p.textContent = "Type " + t;
                    }
                    typeBox.appendChild(p);
                }
            } else {
                typeBox.textContent = "No explicit type code recorded.";
            }
        }

        const notesSmall = document.createElement("p");
        notesSmall.className = "tiny-help";
        notesSmall.textContent =
            materialsData.headTypeNotes +
            " " +
            materialsData.matingRingDesignsHelp;
        typeBox.appendChild(notesSmall);

        typeGroup.appendChild(typeBox);

        let faGroup = null;

        function formatFaValues(values) {
            return (values && values.length) ? values.join(", ") : PLACEHOLDER;
        }

        function formatFaText(values) {
            return (values && values.length) ? values.join("; ") : PLACEHOLDER;
        }

        if (isFaSeal) {
            faGroup = document.createElement("div");
            faGroup.className = "detail-group";
            const faTitle = document.createElement("h4");
            faTitle.textContent = "FA Seal Head Assembly";
            faGroup.appendChild(faTitle);

            const faList = document.createElement("ul");
            faList.className = "detail-list";

            const simpleItems = [
                ["Head Type", faData.head_types],
                ["Shaft / Seal Size", faData.shaft_sizes],
                ["Material Code", faData.material_codes],
                ["Operating Height", faData.oper_heights],
            ];
            simpleItems.forEach(([label, values]) => {
                const li = document.createElement("li");
                li.innerHTML = "<strong>" + label + ":</strong> " + formatFaValues(values);
                faList.appendChild(li);
            });

            const textItems = [
                ["Notes", faData.notes],
                ["Nameplate Data", faData.nameplates],
                ["Manufacturer Part Numbers", faData.mfg_parts],
            ];
            textItems.forEach(([label, values]) => {
                const li = document.createElement("li");
                li.innerHTML = "<strong>" + label + ":</strong> " + formatFaText(values);
                faList.appendChild(li);
            });

            faGroup.appendChild(faList);
        }

        container.appendChild(dimGroup);
        if (faGroup) container.appendChild(faGroup);
        container.appendChild(matGroup);
        container.appendChild(featureGroup);
        container.appendChild(typeGroup);
    }

    function showSealDetails(seal, context) {
        currentDetailSeal = seal;
        const part = seal.part_number;

        if (context === "detail") {
            const placeholder = document.getElementById("detail-placeholder");
            const panel = document.getElementById("detail-panel");
            const title = document.getElementById("detail-part-number");
            const body = document.getElementById("detail-body");

            placeholder.classList.add("hidden");
            panel.classList.remove("hidden");
            title.textContent = part;
            updateDetailHeaderBadge(title, seal.family);
            renderSealDetailsBody(body, seal);
        } else if (context === "pn") {
            const placeholder = document.getElementById("pn-detail-placeholder");
            const panel = document.getElementById("pn-detail-panel");
            const title = document.getElementById("pn-detail-part-number");
            const body = document.getElementById("pn-detail-body");

            placeholder.classList.add("hidden");
            panel.classList.remove("hidden");
            title.textContent = part;
            updateDetailHeaderBadge(title, seal.family);
            renderSealDetailsBody(body, seal);
        }
    }

    function updateComparePanel() {
        const panel = document.getElementById("compare-panel");
        const body = document.getElementById("compare-body");
        body.innerHTML = "";

        if (!compareSelection.length) {
            panel.classList.add("hidden");
            return;
        }
        panel.classList.remove("hidden");

        for (const pn of compareSelection) {
            const seal = sealsByPart.get(pn);
            if (!seal) continue;
            const card = document.createElement("div");
            card.className = "compare-card";

            const head = document.createElement("div");
            head.className = "compare-header";

            const title = document.createElement("h3");
            title.textContent = pn;
            const titleGroup = document.createElement("div");
            titleGroup.className = "result-title-group";
            titleGroup.appendChild(title);
            const badge = createFamilyBadge(seal.family);
            if (badge) titleGroup.appendChild(badge);

            const removeBtn = document.createElement("button");
            removeBtn.className = "btn-small";
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                removeFromCompare(pn);
            });

            head.appendChild(titleGroup);
            head.appendChild(removeBtn);
            card.appendChild(head);

            const inner = document.createElement("div");
            inner.className = "detail-body";
            renderSealDetailsBody(inner, seal);
            card.appendChild(inner);

            body.appendChild(card);
        }
    }

    function addToCompare(seal) {
        const pn = seal.part_number;
        if (!pn) return;
        compareSelection = compareSelection.filter(x => x !== pn);
        compareSelection.push(pn);
        if (compareSelection.length > config.maxCompare) {
            compareSelection.shift();
        }
        updateComparePanel();
    }

    function removeFromCompare(pn) {
        compareSelection = compareSelection.filter(x => x !== pn);
        updateComparePanel();
    }

    function clearCompare() {
        compareSelection = [];
        updateComparePanel();
    }

    function printCurrentDetail(context) {
        const panelId = context === "pn" ? "pn-detail-panel" : "detail-panel";
        const panel = document.getElementById(panelId);
        if (!panel || panel.classList.contains("hidden")) {
            alert("Select a seal to print first.");
            return;
        }

        const clone = panel.cloneNode(true);
        clone.classList.remove("hidden");

        const win = window.open("", "_blank", "width=900,height=900");
        if (!win) return;

        const styles = `
            body {
                font-family: "Segoe UI", system-ui, sans-serif;
                margin: 0;
                padding: 24px;
                background: #f3f4f6;
                color: #0f172a;
            }
            .detail-panel {
                border-radius: 18px;
                border: 1px solid #e2e8f0;
                background: #ffffff;
                padding: 20px;
                max-width: 100%;
            }
            .detail-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .detail-header h3 {
                margin: 0;
                font-size: 1.35rem;
            }
            .detail-header-actions {
                display: none;
            }
            .detail-group {
                margin-top: 16px;
            }
            .detail-group h4 {
                margin: 0 0 6px 0;
                font-size: 1rem;
                color: #0f172a;
            }
            .detail-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 8px;
            }
            .detail-grid-row {
                background: #f8fafc;
                border-radius: 10px;
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .detail-grid-label {
                font-size: 0.72rem;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            .detail-grid-value {
                font-size: 0.92rem;
                font-weight: 600;
            }
            .detail-list {
                margin: 0;
                padding-left: 18px;
            }
            .detail-list li {
                margin-bottom: 4px;
            }
            .tiny-help {
                color: #94a3b8;
                font-size: 0.75rem;
            }
            button {
                display: none !important;
            }
        `;

        win.document.write(`<!DOCTYPE html>
            <html>
            <head>
                <title>Seal Detail</title>
                <meta charset="utf-8" />
                <style>${styles}</style>
            </head>
            <body>
                ${clone.outerHTML}
            </body>
            </html>`);
        win.document.close();

        const triggerPrint = () => {
            win.focus();
            win.print();
        };

        if ("onafterprint" in win) {
            win.onafterprint = () => {
                win.close();
            };
        }

        // Give the new window a moment to finish layout before printing.
        win.setTimeout(triggerPrint, 150);
    }

    function initDimensionalResults() {
        const resultsList = document.getElementById("results-list");
        const resultsCount = document.getElementById("results-count");
        const searchBtn = document.getElementById("dim-search-button");
        const resetBtn = document.getElementById("dim-reset-button");

        searchBtn.addEventListener("click", () => {
            const unit = document.querySelector('input[name="unit"]:checked')?.value || "inch";
            const shaft = document.getElementById("shaft-size-select").value;
            if (!shaft) {
                alert("Please select a shaft size before searching.");
                return;
            }

            const filters = {
                unit,
                shaft,
                matingOd: document.getElementById("mating-od-select").value || null,
                headType: document.getElementById("head-type-select").value || "",
                matingDesign: document.getElementById("mating-design-select").value || "",
                secondaryMaterial: document.getElementById("secondary-material-select").value || "",
                faceMaterial: document.getElementById("face-material-select").value || "",
                metalMaterial: document.getElementById("metal-material-select").value || "",
                minTempF: document.getElementById("temp-rating-select").value || "",
                fluidSecondaryIndex: (function() {
                    const sel = document.getElementById("fluid-secondary-select");
                    if (!sel || sel.value === "") return null;
                    const ix = parseInt(sel.value, 10);
                    return Number.isNaN(ix) ? null : ix;
                })(),
                fluidFacesIndex: (function() {
                    const sel = document.getElementById("fluid-faces-select");
                    if (!sel || sel.value === "") return null;
                    const ix = parseInt(sel.value, 10);
                    return Number.isNaN(ix) ? null : ix;
                })(),
                fluidMetalsIndex: (function() {
                    const sel = document.getElementById("fluid-metals-select");
                    if (!sel || sel.value === "") return null;
                    const ix = parseInt(sel.value, 10);
                    return Number.isNaN(ix) ? null : ix;
                })(),
                allowedFamilies: getSelectedFamilies ? getSelectedFamilies("dim") : null

            };

            window.SealApp.lastDimFilters = {
                shaft: filters.shaft,
                matingOd: filters.matingOd,
                headType: filters.headType,
                matingDesign: filters.matingDesign
            };
            window.SealApp.lastDimUnit = unit;

            const results = search.filterSeals(filters);
            renderResultsList(resultsList, resultsCount, results, unit);
        });

        resetBtn.addEventListener("click", () => {
            document.querySelector('input[name="unit"][value="inch"]').checked = true;
            document.getElementById("shaft-size-select").selectedIndex = 0;
            document.getElementById("shaft-size-select").disabled = true;
            document.getElementById("mating-od-select").innerHTML = '<option value="">(optional)</option>';
            document.getElementById("mating-od-select").disabled = true;
            document.getElementById("head-type-select").innerHTML = '<option value="">(optional)</option>';
            document.getElementById("head-type-select").disabled = true;
            document.getElementById("mating-design-select").innerHTML = '<option value="">(optional)</option>';
            document.getElementById("mating-design-select").disabled = true;
            document.getElementById("secondary-material-select").selectedIndex = 0;
            document.getElementById("face-material-select").selectedIndex = 0;
            document.getElementById("metal-material-select").selectedIndex = 0;
            document.getElementById("temp-rating-select").selectedIndex = 0;
            const fs = document.getElementById("fluid-secondary-select");
            const ff = document.getElementById("fluid-faces-select");
            const fm = document.getElementById("fluid-metals-select");
            if (fs) fs.selectedIndex = 0;
            if (ff) ff.selectedIndex = 0;
            if (fm) fm.selectedIndex = 0;
            resultsList.innerHTML = "";
            resultsCount.textContent = "0 results";
        });


        document.getElementById("detail-add-compare").addEventListener("click", () => {
            if (currentDetailSeal) addToCompare(currentDetailSeal);
        });
        document.getElementById("detail-print").addEventListener("click", () => {
            printCurrentDetail("detail");
        });
        document.getElementById("compare-clear").addEventListener("click", () => {
            clearCompare();
        });
    }

    function initPartNumberResults() {
        const searchBtn = document.getElementById("pn-search-button");
        const resetBtn = document.getElementById("pn-reset-button");
        const input = document.getElementById("pn-search-input");
        const familyTools = window.SealApp.familyFilters;
        if (!searchBtn || !resetBtn || !input) return;

        function familyAllowed(seal) {
            if (!familyTools) return true;
            return familyTools.isFamilyAllowed("pn", seal?.family);
        }

        searchBtn.addEventListener("click", () => {
            const q = (input.value || "").trim().toUpperCase();
            if (!q) return;
            const seal = search.findSealByPart(q);
            if (!seal) {
                alert("Part number not found in loaded data.");
                return;
            }
            if (!familyAllowed(seal)) {
                alert("This part belongs to a filtered family.");
                return;
            }
            showSealDetails(seal, "pn");
        });

        resetBtn.addEventListener("click", () => {
            input.value = "";
            document.getElementById("pn-suggestions").innerHTML = "";
            document.getElementById("pn-suggestions").classList.remove("visible");
            document.getElementById("pn-detail-panel").classList.add("hidden");
            document.getElementById("pn-detail-placeholder").classList.remove("hidden");
            document.querySelectorAll('.family-checkbox[data-context="pn"]').forEach(box => {
                box.checked = true;
            });
            if (familyTools) familyTools.handleFamilyChange("pn");
        });

        document.getElementById("pn-detail-add-compare").addEventListener("click", () => {
            if (currentDetailSeal) addToCompare(currentDetailSeal);
        });
        document.getElementById("pn-detail-print").addEventListener("click", () => {
            printCurrentDetail("pn");
        });
    }

    function initComparePanel() {
        updateComparePanel();
    }

    function initTabs() {
        const buttons = Array.from(document.querySelectorAll(".tab-button"));
        const panels = Array.from(document.querySelectorAll(".tab-panel"));

        buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.dataset.target;
                buttons.forEach(b => b.classList.toggle("active", b === btn));
                panels.forEach(p => p.classList.toggle("active", p.id === targetId));
            });
        });
    }

    function initMfgSearch() {
        const input = document.getElementById("mfg-search-input");
        const btn = document.getElementById("mfg-search-button");
        const resetBtn = document.getElementById("mfg-reset-button");
        const list = document.getElementById("mfg-results-list");
        const count = document.getElementById("mfg-results-count");
        const suggList = document.getElementById("mfg-suggestions");
        const detailPanel = document.getElementById("mfg-detail-panel");
        const detailPlaceholder = document.getElementById("mfg-detail-placeholder");
        const detailTitle = document.getElementById("mfg-detail-title");
        const detailBody = document.getElementById("mfg-detail-body");
        const familyTools = window.SealApp.familyFilters;

        function familyAllowsCrossRef(rec) {
            if (!familyTools) return true;
            if (!rec || !rec.seal_part) return true;
            const seal = sealsByPart.get(rec.seal_part.toUpperCase());
            if (!seal) return true;
            return familyTools.isFamilyAllowed("mfg", seal.family);
        }

        function clearMfgDetail() {
            if (!detailPanel || !detailPlaceholder || !detailBody || !detailTitle) return;
            detailPanel.classList.add("hidden");
            detailPlaceholder.classList.remove("hidden");
            detailBody.innerHTML = "";
            detailTitle.textContent = "";
        }

        function buildMfgSpecRows(rec) {
            const rows = [];
            const sourceKey = rec.source || rec.sourceKey || "";
            const addRow = (label, value) => {
                const cleaned = (value || "").toString().trim();
                if (!cleaned) return;
                rows.push({ label, value: cleaned });
            };
            addRow("Source", sourceKey.toUpperCase());
            addRow("Brand", rec.brand);
            addRow("Manufacturer Part / Model", rec.mfg_part || rec.model);
            addRow("U.S. Seal Part", rec.seal_part);

            if (sourceKey === "flygt") {
                addRow("Seal Position", (rec.position || "").toUpperCase());
                addRow("Seal Size (mm)", rec.seal_size_mm);
                addRow("Material Mix", rec.materials);
                addRow("O-Ring Kit Part", rec.o_ring_kit);
            } else if (sourceKey === "pump_mfg") {
                addRow("Seal Size", rec.seal_size);
                addRow("Head Type", rec.head_type);
                addRow("Mating Ring", rec.mating_ring);
                addRow("Mating Ring Bore", rec.mating_bore);
                addRow("Material Code", rec.material_code);
                addRow("Notes", rec.notes);
                addRow("Pump Nameplate Data", rec.pump_nameplate);
            } else if (sourceKey === "valguard") {
                addRow("Shaft Size", rec.shaft_size);
                addRow("Head Type", rec.head_type);
                addRow("Mating Ring", rec.mating_ring);
                addRow("Mating Ring Bore", rec.mating_ring_bore);
                addRow("Mating Ring OD", rec.mating_ring_od);
                addRow("Mating Ring Thickness", rec.mating_ring_thick);
                addRow("Operating Height", rec.oper_height);
                addRow("Material Code", rec.material_code);
                addRow("Features", rec.features);
                addRow("Notes", rec.notes);
                addRow("Pump Nameplate Data", rec.pump_nameplate);
            }
            return rows;
        }

        function renderMfgDetail(rec) {
            if (!detailPanel || !detailPlaceholder || !detailBody || !detailTitle) return;
            if (!rec) {
                clearMfgDetail();
                return;
            }
            detailPlaceholder.classList.add("hidden");
            detailPanel.classList.remove("hidden");
            detailTitle.textContent = rec.mfg_part || rec.model || rec.seal_part || "Cross-reference detail";
            detailBody.innerHTML = "";
            const rows = buildMfgSpecRows(rec);
            if (!rows.length) {
                const p = document.createElement("p");
                p.className = "muted";
                p.textContent = "No additional specifications were found for this entry.";
                detailBody.appendChild(p);
                return;
            }
            const grid = document.createElement("div");
            grid.className = "detail-grid";
            rows.forEach(({ label, value }) => {
                grid.appendChild(createDetailGridRow(label, value));
            });
            detailBody.appendChild(grid);
        }

        function renderMfgResults(results) {
            list.innerHTML = "";
            let visibleCount = 0;
            for (const rec of results) {
                if (!familyAllowsCrossRef(rec)) {
                    continue;
                }
                visibleCount++;
                const li = document.createElement("li");
                li.className = "result-item";
                li.dataset.partNumber = rec.seal_part || "";

                const titleRow = document.createElement("div");
                titleRow.className = "result-title-row";

                const left = document.createElement("div");
                left.className = "result-title";
                left.textContent = rec.mfg_part || rec.model || "(no mfg part)";
                const titleGroup = document.createElement("div");
                titleGroup.className = "result-title-group";
                titleGroup.appendChild(left);
                if (rec.seal_part) {
                    const matchedSeal = sealsByPart.get(rec.seal_part.toUpperCase());
                    if (matchedSeal) {
                        const badge = createFamilyBadge(matchedSeal.family);
                        if (badge) titleGroup.appendChild(badge);
                    }
                }

                const chips = document.createElement("div");
                chips.className = "result-meta";

                const chipBrand = document.createElement("span");
                chipBrand.className = "result-chip";
                chipBrand.textContent = rec.brand || "";
                chips.appendChild(chipBrand);

                const chipSource = document.createElement("span");
                chipSource.className = "result-chip";
                chipSource.textContent = (rec.source || rec.sourceKey || "").toUpperCase();
                chips.appendChild(chipSource);

                function openSealDetail() {
                    if (!rec.seal_part) {
                        alert("This cross reference entry did not include a specific U.S. Seal / Value Guard part number.");
                        return;
                    }
                    const seal = search.findSealByPart(rec.seal_part);
                    if (!seal) {
                        alert("Seal part " + rec.seal_part + " not found in loaded dimensional data.");
                        return;
                    }
                    showSealDetails(seal, "detail");
                }

                if (rec.seal_part) {
                    const chipSeal = document.createElement("span");
                    chipSeal.className = "result-chip result-chip--link";
                    chipSeal.textContent = "Seal: " + rec.seal_part;
                    chipSeal.title = "Double-click to view seal dimensions, notes, and nameplate info";
                    chipSeal.tabIndex = 0;
                    chipSeal.addEventListener("dblclick", (ev) => {
                        ev.stopPropagation();
                        openSealDetail();
                        renderMfgDetail(rec);
                    });
                    chipSeal.addEventListener("keydown", (ev) => {
                        if (ev.key === "Enter") {
                            ev.stopPropagation();
                            openSealDetail();
                        }
                    });
                    chips.appendChild(chipSeal);
                }

                titleRow.appendChild(titleGroup);
                titleRow.appendChild(chips);
                li.appendChild(titleRow);

                const foot = document.createElement("div");
                foot.className = "result-foot";
                const leftFoot = document.createElement("span");
                const rightFoot = document.createElement("span");
                if (rec.position) {
                    rightFoot.textContent = rec.position.toUpperCase() + " SEAL";
                }
                leftFoot.textContent = "";
                foot.appendChild(leftFoot);
                foot.appendChild(rightFoot);
                li.appendChild(foot);

                li.addEventListener("click", openSealDetail);
                li.addEventListener("dblclick", (ev) => {
                    ev.stopPropagation();
                    renderMfgDetail(rec);
                    openSealDetail();
                });

                list.appendChild(li);
            }
            count.textContent = visibleCount + " result" + (visibleCount === 1 ? "" : "s");
        }

        function updateMfgSuggestions() {
            const q = (input.value || "").trim().toUpperCase();
            suggList.innerHTML = "";
            suggList.classList.remove("visible");
            if (!q) return;

            const allXrefs = window.SealApp.allXrefs || [];
            const matches = [];
            for (const rec of allXrefs) {
                const key = [
                    rec.mfg_part || "",
                    rec.model || "",
                    rec.brand || ""
                ].join(" ").toUpperCase();
                if (!key.includes(q)) continue;
                matches.push(rec);
                if (matches.length >= 5) break;
            }

            if (!matches.length) return;

            for (const rec of matches) {
                const li = document.createElement("li");
                li.className = "suggestion-item";
                const labelParts = [];
                if (rec.mfg_part) labelParts.push(rec.mfg_part);
                if (rec.brand) labelParts.push(rec.brand);
                if (rec.model) labelParts.push(rec.model);
                li.textContent = labelParts.join(" \u2022 ");
                li.addEventListener("click", () => {
                    input.value = rec.mfg_part || rec.model || "";
                    suggList.innerHTML = "";
                    suggList.classList.remove("visible");
                    const results = search.searchXrefsByMfgTerm(input.value);
                    renderMfgResults(results);
                    clearMfgDetail();
                });
                suggList.appendChild(li);
            }
            suggList.classList.add("visible");
        }

        input.addEventListener("input", updateMfgSuggestions);
        input.addEventListener("blur", () => {
            setTimeout(() => {
                suggList.classList.remove("visible");
            }, 150);
        });

        btn.addEventListener("click", () => {
            const q = (input.value || "").trim();
            if (!q) return;
            const results = search.searchXrefsByMfgTerm(q);
            renderMfgResults(results);
             clearMfgDetail();
        });

        resetBtn.addEventListener("click", () => {
            input.value = "";
            list.innerHTML = "";
            count.textContent = "0 results";
            suggList.innerHTML = "";
            suggList.classList.remove("visible");
            document.querySelectorAll('.family-checkbox[data-context="mfg"]').forEach(box => {
                box.checked = true;
            });
            if (familyTools) familyTools.handleFamilyChange("mfg");
            clearMfgDetail();
        });

        function rerunCurrentMfgSearch() {
            const q = (input.value || "").trim();
            if (!q) {
                list.innerHTML = "";
                count.textContent = "0 results";
                return;
            }
            const results = search.searchXrefsByMfgTerm(q);
            renderMfgResults(results);
        }

        window.SealApp.mfgSearch = {
            rerun: rerunCurrentMfgSearch
        };
    }

    function initAdvancedToggle() {
        const toggle = document.getElementById("advanced-toggle");
        const panel = document.getElementById("advanced-filters");
        if (!toggle || !panel) return;
        const collapsedLabel = "Advanced filters \u25B8";
        const expandedLabel = "Advanced filters \u25BE";
        toggle.textContent = collapsedLabel;
        toggle.addEventListener("click", () => {
            const expanded = panel.classList.contains("expanded");
            if (expanded) {
                panel.classList.remove("expanded");
                panel.classList.add("collapsed");
                toggle.textContent = collapsedLabel;
            } else {
                panel.classList.add("expanded");
                panel.classList.remove("collapsed");
                toggle.textContent = expandedLabel;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initTabs();
        initDimensionalResults();
        initPartNumberResults();
        initComparePanel();
        initMfgSearch();
        initAdvancedToggle();
    });

    window.SealApp.uiResults = {
        showSealDetails,
        addToCompare,
        clearCompare
    };
})();
