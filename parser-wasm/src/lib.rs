use js_sys::Array;
use wasm_bindgen::prelude::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

mod env_parser;
mod json_parser;
mod tests;
mod xml_parser;

pub use env_parser::EnvParser;
pub use json_parser::JsonParser;
pub use xml_parser::XmlParser;

/// Span represents a byte range in the original content
#[derive(Debug, Clone, Copy)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }
}

/// Edit represents a single mutation to apply
#[derive(Debug, Clone)]
pub struct Edit {
    pub range: std::ops::Range<usize>,
    pub replacement: String,
}

/// Trait for parsers that support byte-level round-trip mutations
pub trait BytePreservingParser {
    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String>;
    fn validate_syntax(&self, content: &str) -> Result<(), String>;
}

/// Apply a single edit to content, preserving all other bytes
pub fn apply_edit(content: &str, edit: Edit) -> String {
    let mut result = String::with_capacity(content.len() + edit.replacement.len());
    result.push_str(&content[..edit.range.start]);
    result.push_str(&edit.replacement);
    result.push_str(&content[edit.range.end..]);
    result
}

/// Update exactly one value and return the entire file buffer
/// with every other byte preserved.
///
/// * `file_type` – "json" | "xml" | "env"
/// * `content`   – full original file (UTF-8)
/// * `path`      – Vec<String>; JSON pointer components or
///                 XML tag/attribute segments; for .env just [KEY]
/// * `new_val`   – replacement value as UTF-8
///
/// Throws JsValue on any error (invalid syntax, path not found).
#[wasm_bindgen]
pub fn update_value(
    file_type: &str,
    content: &str,
    path: JsValue,
    new_val: &str,
) -> Result<String, JsValue> {
    // Convert JsValue array to Vec<String>
    let path_array: Array = path.into();
    let path: Vec<String> = path_array
        .iter()
        .map(|val| val.as_string().unwrap_or_default())
        .collect();

    if path.is_empty() {
        return Err(JsValue::from_str("Path cannot be empty"));
    }

    let result = match file_type.to_lowercase().as_str() {
        "json" => {
            let parser = JsonParser::new();
            parser
                .validate_syntax(content)
                .map_err(|e| JsValue::from_str(&e))?;
            let span = parser
                .find_value_span(content, &path)
                .map_err(|e| JsValue::from_str(&e))?;

            // For JSON, we need to properly quote strings
            let escaped_value = if new_val.parse::<f64>().is_ok()
                || new_val == "true"
                || new_val == "false"
                || new_val == "null"
            {
                new_val.to_string()
            } else {
                format!("\"{}\"", escape_json_string(new_val))
            };

            let edit = Edit {
                range: span.start..span.end,
                replacement: escaped_value,
            };
            apply_edit(content, edit)
        }
        "xml" | "config" => {
            let parser = XmlParser::new();
            parser
                .validate_syntax(content)
                .map_err(|e| JsValue::from_str(&e))?;
            let span = parser
                .find_value_span(content, &path)
                .map_err(|e| JsValue::from_str(&e))?;

            let escaped_value = escape_xml_string(new_val);
            let edit = Edit {
                range: span.start..span.end,
                replacement: escaped_value,
            };
            apply_edit(content, edit)
        }
        "env" => {
            let parser = EnvParser::new();
            parser
                .validate_syntax(content)
                .map_err(|e| JsValue::from_str(&e))?;
            let span = parser
                .find_value_span(content, &path)
                .map_err(|e| JsValue::from_str(&e))?;

            // For env files, determine if we need quotes
            let needs_quotes = new_val.contains(' ')
                || new_val.contains('#')
                || new_val.contains('\t')
                || new_val.contains('\n');

            let formatted_value = if needs_quotes {
                format!("\"{}\"", escape_env_string(new_val))
            } else {
                new_val.to_string()
            };

            let edit = Edit {
                range: span.start..span.end,
                replacement: formatted_value,
            };
            apply_edit(content, edit)
        }
        _ => {
            return Err(JsValue::from_str(&format!(
                "Unsupported file type: {}",
                file_type
            )))
        }
    };

    Ok(result)
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
    // Initialize any setup needed
}

#[cfg(test)]
mod lib_tests {
    use super::*;
    use std::fs;

    #[test]
    fn simple_test() {
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn test_json_parser_validation() {
        let content = fs::read_to_string("fixtures/test.json").expect("Failed to read test.json");
        let parser = JsonParser::new();
        assert!(parser.validate_syntax(&content).is_ok());

        // Test invalid JSON
        assert!(parser.validate_syntax("{ invalid").is_err());
    }

    #[test]
    fn test_json_parser_find_span() {
        let content = r#"{"name": "test", "age": 25}"#;
        let parser = JsonParser::new();

        let span = parser
            .find_value_span(content, &["name".to_string()])
            .unwrap();
        assert_eq!(&content[span.start..span.end], "\"test\"");

        let span = parser
            .find_value_span(content, &["age".to_string()])
            .unwrap();
        assert_eq!(&content[span.start..span.end], "25");
    }

    #[test]
    fn test_xml_parser_validation() {
        let content = fs::read_to_string("fixtures/test.xml").expect("Failed to read test.xml");
        let parser = XmlParser::new();
        assert!(parser.validate_syntax(&content).is_ok());

        // Test invalid XML - unclosed elements
        let invalid_xml = "<root><unclosed>";
        let result = parser.validate_syntax(invalid_xml);
        assert!(result.is_err()); // Should fail because elements are not closed
    }

    #[test]
    fn test_xml_parser_find_span() {
        let content = r#"<root><n>TestServer</n></root>"#;
        let parser = XmlParser::new();

        println!("Testing XML content: {}", content);
        let result = parser.find_value_span(content, &["root".to_string(), "n".to_string()]);

        match result {
            Ok(span) => {
                let found = &content[span.start..span.end];
                assert_eq!(found, "TestServer");
            }
            Err(e) => {
                // Let's also try finding just the root element
                let root_result = parser.find_value_span(content, &["root".to_string()]);
                println!("Root result: {:?}", root_result);
                panic!("Failed to find span: {}", e);
            }
        }
    }

    #[test]
    fn test_env_parser_validation() {
        let content = fs::read_to_string("fixtures/test.env").expect("Failed to read test.env");
        let parser = EnvParser::new();
        assert!(parser.validate_syntax(&content).is_ok());
    }

    #[test]
    fn test_env_parser_find_span() {
        let content = "DATABASE_URL=postgresql://localhost:5432/mydb\nDEBUG=true";
        let parser = EnvParser::new();

        let span = parser
            .find_value_span(content, &["DATABASE_URL".to_string()])
            .unwrap();
        assert_eq!(
            &content[span.start..span.end],
            "postgresql://localhost:5432/mydb"
        );

        let span = parser
            .find_value_span(content, &["DEBUG".to_string()])
            .unwrap();
        assert_eq!(&content[span.start..span.end], "true");
    }

    #[test]
    fn test_apply_edit() {
        let content = "Hello, World!";
        let edit = Edit {
            range: 7..12,
            replacement: "Rust".to_string(),
        };
        let result = apply_edit(content, edit);
        assert_eq!(result, "Hello, Rust!");
    }
}
