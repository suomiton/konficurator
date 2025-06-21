//! JSON‑parseri, joka käyttää omaa minitokenisoijaa span‑hakuihin.

use crate::json_lexer::{lex, validate, Kind};
use crate::{BytePreservingParser, Span};

pub struct JsonParser;
impl JsonParser {
    pub fn new() -> Self {
        Self
    }
}

// ────────── HELPER FUNCTIONS ──────────

fn find_matching_brace(
    tokens: &[crate::json_lexer::Token],
    start_idx: usize,
) -> Result<usize, String> {
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

fn find_matching_bracket(
    tokens: &[crate::json_lexer::Token],
    start_idx: usize,
) -> Result<usize, String> {
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
        let mut path_stack = Vec::<Seg>::new();
        let mut arr_idx_stack = Vec::<usize>::new();
        let mut expect_key: Option<String> = None;
        let mut i = 0;

        while i < tokens.len() {
            match tokens[i].kind {
                Kind::LBrace => {
                    if let Some(key) = expect_key.take() {
                        path_stack.push(Seg::Key(key));
                        // Check if this object is what we're looking for
                        if path_matches(&path_stack, path) {
                            // Find the matching closing brace
                            let start_pos = tokens[i].span.start;
                            let end_pos = find_matching_brace(&tokens, i)?;
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
                        // Check if this array is what we're looking for
                        if path_matches(&path_stack, path) {
                            // Find the matching closing bracket
                            let start_pos = tokens[i].span.start;
                            let end_pos = find_matching_bracket(&tokens, i)?;
                            return Ok(crate::Span::new(start_pos, end_pos));
                        }
                    }
                    arr_idx_stack.push(0);
                    path_stack.push(Seg::Idx(0));
                    i += 1;
                }
                Kind::RBrack => {
                    arr_idx_stack.pop();
                    // Pop the array index
                    if let Some(Seg::Idx(_)) = path_stack.last() {
                        path_stack.pop();
                    }
                    // Pop the array key as well
                    if let Some(Seg::Key(_)) = path_stack.last() {
                        path_stack.pop();
                    }
                    i += 1;
                }
                Kind::StringLit => {
                    if tokens.get(i + 1).map(|t| t.kind) == Some(Kind::Colon) {
                        // This is a key
                        let key_slice = &content[tokens[i].span.start + 1..tokens[i].span.end - 1];
                        expect_key = Some(key_slice.to_string());
                        i += 2;
                    } else {
                        if let Some(key) = expect_key.take() {
                            path_stack.push(Seg::Key(key));
                        }
                        // This is a string value
                        if path_matches(&path_stack, path) {
                            return Ok(crate::Span::new(tokens[i].span.start, tokens[i].span.end));
                        }
                        // After a primitive value, pop the key if present
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
                    // After a primitive value, pop the key if present
                    if let Some(Seg::Key(_)) = path_stack.last() {
                        path_stack.pop();
                    }
                    i += 1;
                }
                Kind::Comma => {
                    // For arrays, increment index
                    if let Some(last) = arr_idx_stack.last_mut() {
                        *last += 1;
                        if let Some(Seg::Idx(ref mut n)) = path_stack.last_mut() {
                            *n = *last;
                        }
                    }
                    // For objects, we don't need to do anything special -
                    // the next iteration will handle the next key
                    i += 1;
                }
                Kind::Colon => {
                    i += 1;
                }
            }
        }
        Err(format!("Path not found: {}", path.join("/")))
    }
}
