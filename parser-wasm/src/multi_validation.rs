use crate::json_lexer::{self, Kind, Token};
use crate::positions::LineIndex;
use crate::Span;
use serde::Serialize;
use serde_json::Value;

pub(crate) const MAX_MULTI_ERRORS: usize = 10;
const BYTE_LIMIT: usize = 1_000_000;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct DetailedError {
    pub message: String,
    pub code: Option<&'static str>,
    pub line: usize,
    pub column: usize,
    #[serde(flatten)]
    pub span: Span,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct MultiValidationResult {
    pub valid: bool,
    pub summary: Option<DetailedError>,
    pub errors: Vec<DetailedError>,
}

impl MultiValidationResult {
    pub fn success() -> Self {
        Self {
            valid: true,
            summary: None,
            errors: Vec::new(),
        }
    }

    fn invalid(summary: DetailedError, mut errors: Vec<DetailedError>) -> Self {
        if errors.is_empty() {
            errors.push(summary.clone());
        } else if !errors
            .iter()
            .any(|e| e.span == summary.span && e.message == summary.message)
        {
            errors.insert(0, summary.clone());
        }
        Self {
            valid: false,
            summary: Some(summary),
            errors,
        }
    }

    pub fn with_limit(mut self, max_errors: usize) -> Self {
        if self.errors.len() > max_errors {
            self.errors.truncate(max_errors);
        }
        self
    }
}

pub(crate) fn validate_json_multi(content: &str, max_errors: usize) -> MultiValidationResult {
    if content.len() > BYTE_LIMIT {
        return basic_json_result(content);
    }

    match serde_json::from_str::<Value>(content.trim_start_matches('\u{feff}')) {
        Ok(_) => MultiValidationResult::success(),
        Err(err) => {
            let line_index = LineIndex::new(content);
            let start = LineIndex::new(content).byte_offset(err.line().max(1), err.column().max(1))
                + if content.starts_with('\u{feff}') && err.line() == 1 {
                    3
                } else {
                    0
                };
            let span = infer_json_span(content, start);
            let (line, column) = line_index.line_col(span.start);
            let summary = DetailedError {
                message: err.to_string(),
                code: None,
                line,
                column,
                span,
            };

            let budget = max_errors.clamp(1, MAX_MULTI_ERRORS);
            let (tokens, lex_errors) = json_lexer::lex_lenient(content, budget);
            let mut errors = Vec::new();
            for lex_err in lex_errors {
                let (line, column) = line_index.line_col(lex_err.span.start);
                errors.push(DetailedError {
                    message: lex_err.message,
                    code: Some(lex_err.code),
                    line,
                    column,
                    span: lex_err.span,
                });
                if errors.len() >= budget {
                    break;
                }
            }

            if errors.len() < budget {
                let remaining = budget - errors.len();
                let structural =
                    collect_structural_errors(content, &tokens, &line_index, remaining);
                for err in structural {
                    errors.push(err);
                    if errors.len() >= budget {
                        break;
                    }
                }
            }

            MultiValidationResult::invalid(summary, errors)
        }
    }
}

pub(crate) fn validate_xml_multi(content: &str, _max_errors: usize) -> MultiValidationResult {
    match crate::xml_parser::parse_xml(content) {
        Ok(_) => MultiValidationResult::success(),
        Err(error) => {
            let (line, column) = LineIndex::new(content).line_col(error.start);
            crate::invalid_result(DetailedError {
                message: error.message,
                code: Some(error.code),
                line,
                column,
                span: Span::new(error.start, error.start),
            })
        }
    }
}

fn basic_json_result(content: &str) -> MultiValidationResult {
    match serde_json::from_str::<Value>(content.trim_start_matches('\u{feff}')) {
        Ok(_) => MultiValidationResult::success(),
        Err(err) => {
            let start = LineIndex::new(content).byte_offset(err.line().max(1), err.column().max(1))
                + if content.starts_with('\u{feff}') && err.line() == 1 {
                    3
                } else {
                    0
                };
            let span = infer_json_span(content, start);
            let line_index = LineIndex::new(content);
            let (line, column) = line_index.line_col(span.start);
            let summary = DetailedError {
                message: err.to_string(),
                code: None,
                line,
                column,
                span,
            };
            MultiValidationResult::invalid(summary, Vec::new())
        }
    }
}

fn collect_structural_errors(
    content: &str,
    tokens: &[Token],
    index: &LineIndex<'_>,
    max_errors: usize,
) -> Vec<DetailedError> {
    let mut errors = Vec::new();
    let mut stack: Vec<Context> = Vec::new();
    let mut i = 0usize;

    while i < tokens.len() && errors.len() < max_errors {
        let token = tokens[i];

        if let Some(Context::Array(arr)) = stack.last_mut() {
            if !arr.expect_value && !matches!(token.kind, Kind::Comma | Kind::RBrack) {
                errors.push(missing_comma_error(token.span, index));
                arr.expect_value = true;
                arr.comma_guard = false;
                continue;
            }
        }

        if let Some(Context::Object(obj)) = stack.last_mut() {
            if matches!(obj.state, ObjectState::CommaOrEnd)
                && !matches!(token.kind, Kind::Comma | Kind::RBrace)
            {
                errors.push(missing_comma_error(token.span, index));
                obj.state = ObjectState::KeyOrEnd;
                obj.comma_guard = false;
                continue;
            }
        }

        match token.kind {
            Kind::LBrace => {
                note_value_consumed(&mut stack);
                stack.push(Context::Object(ObjectContext::new()));
                i += 1;
            }
            Kind::RBrace => {
                if let Some(Context::Object(obj)) = stack.last() {
                    if matches!(obj.state, ObjectState::KeyOrEnd) && obj.comma_guard {
                        errors.push(trailing_comma_error(token.span, index));
                    }
                }
                match stack.pop() {
                    Some(Context::Object(_)) => {
                        note_value_consumed(&mut stack);
                    }
                    _ => errors.push(mismatched_error(token.span, index, "json.mismatched_brace")),
                }
                i += 1;
            }
            Kind::LBrack => {
                note_value_consumed(&mut stack);
                stack.push(Context::Array(ArrayContext {
                    expect_value: true,
                    comma_guard: false,
                    has_value: false,
                }));
                i += 1;
            }
            Kind::RBrack => {
                if let Some(Context::Array(arr)) = stack.last() {
                    if arr.expect_value && arr.has_value {
                        errors.push(trailing_comma_error(token.span, index));
                    }
                }
                match stack.pop() {
                    Some(Context::Array(_)) => {
                        note_value_consumed(&mut stack);
                    }
                    _ => errors.push(mismatched_error(
                        token.span,
                        index,
                        "json.mismatched_bracket",
                    )),
                }
                i += 1;
            }
            Kind::StringLit => {
                if let Some(Context::Object(obj)) = stack.last_mut() {
                    match obj.state {
                        ObjectState::KeyOrEnd => {
                            obj.state = ObjectState::Colon {
                                key_span: token.span,
                            };
                            obj.comma_guard = false;
                            i += 1;
                        }
                        ObjectState::Colon { key_span } => {
                            errors.push(missing_colon_error(key_span, index));
                            obj.state = ObjectState::Value;
                            continue;
                        }
                        _ => {
                            note_value_consumed(&mut stack);
                            i += 1;
                        }
                    }
                } else {
                    note_value_consumed(&mut stack);
                    i += 1;
                }
            }
            Kind::NumberLit | Kind::True | Kind::False | Kind::Null => {
                note_value_consumed(&mut stack);
                i += 1;
            }
            Kind::Colon => {
                if let Some(Context::Object(obj)) = stack.last_mut() {
                    match obj.state {
                        ObjectState::Colon { .. } => {
                            obj.state = ObjectState::Value;
                        }
                        _ => errors.push(simple_error(
                            token.span,
                            index,
                            "json.unexpected_colon",
                            "Unexpected ':'",
                        )),
                    }
                } else {
                    errors.push(simple_error(
                        token.span,
                        index,
                        "json.unexpected_colon",
                        "Unexpected ':'",
                    ));
                }
                i += 1;
            }
            Kind::Comma => {
                if let Some(Context::Object(obj)) = stack.last_mut() {
                    match obj.state {
                        ObjectState::CommaOrEnd => {
                            obj.state = ObjectState::KeyOrEnd;
                            obj.comma_guard = true;
                        }
                        _ => errors.push(simple_error(
                            token.span,
                            index,
                            "json.unexpected_comma",
                            "Unexpected ','",
                        )),
                    }
                } else if let Some(Context::Array(arr)) = stack.last_mut() {
                    if arr.expect_value {
                        errors.push(simple_error(
                            token.span,
                            index,
                            "json.unexpected_comma",
                            "Unexpected ','",
                        ));
                    } else {
                        arr.expect_value = true;
                        arr.comma_guard = true;
                    }
                } else {
                    errors.push(simple_error(
                        token.span,
                        index,
                        "json.unexpected_comma",
                        "Unexpected ','",
                    ));
                }
                i += 1;
            }
        }
    }

    if errors.len() < max_errors && !stack.is_empty() {
        for ctx in stack.into_iter().rev() {
            if errors.len() >= max_errors {
                break;
            }
            let span = Span::new(content.len().saturating_sub(1), content.len());
            let (line, column) = index.line_col(span.start);
            let (code, message) = match ctx {
                Context::Object(_) => ("json.unclosed_object", "Unclosed '{'"),
                Context::Array(_) => ("json.unclosed_array", "Unclosed '['"),
            };
            errors.push(DetailedError {
                message: message.to_string(),
                code: Some(code),
                line,
                column,
                span,
            });
        }
    }

    errors
}

fn note_value_consumed(stack: &mut [Context]) {
    if let Some(ctx) = stack.last_mut() {
        match ctx {
            Context::Object(obj) => {
                obj.state = ObjectState::CommaOrEnd;
                obj.comma_guard = false;
            }
            Context::Array(arr) => {
                arr.expect_value = false;
                arr.comma_guard = false;
                arr.has_value = true;
            }
        }
    }
}

fn missing_colon_error(span: Span, index: &LineIndex) -> DetailedError {
    let (line, column) = index.line_col(span.start);
    DetailedError {
        message: "Missing ':' after object key".into(),
        code: Some("json.missing_colon"),
        line,
        column,
        span,
    }
}

fn missing_comma_error(span: Span, index: &LineIndex) -> DetailedError {
    let (line, column) = index.line_col(span.start);
    DetailedError {
        message: "Missing ',' between items".into(),
        code: Some("json.missing_comma"),
        line,
        column,
        span,
    }
}

fn trailing_comma_error(span: Span, index: &LineIndex) -> DetailedError {
    let (line, column) = index.line_col(span.start);
    DetailedError {
        message: "Trailing ',' before closing delimiter".into(),
        code: Some("json.trailing_comma"),
        line,
        column,
        span,
    }
}

fn mismatched_error(span: Span, index: &LineIndex<'_>, code: &'static str) -> DetailedError {
    let (line, column) = index.line_col(span.start);
    DetailedError {
        message: "Mismatched closing delimiter".into(),
        code: Some(code),
        line,
        column,
        span,
    }
}

fn simple_error(
    span: Span,
    index: &LineIndex<'_>,
    code: &'static str,
    message: &str,
) -> DetailedError {
    let (line, column) = index.line_col(span.start);
    DetailedError {
        message: message.to_string(),
        code: Some(code),
        line,
        column,
        span,
    }
}

pub(crate) fn infer_json_span(content: &str, start: usize) -> Span {
    if start >= content.len() {
        return Span::new(content.len(), content.len());
    }
    let slice = &content[start..];
    let mut chars = slice.char_indices();
    if let Some((_, ch)) = chars.next() {
        match ch {
            '"' => {
                let mut i = start + ch.len_utf8();
                let bytes = content.as_bytes();
                let mut esc = false;
                while i < content.len() {
                    let b = bytes[i];
                    if b == b'\\' && !esc {
                        esc = true;
                        i += 1;
                        continue;
                    }
                    if b == b'"' && !esc {
                        i += 1;
                        break;
                    }
                    esc = false;
                    i += 1;
                }
                return Span::new(start, i);
            }
            '-' | '0'..='9' => {
                let mut i = start + ch.len_utf8();
                while i < content.len() {
                    let c = content.as_bytes()[i] as char;
                    if matches!(c, '0'..='9' | '+' | '-' | 'e' | 'E' | '.') {
                        i += 1;
                    } else {
                        break;
                    }
                }
                return Span::new(start, i);
            }
            _ => {
                let mut i = start + ch.len_utf8();
                while i < content.len() {
                    let c = content.as_bytes()[i] as char;
                    if c.is_whitespace() {
                        break;
                    }
                    i += 1;
                }
                return Span::new(start, i);
            }
        }
    }
    Span::new(start, start)
}

enum Context {
    Object(ObjectContext),
    Array(ArrayContext),
}

struct ObjectContext {
    state: ObjectState,
    comma_guard: bool,
}

impl ObjectContext {
    fn new() -> Self {
        Self {
            state: ObjectState::KeyOrEnd,
            comma_guard: false,
        }
    }
}

struct ArrayContext {
    expect_value: bool,
    comma_guard: bool,
    has_value: bool,
}

#[derive(Clone, Copy)]
enum ObjectState {
    KeyOrEnd,
    Colon { key_span: Span },
    Value,
    CommaOrEnd,
}
