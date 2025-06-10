use crate::{BytePreservingParser, Span};

pub struct EnvParser;

impl EnvParser {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Clone)]
struct EnvLine {
    key_span: Option<Span>,
    value_span: Option<Span>,
    key: String,
}

impl BytePreservingParser for EnvParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        // ENV files are very permissive, just check basic structure
        for (line_num, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            
            if !trimmed.contains('=') {
                return Err(format!("Invalid ENV line {}: missing '=' separator", line_num + 1));
            }
        }
        
        Ok(())
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        if path.is_empty() || path.len() != 1 {
            return Err("ENV path must contain exactly one key".to_string());
        }

        let target_key = &path[0];
        let lines = parse_env_lines(content);
        
        for line in lines {
            if line.key == *target_key {
                if let Some(value_span) = line.value_span {
                    return Ok(value_span);
                } else {
                    return Err(format!("Key '{}' has no value", target_key));
                }
            }
        }
        
        Err(format!("Key '{}' not found", target_key))
    }
}

fn parse_env_lines(content: &str) -> Vec<EnvLine> {
    let mut lines = Vec::new();
    let mut byte_offset = 0;
    
    for line in content.lines() {
        let line_start = byte_offset;
        let line_end = byte_offset + line.len();
        
        let trimmed = line.trim();
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            if let Some(eq_pos) = trimmed.find('=') {
                let key_part = trimmed[..eq_pos].trim();
                let value_part = trimmed[eq_pos + 1..].trim();
                
                if !key_part.is_empty() {
                    // Find the actual byte positions
                    let key_start_in_line = line.find(key_part).unwrap_or(0);
                    let key_start = line_start + key_start_in_line;
                    let key_end = key_start + key_part.len();
                    
                    let mut value_span = None;
                    if !value_part.is_empty() {
                        let value_start_in_line = line.rfind('=').unwrap() + 1;
                        let value_start_trimmed = line[value_start_in_line..].find(|c: char| !c.is_whitespace()).unwrap_or(0);
                        let value_start = line_start + value_start_in_line + value_start_trimmed;
                        
                        // Handle quoted values
                        let value_end = if value_part.starts_with('"') && value_part.ends_with('"') && value_part.len() > 1 {
                            // Quoted value - span includes quotes
                            line_start + line.len() - (line.len() - line.trim_end().len())
                        } else if value_part.starts_with('\'') && value_part.ends_with('\'') && value_part.len() > 1 {
                            // Single quoted value - span includes quotes
                            line_start + line.len() - (line.len() - line.trim_end().len())
                        } else {
                            // Unquoted value - find the end of non-whitespace
                            let trimmed_end = value_part.trim_end();
                            value_start + trimmed_end.len()
                        };
                        
                        value_span = Some(Span::new(value_start, value_end));
                    }
                    
                    lines.push(EnvLine {
                        key_span: Some(Span::new(key_start, key_end)),
                        value_span,
                        key: key_part.to_string(),
                    });
                }
            }
        }
        
        // Move to next line (including newline character if present)
        byte_offset = line_end + 1; // +1 for newline
    }
    
    lines
}
