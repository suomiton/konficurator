//! Pieni, no‑alloc JSON‑tokenisoija, joka tuottaa Token { kind, span }.
//! • Tukee RFC 8259: numerot, stringit, true/false/null, whitespace.
//! • Ei kommentteja eikä trailing‑comma‑sallintaa (sama kuin virallinen JSON).
//! • Span = byte‑indeksit alkuperäiseen buffiin (start..end).

use crate::Span;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    LBrace,
    RBrace,
    LBrack,
    RBrack,
    Colon,
    Comma,
    StringLit,
    NumberLit,
    True,
    False,
    Null,
}

#[derive(Debug, Clone, Copy)]
pub struct Token {
    pub kind: Kind,
    pub span: Span,
}

pub fn lex(buf: &str) -> Result<Vec<Token>, String> {
    let bytes = buf.as_bytes();
    let mut i = 0;
    let mut tokens = Vec::new();

    macro_rules! push {
        ($kind:expr, $s:expr, $e:expr) => {
            tokens.push(Token {
                kind: $kind,
                span: Span::new($s, $e),
            });
        };
    }

    while i < bytes.len() {
        match bytes[i] {
            b'{' => {
                push!(Kind::LBrace, i, i + 1);
                i += 1;
            }
            b'}' => {
                push!(Kind::RBrace, i, i + 1);
                i += 1;
            }
            b'[' => {
                push!(Kind::LBrack, i, i + 1);
                i += 1;
            }
            b']' => {
                push!(Kind::RBrack, i, i + 1);
                i += 1;
            }
            b':' => {
                push!(Kind::Colon, i, i + 1);
                i += 1;
            }
            b',' => {
                push!(Kind::Comma, i, i + 1);
                i += 1;
            }

            b'"' => {
                let start = i;
                i += 1;
                let mut esc = false;
                while i < bytes.len() {
                    match bytes[i] {
                        b'\\' if !esc => {
                            esc = true;
                            i += 1;
                        }
                        b'"' if !esc => {
                            i += 1;
                            break;
                        }
                        _ => {
                            esc = false;
                            i += 1;
                        }
                    }
                }
                if i > bytes.len() {
                    return Err("unterminated string".into());
                }
                push!(Kind::StringLit, start, i);
            }

            b'-' | b'0'..=b'9' => {
                let start = i;
                i += 1;
                while i < bytes.len()
                    && matches!(bytes[i], b'0'..=b'9' | b'.' | b'e' | b'E' | b'+' | b'-')
                {
                    i += 1;
                }
                push!(Kind::NumberLit, start, i);
            }

            b't' if bytes.get(i..i + 4) == Some(b"true") => {
                push!(Kind::True, i, i + 4);
                i += 4;
            }
            b'f' if bytes.get(i..i + 5) == Some(b"false") => {
                push!(Kind::False, i, i + 5);
                i += 5;
            }
            b'n' if bytes.get(i..i + 4) == Some(b"null") => {
                push!(Kind::Null, i, i + 4);
                i += 4;
            }

            c if c.is_ascii_whitespace() => {
                i += 1;
            }

            _ => return Err(format!("unexpected byte 0x{:02x} at {}", bytes[i], i)),
        }
    }
    Ok(tokens)
}

/// Erittäin kevyt syntaksivalidointi – tarkistaa sulkujen tasapainon ja
/// object‑key → colon → value ‑järjestyksen pääpiirteissään.
/// Riittää konfiguraatiokäyttöihin; syvällisempi tarkistus voidaan
/// delegoida serde_jsonille, jos tarve.
pub fn validate(tokens: &[Token]) -> Result<(), String> {
    use Kind::*;
    let mut stack = Vec::new();
    let mut expect_key_or_end = false; // inside object
    let mut i = 0;

    while i < tokens.len() {
        match tokens[i].kind {
            LBrace => {
                stack.push(LBrace);
                expect_key_or_end = true;
                i += 1;
            }
            LBrack => {
                stack.push(LBrack);
                i += 1;
            }
            RBrace => {
                if stack.pop() != Some(LBrace) {
                    return Err("mismatched '}'".into());
                }
                i += 1;
                expect_key_or_end = false;
            }
            RBrack => {
                if stack.pop() != Some(LBrack) {
                    return Err("mismatched ']'".into());
                }
                i += 1;
            }
            StringLit => {
                if stack.last() == Some(&LBrace) && expect_key_or_end {
                    // key position – next token must be Colon
                    if tokens.get(i + 1).map(|t| t.kind) != Some(Colon) {
                        return Err("object key not followed by ':'".into());
                    }
                }
                i += 1;
            }
            Colon => {
                expect_key_or_end = false;
                i += 1;
            }
            Comma => {
                expect_key_or_end = stack.last() == Some(&LBrace);
                i += 1;
            }
            NumberLit | True | False | Null => {
                i += 1;
            }
        }
    }
    if !stack.is_empty() {
        return Err("unclosed brackets/braces".into());
    }
    Ok(())
}
