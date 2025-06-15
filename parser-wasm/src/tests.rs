use crate::{BytePreservingParser, EnvParser, JsonParser, Span, XmlParser};

// ───── JSON ─────

#[test]
fn json_simple_key_value() {
    let src = r#"{ "name": "Toni", "age": 42 }"#;
    let parser = JsonParser::new();
    parser.validate_syntax(src).unwrap();

    let span = parser.find_value_span(src, &["name".into()]).unwrap();
    assert_eq!(&src[span.start..span.end], "\"Toni\"");
    let updated = parser.replace_value(src, span, "\"Suominen\"");
    assert!(updated.contains(r#""name": "Suominen""#));
}

#[test]
fn json_number_and_booleans() {
    let src = r#"{ "active": true, "score": 3.14, "nullval": null }"#;
    let parser = JsonParser::new();

    let span1 = parser.find_value_span(src, &["active".into()]).unwrap();
    assert_eq!(&src[span1.start..span1.end], "true");

    let span2 = parser.find_value_span(src, &["score".into()]).unwrap();
    assert_eq!(&src[span2.start..span2.end], "3.14");

    let span3 = parser.find_value_span(src, &["nullval".into()]).unwrap();
    assert_eq!(&src[span3.start..span3.end], "null");
}

#[test]
fn json_nested_path_and_array() {
    let src = r#"{ "profile": { "skills": ["Rust", "C#", "TS"] } }"#;
    let parser = JsonParser::new();

    let span = parser
        .find_value_span(src, &["profile".into(), "skills".into(), "1".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], r#""C#""#);
}

// ───── XML ─────

#[test]
fn xml_text_node_span() {
    let src = r#"<settings><host>localhost</host></settings>"#;
    let parser = XmlParser::new();
    parser.validate_syntax(src).unwrap();

    let span = parser
        .find_value_span(src, &["settings".into(), "host".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], "localhost");
}

#[test]
fn xml_attribute_span() {
    let src = r#"<connection host="127.0.0.1" port="8080"/>"#;
    let parser = XmlParser::new();

    let span = parser
        .find_value_span(src, &["connection".into(), "@host".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], r#""127.0.0.1""#);
}

#[test]
fn xml_nested_structure() {
    let src = r#"<a><b><c><d>deep</d></c></b></a>"#;
    let parser = XmlParser::new();

    let span = parser
        .find_value_span(src, &["a".into(), "b".into(), "c".into(), "d".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], "deep");
}

// ───── ENV ─────

#[test]
fn env_basic_and_comment() {
    let src = r#"# DB settings
DATABASE_URL=postgres://user:pass@localhost/db
DEBUG=true
"#;
    let parser = EnvParser::new();
    parser.validate_syntax(src).unwrap();

    let span = parser
        .find_value_span(src, &["DATABASE_URL".into()])
        .unwrap();
    assert_eq!(
        &src[span.start..span.end],
        "postgres://user:pass@localhost/db"
    );

    let span2 = parser.find_value_span(src, &["DEBUG".into()]).unwrap();
    assert_eq!(&src[span2.start..span2.end], "true");
}

#[test]
fn env_quoted_value_and_spacing() {
    let src = r#"API_KEY="abc 123"  # inline comment"#;
    let parser = EnvParser::new();
    parser.validate_syntax(src).unwrap();

    let span = parser.find_value_span(src, &["API_KEY".into()]).unwrap();
    assert_eq!(&src[span.start..span.end], r#""abc 123""#);
}

#[test]
fn env_edge_cases_and_escape() {
    let src = r#"PASSWORD="p@ssw0rd#123"  
MULTILINE="first\nsecond"
SPACED=   "value with space"
"#;
    let parser = EnvParser::new();
    parser.validate_syntax(src).unwrap();

    let span = parser.find_value_span(src, &["PASSWORD".into()]).unwrap();
    assert_eq!(&src[span.start..span.end], r#""p@ssw0rd#123""#);

    let span2 = parser.find_value_span(src, &["MULTILINE".into()]).unwrap();
    assert_eq!(&src[span2.start..span2.end], r#""first\nsecond""#);
}

// ───── Shared ─────

#[test]
fn replace_helper_works() {
    let input = "The quick brown fox";
    let span = Span::new(10, 15);
    let replaced = crate::JsonParser::new().replace_value(input, span, "lazy");

    assert_eq!(replaced, "The quick lazy fox");
}

#[test]
fn json_deeply_nested_key() {
    let src = r#"
    {
      "app": {
        "name": "My Application 7",
        "version": "1.0.0",
        "debug": true,
        "port": 3000
      }
    }
    "#;
    let parser = JsonParser::new();
    let span = parser
        .find_value_span(src, &["app".into(), "port".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], "3000");
}
