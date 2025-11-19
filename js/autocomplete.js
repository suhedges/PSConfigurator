window.SealApp = window.SealApp || {};

(function() {
    const seals = window.SealApp.seals || [];

    function familyAllowed(seal) {
        const tools = window.SealApp.familyFilters;
        if (!tools) return true;
        return tools.isFamilyAllowed("pn", seal.family);
    }

    function findMatches(query) {
        const q = (query || "").trim().toUpperCase();
        if (!q) return [];
        const results = [];
        for (const seal of seals) {
            if (!seal.part_number) continue;
            if (!familyAllowed(seal)) continue;
            if (seal.part_number.toUpperCase().includes(q)) {
                results.push(seal.part_number);
                if (results.length >= 5) break;
            }
        }
        return results;
    }

    function initPartNumberAutocomplete() {
        const input = document.getElementById("pn-search-input");
        const list = document.getElementById("pn-suggestions");
        if (!input || !list) return;

        function clearSuggestions() {
            list.innerHTML = "";
            list.classList.remove("visible");
        }

        input.addEventListener("input", () => {
            const matches = findMatches(input.value);
            if (!matches.length) {
                clearSuggestions();
                return;
            }
            list.innerHTML = "";
            matches.forEach(part => {
                const li = document.createElement("li");
                li.className = "suggestion-item";
                li.textContent = part;
                li.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    input.value = part;
                    clearSuggestions();
                });
                list.appendChild(li);
            });
            list.classList.add("visible");
        });

        input.addEventListener("blur", () => {
            setTimeout(clearSuggestions, 120);
        });
    }

    document.addEventListener("DOMContentLoaded", initPartNumberAutocomplete);
})();
