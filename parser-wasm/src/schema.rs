use crate::json_parser::JsonSpanResolver;
use crate::multi_validation::infer_json_span;
use crate::{compute_line_col_from_offset, compute_offset_from_line_col, Span};
use js_sys::{Array, Object, Reflect};
use jsonschema::error::{ValidationError, ValidationErrorKind};
use jsonschema::{Draft, JSONSchema};
use once_cell::sync::Lazy;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use wasm_bindgen::JsValue;

const DEFAULT_MAX_SCHEMA_ERRORS: usize = 50;
const MAX_SCHEMA_ERROR_CAP: usize = 200;

static SCHEMA_CACHE: Lazy<Mutex<HashMap<String, Arc<JSONSchema>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone)]
pub(crate) struct SchemaValidationOptions {
    pub(crate) max_errors: usize,
    pub(crate) collect_positions: bool,
    pub(crate) draft: Option<Draft>,
}

impl Default for SchemaValidationOptions {
    fn default() -> Self {
        Self {
            max_errors: DEFAULT_MAX_SCHEMA_ERRORS,
            collect_positions: true,
            draft: None,
        }
    }
}

impl SchemaValidationOptions {
    pub(crate) fn from_js(value: Option<JsValue>) -> Self {
        let mut opts = Self::default();
        if let Some(js) = value {
            if js.is_object() && !js.is_null() {
                let obj = Object::from(js);
                if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("maxErrors")) {
                    if let Some(num) = val.as_f64() {
                        if num.is_finite() && num > 0.0 {
                            opts.max_errors = num as usize;
                        }
                    }
                }
                if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("collectPositions")) {
                    if let Some(flag) = val.as_bool() {
                        opts.collect_positions = flag;
                    }
                }
                if let Ok(val) = Reflect::get(&obj, &JsValue::from_str("draft")) {
                    if let Some(label) = val.as_string() {
                        opts.draft = parse_draft_label(&label);
                    }
                }
            }
        }
        opts.max_errors = opts.max_errors.clamp(1, MAX_SCHEMA_ERROR_CAP);
        opts
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SchemaErrorDescriptor {
    pub(crate) message: String,
    pub(crate) keyword: Option<String>,
    pub(crate) instance_path: String,
    pub(crate) schema_path: Option<String>,
    pub(crate) line: Option<usize>,
    pub(crate) column: Option<usize>,
    pub(crate) start: Option<usize>,
    pub(crate) end: Option<usize>,
}

#[derive(Debug, Clone)]
pub(crate) struct SchemaValidationOutcome {
    pub(crate) valid: bool,
    pub(crate) errors: Vec<SchemaErrorDescriptor>,
}

impl SchemaValidationOutcome {
    fn success() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
        }
    }

    fn from_errors(errors: Vec<SchemaErrorDescriptor>) -> Self {
        let valid = errors.is_empty();
        Self { valid, errors }
    }
}

#[derive(Debug, Clone)]
struct SyntaxErrorDetail {
    message: String,
    line: usize,
    column: usize,
    span: Span,
}

pub(crate) fn validate_schema_inline(
    content: &str,
    schema: &str,
    options: Option<JsValue>,
) -> JsValue {
    let opts = SchemaValidationOptions::from_js(options);
    let instance_value = match parse_instance(content) {
        Ok(val) => val,
        Err(detail) => {
            return schema_outcome_to_js(schema_outcome_from_syntax(detail, &opts));
        }
    };

    let schema_value = match serde_json::from_str::<Value>(schema) {
        Ok(val) => val,
        Err(err) => {
            return schema_outcome_to_js(schema_issue_outcome(format!(
                "Schema parse error: {err}"
            )));
        }
    };

    let compiled = match compile_schema(&schema_value, opts.draft) {
        Ok(schema) => schema,
        Err(err) => {
            return schema_outcome_to_js(schema_issue_outcome(format!(
                "Schema compilation failed: {err}"
            )));
        }
    };

    let outcome = schema_validate_instance(&compiled, &instance_value, content, &opts);
    schema_outcome_to_js(outcome)
}

pub(crate) fn validate_schema_with_id(
    content: &str,
    schema_id: &str,
    options: Option<JsValue>,
) -> JsValue {
    let opts = SchemaValidationOptions::from_js(options);
    let instance_value = match parse_instance(content) {
        Ok(val) => val,
        Err(detail) => {
            return schema_outcome_to_js(schema_outcome_from_syntax(detail, &opts));
        }
    };

    let schema = match get_cached_schema(schema_id) {
        Some(schema) => schema,
        None => {
            return schema_outcome_to_js(schema_issue_outcome(format!(
                "Schema '{schema_id}' is not registered"
            )));
        }
    };

    let outcome = schema_validate_instance(schema.as_ref(), &instance_value, content, &opts);
    schema_outcome_to_js(outcome)
}

pub(crate) fn register_schema(schema_id: &str, schema: &str) -> Result<(), JsValue> {
    let schema_value: Value = serde_json::from_str(schema).map_err(|err| {
        JsValue::from_str(&format!("Invalid schema JSON for '{schema_id}': {err}"))
    })?;
    let compiled =
        JSONSchema::compile(&schema_value).map_err(|err| JsValue::from_str(&err.to_string()))?;

    let mut cache = SCHEMA_CACHE.lock().expect("schema cache lock poisoned");
    cache.insert(schema_id.to_string(), Arc::new(compiled));
    Ok(())
}

#[cfg(test)]
pub(crate) fn validate_schema_for_tests(
    schema_json: &str,
    content: &str,
    options: Option<SchemaValidationOptions>,
) -> SchemaValidationOutcome {
    let schema_value: Value = serde_json::from_str(schema_json).unwrap();
    let compiled = JSONSchema::compile(&schema_value).unwrap();
    let instance_value = serde_json::from_str::<Value>(content).unwrap();
    let opts = options.unwrap_or_default();
    schema_validate_instance(&compiled, &instance_value, content, &opts)
}

fn parse_instance(content: &str) -> Result<Value, SyntaxErrorDetail> {
    match serde_json::from_str::<Value>(content) {
        Ok(val) => Ok(val),
        Err(err) => {
            let line = err.line().max(1) as usize;
            let column = err.column().max(1) as usize;
            let start = compute_offset_from_line_col(content, line, column);
            let span = infer_json_span(content, start);
            Err(SyntaxErrorDetail {
                message: err.to_string(),
                line,
                column,
                span,
            })
        }
    }
}

fn compile_schema(
    schema_value: &Value,
    draft: Option<Draft>,
) -> Result<JSONSchema, ValidationError> {
    let mut options = JSONSchema::options();
    if let Some(draft) = draft {
        options.with_draft(draft);
    }
    options.compile(schema_value)
}

fn schema_validate_instance(
    compiled: &JSONSchema,
    instance: &Value,
    content: &str,
    opts: &SchemaValidationOptions,
) -> SchemaValidationOutcome {
    match compiled.validate(instance) {
        Ok(_) => SchemaValidationOutcome::success(),
        Err(errors) => {
            let resolver = if opts.collect_positions {
                JsonSpanResolver::new(content).ok()
            } else {
                None
            };
            let mut collected = Vec::new();
            for error in errors.take(opts.max_errors) {
                collected.push(descriptor_from_error(
                    error,
                    content,
                    opts.collect_positions,
                    resolver.as_ref(),
                ));
            }
            SchemaValidationOutcome::from_errors(collected)
        }
    }
}

fn descriptor_from_error(
    error: ValidationError,
    content: &str,
    include_positions: bool,
    resolver: Option<&JsonSpanResolver>,
) -> SchemaErrorDescriptor {
    let instance_path = error.instance_path.to_string();
    let schema_path = Some(error.schema_path.to_string());
    let keyword = keyword_from_kind(&error.kind).map(|kw| kw.to_string());

    let (line, column, start, end) = if include_positions {
        resolver
            .and_then(|res| resolve_pointer_span(res, &instance_path))
            .map(|span| {
                let (line, column) = compute_line_col_from_offset(content, span.start);
                (Some(line), Some(column), Some(span.start), Some(span.end))
            })
            .unwrap_or((None, None, None, None))
    } else {
        (None, None, None, None)
    };

    SchemaErrorDescriptor {
        message: error.to_string(),
        keyword,
        instance_path,
        schema_path,
        line,
        column,
        start,
        end,
    }
}

fn schema_outcome_from_syntax(
    detail: SyntaxErrorDetail,
    opts: &SchemaValidationOptions,
) -> SchemaValidationOutcome {
    let mut descriptor = SchemaErrorDescriptor {
        message: detail.message,
        keyword: Some("syntax".into()),
        instance_path: String::new(),
        schema_path: None,
        line: None,
        column: None,
        start: None,
        end: None,
    };
    if opts.collect_positions {
        descriptor.line = Some(detail.line);
        descriptor.column = Some(detail.column);
        descriptor.start = Some(detail.span.start);
        descriptor.end = Some(detail.span.end);
    }
    SchemaValidationOutcome::from_errors(vec![descriptor])
}

fn schema_issue_outcome(message: String) -> SchemaValidationOutcome {
    SchemaValidationOutcome::from_errors(vec![SchemaErrorDescriptor {
        message,
        keyword: Some("schema".into()),
        instance_path: String::new(),
        schema_path: None,
        line: None,
        column: None,
        start: None,
        end: None,
    }])
}

fn schema_outcome_to_js(outcome: SchemaValidationOutcome) -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("valid"),
        &JsValue::from_bool(outcome.valid),
    );
    if !outcome.errors.is_empty() {
        let arr = Array::new();
        for err in &outcome.errors {
            arr.push(&schema_error_to_js(err));
        }
        let _ = Reflect::set(&obj, &JsValue::from_str("errors"), &arr);
    }
    obj.into()
}

fn schema_error_to_js(err: &SchemaErrorDescriptor) -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("message"),
        &JsValue::from_str(&err.message),
    );
    if let Some(keyword) = &err.keyword {
        let _ = Reflect::set(
            &obj,
            &JsValue::from_str("keyword"),
            &JsValue::from_str(keyword),
        );
    }
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("instancePath"),
        &JsValue::from_str(&err.instance_path),
    );
    if let Some(schema_path) = &err.schema_path {
        let _ = Reflect::set(
            &obj,
            &JsValue::from_str("schemaPath"),
            &JsValue::from_str(schema_path),
        );
    }
    if let Some(line) = err.line {
        let _ = Reflect::set(
            &obj,
            &JsValue::from_str("line"),
            &JsValue::from_f64(line as f64),
        );
    }
    if let Some(column) = err.column {
        let _ = Reflect::set(
            &obj,
            &JsValue::from_str("column"),
            &JsValue::from_f64(column as f64),
        );
    }
    if let Some(start) = err.start {
        let _ = Reflect::set(
            &obj,
            &JsValue::from_str("start"),
            &JsValue::from_f64(start as f64),
        );
    }
    if let Some(end) = err.end {
        let _ = Reflect::set(
            &obj,
            &JsValue::from_str("end"),
            &JsValue::from_f64(end as f64),
        );
    }
    obj.into()
}

#[allow(unreachable_patterns)]
fn keyword_from_kind(kind: &ValidationErrorKind) -> Option<&'static str> {
    use ValidationErrorKind::*;
    match kind {
        AdditionalItems { .. } => Some("additionalItems"),
        AdditionalProperties { .. } => Some("additionalProperties"),
        AnyOf => Some("anyOf"),
        BacktrackLimitExceeded { .. } => Some("format"),
        Constant { .. } => Some("const"),
        Contains => Some("contains"),
        ContentEncoding { .. } => Some("contentEncoding"),
        ContentMediaType { .. } => Some("contentMediaType"),
        Enum { .. } => Some("enum"),
        ExclusiveMaximum { .. } => Some("exclusiveMaximum"),
        ExclusiveMinimum { .. } => Some("exclusiveMinimum"),
        FalseSchema => Some("false"),
        FileNotFound { .. } => Some("$ref"),
        Format { .. } => Some("format"),
        FromUtf8 { .. } => Some("contentEncoding"),
        Utf8 { .. } => Some("contentEncoding"),
        JSONParse { .. } => Some("$ref"),
        InvalidReference { .. } => Some("$ref"),
        InvalidURL { .. } => Some("$ref"),
        MaxItems { .. } => Some("maxItems"),
        Maximum { .. } => Some("maximum"),
        MaxLength { .. } => Some("maxLength"),
        MaxProperties { .. } => Some("maxProperties"),
        MinItems { .. } => Some("minItems"),
        Minimum { .. } => Some("minimum"),
        MinLength { .. } => Some("minLength"),
        MinProperties { .. } => Some("minProperties"),
        MultipleOf { .. } => Some("multipleOf"),
        Not { .. } => Some("not"),
        OneOfMultipleValid | OneOfNotValid => Some("oneOf"),
        Pattern { .. } => Some("pattern"),
        PropertyNames { .. } => Some("propertyNames"),
        Required { .. } => Some("required"),
        Schema => Some("$schema"),
        Type { .. } => Some("type"),
        UnevaluatedProperties { .. } => Some("unevaluatedProperties"),
        UniqueItems => Some("uniqueItems"),
        UnknownReferenceScheme { .. } => Some("$ref"),
        Resolver { .. } => Some("$ref"),
        _ => None,
    }
}

fn resolve_pointer_span(resolver: &JsonSpanResolver, pointer: &str) -> Option<Span> {
    for candidate in pointer_candidates(pointer) {
        if let Ok(span) = resolver.span_for_pointer(&candidate) {
            return Some(span);
        }
    }
    None
}

fn pointer_candidates(pointer: &str) -> Vec<String> {
    if pointer.is_empty() {
        return vec![String::new()];
    }
    let mut current = pointer.to_string();
    let mut out = Vec::new();
    loop {
        out.push(current.clone());
        if current.is_empty() {
            break;
        }
        if let Some(idx) = current.rfind('/') {
            if idx == 0 {
                current.clear();
            } else {
                current.truncate(idx);
            }
        } else {
            current.clear();
        }
        if current.is_empty() {
            out.push(String::new());
            break;
        }
    }
    out
}

fn parse_draft_label(raw: &str) -> Option<Draft> {
    let normalized = raw.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "draft4" | "draft-4" | "4" => Some(Draft::Draft4),
        "draft6" | "draft-6" | "6" => Some(Draft::Draft6),
        "draft7" | "draft-7" | "7" => Some(Draft::Draft7),
        "2019-09" | "draft2019-09" | "2019" | "201909" => Some(Draft::Draft201909),
        "2020-12" | "draft2020-12" | "2020" | "202012" => Some(Draft::Draft202012),
        _ => None,
    }
}

fn get_cached_schema(id: &str) -> Option<Arc<JSONSchema>> {
    SCHEMA_CACHE
        .lock()
        .ok()
        .and_then(|cache| cache.get(id).cloned())
}
