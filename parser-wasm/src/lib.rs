use js_sys::Array;
use wasm_bindgen::prelude::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

mod env_parser;
mod json_parser;
mod xml_parser;

pub use env_parser::EnvParser;
pub use json_parser::JsonParser;
pub use xml_parser::XmlParser;

/// Span represents a byte range in the original content
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }

    pub fn len(&self) -> usize {
        self.end - self.start
    }
}

/// Trait for parsers that support byte-level round-trip mutations
pub trait BytePreservingParser {
    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String>;
    fn validate_syntax(&self, content: &str) -> Result<(), String>;

    fn replace_value(&self, content: &str, span: Span, new_val: &str) -> String {
        let mut result = String::with_capacity(content.len() - span.len() + new_val.len());
        result.push_str(&content[..span.start]);
        result.push_str(new_val);
        result.push_str(&content[span.end..]);
        result
    }
}

#[wasm_bindgen]
pub fn update_value(
    file_type: &str,
    content: &str,
    path: JsValue,
    new_val: &str,
) -> Result<String, JsValue> {
    let path: Vec<String> = if let Ok(js_array) = path.dyn_into::<Array>() {
        js_array.iter().map(|val| val.as_string().unwrap_or_default()).collect()
    } else {
        return Err(JsValue::from_str("Invalid path: must be an array of strings"));
    };

    if path.is_empty() {
        return Err(JsValue::from_str("Path cannot be empty"));
    }

    let result = match file_type.to_lowercase().as_str() {
        "json" => {
            let parser = JsonParser::new();
            parser.validate_syntax(content).map_err(JsValue::from_str)?;
            let span = parser.find_value_span(content, &path).map_err(JsValue::from_str)?;

            let escaped_value = if is_json_literal(new_val) {
                new_val.to_string()
            } else {
                format!("\"{}\"", escape_json_string(new_val))
            };

            Ok(parser.replace_value(content, span, &escaped_value))
        }

        "xml" | "config" => {
            let parser = XmlParser::new();
            parser.validate_syntax(content).map_err(JsValue::from_str)?;
            let span = parser.find_value_span(content, &path).map_err(JsValue::from_str)?;
            Ok(parser.replace_value(content, span, &escape_xml_string(new_val)))
        }

        "env" => {
            let parser = EnvParser::new();
            parser.validate_syntax(content).map_err(JsValue::from_str)?;
            let span = parser.find_value_span(content, &path).map_err(JsValue::from_str)?;

            let needs_quotes = new_val.contains([' ', '#', '\n', '\t']);
            let val = if needs_quotes {
                format!("\"{}\"", escape_env_string(new_val))
            } else {
                new_val.to_string()
            };

            Ok(parser.replace_value(content, span, &val))
        }

        other => Err(JsValue::from_str(&format!("Unsupported file type: {}", other))),
    }?;

    Ok(result)
}

fn is_json_literal(s: &str) -> bool {
    matches!(s, "true" | "false" | "null") || s.parse::<f64>().map_or(false, |v| v.to_string() == s)
}

fn escape_json_string(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '"' => "\\\"".to_string(),
            '\\' => "\\\\".to_string(),
            '\n' => "\\n".to_string(),
            '\r' => "\\r".to_string(),
            '\t' => "\\t".to_string(),
            c if c.is_control() => format!("\\u{:04x}", c as u32),
            c => c.to_string(),
        })
        .collect()
}

fn escape_xml_string(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '&' => "&amp;".to_string(),
            '<' => "&lt;".to_string(),
            '>' => "&gt;".to_string(),
            '"' => "&quot;".to_string(),
            '\'' => "&apos;".to_string(),
            c => c.to_string(),
        })
        .collect()
}

fn escape_env_string(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '"' => "\\\"".to_string(),
            '\\' => "\\\\".to_string(),
            '\n' => "\\n".to_string(),
            '\r' => "\\r".to_string(),
            '\t' => "\\t".to_string(),
            c => c.to_string(),
        })
        .collect()
}

#[wasm_bindgen(start)]
pub fn main() {
    // WASM init hook
}
