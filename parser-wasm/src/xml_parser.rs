// xml_parser.rs
// Uses: xmlparser = "0.13"

use crate::BytePreservingParser;
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

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<crate::Span, String> {
        let path = XmlPath::from(path);
        let attr_name = path.attribute.clone();
        let mut stack: Vec<String> = Vec::new();
        let mut awaiting_attribute = false;

        for token in Tokenizer::from(content) {
            match token {
                Ok(Token::ElementStart { local, .. }) => {
                    stack.push(local.to_string());
                    if stack == path.elements {
                        if attr_name.is_some() {
                            awaiting_attribute = true;
                        }
                    }
                }

                Ok(Token::Attribute { local, value, .. }) => {
                    if awaiting_attribute {
                        if let Some(attr) = attr_name.as_ref() {
                            if attr.as_str() == local.as_str() {
                                return Ok(crate::Span::new(value.start(), value.end()));
                            }
                        }
                    }
                }

                Ok(Token::ElementEnd { end, .. }) => {
                    if awaiting_attribute && matches!(end, ElementEnd::Open | ElementEnd::Empty) {
                        if let Some(attr) = attr_name.as_ref() {
                            return Err(format!("Attribute '{}' not found", attr));
                        }
                    }
                    if matches!(end, ElementEnd::Close(..) | ElementEnd::Empty) {
                        if stack == path.elements {
                            awaiting_attribute = false;
                        }
                        stack.pop();
                    }
                }

                Ok(Token::Text { text }) => {
                    if stack == path.elements && path.attribute.is_none() {
                        return Ok(crate::Span::new(text.start(), text.end()));
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

    fn replace_value(&self, content: &str, span: crate::Span, new_val: &str) -> String {
        let mut out = String::with_capacity(content.len() - span.len() + new_val.len());
        out.push_str(&content[..span.start]);
        out.push_str(new_val);
        out.push_str(&content[span.end..]);
        out
    }
}
