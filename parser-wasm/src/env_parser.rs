//---------------------------------------------------------
// env_parser.rs  (no external crates, browser–WASM ready)
//---------------------------------------------------------

use crate::Span;

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

// Move Quote definition above mod lexer so it's visible to the whole file
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Quote {
    Single,
    Double,
}
impl Quote {
    pub fn as_byte(self) -> u8 {
        match self {
            Quote::Single => b'\'',
            Quote::Double => b'"',
        }
    }
}

// Make struct Line<'a> public so it can be used in mod lexer
#[allow(dead_code)]
pub struct Line<'a> {
    pub bytes: &'a [u8],
    pub eol_len: usize, // 0, 1 or 2
}

// ───────────────────────── 1. LEXER ─────────────────────────
mod lexer {

    use super::Line;
    use super::{Quote, Span};

    /// Parsed line → (optional) key/value spans + quote info.
    #[derive(Debug)]
    pub struct EntryRaw {
        pub key_span: Span,
        pub value_span: Span,
        pub quote: Option<Quote>,
    }

    #[derive(Debug, Clone)]
    pub struct LexError {
        pub msg: String,
        pub line: usize,
        pub column: usize,
    }

    /// Split buffer into `Line`s *without* allocating.
    fn iter_lines(buf: &str) -> impl Iterator<Item = Line<'_>> {
        let mut bytes = buf.as_bytes();
        std::iter::from_fn(move || {
            if bytes.is_empty() {
                return None;
            }
            let mut idx = 0;
            while idx < bytes.len() && bytes[idx] != b'\n' && bytes[idx] != b'\r' {
                idx += 1;
            }

            let (_, rest) = bytes.split_at(idx);
            let mut eol_len = 0;
            // handle \r\n or \n  /  \r
            if rest.first() == Some(&b'\r') && rest.get(1) == Some(&b'\n') {
                eol_len = 2;
            } else if rest.first().is_some() {
                eol_len = 1;
            }

            // advance local slice
            let consumed = idx + eol_len;
            let (line_bytes, remainder) = bytes.split_at(consumed);
            bytes = remainder;

            Some(Line {
                bytes: line_bytes,
                eol_len,
            })
        })
    }

    /// Core tokenisation logic – returns Vec of raw entries; ignores comments/blank lines.
    pub fn lex_with_pos(buf: &str) -> Result<Vec<EntryRaw>, LexError> {
        let mut offset = 0; // running byte offset in the original buffer
        let mut out = Vec::<EntryRaw>::new();
        let mut line_no: usize = 1;

        for line in iter_lines(buf) {
            let slice = line.bytes; // still contains EOL
            let trimmed = trim_ws(slice);

            // count leading whitespace to compute accurate columns
            let mut lead_ws = 0usize;
            while lead_ws < slice.len() && is_space(slice[lead_ws]) {
                lead_ws += 1;
            }

            if trimmed.is_empty() || trimmed[0] == b'#' {
                // blank / comment
                offset += slice.len();
                line_no += 1;
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
            while idx < trimmed.len() && !trimmed[idx].is_ascii_whitespace() && trimmed[idx] != b'='
            {
                idx += 1;
            }
            let key_end = idx;
            skip_spaces(&trimmed, &mut idx);

            // '='
            if idx >= trimmed.len() || trimmed[idx] != b'=' {
                return Err(LexError {
                    msg: "missing '=' separator".into(),
                    line: line_no,
                    column: lead_ws + idx + 1,
                });
            }
            idx += 1; // past '='
            let _after_eq = idx;
            // capture value (leading spaces allowed)
            skip_spaces(&trimmed, &mut idx);

            // determine quoting
            let (quote, val_body_start) = match trimmed.get(idx) {
                Some(b'"') => (Some(super::Quote::Double), idx + 1),
                Some(b'\'') => (Some(super::Quote::Single), idx + 1),
                _ => (None, idx),
            };

            // locate end of value (before in-line comment / EOL)
            let val_end;

            // For quoted values, find the closing quote first
            if let Some(q) = quote {
                // For quoted values, find the matching closing quote
                let mut j = val_body_start;
                while j < trimmed.len() && trimmed[j] != q.as_byte() {
                    j += 1;
                }
                if j >= trimmed.len() {
                    return Err(LexError {
                        msg: "unterminated quoted value".into(),
                        line: line_no,
                        column: lead_ws + j + 1,
                    });
                }
                val_end = j + 1; // include the closing quote
            } else {
                // For unquoted values, find end considering comments
                let mut j = trimmed.len();
                if let Some(pos) = memchr::memchr(b'#', &trimmed[val_body_start..]) {
                    j = val_body_start + pos;
                }
                // Strip trailing spaces before comment
                while j > val_body_start && is_space(trimmed[j - 1]) {
                    j -= 1;
                }
                val_end = j;
            }

            let key_global = Span::new(
                offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + key_start,
                offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + key_end,
            );
            // For quoted values, include the quotes in the span
            let (val_span_start, val_span_end) = if quote.is_some() {
                (val_body_start - 1, val_end) // include opening and closing quotes
            } else {
                (val_body_start, val_end)
            };
            let val_global = Span::new(
                offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + val_span_start,
                offset + (trimmed.as_ptr() as usize - slice.as_ptr() as usize) + val_span_end,
            );

            out.push(EntryRaw {
                key_span: key_global,
                value_span: val_global,
                quote,
            });

            offset += slice.len();
            line_no += 1;
        }
        Ok(out)
    }

    // Backward-compatible wrapper that drops position info
    pub fn lex(buf: &str) -> Result<Vec<EntryRaw>, String> {
        match lex_with_pos(buf) {
            Ok(v) => Ok(v),
            Err(e) => Err(e.msg),
        }
    }

    // ───── helpers ─────
    #[inline]
    fn is_space(b: u8) -> bool {
        b == b' ' || b == b'\t'
    }
    #[inline]
    fn trim_ws(mut s: &[u8]) -> &[u8] {
        while !s.is_empty() && is_space(s[0]) {
            s = &s[1..];
        }
        while !s.is_empty()
            && (is_space(s[s.len() - 1]) || s[s.len() - 1] == b'\n' || s[s.len() - 1] == b'\r')
        {
            s = &s[..s.len() - 1];
        }
        s
    }
    #[inline]
    fn skip_spaces(buf: &[u8], idx: &mut usize) {
        while *idx < buf.len() && is_space(buf[*idx]) {
            *idx += 1;
        }
    }
    #[inline]
    fn starts_with_kw(buf: &[u8], kw: &[u8]) -> bool {
        buf.len() >= kw.len()
            && &buf[..kw.len()] == kw
            && (buf.get(kw.len()).map_or(true, |c| is_space(*c)))
    }
}
use lexer::lex;

// ───────────────────────── 2. MODEL ─────────────────────────
#[derive(Debug)]
struct Entry {
    key: String,
    _key_span: Span,
    value_span: Span,
    _quote: Option<Quote>,
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
                _key_span: r.key_span,
                value_span: r.value_span,
                _quote: r.quote,
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
impl EnvParser {
    pub fn new() -> Self {
        Self
    }
}

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

// Positional validation for ENV, returning first error with line/column
#[derive(Debug, Clone)]
pub struct PosError {
    pub msg: String,
    pub line: usize,
    pub column: usize,
}

pub fn validate_with_pos(content: &str) -> Result<(), PosError> {
    // First stage: lexical errors (missing '=', unterminated quotes) with line/column
    let raw = match lexer::lex_with_pos(content) {
        Ok(v) => v,
        Err(e) => {
            return Err(PosError {
                msg: e.msg,
                line: e.line,
                column: e.column,
            })
        }
    };

    // Second stage: duplicate key detection with position of the second occurrence
    let mut seen = std::collections::HashSet::new();
    for r in &raw {
        let key = &content[r.key_span.start..r.key_span.end];
        let key_trim = key.trim();
        if !seen.insert(key_trim.to_owned()) {
            let (line, column) = offset_to_line_col(content, r.key_span.start);
            return Err(PosError {
                msg: format!("duplicate key '{}'", key_trim),
                line,
                column,
            });
        }
    }

    Ok(())
}

// Utility: compute line and column from byte offset (1-based)
fn offset_to_line_col(buf: &str, offset: usize) -> (usize, usize) {
    let mut line = 1usize;
    let mut col = 1usize;
    for (idx, ch) in buf.char_indices() {
        if idx >= offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    (line, col)
}
