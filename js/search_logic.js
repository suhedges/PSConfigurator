window.SealApp = window.SealApp || {};

(function() {
    const cfg = window.SealApp.config;
    const seals = window.SealApp.seals;
    const materialsData = window.SealApp.materialsData;
    const UNSPECIFIED_DIM_VALUE = "__UNSPECIFIED__";
    window.SealApp.UNSPECIFIED_DIM_VALUE = UNSPECIFIED_DIM_VALUE;

    function approxEqual(a, b, tol) {
        if (a == null || b == null) return false;
        return Math.abs(a - b) <= (tol || cfg.toleranceDim);
    }

    /**
     * Build unique option lists for dimensional dropdowns,
     * constrained by the current filter combination.
     *
     * filters = {
     *   shaft: string (numeric string or ""),
     *   matingOd: string (numeric string or ""),
     *   headType: string,
     *   matingDesign: string
     * }
     */
    function familyIsAllowed(seal, allowedFamilies) {
        if (!Array.isArray(allowedFamilies)) return true;
        if (!allowedFamilies.length) return false;
        const family = (seal.family || "other");
        return allowedFamilies.includes(family);
    }

    function getUniqueOptions(unit, filters) {
        filters = filters || {};
        const shaftRaw = filters.shaft;
        const matingRaw = filters.matingOd;
        const wantsUnspecifiedShaft = shaftRaw === UNSPECIFIED_DIM_VALUE;
        const wantsUnspecifiedMating = matingRaw === UNSPECIFIED_DIM_VALUE;
        const shaftFilter = wantsUnspecifiedShaft || !shaftRaw ? null : parseFloat(shaftRaw);
        const matingFilter = wantsUnspecifiedMating || !matingRaw ? null : parseFloat(matingRaw);
        const headFilter = (filters.headType || "").toUpperCase();
        const designFilter = (filters.matingDesign || "").toUpperCase();

        const shaftOptions = new Map();
        const matingOdOptions = new Map();
        const headTypes = new Set();
        const matingDesigns = new Set();
        let hasUnspecifiedShaft = false;
        let hasUnspecifiedMating = false;

        for (const seal of seals) {
            if (!familyIsAllowed(seal, filters.allowedFamilies)) continue;
            if (!sealMatchesMaterialFilters(seal, filters)) continue;
            for (const dim of seal.dimensional || []) {
                let shaft, shaftConv = false;
                let matingOd, matingConv = false;

                if (unit === "inch") {
                    shaft = dim.shaft_in;
                    matingOd = dim.mating_bore_in || dim.head_od_in;
                    if (dim.unit_original === "mm") {
                        shaftConv = true;
                        if (matingOd != null) matingConv = true;
                    }
                } else {
                    shaft = dim.shaft_mm;
                    matingOd = dim.mating_bore_mm || dim.head_od_mm;
                    if (dim.unit_original === "inch") {
                        shaftConv = true;
                        if (matingOd != null) matingConv = true;
                    }
                }

                if (!Number.isFinite(shaft)) shaft = null;
                if (!Number.isFinite(matingOd)) matingOd = null;

                // Apply current filter constraints
                if (wantsUnspecifiedShaft) {
                    if (shaft != null) continue;
                } else if (shaftFilter != null) {
                    if (shaft == null || !approxEqual(shaft, shaftFilter, cfg.toleranceDim)) {
                        continue;
                    }
                }
                if (wantsUnspecifiedMating) {
                    if (matingOd != null) continue;
                } else if (matingFilter != null) {
                    if (matingOd == null || !approxEqual(matingOd, matingFilter, cfg.toleranceDim)) {
                        continue;
                    }
                }
                if (headFilter) {
                    const h = (dim.head_type || "").toUpperCase();
                    if (h !== headFilter) continue;
                }
                if (designFilter) {
                    const d = (dim.mating_design || "").toUpperCase();
                    if (d !== designFilter) continue;
                }

                // If we get here, this dimensional row is valid for the current combination,
                // so we harvest its options for all dropdowns.

                if (shaft == null) {
                    hasUnspecifiedShaft = true;
                } else {
                    const key = shaft.toFixed(4);
                    const existing = shaftOptions.get(key);
                    if (!existing) {
                        shaftOptions.set(key, { value: shaft, converted: shaftConv });
                    } else if (shaftConv) {
                        existing.converted = true;
                    }
                }

                if (matingOd == null) {
                    hasUnspecifiedMating = true;
                } else {
                    const key = matingOd.toFixed(4);
                    const existing = matingOdOptions.get(key);
                    if (!existing) {
                        matingOdOptions.set(key, { value: matingOd, converted: matingConv });
                    } else if (matingConv) {
                        existing.converted = true;
                    }
                }

                if (dim.head_type) headTypes.add(dim.head_type);
                if (dim.mating_design) matingDesigns.add(dim.mating_design);
            }
        }

        return {
            shaft: Array.from(shaftOptions.values()).sort((a,b) => a.value - b.value),
            matingOd: Array.from(matingOdOptions.values()).sort((a,b) => a.value - b.value),
            headTypes: Array.from(headTypes).sort(),
            matingDesigns: Array.from(matingDesigns).sort(),
            includeUnspecifiedShaft: hasUnspecifiedShaft,
            includeUnspecifiedMating: hasUnspecifiedMating,
        };
    }

    function sealMatchesDimFilters(seal, filters) {
        // For SEARCH button we still require unit + shaft
        if (!filters.unit || !filters.shaft) return true;

        const unit = filters.unit;
        const wantsUnspecifiedShaft = filters.shaft === UNSPECIFIED_DIM_VALUE;
        const wantsUnspecifiedMating = filters.matingOd === UNSPECIFIED_DIM_VALUE;
        const shaftTarget = wantsUnspecifiedShaft ? null : parseFloat(filters.shaft);
        const matingTarget = wantsUnspecifiedMating
            ? null
            : filters.matingOd
                ? parseFloat(filters.matingOd)
                : null;
        const headType = filters.headType || "";
        const matingDesign = filters.matingDesign || "";

        for (const dim of seal.dimensional || []) {
            let shaft, matingOd;

            if (unit === "inch") {
                shaft = dim.shaft_in;
                matingOd = dim.mating_bore_in || dim.head_od_in;
            } else {
                shaft = dim.shaft_mm;
                matingOd = dim.mating_bore_mm || dim.head_od_mm;
            }

            if (!Number.isFinite(shaft)) shaft = null;
            if (!Number.isFinite(matingOd)) matingOd = null;

            if (wantsUnspecifiedShaft) {
                if (shaft != null) continue;
            } else {
                if (shaft == null) continue;
                if (!approxEqual(shaft, shaftTarget)) continue;
            }

            if (wantsUnspecifiedMating) {
                if (matingOd != null) continue;
            } else if (matingTarget != null) {
                if (matingOd == null || !approxEqual(matingOd, matingTarget)) continue;
            }

            if (headType && (dim.head_type || "").toUpperCase() !== headType.toUpperCase()) continue;
            if (matingDesign && (dim.mating_design || "").toUpperCase() !== matingDesign.toUpperCase()) continue;

            return true;
        }

        return false;
    }

    function isSealCompatibleWithFluidCategory(seal, fluidRec, categoryKey) {
        if (!fluidRec || !seal || !seal.materials) return false;

        const mats = seal.materials;
        let okList, materials;

        if (categoryKey === "secondary") {
            okList = fluidRec.secondary_ok || [];
            materials = mats.secondary || [];
        } else if (categoryKey === "faces") {
            okList = fluidRec.faces_ok || [];
            materials = mats.faces || [];
        } else if (categoryKey === "metals") {
            okList = fluidRec.metals_ok || [];
            materials = mats.metals || [];
        } else {
            return false;
        }

        if (!materials.length) return false;

        const okSet = new Set(okList);
        return materials.some(m => okSet.has(m));
    }

    // Build the <option> list for ONE of the three fluid filters
    //   categoryKey: "secondary" | "faces" | "metals"
    //   filters:     full filter object without that category's own fluid index set
    function collectFluidOptionsForCategory(categoryKey, filters) {
        const results = filterSeals(filters);
        const fluids = materialsData.fluids || [];
        const available = [];

        for (let idx = 0; idx < fluids.length; idx++) {
            const rec = fluids[idx];
            if (!rec) continue;

            const hasMatch = results.some(seal =>
                isSealCompatibleWithFluidCategory(seal, rec, categoryKey)
            );

            if (hasMatch) {
                available.push({ value: idx, label: rec.fluid });
            }
        }

        return available;
    }

    // Extend material filters with per-category fluid compatibility
    function sealMatchesMaterialFilters(seal, filters) {
        const mats = seal.materials || {};

        // Basic material filters
        if (filters.secondaryMaterial) {
            const list = mats.secondary || [];
            if (!list.includes(filters.secondaryMaterial)) return false;
        }
        if (filters.faceMaterial) {
            const list = mats.faces || [];
            if (!list.includes(filters.faceMaterial)) return false;
        }
        if (filters.metalMaterial) {
            const list = mats.metals || [];
            if (!list.includes(filters.metalMaterial)) return false;
        }

        // Temperature
        if (filters.minTempF) {
            const needed = parseFloat(filters.minTempF);
            const maxT = seal.max_temp_f;
            if (maxT == null || maxT < needed) return false;
        }

        // NEW: per-category fluid compatibility filters
        if (filters.fluidSecondaryIndex != null) {
            const rec = materialsData.fluids[filters.fluidSecondaryIndex];
            if (!isSealCompatibleWithFluidCategory(seal, rec, "secondary")) return false;
        }
        if (filters.fluidFacesIndex != null) {
            const rec = materialsData.fluids[filters.fluidFacesIndex];
            if (!isSealCompatibleWithFluidCategory(seal, rec, "faces")) return false;
        }
        if (filters.fluidMetalsIndex != null) {
            const rec = materialsData.fluids[filters.fluidMetalsIndex];
            if (!isSealCompatibleWithFluidCategory(seal, rec, "metals")) return false;
        }

        return true;
    }

    function filterSeals(filters) {
        filters = filters || {};
        const results = [];
        for (const seal of seals) {
            if (!familyIsAllowed(seal, filters.allowedFamilies)) continue;
            if (!sealMatchesDimFilters(seal, filters)) continue;
            if (!sealMatchesMaterialFilters(seal, filters)) continue;
            results.push(seal);
        }
        return results;
    }

    function findSealByPart(partNumber) {
        if (!partNumber) return null;
        const map = window.SealApp.sealsByPart;
        if (!map) return null;
        return map.get(partNumber.toUpperCase()) || null;
    }

    function searchXrefsByMfgTerm(term) {
        const all = window.SealApp.allXrefs || [];
        const q = (term || "").toUpperCase();
        if (!q) return [];

        const results = [];
        for (const rec of all) {
            const hay = [
                rec.mfg_part || "",
                rec.model || "",
                rec.brand || ""
            ].join(" ").toUpperCase();
            if (!hay.includes(q)) continue;
            results.push(rec);
        }
        return results;
    }

    function getTypeDescriptor(typeCode) {
        if (!typeCode) return null;
        const data = materialsData.typeDescriptions || {};
        return data[typeCode] || null;
    }

    window.SealApp.search = {
        getUniqueOptions,
        filterSeals,
        findSealByPart,
        searchXrefsByMfgTerm,
        getTypeDescriptor,
        isSealCompatibleWithFluidCategory,
        collectFluidOptionsForCategory
    };
})();
