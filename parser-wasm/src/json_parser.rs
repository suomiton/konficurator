use crate::{BytePreservingParser, Span};
use json_syntax::lexer::{Lexer, Token, TokenKind};
use json_syntax::parser;

pub struct JsonParser;
impl JsonParser {
    pub fn new() -> Self {
        Self
    }
}

// ─────────────────────────── LEXER ───────────────────────────

#[derive(Debug, Clone)]
struct JsonToken {
    kind: TokenKind,
    span: Span,
}

fn tokenize(input: &str) -> Result<Vec<JsonToken>, String> {
    let mut tokens = Vec::new();
    let mut lexer = Lexer::new(input);
    while let Some(token) = lexer.next_token().transpose() {
        let token = token.map_err(|e| e.to_string())?;
        let span = Span::new(token.range.start, token.range.end);
        tokens.push(JsonToken {
            kind: token.kind,
            span,
        });
    }
    Ok(tokens)
}

// ──────────────────────── PATH TRACKER ────────────────────────

#[derive(Debug, Clone)]
enum PathSegment {
    Key(String),
    Index(usize),
}

fn find_value_span(tokens: &[JsonToken], path: &[String]) -> Option<Span> {
    let mut current_path = Vec::<PathSegment>::new();
    let mut stack = Vec::<(usize, PathSegment)>::new(); // (depth, path segment)
    let mut array_index_stack = Vec::<usize>::new();
    let mut key: Option<String> = None;

    let mut i = 0;
    while i < tokens.len() {
        let t = &tokens[i];
        match &t.kind {
            TokenKind::LBrace => {
                if let Some((depth, seg)) = stack.last() {
                    if *depth == current_path.len() {
                        current_path.push(seg.clone());
                    }
                }
                i += 1;
            }
            TokenKind::RBrace => {
                current_path.pop();
                i += 1;
            }
            TokenKind::LBracket => {
                array_index_stack.push(0);
                if let Some((depth, seg)) = stack.last() {
                    if *depth == current_path.len() {
                        current_path.push(seg.clone());
                    }
                }
                i += 1;
            }
            TokenKind::RBracket => {
                array_index_stack.pop();
                current_path.pop();
                i += 1;
            }
            TokenKind::Colon => {
                // do nothing
                i += 1;
            }
            TokenKind::Comma => {
                if let Some(last) = array_index_stack.last_mut() {
                    *last += 1;
                }
                if current_path.last().map(|seg| matches!(seg, PathSegment::Index(_))) == Some(true) {
                    current_path.pop();
                    current_path.push(PathSegment::Index(*array_index_stack.last().unwrap_or(&0)));
                }
                i += 1;
            }
            TokenKind::StringLiteral => {
                let s = unquote(&tokens[i], path);
                // if next is colon → it's a key
                if tokens.get(i + 1).map(|t| matches!(t.kind, TokenKind::Colon)) == Some(true) {
                    key = Some(s);
                    stack.push((current_path.len(), PathSegment::Key(s)));
                    i += 1;
                } else {
                    if let Some(PathSegment::Key(_)) = current_path.last() {
                        if path_matches(&current_path, path) {
                            return Some(t.span);
                        }
                        current_path.pop(); // finish consuming key
                    } else if let Some(PathSegment::Index(_)) = current_path.last() {
                        if path_matches(&current_path, path) {
                            return Some(t.span);
                        }
                    }
                    i += 1;
                }
            }
            TokenKind::NumberLiteral
            | TokenKind::True
            | TokenKind::False
            | TokenKind::Null => {
                if path_matches(&current_path, path) {
                    return Some(t.span);
                }
                if current_path.last().map(|seg| matches!(seg, PathSegment::Key(_))) == Some(true) {
                    current_path.pop();
                }
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    None
}

fn unquote(token: &JsonToken, _path: &[String]) -> String {
    // unwrap quotes
    // (assuming well-formed token, don't unescape for speed)
    // slice is guaranteed to start/end with quotes
    format!(
        "{}",
        &token.kind.to_string()[1..token.kind.to_string().len() - 1]
    )
}

fn path_matches(current: &[PathSegment], target: &[String]) -> bool {
    if current.len() != target.len() {
        return false;
    }

    for (seg, expected) in current.iter().zip(target.iter()) {
        match seg {
            PathSegment::Key(k) => {
                if k != expected {
                    return false;
                }
            }
            PathSegment::Index(i) => {
                if i.to_string() != *expected {
                    return false;
                }
            }
        }
    }
    true
}

// ───────────────────────── PUBLIC API ─────────────────────────

impl BytePreservingParser for JsonParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        parser::parse_value(content)
            .map(|_| ())
            .map_err(|e| format!("Invalid JSON: {e}"))
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        let tokens = tokenize(content).map_err(|e| format!("Tokenization error: {e}"))?;
        find_value_span(&tokens, path)
            .ok_or_else(|| format!("Path not found: {}", path.join("/")))
    }

    fn replace_value(&self, content: &str, span: Span, new_val: &str) -> String {
        let mut out = String::with_capacity(content.len() - span.len() + new_val.len());
        out.push_str(&content[..span.start]);
        out.push_str(new_val);
        out.push_str(&content[span.end..]);
        out
    }
}
