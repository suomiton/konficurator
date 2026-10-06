//! XML spans, qualified names and indexed siblings from one token walk.
use crate::model::Node;
use crate::{BytePreservingParser, Span};
use xmlparser::{ElementEnd, Token, Tokenizer};

#[derive(Default)]
pub struct XmlParser;
impl XmlParser {
    pub fn new() -> Self {
        Self
    }
}
#[derive(Debug)]
pub(crate) struct XmlIssue {
    pub message: String,
    pub code: &'static str,
    pub start: usize,
}
impl BytePreservingParser for XmlParser {
    fn parse(&self, content: &str) -> Result<Node, String> {
        parse_xml(content).map_err(|e| e.message)
    }
    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        let tree = self.parse(content)?;
        let node = tree
            .find(path)
            .ok_or_else(|| format!("Path not found: {}", path.join("/")))?;
        if node.value.is_none() {
            return Err("Cannot replace a parent element's text".into());
        }
        Ok(node.span)
    }
}
struct Element {
    node: Node,
    open_end: usize,
}
fn qualified(prefix: &str, local: &str) -> String {
    if prefix.is_empty() {
        local.into()
    } else {
        format!("{prefix}:{local}")
    }
}
pub(crate) fn parse_xml(content: &str) -> Result<Node, XmlIssue> {
    let mut root = Node::new(String::new(), vec![], "object", Span::new(0, content.len()));
    let mut stack: Vec<Element> = Vec::new();
    for token in Tokenizer::from(content) {
        let token = token.map_err(|error| XmlIssue {
            start: crate::compute_offset_from_line_col(
                content,
                error.pos().row as usize,
                error.pos().col as usize,
            ),
            message: error.to_string(),
            code: "xml.parse_error",
        })?;
        match token {
            Token::ElementStart {
                prefix,
                local,
                span,
            } => {
                stack.push(Element {
                    node: Node::new(
                        qualified(prefix.as_str(), local.as_str()),
                        vec![],
                        "xml_element",
                        Span::new(span.start(), span.end()),
                    ),
                    open_end: span.end(),
                });
            }
            Token::Attribute {
                prefix,
                local,
                value,
                ..
            } => {
                let element = stack.last_mut().unwrap();
                let key = format!("@{}", qualified(prefix.as_str(), local.as_str()));
                if element.node.children.iter().any(|n| n.key == key) {
                    return Err(XmlIssue {
                        message: format!("Duplicate attribute: {key}"),
                        code: "xml.duplicate_attribute",
                        start: value.start(),
                    });
                }
                let mut attr = Node::new(
                    key,
                    vec![],
                    "xml_attribute",
                    Span::new(value.start(), value.end()),
                );
                attr.value = Some(decode_entities(value.as_str()).map_err(|message| XmlIssue {
                    message,
                    code: "xml.invalid_entity",
                    start: value.start(),
                })?);
                attr.quote = content[..value.start()].chars().next_back();
                element.node.children.push(attr);
            }
            Token::ElementEnd {
                end: ElementEnd::Open,
                span,
            } => {
                stack.last_mut().unwrap().open_end = span.end();
            }
            Token::ElementEnd { end, span } => {
                let mut element = stack.pop().ok_or_else(|| XmlIssue {
                    message: "Unexpected closing tag".into(),
                    code: "xml.mismatched_tag",
                    start: span.start(),
                })?;
                if let ElementEnd::Close(prefix, local) = end {
                    let closing = qualified(prefix.as_str(), local.as_str());
                    if element.node.key != closing {
                        return Err(XmlIssue {
                            message: format!(
                                "Expected </{}>, found </{closing}>",
                                element.node.key
                            ),
                            code: "xml.mismatched_tag",
                            start: span.start(),
                        });
                    }
                }
                let has_elements = element
                    .node
                    .children
                    .iter()
                    .any(|n| n.kind == "xml_element" || !n.key.starts_with(['@', '#']));
                let texts: Vec<usize> = element
                    .node
                    .children
                    .iter()
                    .enumerate()
                    .filter_map(|(i, n)| (n.key == "#text").then_some(i))
                    .collect();
                if !has_elements
                    && texts.len() > 1
                    && texts
                        .iter()
                        .all(|i| element.node.children[*i].kind == "xml_cdata")
                    && texts.windows(2).all(|pair| {
                        content[element.node.children[pair[0]].span.end
                            ..element.node.children[pair[1]].span.start]
                            == *"]]><![CDATA["
                    })
                {
                    let first = element.node.children[texts[0]].span.start;
                    let last = element.node.children[*texts.last().unwrap()].span.end;
                    let value = texts
                        .iter()
                        .map(|i| element.node.children[*i].value.as_deref().unwrap_or(""))
                        .collect::<String>();
                    element.node.children.retain(|n| n.key != "#text");
                    let mut text =
                        Node::new("#text".into(), vec![], "xml_cdata", Span::new(first, last));
                    text.value = Some(value);
                    element.node.children.push(text);
                }
                let texts: Vec<usize> = element
                    .node
                    .children
                    .iter()
                    .enumerate()
                    .filter_map(|(i, n)| (n.key == "#text").then_some(i))
                    .collect();
                if !has_elements && texts.len() <= 1 {
                    if let Some(index) = texts.first() {
                        let text = element.node.children.remove(*index);
                        element.node.value = text.value;
                        element.node.kind = text.kind;
                        element.node.span = text.span;
                    } else {
                        element.node.value = Some(String::new());
                        element.node.kind = if matches!(end, ElementEnd::Empty) {
                            "xml_empty"
                        } else {
                            "xml_text"
                        }
                        .into();
                        element.node.span = if matches!(end, ElementEnd::Empty) {
                            Span::new(span.start(), span.end())
                        } else {
                            Span::new(element.open_end, element.open_end)
                        };
                    }
                } else {
                    element.node.span.end = span.end();
                }
                if let Some(parent) = stack.last_mut() {
                    parent.node.children.push(element.node);
                } else {
                    root.children.push(element.node);
                }
            }
            Token::Text { text } => {
                if let Some(element) = stack.last_mut() {
                    let raw = text.as_str();
                    let trimmed = raw.trim();
                    let start = text.start() + raw.len() - raw.trim_start().len();
                    let mut node = Node::new(
                        "#text".into(),
                        vec![],
                        "xml_text",
                        Span::new(start, start + trimmed.len()),
                    );
                    node.value = Some(decode_entities(trimmed).map_err(|message| XmlIssue {
                        message,
                        code: "xml.invalid_entity",
                        start,
                    })?);
                    // Formatting whitespace is never a parent value.
                    if !trimmed.is_empty() {
                        element.node.children.push(node);
                    }
                }
            }
            Token::Cdata { text, .. } => {
                if let Some(element) = stack.last_mut() {
                    let mut node = Node::new(
                        "#text".into(),
                        vec![],
                        "xml_cdata",
                        Span::new(text.start(), text.end()),
                    );
                    node.value = Some(text.as_str().into());
                    element.node.children.push(node);
                }
            }
            _ => {}
        }
    }
    if !stack.is_empty() || root.children.len() != 1 {
        return Err(XmlIssue {
            message: "XML requires one complete root element".into(),
            code: "xml.unclosed_tag",
            start: content.len(),
        });
    }
    assign_paths(&mut root);
    Ok(root)
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
        if counts[&child.key] > 1 || child.key == "#text" {
            let index = seen.entry(child.key.clone()).or_insert(0usize);
            child.path.push(index.to_string());
            *index += 1;
        }
        assign_paths(child);
    }
}
fn decode_entities(text: &str) -> Result<String, String> {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('&') {
        out.push_str(&rest[..start]);
        rest = &rest[start + 1..];
        let end = rest.find(';').ok_or("Unterminated XML entity")?;
        let entity = &rest[..end];
        let c = match entity {
            "amp" => '&',
            "lt" => '<',
            "gt" => '>',
            "quot" => '"',
            "apos" => '\'',
            _ => {
                let number = if let Some(hex) = entity.strip_prefix("#x") {
                    u32::from_str_radix(hex, 16).ok()
                } else {
                    entity.strip_prefix('#').and_then(|s| s.parse::<u32>().ok())
                };
                number
                    .and_then(char::from_u32)
                    .filter(|c| valid_xml_char(*c))
                    .ok_or_else(|| format!("Unsupported XML entity: &{entity};"))?
            }
        };
        out.push(c);
        rest = &rest[end + 1..];
    }
    out.push_str(rest);
    Ok(out)
}
fn valid_xml_char(c: char) -> bool {
    matches!(c, '\t' | '\n' | '\r') || (c >= '\u{20}' && c != '\u{fffe}' && c != '\u{ffff}')
}
pub(crate) fn encode(value: &str, node: &Node) -> Result<String, String> {
    if !value.chars().all(valid_xml_char) {
        return Err("Invalid XML control character".into());
    }
    if node.kind == "xml_cdata" {
        return Ok(value.replace("]]>", "]]]]><![CDATA[>"));
    }
    let mut out = value.replace('&', "&amp;").replace('<', "&lt;");
    if node.kind == "xml_attribute" {
        out = if node.quote == Some('\'') {
            out.replace('\'', "&apos;")
        } else {
            out.replace('"', "&quot;")
        };
        out = out
            .replace('\n', "&#10;")
            .replace('\r', "&#13;")
            .replace('\t', "&#9;");
    } else {
        out = out.replace("]]>", "]]&gt;");
    }
    if node.kind == "xml_empty" {
        out = format!(">{out}</{}>", node.key);
    }
    Ok(out)
}
