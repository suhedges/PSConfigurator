window.SealApp = window.SealApp || {};

(function() {
    const config = {
        mmPerInch: 25.4,
        toleranceDim: 0.002,   // inch / mm matching tolerance
        maxCompare: 2
    };

    window.SealApp.config = config;
})();
