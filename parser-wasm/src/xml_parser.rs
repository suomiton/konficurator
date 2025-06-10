use crate::{BytePreservingParser, Span};
use xmlparser::{Tokenizer, Token, ElementEnd};

pub struct XmlParser;

impl XmlParser {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Clone)]
struct XmlPath {
    elements: Vec<String>,
    attribute: Option<String>,
}

impl XmlPath {
    fn from_path(path: &[String]) -> Self {
        if path.len() >= 2 && path.last().unwrap().starts_with('@') {
            // Last component is an attribute
            let attr_name = path.last().unwrap().trim_start_matches('@').to_string();
            let elements = path[..path.len()-1].to_vec();
            Self {
                elements,
                attribute: Some(attr_name),
            }
        } else {
            Self {
                elements: path.to_vec(),
                attribute: None,
            }
        }
    }
}

impl BytePreservingParser for XmlParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String> {
        let tokenizer = Tokenizer::from(content);
        let mut element_stack = Vec::new();
        
        for token in tokenizer {
            match token {
                Ok(Token::ElementStart { local, .. }) => {
                    // Track opened elements
                    element_stack.push(local.as_str().to_string());
                }
                Ok(Token::ElementEnd { end, .. }) => {
                    match end {
                        ElementEnd::Open => {
                            // This just closes the opening tag syntax (">"), element remains open
                        }
                        ElementEnd::Close(..) => {
                            // This is an actual closing tag "</name>"
                            if element_stack.is_empty() {
                                return Err("Unexpected closing tag".to_string());
                            }
                            element_stack.pop();
                        }
                        ElementEnd::Empty => {
                            // Self-closing element "/>"
                            if element_stack.is_empty() {
                                return Err("Unexpected self-closing tag".to_string());
                            }
                            element_stack.pop();
                        }
                    }
                }
                Err(e) => return Err(format!("XML parsing error: {}", e)),
                _ => {}
            }
        }
        
        if !element_stack.is_empty() {
            return Err(format!("Unclosed XML elements: {:?}", element_stack));
        }
        
        Ok(())
    }

    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String> {
        if path.is_empty() {
            return Err("Path cannot be empty".to_string());
        }

        let xml_path = XmlPath::from_path(path);
        let tokenizer = Tokenizer::from(content);
        let mut element_stack: Vec<String> = Vec::new();
        let mut in_target_element = false;

        for token in tokenizer {
            match token {
                Ok(Token::ElementStart { local, span, .. }) => {
                    element_stack.push(local.as_str().to_string());
                    
                    // Check if we're entering the target element
                    if element_stack.len() == xml_path.elements.len() &&
                       elements_match(&element_stack, &xml_path.elements) {
                        in_target_element = true;
                        
                        // If we're looking for an attribute, check it now
                        if let Some(ref attr_name) = xml_path.attribute {
                            // Look for attributes in this element
                            let element_content = &content[span.start()..];
                            let attr_tokenizer = Tokenizer::from(element_content);
                            for attr_token in attr_tokenizer {
                                if let Ok(Token::Attribute { local, value, .. }) = attr_token {
                                    if local.as_str() == attr_name {
                                        let attr_start = span.start() + value.start();
                                        let attr_end = span.start() + value.end();
                                        // Remove quotes from attribute value span
                                        return Ok(Span::new(attr_start + 1, attr_end - 1));
                                    }
                                }
                                // Stop at element end
                                if matches!(attr_token, Ok(Token::ElementEnd { .. })) {
                                    break;
                                }
                            }
                            return Err(format!("Attribute '{}' not found", attr_name));
                        }
                    }
                }
                
                Ok(Token::ElementEnd { end, .. }) => {
                    match end {
                        ElementEnd::Open => {
                            // This just closes the opening tag syntax (">"), element remains open
                            // Don't pop the element stack or change in_target_element state
                        }
                        ElementEnd::Empty => {
                            // Self-closing element "/>"
                            if in_target_element && xml_path.attribute.is_none() {
                                in_target_element = false;
                            }
                            element_stack.pop();
                        }
                        ElementEnd::Close(..) => {
                            // This is an actual closing tag "</name>"
                            if in_target_element && xml_path.attribute.is_none() {
                                in_target_element = false;
                            }
                            element_stack.pop();
                        }
                    }
                }
                
                Ok(Token::Text { text }) => {
                    if in_target_element && xml_path.attribute.is_none() {
                        // This is the text content of our target element
                        let trimmed = text.as_str().trim();
                        if !trimmed.is_empty() {
                            // Find the actual span of non-whitespace content
                            let content_start = text.as_str().find(|c: char| !c.is_whitespace()).unwrap_or(0);
                            let content_end = text.as_str().rfind(|c: char| !c.is_whitespace()).map(|i| i + 1).unwrap_or(text.as_str().len());
                            
                            return Ok(Span::new(
                                text.start() + content_start,
                                text.start() + content_end
                            ));
                        }
                    }
                }
                
                Err(e) => return Err(format!("XML parsing error: {}", e)),
                _ => {}
            }
        }
        
        Err(format!("Path not found: {}", path.join("/")))
    }
}

fn elements_match(current: &[String], target: &[String]) -> bool {
    if current.len() != target.len() {
        return false;
    }
    
    current.iter().zip(target.iter()).all(|(a, b)| a == b)
}
