//! JSON‑parseri, joka käyttää omaa minitokenisoijaa span‑hakuihin.

use crate::json_lexer::{lex, validate, Kind};
use crate::{BytePreservingParser, Span};

pub struct JsonParser;
impl JsonParser {
    pub fn new() -> Self {
        Self
    }
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
                    }
                    arr_idx_stack.push(0);
                    path_stack.push(Seg::Idx(0));
                    i += 1;
                }
                Kind::RBrack => {
                    arr_idx_stack.pop();
                    path_stack.pop();
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
