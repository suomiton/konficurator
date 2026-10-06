use crate::Span;
use serde::Serialize;

/// One grammar supplies both the form model and the spans used when saving.
#[derive(Debug, Clone, Serialize)]
pub struct Node {
    pub key: String,
    pub path: Vec<String>,
    pub kind: String,
    pub value: Option<String>,
    pub span: Span,
    pub children: Vec<Node>,
    pub quote: Option<char>,
}

impl Node {
    pub fn new(key: String, path: Vec<String>, kind: &str, span: Span) -> Self {
        Self {
            key,
            path,
            kind: kind.into(),
            value: None,
            span,
            children: Vec::new(),
            quote: None,
        }
    }
    pub fn find(&self, path: &[String]) -> Option<&Self> {
        if self.path == path {
            return Some(self);
        }
        self.children.iter().find_map(|child| child.find(path))
    }
}

pub trait BytePreservingParser {
    fn parse(&self, content: &str) -> Result<Node, String>;
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        self.parse(content).map(|_| ())
    }
    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        self.parse(content)?
            .find(path)
            .map(|node| node.span)
            .ok_or_else(|| format!("Path not found: {}", path.join("/")))
    }
    fn replace_value(&self, content: &str, span: Span, value: &str) -> String {
        splice(content, span, value)
    }
}

pub fn splice(content: &str, span: Span, value: &str) -> String {
    let mut out = String::with_capacity(content.len() - span.len() + value.len());
    out.push_str(&content[..span.start]);
    out.push_str(value);
    out.push_str(&content[span.end..]);
    out
}
