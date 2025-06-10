use crate::{BytePreservingParser, Span};

pub struct JsonParser;

impl JsonParser {
    pub fn new() -> Self {
        Self
    }
}

impl BytePreservingParser for JsonParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        // Use serde_json for validation
        match serde_json::from_str::<serde_json::Value>(content) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Invalid JSON syntax: {}", e)),
        }
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        if path.is_empty() {
            return Err("Path cannot be empty".to_string());
        }

        // Manual JSON parser to find spans
        let mut chars = content.char_indices().peekable();
        let mut current_path: Vec<String> = Vec::new();
        let mut in_string = false;
        let mut escape_next = false;
        let mut key_buffer = String::new();
        let mut in_key = false;
        let mut waiting_for_value = false;
        let mut array_indices: Vec<usize> = Vec::new();

        while let Some((i, ch)) = chars.next() {
            if in_string {
                if escape_next {
                    escape_next = false;
                    if in_key {
                        key_buffer.push(ch);
                    }
                    continue;
                }

                if ch == '\\' {
                    escape_next = true;
                    if in_key {
                        key_buffer.push(ch);
                    }
                    continue;
                }

                if ch == '"' {
                    in_string = false;

                    if in_key {
                        in_key = false;
                        waiting_for_value = true;
                    } else if waiting_for_value {
                        // This is a string value
                        if paths_match(&current_path, &array_indices, path) {
                            return Ok(Span::new(
                                i - get_string_content_length(&content[..=i]) + 1,
                                i + 1,
                            ));
                        }
                        waiting_for_value = false;
                        if !current_path.is_empty() {
                            current_path.pop();
                        }
                    }
                } else if in_key {
                    key_buffer.push(ch);
                }
                continue;
            }

            match ch {
                '"' => {
                    in_string = true;
                    if waiting_for_value {
                        // This is the start of a string value
                        if paths_match(&current_path, &array_indices, path) {
                            // Find the end of the string
                            let start = i;
                            let mut end = i + 1;
                            let mut local_escape = false;

                            while let Some((j, string_ch)) = chars.next() {
                                end = j + 1;
                                if local_escape {
                                    local_escape = false;
                                    continue;
                                }
                                if string_ch == '\\' {
                                    local_escape = true;
                                    continue;
                                }
                                if string_ch == '"' {
                                    break;
                                }
                            }
                            return Ok(Span::new(start, end));
                        }
                    } else {
                        // This might be a key
                        in_key = true;
                        key_buffer.clear();
                    }
                }
                '{' => {
                    // Object start
                }
                '}' => {
                    if !current_path.is_empty() {
                        current_path.pop();
                    }
                    if waiting_for_value {
                        waiting_for_value = false;
                    }
                }
                '[' => {
                    array_indices.push(0);
                }
                ']' => {
                    array_indices.pop();
                    if !current_path.is_empty() {
                        current_path.pop();
                    }
                }
                ':' => {
                    if !key_buffer.is_empty() {
                        current_path.push(key_buffer.clone());
                        key_buffer.clear();
                        waiting_for_value = true;
                    }
                }
                ',' => {
                    if waiting_for_value {
                        waiting_for_value = false;
                        if !current_path.is_empty() {
                            current_path.pop();
                        }
                    }

                    // Increment array index if we're in an array
                    if let Some(last_idx) = array_indices.last_mut() {
                        *last_idx += 1;
                    }
                }
                c if c.is_whitespace() => continue,
                _ => {
                    // Handle other values (numbers, booleans, null)
                    if waiting_for_value {
                        if paths_match(&current_path, &array_indices, path) {
                            // Find the end of this value
                            let start = i;
                            let mut end = i + 1;
                            while let Some((j, next_ch)) = chars.peek() {
                                if next_ch.is_whitespace()
                                    || *next_ch == ','
                                    || *next_ch == '}'
                                    || *next_ch == ']'
                                {
                                    break;
                                }
                                end = *j + 1;
                                chars.next();
                            }
                            return Ok(Span::new(start, end));
                        }
                        waiting_for_value = false;
                        if !current_path.is_empty() {
                            current_path.pop();
                        }

                        // Skip to next token
                        while let Some((_, next_ch)) = chars.peek() {
                            if next_ch.is_whitespace()
                                || *next_ch == ','
                                || *next_ch == '}'
                                || *next_ch == ']'
                            {
                                break;
                            }
                            chars.next();
                        }
                    }
                }
            }
        }

        Err(format!("Path not found: {}", path.join("/")))
    }
}

fn get_string_content_length(content_up_to_quote: &str) -> usize {
    let mut len = 0;
    let mut chars = content_up_to_quote.chars().rev();

    // Skip the closing quote
    chars.next();

    while let Some(ch) = chars.next() {
        len += 1;
        if ch == '"' {
            // Check if it's escaped
            let mut escape_count = 0;
            let mut temp_chars = chars.clone();
            while let Some('\\') = temp_chars.next() {
                escape_count += 1;
            }
            if escape_count % 2 == 0 {
                // Even number of escapes means the quote is not escaped
                break;
            }
        }
    }

    len
}

fn paths_match(current_path: &[String], _array_indices: &[usize], target_path: &[String]) -> bool {
    if current_path.len() != target_path.len() {
        return false;
    }

    current_path
        .iter()
        .zip(target_path.iter())
        .all(|(a, b)| a == b)
}
