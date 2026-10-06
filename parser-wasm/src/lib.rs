use js_sys::Array;
use serde::Serialize;
use wasm_bindgen::prelude::*;

mod env_parser;
mod json_lexer;
mod json_parser;
mod model;
mod multi_validation;
mod positions;
#[cfg(test)]
mod roundtrip_tests;
mod schema;
#[cfg(test)]
mod tests;
mod xml_parser;

pub use env_parser::{validate_with_pos, EnvParser};
pub use json_parser::JsonParser;
pub use model::BytePreservingParser;
use model::{splice, Node};
use multi_validation::{DetailedError, MultiValidationResult, MAX_MULTI_ERRORS};
pub use xml_parser::XmlParser;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
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
    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }
}

// The generated package is the only TypeScript declaration of the WASM API.
#[wasm_bindgen(typescript_custom_section)]
const TYPES: &str = r#"
export interface ParseNode {
  key: string; path: string[]; kind: string; value: string | null;
  span: { start: number; end: number }; children: ParseNode[]; quote: string | null;
}
export interface ValidationError {
  message: string; code?: string; line: number; column: number; start: number; end: number;
}
export interface ValidationResult {
  valid: boolean; message?: string; line?: number; column?: number; start?: number; end?: number;
}
export interface MultiValidationResult {
  valid: boolean; errors: ValidationError[]; summary?: ValidationError | null;
}
export interface SchemaValidationError {
  message: string; keyword?: string | null; instancePath: string; schemaPath?: string | null;
  line?: number | null; column?: number | null; start?: number | null; end?: number | null;
}
export interface SchemaValidationResult { valid: boolean; errors: SchemaValidationError[]; }
export interface SchemaValidationOptions { maxErrors?: number; collectPositions?: boolean; draft?: string; }
"#;

pub fn parse_native(file_type: &str, content: &str) -> Result<Node, String> {
    match file_type.to_ascii_lowercase().as_str() {
        "json" => JsonParser.parse(content),
        "xml" | "config" => XmlParser.parse(content),
        "env" => EnvParser.parse(content),
        other => Err(format!("Unsupported file type: {other}")),
    }
}
#[wasm_bindgen(unchecked_return_type = "ParseNode")]
pub fn parse_tree(file_type: &str, content: &str) -> Result<JsValue, JsValue> {
    parse_native(file_type, content)
        .map(|node| to_js(&node))
        .map_err(|e| JsValue::from_str(&e))
}
fn read_path(path: JsValue) -> Result<Vec<String>, JsValue> {
    let array = path
        .dyn_into::<Array>()
        .map_err(|_| JsValue::from_str("Path must be an array of strings"))?;
    array
        .iter()
        .map(|v| {
            v.as_string()
                .ok_or_else(|| JsValue::from_str("Every path segment must be a string"))
        })
        .collect()
}
#[wasm_bindgen]
pub fn update_value(
    file_type: &str,
    content: &str,
    #[wasm_bindgen(unchecked_param_type = "string[]")] path: JsValue,
    new_val: &str,
) -> Result<String, JsValue> {
    update_native(file_type, content, &read_path(path)?, new_val).map_err(|e| JsValue::from_str(&e))
}
pub fn update_native(
    file_type: &str,
    content: &str,
    path: &[String],
    value: &str,
) -> Result<String, String> {
    let tree = parse_native(file_type, content)?;
    let node = tree
        .find(path)
        .ok_or_else(|| format!("Path not found: {}", path.join("/")))?;
    if node.value.as_deref() == Some(value) {
        return Ok(content.into());
    }
    let encoded = match node.kind.as_str() {
        "string" => serde_json::to_string(value).map_err(|e| e.to_string())?,
        "number" | "boolean" | "null" | "array" | "object"
            if file_type.eq_ignore_ascii_case("json") =>
        {
            let new_value: serde_json::Value =
                serde_json::from_str(value).map_err(|e| e.to_string())?;
            let same_kind = match node.kind.as_str() {
                "number" => new_value.is_number(),
                "boolean" => new_value.is_boolean(),
                "null" => new_value.is_null(),
                "array" => new_value.is_array(),
                "object" => new_value.is_object(),
                _ => false,
            };
            if !same_kind {
                return Err(format!("Expected a JSON {} value", node.kind));
            }
            value.into()
        }
        "env" => env_parser::encode(value, node.quote),
        "xml_text" | "xml_attribute" | "xml_cdata" | "xml_empty" => {
            xml_parser::encode(value, node)?
        }
        _ => return Err("Cannot replace a parent element's text".into()),
    };
    Ok(splice(content, node.span, &encoded))
}

/// Structural array edits splice only the item and its separator.
#[wasm_bindgen]
pub fn edit_array(
    content: &str,
    #[wasm_bindgen(unchecked_param_type = "string[]")] path: JsValue,
    index: Option<u32>,
    value: Option<String>,
) -> Result<String, JsValue> {
    edit_array_native(
        content,
        &read_path(path)?,
        index.map(|i| i as usize),
        value.as_deref(),
    )
    .map_err(|e| JsValue::from_str(&e))
}
pub fn edit_array_native(
    content: &str,
    path: &[String],
    index: Option<usize>,
    value: Option<&str>,
) -> Result<String, String> {
    let tree = JsonParser.parse(content)?;
    let node = tree
        .find(path)
        .filter(|n| n.kind == "array")
        .ok_or("Array not found")?;
    if let Some(index) = index {
        let child = node
            .children
            .get(index)
            .ok_or("Array index out of bounds")?;
        let span = if node.children.len() == 1 {
            child.span
        } else if index == 0 {
            Span::new(child.span.start, node.children[1].span.start)
        } else {
            Span::new(node.children[index - 1].span.end, child.span.end)
        };
        Ok(splice(content, span, ""))
    } else {
        let value = value.unwrap_or("\"\"");
        serde_json::from_str::<serde_json::Value>(value).map_err(|e| e.to_string())?;
        if let Some(last) = node.children.last() {
            let separator = if node.children.len() > 1 {
                &content[node.children[0].span.end..node.children[1].span.start]
            } else {
                ", "
            };
            let separator = if node.children.len() == 1
                && content[node.span.start..last.span.start].contains('\n')
            {
                let lead = &content[node.span.start + 1..last.span.start];
                format!(",{lead}")
            } else {
                separator.into()
            };
            Ok(splice(
                content,
                Span::new(last.span.end, last.span.end),
                &format!("{separator}{value}"),
            ))
        } else {
            Ok(splice(
                content,
                Span::new(node.span.start + 1, node.span.start + 1),
                value,
            ))
        }
    }
}

#[wasm_bindgen(unchecked_return_type = "ValidationResult")]
pub fn validate(file_type: &str, content: &str) -> JsValue {
    let result = validation_result(file_type, content, 1);
    let mut value = serde_json::json!({ "valid": result.valid });
    if let Some(summary) = result.summary {
        let fields = serde_json::to_value(summary).expect("serializable error");
        value
            .as_object_mut()
            .unwrap()
            .extend(fields.as_object().unwrap().clone());
    }
    to_js(&value)
}
#[wasm_bindgen(unchecked_return_type = "MultiValidationResult")]
pub fn validate_multi(file_type: &str, content: &str, max_errors: Option<u32>) -> JsValue {
    let cap = max_errors.unwrap_or(3).clamp(1, MAX_MULTI_ERRORS as u32) as usize;
    to_js(&validation_result(file_type, content, cap).with_limit(cap))
}
fn validation_result(file_type: &str, content: &str, cap: usize) -> MultiValidationResult {
    match file_type.to_ascii_lowercase().as_str() {
        "json" => multi_validation::validate_json_multi(content, cap),
        "xml" | "config" => multi_validation::validate_xml_multi(content, cap),
        "env" => env_parser::validate_multi(content, cap),
        other => invalid_result(DetailedError {
            message: format!("Unsupported file type: {other}"),
            code: None,
            line: 1,
            column: 1,
            span: Span::new(0, 0),
        }),
    }
}
pub(crate) fn invalid_result(summary: DetailedError) -> MultiValidationResult {
    MultiValidationResult {
        valid: false,
        errors: vec![summary.clone()],
        summary: Some(summary),
    }
}

#[wasm_bindgen(unchecked_return_type = "SchemaValidationResult")]
pub fn validate_schema(content: &str, schema: &str, options: Option<JsValue>) -> JsValue {
    schema::validate_schema_inline(content, schema, options)
}
#[wasm_bindgen(unchecked_return_type = "SchemaValidationResult")]
pub fn validate_schema_with_id(
    content: &str,
    schema_id: &str,
    #[wasm_bindgen(unchecked_param_type = "SchemaValidationOptions")] options: Option<JsValue>,
) -> JsValue {
    schema::validate_schema_with_id(content, schema_id, options)
}
#[wasm_bindgen]
pub fn register_schema(schema_id: &str, schema: &str) -> Result<(), JsValue> {
    schema::register_schema(schema_id, schema)
}

// Serialize result structs, rather than maintaining property-by-property JS objects.
pub(crate) fn to_js(value: &impl Serialize) -> JsValue {
    js_sys::JSON::parse(&serde_json::to_string(value).expect("serializable parser result"))
        .expect("valid serialized JSON")
}
pub(crate) fn compute_offset_from_line_col(content: &str, line: usize, column: usize) -> usize {
    positions::LineIndex::new(content).offset(line, column)
}
pub(crate) fn compute_line_col_from_offset(content: &str, offset: usize) -> (usize, usize) {
    positions::LineIndex::new(content).line_col(offset)
}
#[cfg(test)]
pub fn is_json_literal(value: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(value).is_ok_and(|v| !v.is_string())
}
