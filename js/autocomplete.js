window.SealApp = window.SealApp || {};

(function() {
    const allParts = window.SealApp.allPartNumbers || [];
    const search = window.SealApp.search;
    const uiResults = window.SealApp.uiResults;

    function initPartNumberAutocomplete() {
        const input = document.getElementById("pn-search-input");
        const list = document.getElementById("pn-suggestions");

        function updateSuggestions() {
            const q = (input.value || "").trim().toUpperCase();
            list.innerHTML = "";
            list.classList.remove("visible");
            if (!q) return;

            const matches = [];
            for (const pn of allParts) {
                if (pn.toUpperCase().includes(q)) {
                    matches.push(pn);
                    if (matches.length >= 3) break;
                }
            }

            if (!matches.length) return;

            for (const pn of matches) {
                const li = document.createElement("li");
                li.className = "suggestion-item";
                li.textContent = pn;
                li.addEventListener("click", () => {
                    input.value = pn;
                    list.innerHTML = "";
                    list.classList.remove("visible");
                    const seal = search.findSealByPart(pn);
                    if (seal) uiResults.showSealDetails(seal, "pn");
                });
                list.appendChild(li);
            }
            list.classList.add("visible");
        }

        input.addEventListener("input", updateSuggestions);
        input.addEventListener("blur", () => {
            setTimeout(() => {
                list.classList.remove("visible");
            }, 150);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initPartNumberAutocomplete();
    });

    window.SealApp.autocomplete = {
        initPartNumberAutocomplete
    };
})();
