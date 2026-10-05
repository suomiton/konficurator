use crate::json_lexer::{self, Kind, Token};
use crate::Span;
use serde_json::Value;
use xmlparser::{Error as XmlError, Tokenizer};

pub(crate) const MAX_MULTI_ERRORS: usize = 10;
const BYTE_LIMIT: usize = 1_000_000;

#[derive(Debug, Clone)]
pub(crate) struct DetailedError {
    pub message: String,
    pub code: Option<&'static str>,
    pub line: usize,
    pub column: usize,
    pub span: Span,
}

#[derive(Debug, Clone)]
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

    match serde_json::from_str::<Value>(content) {
        Ok(_) => MultiValidationResult::success(),
        Err(err) => {
            let line_index = LineIndex::new(content);
            let start = crate::compute_offset_from_line_col(
                content,
                err.line().max(1) as usize,
                err.column().max(1) as usize,
            );
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

pub(crate) fn validate_xml_multi(content: &str, max_errors: usize) -> MultiValidationResult {
    if content.len() > BYTE_LIMIT {
        return basic_xml_result(content);
    }

    let mut tokenizer = Tokenizer::from(content);
    for tok in &mut tokenizer {
        if let Err(err) = tok {
            let errors = collect_xml_errors(content, err, max_errors);
            if errors.is_empty() {
                return MultiValidationResult::success();
            }
            let summary = errors.first().cloned().unwrap();
            return MultiValidationResult::invalid(summary, errors);
        }
    }
    MultiValidationResult::success()
}

fn basic_json_result(content: &str) -> MultiValidationResult {
    match serde_json::from_str::<Value>(content) {
        Ok(_) => MultiValidationResult::success(),
        Err(err) => {
            let start = crate::compute_offset_from_line_col(
                content,
                err.line().max(1) as usize,
                err.column().max(1) as usize,
            );
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

fn basic_xml_result(content: &str) -> MultiValidationResult {
    let mut tokenizer = Tokenizer::from(content);
    for tok in &mut tokenizer {
        if let Err(err) = tok {
            let index = LineIndex::new(content);
            let detailed = build_xml_error(content, &index, &err);
            return MultiValidationResult::invalid(detailed.clone(), vec![detailed]);
        }
    }
    MultiValidationResult::success()
}

fn collect_xml_errors(
    content: &str,
    first_error: XmlError,
    max_errors: usize,
) -> Vec<DetailedError> {
    let mut errors = Vec::new();
    let line_index = LineIndex::new(content);
    let budget = max_errors.clamp(1, MAX_MULTI_ERRORS);

    let mut cursor = 0usize;
    let mut current_error = Some(first_error);

    while cursor < content.len() && errors.len() < budget {
        let err = match current_error.take() {
            Some(e) => e,
            None => {
                let mut tokenizer = Tokenizer::from(&content[cursor..]);
                let mut caught: Option<XmlError> = None;
                for tok in &mut tokenizer {
                    if let Err(e) = tok {
                        caught = Some(e);
                        break;
                    }
                }
                if let Some(e) = caught {
                    e
                } else {
                    break;
                }
            }
        };

        let rel_line = err.pos().row as usize;
        let rel_col = err.pos().col as usize;
        let rel_offset = crate::compute_offset_from_line_col(&content[cursor..], rel_line, rel_col);
        let abs_offset = cursor + rel_offset;

        let detailed = build_xml_error_at(content, &line_index, &err, abs_offset);
        cursor = find_next_tag_start(content, detailed.span.end).unwrap_or(content.len());
        errors.push(detailed);
        if errors.len() >= budget {
            break;
        }
        current_error = None;
    }

    errors
}

fn build_xml_error(content: &str, index: &LineIndex, err: &XmlError) -> DetailedError {
    let start = crate::compute_offset_from_line_col(
        content,
        err.pos().row as usize,
        err.pos().col as usize,
    );
    build_xml_error_at(content, index, err, start)
}

fn build_xml_error_at(
    content: &str,
    index: &LineIndex,
    err: &XmlError,
    start: usize,
) -> DetailedError {
    let message = err.to_string();
    let span = infer_xml_span(content, start, &message);
    let (line, column) = index.line_col(span.start);
    let code = classify_xml_code(&message);
    DetailedError {
        message,
        code: Some(code),
        line,
        column,
        span,
    }
}

fn classify_xml_code(msg: &str) -> &'static str {
    let lower = msg.to_lowercase();
    if lower.contains("quote") {
        "xml.unterminated_quote"
    } else if lower.contains("mismatch") {
        "xml.mismatched_tag"
    } else if lower.contains("unexpected") {
        "xml.unexpected_token"
    } else {
        "xml.parse_error"
    }
}

fn find_next_tag_start(content: &str, from: usize) -> Option<usize> {
    let bytes = content.as_bytes();
    let mut i = from.min(bytes.len());
    while i < bytes.len() {
        if bytes[i] == b'<' {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn infer_xml_span(content: &str, start: usize, msg: &str) -> Span {
    let bytes = content.as_bytes();
    let clamped_start = start.min(bytes.len());
    let lower = msg.to_lowercase();
    let end = if lower.contains("quote") {
        scan_until(bytes, clamped_start, b'"')
    } else if lower.contains("unexpected") {
        (clamped_start + 1).min(bytes.len())
    } else {
        scan_until(bytes, clamped_start, b'>')
    };
    Span::new(clamped_start, end)
}

fn scan_until(bytes: &[u8], start: usize, needle: u8) -> usize {
    let mut i = start;
    while i < bytes.len() {
        if bytes[i] == needle || bytes[i] == b'\n' {
            return i + 1;
        }
        i += 1;
    }
    bytes.len()
}

fn collect_structural_errors(
    content: &str,
    tokens: &[Token],
    index: &LineIndex,
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
            if matches!(obj.state, ObjectState::ExpectCommaOrEnd)
                && !matches!(token.kind, Kind::Comma | Kind::RBrace)
            {
                errors.push(missing_comma_error(token.span, index));
                obj.state = ObjectState::ExpectKeyOrEnd;
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
                    if matches!(obj.state, ObjectState::ExpectKeyOrEnd) && obj.comma_guard {
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
                        ObjectState::ExpectKeyOrEnd => {
                            obj.state = ObjectState::ExpectColon {
                                key_span: token.span,
                            };
                            obj.comma_guard = false;
                            i += 1;
                        }
                        ObjectState::ExpectColon { key_span } => {
                            errors.push(missing_colon_error(key_span, index));
                            obj.state = ObjectState::ExpectValue;
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
                        ObjectState::ExpectColon { .. } => {
                            obj.state = ObjectState::ExpectValue;
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
                        ObjectState::ExpectCommaOrEnd => {
                            obj.state = ObjectState::ExpectKeyOrEnd;
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

fn note_value_consumed(stack: &mut Vec<Context>) {
    if let Some(ctx) = stack.last_mut() {
        match ctx {
            Context::Object(obj) => {
                obj.state = ObjectState::ExpectCommaOrEnd;
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

fn mismatched_error(span: Span, index: &LineIndex, code: &'static str) -> DetailedError {
    let (line, column) = index.line_col(span.start);
    DetailedError {
        message: "Mismatched closing delimiter".into(),
        code: Some(code),
        line,
        column,
        span,
    }
}

fn simple_error(span: Span, index: &LineIndex, code: &'static str, message: &str) -> DetailedError {
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

struct LineIndex {
    offsets: Vec<usize>,
    len: usize,
}

impl LineIndex {
    fn new(content: &str) -> Self {
        let mut offsets = Vec::new();
        offsets.push(0);
        for (idx, ch) in content.char_indices() {
            if ch == '\n' {
                offsets.push(idx + ch.len_utf8());
            }
        }
        Self {
            offsets,
            len: content.len(),
        }
    }

    fn line_col(&self, offset: usize) -> (usize, usize) {
        let clamped = offset.min(self.len);
        let idx = match self.offsets.binary_search(&clamped) {
            Ok(i) => i,
            Err(i) if i == 0 => 0,
            Err(i) => i - 1,
        };
        let line = idx + 1;
        let column = clamped - self.offsets[idx] + 1;
        (line, column)
    }
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
            state: ObjectState::ExpectKeyOrEnd,
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
    ExpectKeyOrEnd,
    ExpectColon { key_span: Span },
    ExpectValue,
    ExpectCommaOrEnd,
}
