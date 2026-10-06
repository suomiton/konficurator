// The Node target contains the same Rust core as the browser build.
const core = require("../parser-wasm/pkg-node/parser_core.js");
module.exports = { __esModule: true, default: async () => {}, ...core };
