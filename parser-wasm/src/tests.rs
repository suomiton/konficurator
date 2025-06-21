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

#[test]
fn json_security_session_timeout_case() {
    let src = r#"{
  "application": {
    "name": "Sample Application 1234",
    "version": "2.1.0",
    "environment": "production",
    "debug": false
  },
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "maxConnections": 1000,
    "timeout": 30000,
    "ssl": {
      "enabled": true,
      "certificatePath": "/etc/ssl/cert.pem",
      "keyPath": "/etc/ssl/key.pem"
    }
  },
  "features": {
    "authentication": true,
    "authorization": true,
    "metrics": true,
    "healthCheck": true,
    "rateLimiting": {
      "enabled": true,
      "requestsPerMinute": 100,
      "burstSize": 10
    }
  },
  "security": {
    "corsOrigins": [
      "https://app.example.com",
      "https://admin.example.com"
    ],
    "sessionTimeout": 1800,
    "csrfProtection": true,
    "contentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline'"
  }
}"#;
    let parser = JsonParser::new();

    // Test finding the sessionTimeout value
    let span = parser
        .find_value_span(src, &["security".into(), "sessionTimeout".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], "1800");

    // Test finding rateLimiting.requestsPerMinute value
    let span2 = parser
        .find_value_span(
            src,
            &[
                "features".into(),
                "rateLimiting".into(),
                "requestsPerMinute".into(),
            ],
        )
        .unwrap();
    assert_eq!(&src[span2.start..span2.end], "100");
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

#[test]
fn xml_deeply_nested_realworld() {
    let src = r#"
    <config>
        <app>
            <name>My Application 7</name>
            <version>1.0.0</version>
            <debug>true</debug>
            <port>3000</port>
        </app>
        <database>
            <host>localhost</host>
            <port>5432</port>
            <name>myapp_db</name>
            <ssl>false</ssl>
            <connectionPool>
                <min>2</min>
                <max>10</max>
                <timeout>30000</timeout>
            </connectionPool>
        </database>
        <features>
            <enableLogging>true</enableLogging>
            <enableMetrics>true</enableMetrics>
            <enableCache>true</enableCache>
        </features>
        <allowedOrigins>
            <origin>http://localhost:3000</origin>
            <origin>https://example.com</origin>
        </allowedOrigins>
    </config>
    "#;
    let parser = XmlParser::new();
    let span = parser
        .find_value_span(src, &["config".into(), "app".into(), "port".into()])
        .unwrap();
    assert_eq!(&src[span.start..span.end], "3000");
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

#[test]
fn json_array_replacement() {
    let src = r#"{
  "users": ["alice", "bob"],
  "config": {
    "features": ["auth", "logging"]
  }
}"#;
    let parser = JsonParser::new();

    // Test finding the entire users array
    let span = parser.find_value_span(src, &["users".into()]).unwrap();
    assert_eq!(&src[span.start..span.end], r#"["alice", "bob"]"#);

    // Test replacing entire array
    let updated = parser.replace_value(src, span, r#"["alice", "bob", "charlie"]"#);
    assert!(updated.contains(r#""users": ["alice", "bob", "charlie"]"#));

    // Test nested array replacement
    let span2 = parser
        .find_value_span(src, &["config".into(), "features".into()])
        .unwrap();
    assert_eq!(&src[span2.start..span2.end], r#"["auth", "logging"]"#);

    let updated2 = parser.replace_value(src, span2, r#"["auth", "logging", "metrics"]"#);
    assert!(updated2.contains(r#""features": ["auth", "logging", "metrics"]"#));
}

#[test]
fn json_literal_detection() {
    // Test basic literals
    assert!(crate::is_json_literal("true"));
    assert!(crate::is_json_literal("false"));
    assert!(crate::is_json_literal("null"));
    assert!(crate::is_json_literal("42"));
    assert!(crate::is_json_literal("3.14"));

    // Test JSON arrays
    assert!(crate::is_json_literal(r#"["alice", "bob"]"#));
    assert!(crate::is_json_literal(r#"["auth", "logging", "metrics"]"#));
    assert!(crate::is_json_literal(r#"[]"#));
    assert!(crate::is_json_literal(r#"[1, 2, 3]"#));

    // Test JSON objects
    assert!(crate::is_json_literal(r#"{"name": "test"}"#));
    assert!(crate::is_json_literal(r#"{}"#));

    // Test invalid JSON (should not be considered literals)
    assert!(!crate::is_json_literal("not json"));
    assert!(!crate::is_json_literal("[invalid"));
    assert!(!crate::is_json_literal("{'single': quotes}"));
}
