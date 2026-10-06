//! ENV/properties entries, including exports, quoted multiline values and sections.
use crate::model::Node;
use crate::{BytePreservingParser, Span};

#[derive(Default)]
pub struct EnvParser;
impl EnvParser {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Clone)]
pub struct EnvError {
    pub msg: String,
    pub line: usize,
    pub column: usize,
}

pub fn validate_with_pos(content: &str) -> Result<(), EnvError> {
    scan(content).map(|_| ())
}

impl BytePreservingParser for EnvParser {
    fn parse(&self, content: &str) -> Result<Node, String> {
        scan(content).map_err(|e| format!("{} at {}:{}", e.msg, e.line, e.column))
    }
}

fn scan(content: &str) -> Result<Node, EnvError> {
    let bytes = content.as_bytes();
    let mut i = if content.starts_with('\u{feff}') {
        3
    } else {
        0
    };
    let mut root = Node::new(String::new(), vec![], "object", Span::new(0, content.len()));
    let mut section: Option<usize> = None;
    let error = |offset, message: &str| {
        let (line, column) = crate::positions::LineIndex::new(content).line_col(offset);
        EnvError {
            msg: message.into(),
            line,
            column,
        }
    };
    while i < bytes.len() {
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if i == bytes.len() {
            break;
        }
        if matches!(bytes[i], b'#' | b';') {
            skip_line(bytes, &mut i);
            continue;
        }
        if bytes[i] == b'[' {
            let start = i;
            skip_line(bytes, &mut i);
            let text = content[start..i].trim();
            let close = text
                .find(']')
                .ok_or_else(|| error(start, "Unclosed section"))?;
            if !text[close + 1..].trim().is_empty() {
                return Err(error(start, "Invalid section"));
            }
            let name = text[1..close].trim().to_string();
            section = Some(
                if let Some(index) = root.children.iter().position(|n| n.key == name) {
                    index
                } else {
                    root.children.push(Node::new(
                        name.clone(),
                        vec![name],
                        "object",
                        Span::new(start, i),
                    ));
                    root.children.len() - 1
                },
            );
            continue;
        }
        if content[i..].starts_with("export")
            && bytes.get(i + 6).is_some_and(|b| matches!(b, b' ' | b'\t'))
        {
            i += 6;
            skip_spaces(bytes, &mut i);
        }
        let key_start = i;
        while i < bytes.len() && !matches!(bytes[i], b'=' | b'\n' | b'\r' | b' ' | b'\t') {
            i += 1;
        }
        let key = content[key_start..i].to_string();
        skip_spaces(bytes, &mut i);
        if key.is_empty() || bytes.get(i) != Some(&b'=') {
            return Err(error(key_start, "missing '=' separator"));
        }
        i += 1;
        skip_spaces(bytes, &mut i);
        let start = i;
        let quote = bytes.get(i).filter(|b| matches!(b, b'\'' | b'"')).copied();
        let end;
        let value;
        if let Some(q) = quote {
            i += 1;
            let inner = i;
            while i < bytes.len() {
                if bytes[i] == b'\\' && i + 1 < bytes.len() {
                    i += 2;
                    continue;
                }
                if bytes[i] == q {
                    break;
                }
                i += 1;
            }
            if i == bytes.len() {
                return Err(error(start, "unterminated quoted value"));
            }
            value = decode(&content[inner..i], q as char);
            i += 1;
            end = i;
            skip_spaces(bytes, &mut i);
            if i < bytes.len() && !matches!(bytes[i], b'\n' | b'\r' | b'#' | b';') {
                return Err(error(i, "Unexpected text after quoted value"));
            }
            skip_line(bytes, &mut i);
        } else {
            while i < bytes.len() && !matches!(bytes[i], b'\n' | b'\r') {
                if matches!(bytes[i], b'#' | b';')
                    && (i == start || bytes[i - 1].is_ascii_whitespace())
                {
                    break;
                }
                i += 1;
            }
            end = start + content[start..i].trim_end().len();
            value = content[start..end].into();
            skip_line(bytes, &mut i);
        }
        let parent = if let Some(idx) = section {
            &mut root.children[idx]
        } else {
            &mut root
        };
        let mut path = parent.path.clone();
        path.push(key.clone());
        let mut node = Node::new(key, path, "env", Span::new(start, end));
        node.value = Some(value);
        node.quote = quote.map(char::from);
        parent.children.push(node);
    }
    index_duplicates(&mut root);
    Ok(root)
}

fn index_duplicates(node: &mut Node) {
    let mut counts = std::collections::HashMap::new();
    for child in &node.children {
        *counts.entry(child.key.clone()).or_insert(0usize) += 1;
    }
    let mut seen = std::collections::HashMap::new();
    for child in &mut node.children {
        if counts[&child.key] > 1 {
            let index = seen.entry(child.key.clone()).or_insert(0usize);
            child.path.push(index.to_string());
            *index += 1;
        }
        index_duplicates(child);
    }
}
fn skip_spaces(bytes: &[u8], i: &mut usize) {
    while *i < bytes.len() && matches!(bytes[*i], b' ' | b'\t') {
        *i += 1;
    }
}
fn skip_line(bytes: &[u8], i: &mut usize) {
    while *i < bytes.len() && !matches!(bytes[*i], b'\n' | b'\r') {
        *i += 1;
    }
}
fn decode(text: &str, quote: char) -> String {
    let mut chars = text.chars();
    let mut out = String::new();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(next) = chars.next() {
                match next {
                    'n' if quote == '"' => out.push('\n'),
                    'r' if quote == '"' => out.push('\r'),
                    't' if quote == '"' => out.push('\t'),
                    '\\' => out.push('\\'),
                    q if q == quote => out.push(q),
                    _ => {
                        out.push('\\');
                        out.push(next);
                    }
                }
            } else {
                out.push(c);
            }
        } else {
            out.push(c);
        }
    }
    out
}

pub(crate) fn encode(value: &str, original_quote: Option<char>) -> String {
    let quote = original_quote.or_else(|| {
        (value.contains([' ', '\t', '\n', '\r', '"', '\'', '\\']) || value.starts_with(['#', ';']))
            .then_some('"')
    });
    let Some(q) = quote else {
        return value.into();
    };
    let mut out = String::new();
    out.push(q);
    for c in value.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\n' if q == '"' => out.push_str("\\n"),
            '\r' if q == '"' => out.push_str("\\r"),
            '\t' if q == '"' => out.push_str("\\t"),
            c if c == q => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out.push(q);
    out
}

/// Recover by commenting the offending line in a same-length validation buffer.
/// Every diagnostic still comes from the same scanner used for display and saves.
pub(crate) fn validate_multi(
    content: &str,
    cap: usize,
) -> crate::multi_validation::MultiValidationResult {
    let mut buffer = content.to_string();
    let mut errors = Vec::new();
    for _ in 0..cap {
        let Err(error) = scan(&buffer) else {
            break;
        };
        let index = crate::positions::LineIndex::new(content);
        let start = index.offset(error.line, error.column);
        errors.push(crate::multi_validation::DetailedError {
            message: error.msg,
            code: Some("env.parse_error"),
            line: error.line,
            column: error.column,
            span: Span::new(start, start),
        });
        let mut line_start = index.offset(error.line, 1);
        if line_start == 0 && content.starts_with('\u{feff}') {
            line_start = 3;
        }
        let line_end = buffer[line_start..]
            .find(['\n', '\r'])
            .map_or(buffer.len(), |i| line_start + i);
        if line_end <= line_start {
            break;
        }
        let replacement = format!("#{}", " ".repeat(line_end - line_start - 1));
        buffer.replace_range(line_start..line_end, &replacement);
    }
    if errors.is_empty() {
        crate::multi_validation::MultiValidationResult::success()
    } else {
        crate::multi_validation::MultiValidationResult {
            valid: false,
            summary: errors.first().cloned(),
            errors,
        }
    }
}
