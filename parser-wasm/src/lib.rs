use js_sys::Array;
use serde_json::Value;
use wasm_bindgen::prelude::*;
use xmlparser::{Error as XmlError, Tokenizer};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

mod env_parser;
mod json_lexer;
mod json_parser;
mod multi_validation;
mod schema;
mod xml_parser;

#[cfg(test)]
mod tests;

pub use env_parser::EnvParser;
pub use json_parser::JsonParser;
use multi_validation::{
    infer_json_span, validate_json_multi, validate_xml_multi, DetailedError, MultiValidationResult,
    MAX_MULTI_ERRORS,
};
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

#[wasm_bindgen]
pub fn update_value(
    file_type: &str,
    content: &str,
    path: JsValue,
    new_val: &str,
) -> Result<String, JsValue> {
    let path: Vec<String> = if let Ok(js_array) = path.dyn_into::<Array>() {
        js_array
            .iter()
            .map(|val| val.as_string().unwrap_or_default())
            .collect()
    } else {
        return Err(JsValue::from_str(
            "Invalid path: must be an array of strings",
        ));
    };

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

            let escaped_value = if is_json_literal(new_val) {
                new_val.to_string()
            } else {
                format!("\"{}\"", escape_json_string(new_val))
            };

            Ok(parser.replace_value(content, span, &escaped_value))
        }

        "xml" | "config" => {
            let parser = XmlParser::new();
            parser
                .validate_syntax(content)
                .map_err(|e| JsValue::from_str(&e))?;
            let span = parser
                .find_value_span(content, &path)
                .map_err(|e| JsValue::from_str(&e))?;
            Ok(parser.replace_value(content, span, &escape_xml_string(new_val)))
        }

        "env" => {
            let parser = EnvParser::new();
            parser
                .validate_syntax(content)
                .map_err(|e| JsValue::from_str(&e))?;
            let span = parser
                .find_value_span(content, &path)
                .map_err(|e| JsValue::from_str(&e))?;

            let needs_quotes = new_val.contains([' ', '#', '\n', '\t']);
            let val = if needs_quotes {
                format!("\"{}\"", escape_env_string(new_val))
            } else {
                new_val.to_string()
            };

            Ok(parser.replace_value(content, span, &val))
        }

        other => Err(JsValue::from_str(&format!(
            "Unsupported file type: {}",
            other
        ))),
    }?;

    Ok(result)
}

#[wasm_bindgen]
pub fn validate(file_type: &str, content: &str) -> JsValue {
    let ty = file_type.to_lowercase();
    let obj = js_sys::Object::new();

    // Default: assume valid=false until proven valid
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("valid"),
        &JsValue::from_bool(false),
    );

    match ty.as_str() {
        "json" => match serde_json::from_str::<serde_json::Value>(content) {
            Ok(_) => {
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("valid"),
                    &JsValue::from_bool(true),
                );
            }
            Err(e) => {
                let msg = e.to_string();
                let line = e.line();
                let column = e.column();
                let start = compute_offset_from_line_col(content, line as usize, column as usize);
                let span = infer_json_span(content, start);
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("message"),
                    &JsValue::from_str(&msg),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("line"),
                    &JsValue::from_f64(line as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("column"),
                    &JsValue::from_f64(column as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("start"),
                    &JsValue::from_f64(span.start as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("end"),
                    &JsValue::from_f64(span.end as f64),
                );
            }
        },
        "xml" | "config" => {
            // Iterate tokens and stop at first error to get precise position
            let mut err: Option<XmlError> = None;
            for tok in Tokenizer::from(content) {
                if let Err(e) = tok {
                    err = Some(e);
                    break;
                }
            }
            if let Some(e) = err {
                let msg = e.to_string();
                let pos = e.pos();
                let line = pos.row;
                let column = pos.col;
                let start = compute_offset_from_line_col(content, line as usize, column as usize);
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("message"),
                    &JsValue::from_str(&msg),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("line"),
                    &JsValue::from_f64(line as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("column"),
                    &JsValue::from_f64(column as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("start"),
                    &JsValue::from_f64(start as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("end"),
                    &JsValue::from_f64(start as f64),
                );
            } else {
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("valid"),
                    &JsValue::from_bool(true),
                );
            }
        }
        "env" => match env_parser::validate_with_pos(content) {
            Ok(_) => {
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("valid"),
                    &JsValue::from_bool(true),
                );
            }
            Err(e) => {
                let start =
                    compute_offset_from_line_col(content, e.line as usize, e.column as usize);
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("message"),
                    &JsValue::from_str(&e.msg),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("line"),
                    &JsValue::from_f64(e.line as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("column"),
                    &JsValue::from_f64(e.column as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("start"),
                    &JsValue::from_f64(start as f64),
                );
                let _ = js_sys::Reflect::set(
                    &obj,
                    &JsValue::from_str("end"),
                    &JsValue::from_f64(start as f64),
                );
            }
        },
        other => {
            let _ = js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("message"),
                &JsValue::from_str(&format!("Unsupported file type: {}", other)),
            );
        }
    }

    obj.into()
}

#[wasm_bindgen]
pub fn validate_multi(file_type: &str, content: &str, max_errors: Option<u32>) -> JsValue {
    let ty = file_type.to_lowercase();
    let cap = max_errors.unwrap_or(3).clamp(1, MAX_MULTI_ERRORS as u32) as usize;
    let result = match ty.as_str() {
        "json" => validate_json_multi(content, cap),
        "xml" | "config" => validate_xml_multi(content, cap),
        "env" => env_multi_result(content),
        other => unsupported_multi_result(other),
    };
    multi_result_to_js(result.with_limit(cap))
}

#[wasm_bindgen]
pub fn validate_schema(content: &str, schema: &str, options: Option<JsValue>) -> JsValue {
    schema::validate_schema_inline(content, schema, options)
}

#[wasm_bindgen]
pub fn validate_schema_with_id(
    content: &str,
    schema_id: &str,
    options: Option<JsValue>,
) -> JsValue {
    schema::validate_schema_with_id(content, schema_id, options)
}

#[wasm_bindgen]
pub fn register_schema(schema_id: &str, schema: &str) -> Result<(), JsValue> {
    schema::register_schema(schema_id, schema)
}

fn multi_result_to_js(result: MultiValidationResult) -> JsValue {
    let obj = js_sys::Object::new();
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("valid"),
        &JsValue::from_bool(result.valid),
    );

    let errors = Array::new();
    for err in &result.errors {
        errors.push(&detailed_error_to_js(err));
    }
    let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("errors"), &errors);

    if let Some(summary) = &result.summary {
        let summary_obj = js_sys::Object::new();
        set_summary_fields(&summary_obj, summary);
        let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("summary"), &summary_obj);
    }

    obj.into()
}

fn detailed_error_to_js(err: &DetailedError) -> JsValue {
    let obj = js_sys::Object::new();
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("message"),
        &JsValue::from_str(&err.message),
    );
    if let Some(code) = err.code {
        let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("code"), &JsValue::from_str(code));
    }
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("line"),
        &JsValue::from_f64(err.line as f64),
    );
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("column"),
        &JsValue::from_f64(err.column as f64),
    );
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("start"),
        &JsValue::from_f64(err.span.start as f64),
    );
    let _ = js_sys::Reflect::set(
        &obj,
        &JsValue::from_str("end"),
        &JsValue::from_f64(err.span.end as f64),
    );
    obj.into()
}

fn set_summary_fields(obj: &js_sys::Object, summary: &DetailedError) {
    let _ = js_sys::Reflect::set(
        obj,
        &JsValue::from_str("message"),
        &JsValue::from_str(&summary.message),
    );
    let _ = js_sys::Reflect::set(
        obj,
        &JsValue::from_str("line"),
        &JsValue::from_f64(summary.line as f64),
    );
    let _ = js_sys::Reflect::set(
        obj,
        &JsValue::from_str("column"),
        &JsValue::from_f64(summary.column as f64),
    );
    let _ = js_sys::Reflect::set(
        obj,
        &JsValue::from_str("start"),
        &JsValue::from_f64(summary.span.start as f64),
    );
    let _ = js_sys::Reflect::set(
        obj,
        &JsValue::from_str("end"),
        &JsValue::from_f64(summary.span.end as f64),
    );
}

fn env_multi_result(content: &str) -> MultiValidationResult {
    match env_parser::validate_with_pos(content) {
        Ok(_) => MultiValidationResult::success(),
        Err(e) => {
            let start = compute_offset_from_line_col(content, e.line as usize, e.column as usize);
            let summary = DetailedError {
                message: e.msg,
                code: None,
                line: e.line as usize,
                column: e.column as usize,
                span: Span::new(start, start),
            };
            invalid_summary_result(summary)
        }
    }
}

fn unsupported_multi_result(file_type: &str) -> MultiValidationResult {
    let summary = DetailedError {
        message: format!("Unsupported file type: {}", file_type),
        code: None,
        line: 1,
        column: 1,
        span: Span::new(0, 0),
    };
    invalid_summary_result(summary)
}

fn invalid_summary_result(summary: DetailedError) -> MultiValidationResult {
    MultiValidationResult {
        valid: false,
        summary: Some(summary.clone()),
        errors: vec![summary],
    }
}

pub(crate) fn compute_offset_from_line_col(content: &str, line: usize, column: usize) -> usize {
    // Lines/columns are 1-based per serde_json/xmlparser conventions
    let mut current_line = 1usize;
    let mut offset = 0usize;
    for (idx, ch) in content.char_indices() {
        if current_line == line {
            // column indicates the character position within the line (1-based)
            // Convert to byte offset: find the byte index at given column
            let mut col = 1usize;
            let mut i = idx;
            // Walk forward within this line to the requested column
            while i < content.len() {
                if col == column {
                    return i;
                }
                let c = content[i..].chars().next().unwrap();
                if c == '\n' || c == '\r' {
                    // End of line reached before desired column
                    return i;
                }
                i += c.len_utf8();
                col += 1;
            }
            return i;
        }
        if ch == '\n' {
            current_line += 1;
            offset = idx + 1;
            if current_line > line {
                break;
            }
        }
    }
    // Fallback to last known offset
    offset
}

pub(crate) fn compute_line_col_from_offset(content: &str, offset: usize) -> (usize, usize) {
    let clamped = offset.min(content.len());
    let mut line = 1usize;
    let mut column = 1usize;
    for (idx, ch) in content.char_indices() {
        if idx >= clamped {
            return (line, column);
        }
        if ch == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    (line, column)
}

pub fn is_json_literal(s: &str) -> bool {
    // Check for basic JSON literals
    if matches!(s, "true" | "false" | "null") {
        return true;
    }

    if let Ok(value) = serde_json::from_str::<Value>(s) {
        return matches!(value, Value::Number(_) | Value::Array(_) | Value::Object(_));
    }

    false
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

#[cfg_attr(not(test), wasm_bindgen(start))]
pub fn main() {
    // WASM init hook
}

// Ensure the trait is imported at the top of the file so methods are in scope
use crate::env_parser::BytePreservingParser;
