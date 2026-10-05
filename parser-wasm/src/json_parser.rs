//! JSON‑parseri, joka käyttää omaa minitokenisoijaa span‑hakuihin.

use crate::json_lexer::{lex, validate, Kind, Token};
use crate::{BytePreservingParser, Span};

pub struct JsonParser;
impl JsonParser {
    pub fn new() -> Self {
        Self
    }
}

// ────────── HELPER FUNCTIONS ──────────

fn find_matching_brace(tokens: &[Token], start_idx: usize) -> Result<usize, String> {
    let mut depth = 0;
    for i in start_idx..tokens.len() {
        match tokens[i].kind {
            Kind::LBrace => depth += 1,
            Kind::RBrace => {
                depth -= 1;
                if depth == 0 {
                    return Ok(tokens[i].span.end);
                }
            }
            _ => {}
        }
    }
    Err("Unmatched opening brace".to_string())
}

fn find_matching_bracket(tokens: &[Token], start_idx: usize) -> Result<usize, String> {
    let mut depth = 0;
    for i in start_idx..tokens.len() {
        match tokens[i].kind {
            Kind::LBrack => depth += 1,
            Kind::RBrack => {
                depth -= 1;
                if depth == 0 {
                    return Ok(tokens[i].span.end);
                }
            }
            _ => {}
        }
    }
    Err("Unmatched opening bracket".to_string())
}

// ────────── PATH‑TRACKER ──────────
#[derive(Debug, Clone)]
enum Seg {
    Key(String),
    Idx(usize),
}

fn path_matches(stack: &[Seg], target: &[String]) -> bool {
    if stack.len() != target.len() {
        return false;
    }
    for (s, t) in stack.iter().zip(target) {
        match s {
            Seg::Key(k) if k == t => (),
            Seg::Idx(i) if i.to_string() == *t => (),
            _ => return false,
        }
    }
    true
}

impl BytePreservingParser for JsonParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        let tokens = lex(content)?;
        validate(&tokens)
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        let tokens = lex(content)?;
        find_value_span_with_tokens(&tokens, content, path)
    }
}

fn find_value_span_with_tokens(
    tokens: &[Token],
    content: &str,
    path: &[String],
) -> Result<Span, String> {
    let mut path_stack = Vec::<Seg>::new();
    let mut arr_idx_stack = Vec::<usize>::new();
    let mut expect_key: Option<String> = None;
    let mut i = 0;

    while i < tokens.len() {
        match tokens[i].kind {
            Kind::LBrace => {
                if let Some(key) = expect_key.take() {
                    path_stack.push(Seg::Key(key));
                    if path_matches(&path_stack, path) {
                        let start_pos = tokens[i].span.start;
                        let end_pos = find_matching_brace(tokens, i)?;
                        return Ok(crate::Span::new(start_pos, end_pos));
                    }
                }
                i += 1;
            }
            Kind::RBrace => {
                if let Some(Seg::Key(_)) = path_stack.last() {
                    path_stack.pop();
                }
                i += 1;
            }
            Kind::LBrack => {
                if let Some(key) = expect_key.take() {
                    path_stack.push(Seg::Key(key));
                    if path_matches(&path_stack, path) {
                        let start_pos = tokens[i].span.start;
                        let end_pos = find_matching_bracket(tokens, i)?;
                        return Ok(crate::Span::new(start_pos, end_pos));
                    }
                }
                arr_idx_stack.push(0);
                path_stack.push(Seg::Idx(0));
                i += 1;
            }
            Kind::RBrack => {
                arr_idx_stack.pop();
                if let Some(Seg::Idx(_)) = path_stack.last() {
                    path_stack.pop();
                }
                if let Some(Seg::Key(_)) = path_stack.last() {
                    path_stack.pop();
                }
                i += 1;
            }
            Kind::StringLit => {
                if tokens.get(i + 1).map(|t| t.kind) == Some(Kind::Colon) {
                    let key_slice = &content[tokens[i].span.start + 1..tokens[i].span.end - 1];
                    expect_key = Some(key_slice.to_string());
                    i += 2;
                } else {
                    if let Some(key) = expect_key.take() {
                        path_stack.push(Seg::Key(key));
                    }
                    if path_matches(&path_stack, path) {
                        return Ok(crate::Span::new(tokens[i].span.start, tokens[i].span.end));
                    }
                    if let Some(Seg::Key(_)) = path_stack.last() {
                        path_stack.pop();
                    }
                    i += 1;
                }
            }
            Kind::NumberLit | Kind::True | Kind::False | Kind::Null => {
                if let Some(key) = expect_key.take() {
                    path_stack.push(Seg::Key(key));
                }
                if path_matches(&path_stack, path) {
                    return Ok(crate::Span::new(tokens[i].span.start, tokens[i].span.end));
                }
                if let Some(Seg::Key(_)) = path_stack.last() {
                    path_stack.pop();
                }
                i += 1;
            }
            Kind::Comma => {
                if let Some(last) = arr_idx_stack.last_mut() {
                    *last += 1;
                    if let Some(Seg::Idx(ref mut n)) = path_stack.last_mut() {
                        *n = *last;
                    }
                }
                i += 1;
            }
            Kind::Colon => {
                i += 1;
            }
        }
    }
    Err(format!("Path not found: {}", path.join("/")))
}

pub struct JsonSpanResolver<'a> {
    content: &'a str,
    tokens: Vec<Token>,
}

impl<'a> JsonSpanResolver<'a> {
    pub fn new(content: &'a str) -> Result<Self, String> {
        let tokens = lex(content)?;
        Ok(Self { content, tokens })
    }

    pub fn find_path(&self, path: &[String]) -> Result<Span, String> {
        find_value_span_with_tokens(&self.tokens, self.content, path)
    }

    pub fn span_for_pointer(&self, pointer: &str) -> Result<Span, String> {
        let segments = pointer_to_segments(pointer)?;
        if segments.is_empty() {
            return Ok(Span::new(0, self.content.len()));
        }
        self.find_path(&segments)
    }
}

fn pointer_to_segments(pointer: &str) -> Result<Vec<String>, String> {
    if pointer.is_empty() {
        return Ok(Vec::new());
    }
    if !pointer.starts_with('/') {
        return Err(format!("Invalid JSON Pointer: {}", pointer));
    }
    pointer
        .split('/')
        .skip(1)
        .map(|segment| decode_pointer_segment(segment))
        .collect()
}

fn decode_pointer_segment(segment: &str) -> Result<String, String> {
    let mut out = String::with_capacity(segment.len());
    let mut chars = segment.chars();
    while let Some(ch) = chars.next() {
        if ch == '~' {
            match chars.next() {
                Some('0') => out.push('~'),
                Some('1') => out.push('/'),
                Some(other) => {
                    out.push('~');
                    out.push(other);
                }
                None => out.push('~'),
            }
        } else {
            out.push(ch);
        }
    }
    Ok(out)
}
