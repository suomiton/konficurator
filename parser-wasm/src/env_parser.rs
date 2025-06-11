//---------------------------------------------------------
// env_parser.rs  (no external crates, browser–WASM ready)
//---------------------------------------------------------
use std::ops::Range;

/// Byte-range inside the *original* UTF-8 buffer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end:   usize,
}
impl Span {
    pub fn new(start: usize, end: usize) -> Self { Self { start, end } }
    pub fn len(&self) -> usize { self.end - self.start }
}

/// API expected by upper-level tooling.
pub trait BytePreservingParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String>;
    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String>;

    /// Convenience: splice `new_val` into `content` at `span`, preserving every
    /// other byte. **Caller must** ensure `span` came from `find_value_span`.
    fn replace_value(&self, content: &str, span: Span, new_val: &str) -> String {
        let mut out = String::with_capacity(content.len() - span.len() + new_val.len());
        out.push_str(&content[..span.start]);
        out.push_str(new_val);
        out.push_str(&content[span.end..]);
        out
    }
}

// ───────────────────────── 1. LEXER ─────────────────────────
mod lexer {
    use super::{Span, Quote};
    /// One physical line including its EOL marker (or empty if EOF).
    struct Line<'a> {
        bytes: &'a [u8],
        eol_len: usize, // 0, 1 or 2
    }

    /// Quoting style of a value (used to keep quotes on replacement).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum Quote { Single, Double }

    /// Parsed line → (optional) key/value spans + quote info.
    #[derive(Debug)]
    pub struct EntryRaw {
        pub key_span:   Span,
        pub value_span: Span,
        pub quote:      Option<Quote>,
    }

    /// Split buffer into `Line`s *without* allocating.
    fn iter_lines(buf: &str) -> impl Iterator<Item = Line<'_>> {
        let bytes = buf.as_bytes();
        std::iter::from_fn(move || {
            if bytes.is_empty() { return None; }
            let mut idx = 0;
            while idx < bytes.len() && bytes[idx] != b'\n' && bytes[idx] != b'\r' { idx += 1; }

            let (line, rest) = bytes.split_at(idx);
            let mut eol_len = 0;
            // handle \r\n or \n  /  \r
            if rest.first() == Some(&b'\r') && rest.get(1) == Some(&b'\n') { eol_len = 2; }
            else if rest.first().is_some() { eol_len = 1; }

            // advance global slice
            let consumed = idx + eol_len;
            let (this, remainder) = bytes.split_at(consumed);
            *unsafe { &mut *( &bytes as *const _ as *mut &[u8] ) } = remainder;

            Some(Line { bytes: this, eol_len })
        })
    }

    /// Core tokenisation logic – returns Vec of raw entries; ignores comments/blank lines.
    pub fn lex(buf: &str) -> Result<Vec<EntryRaw>, String> {
        let mut offset = 0;                      // running byte offset in the original buffer
        let mut out    = Vec::<EntryRaw>::new();

        for line in iter_lines(buf) {
            let slice = line.bytes;              // still contains EOL
            let trimmed = trim_ws(slice);

            if trimmed.is_empty() || trimmed[0] == b'#' { // blank / comment
                offset += slice.len();
                continue;
            }

            // optional leading "export"
            let mut idx = 0;
            if starts_with_kw(trimmed, b"export") {
                idx += b"export".len();
                skip_spaces(&trimmed, &mut idx);
            }

            // parse key
            let key_start = idx;
            while idx < trimmed.len() && !trimmed[idx].is_ascii_whitespace() && trimmed[idx] != b'=' {
                idx += 1;
            }
            let key_end = idx;
            skip_spaces(&trimmed, &mut idx);

            // '='
            if idx >= trimmed.len() || trimmed[idx] != b'=' {
                return Err("missing '=' separator".into());
            }
            idx += 1; // past '='
            let after_eq = idx;
            // capture value (leading spaces allowed)
            skip_spaces(&trimmed, &mut idx);
            let val_start = idx;

            // determine quoting
            let (quote, val_body_start) = match trimmed.get(idx) {
                Some(b'"') => (Some(Quote::Double), idx + 1),
                Some(b'\'') => (Some(Quote::Single), idx + 1),
                _ => (None, idx),
            };

            // locate end of value (before in-line comment / EOL)
            let mut val_end = trimmed.len();
            // strip trailing spaces / in-line comment
            let mut j = trimmed.len();
            while j > val_body_start && is_space(trimmed[j - 1]) { j -= 1; }
            if let Some(pos) = memchr::memchr(b'#', &trimmed[val_body_start..j]) {
                val_end = val_body_start + pos;
            } else {
                val_end = j;
            }
            // if quoted, shrink by one to exclude closing quote
            if let Some(q) = quote {
                if val_end == val_body_start {
                    return Err("unterminated quoted value".into());
                }
                if trimmed[val_end - 1] != q.as_byte() {
                    return Err("unterminated quoted value".into());
                }
                val_end -= 1;
            }

            let key_global   = Span::new(offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + key_start,
                                         offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + key_end);
            let val_global   = Span::new(offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + val_body_start,
                                         offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + val_end);

            out.push(EntryRaw { key_span: key_global, value_span: val_global, quote });

            offset += slice.len();
        }
        Ok(out)
    }

    // ───── helpers ─────
    #[inline] fn is_space(b: u8) -> bool { b == b' ' || b == b'\t' }
    #[inline] fn trim_ws(mut s: &[u8]) -> &[u8] {
        while !s.is_empty() && is_space(s[0]) { s = &s[1..]; }
        while !s.is_empty() && is_space(s[s.len()-1]) { s = &s[..s.len()-1]; }
        s
    }
    #[inline] fn skip_spaces(buf: &[u8], idx: &mut usize) {
        while *idx < buf.len() && is_space(buf[*idx]) { *idx += 1; }
    }
    #[inline] fn starts_with_kw(buf: &[u8], kw: &[u8]) -> bool {
        buf.len() >= kw.len() && &buf[..kw.len()] == kw
            && (buf.get(kw.len()).map_or(true, |c| is_space(*c)))
    }
    impl Quote { pub fn as_byte(self) -> u8 { match self { Quote::Single => b'\'', Quote::Double => b'"' } } }
}
use lexer::{Quote, lex, EntryRaw};

// ───────────────────────── 2. MODEL ─────────────────────────
#[derive(Debug)]
struct Entry {
    key:        String,
    key_span:   Span,
    value_span: Span,
    quote:      Option<Quote>,
}

#[derive(Debug)]
struct EnvDocument {
    entries: Vec<Entry>,
}

impl EnvDocument {
    fn parse(buf: &str) -> Result<Self, String> {
        let raw = lex(buf)?;
        let mut entries = Vec::with_capacity(raw.len());
        let mut seen = std::collections::HashSet::new();

        for r in raw {
            let key = &buf[r.key_span.start..r.key_span.end];
            let key_str = key.trim().to_owned();
            if !seen.insert(key_str.clone()) {
                return Err(format!("duplicate key '{}'", key_str));
            }
            entries.push(Entry {
                key: key_str,
                key_span: r.key_span,
                value_span: r.value_span,
                quote: r.quote,
            });
        }
        Ok(Self { entries })
    }

    fn get(&self, key: &str) -> Option<&Entry> {
        self.entries.iter().find(|e| e.key == key)
    }
}

// ───────────────────────── 3. PUBLIC PARSER ─────────────────────────
pub struct EnvParser;
impl EnvParser { pub fn new() -> Self { Self } }

impl BytePreservingParser for EnvParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        // full parse catches duplicates / missing '=' / unterminated quotes
        EnvDocument::parse(content).map(|_| ())
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        if path.len() != 1 {
            return Err("ENV path must contain exactly one key".into());
        }
        let doc = EnvDocument::parse(content)?;
        let key = &path[0];
        match doc.get(key) {
            Some(entry) => Ok(entry.value_span),
            None => Err(format!("key '{}' not found", key)),
        }
    }
}
