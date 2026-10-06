//! Strict JSON parsing with token spans and decoded keys.
use crate::json_lexer::{lex, Kind, Token};
use crate::model::Node;
use crate::{BytePreservingParser, Span};

#[derive(Default)]
pub struct JsonParser;
impl JsonParser {
    pub fn new() -> Self {
        Self
    }
}
impl BytePreservingParser for JsonParser {
    fn parse(&self, content: &str) -> Result<Node, String> {
        serde_json::from_str::<serde_json::Value>(content.trim_start_matches('\u{feff}'))
            .map_err(|e| e.to_string())?;
        let tokens = lex(content)?;
        let mut node = parse_node(content, &tokens, &mut 0, String::new(), Vec::new())?;
        assign_paths(&mut node);
        Ok(node)
    }
}
fn parse_node(
    content: &str,
    tokens: &[Token],
    index: &mut usize,
    key: String,
    path: Vec<String>,
) -> Result<Node, String> {
    let token = tokens.get(*index).ok_or("Missing JSON value")?;
    *index += 1;
    let kind = match token.kind {
        Kind::LBrace => "object",
        Kind::LBrack => "array",
        Kind::StringLit => "string",
        Kind::NumberLit => "number",
        Kind::True | Kind::False => "boolean",
        Kind::Null => "null",
        _ => return Err("Expected JSON value".into()),
    };
    let mut node = Node::new(key, path, kind, token.span);
    if matches!(kind, "object" | "array") {
        let close = if kind == "object" {
            Kind::RBrace
        } else {
            Kind::RBrack
        };
        while tokens[*index].kind != close {
            let key = if kind == "object" {
                let key_token = tokens[*index];
                *index += 2;
                serde_json::from_str::<String>(&content[key_token.span.start..key_token.span.end])
                    .map_err(|e| e.to_string())?
            } else {
                node.children.len().to_string()
            };
            let mut child_path = node.path.clone();
            child_path.push(key.clone());
            node.children
                .push(parse_node(content, tokens, index, key, child_path)?);
            if tokens[*index].kind == Kind::Comma {
                *index += 1;
            }
        }
        node.span.end = tokens[*index].span.end;
        *index += 1;
    } else {
        let raw = &content[token.span.start..token.span.end];
        node.value = Some(if kind == "string" {
            serde_json::from_str::<String>(raw).map_err(|e| e.to_string())?
        } else {
            raw.into()
        });
    }
    Ok(node)
}
pub struct JsonSpanResolver {
    tree: Node,
}
impl JsonSpanResolver {
    pub fn new(content: &str) -> Result<Self, String> {
        Ok(Self {
            tree: JsonParser.parse(content)?,
        })
    }
    pub fn span_for_pointer(&self, pointer: &str) -> Result<Span, String> {
        if !pointer.is_empty() && !pointer.starts_with('/') {
            return Err("Invalid JSON Pointer".into());
        }
        let path: Vec<String> = if pointer.is_empty() {
            vec![]
        } else {
            pointer[1..]
                .split('/')
                .map(|s| s.replace("~1", "/").replace("~0", "~"))
                .collect()
        };
        self.tree
            .find(&path)
            .map(|node| node.span)
            .ok_or_else(|| format!("Path not found: {pointer}"))
    }
}

fn assign_paths(parent: &mut Node) {
    let mut counts = std::collections::HashMap::new();
    for child in &parent.children {
        *counts.entry(child.key.clone()).or_insert(0usize) += 1;
    }
    let mut seen = std::collections::HashMap::new();
    for child in &mut parent.children {
        child.path = parent.path.clone();
        child.path.push(child.key.clone());
        if counts[&child.key] > 1 {
            let index = seen.entry(child.key.clone()).or_insert(0usize);
            child.path.push(index.to_string());
            *index += 1;
        }
        assign_paths(child);
    }
}
