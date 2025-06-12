// xml_parser.rs
// Uses: xmlparser = "0.13"

use crate::{BytePreservingParser, Span};
use xmlparser::{ElementEnd, Token, Tokenizer};

pub struct XmlParser;
impl XmlParser {
    pub fn new() -> Self {
        Self
    }
}

// ─────────────────── PATH FORMAT ───────────────────

#[derive(Debug, Clone)]
struct XmlPath {
    elements: Vec<String>,
    attribute: Option<String>,
}
impl XmlPath {
    fn from(path: &[String]) -> Self {
        if path.last().map_or(false, |s| s.starts_with('@')) {
            let attr = path.last().unwrap().trim_start_matches('@').to_string();
            let elems = path[..path.len() - 1].to_vec();
            Self {
                elements: elems,
                attribute: Some(attr),
            }
        } else {
            Self {
                elements: path.to_vec(),
                attribute: None,
            }
        }
    }
}

// ──────────────── MAIN PARSER IMPL ────────────────

impl BytePreservingParser for XmlParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        let mut stack = Vec::new();
        for token in Tokenizer::from(content) {
            match token {
                Ok(Token::ElementStart { local, .. }) => stack.push(local.to_string()),
                Ok(Token::ElementEnd { end, .. }) => match end {
                    ElementEnd::Open => {} // no-op
                    ElementEnd::Close(..) | ElementEnd::Empty => {
                        stack.pop();
                    }
                },
                Err(e) => return Err(format!("XML parsing error: {e}")),
                _ => {}
            }
        }
        if !stack.is_empty() {
            return Err(format!("Unclosed tags: {:?}", stack));
        }
        Ok(())
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<crate::env_parser::Span, String> {
        let path = XmlPath::from(path);
        let mut stack: Vec<String> = Vec::new();
        let mut in_target = false;

        for token in Tokenizer::from(content) {
            match token {
                Ok(Token::ElementStart { local, span, .. }) => {
                    stack.push(local.to_string());
                    in_target = stack == path.elements;

                    if in_target {
                        if let Some(attr) = &path.attribute {
                            // Inline attribute scan
                            let mut attr_tok = Tokenizer::from(&content[span.start()..]);
                            while let Some(Ok(Token::Attribute { local, value, .. })) =
                                attr_tok.next()
                            {
                                if local.as_str() == attr {
                                    let val_span = Span::new(
                                        span.start() + value.start(),
                                        span.start() + value.end(),
                                    );
                                    return Ok(crate::env_parser::Span::new(val_span.start, val_span.end));
                                }
                            }
                            return Err(format!("Attribute '{}' not found", attr));
                        }
                    }
                }

                Ok(Token::ElementEnd { end, .. }) => {
                    if matches!(end, ElementEnd::Close(..) | ElementEnd::Empty) {
                        stack.pop();
                        in_target = false;
                    }
                }

                Ok(Token::Text { text }) => {
                    if in_target && path.attribute.is_none() {
                        return Ok(crate::env_parser::Span::new(text.start(), text.end()));
                    }
                }

                Err(e) => return Err(format!("XML parsing error: {e}")),
                _ => {}
            }
        }

        Err(format!(
            "Path not found: {}",
            path.elements.join("/")
                + &path
                    .attribute
                    .as_ref()
                    .map_or(String::new(), |a| format!("/@{a}"))
        ))
    }

    fn replace_value(&self, content: &str, span: crate::env_parser::Span, new_val: &str) -> String {
        let mut out = String::with_capacity(content.len() - span.len() + new_val.len());
        out.push_str(&content[..span.start]);
        out.push_str(new_val);
        out.push_str(&content[span.end..]);
        out
    }
}
