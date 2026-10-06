use crate::{
    edit_array_native, parse_native, update_native, BytePreservingParser, JsonParser, XmlParser,
};
fn path(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|s| s.to_string()).collect()
}
fn edit(kind: &str, input: &str, parts: &[&str], value: &str, expected: &str) {
    let updated = update_native(kind, input, &path(parts), value).unwrap();
    assert_eq!(updated.as_bytes(), expected.as_bytes());
    parse_native(kind, &updated).unwrap();
}
#[test]
fn json_arrays_objects_and_escaped_dotted_keys() {
    let input = "\u{feff}{\r\n  \"servers\": [{\"host\":\"a\",\"port\":1}, {\"host\":\"b\",\"port\":2}],\r\n  \"a\\\"b.c\": \"1.0\", \"large\": 9007199254740993, \"decimal\": 1.50, \"zero\": 0\r\n}\r\n";
    edit(
        "json",
        input,
        &["servers", "1", "port"],
        "5",
        &input.replace("\"port\":2", "\"port\":5"),
    );
    edit(
        "json",
        input,
        &["servers", "0", "port"],
        "7",
        &input.replace("\"port\":1", "\"port\":7"),
    );
    for value in ["2", "true", "[1,2]"] {
        edit(
            "json",
            input,
            &["a\"b.c"],
            value,
            &input.replace("\"1.0\"", &serde_json::to_string(value).unwrap()),
        );
    }
    let tree = parse_native("json", input).unwrap();
    assert_eq!(
        tree.find(&path(&["large"])).unwrap().value.as_deref(),
        Some("9007199254740993")
    );
    assert_eq!(
        tree.find(&path(&["decimal"])).unwrap().value.as_deref(),
        Some("1.50")
    );
    assert_eq!(
        tree.find(&path(&["zero"])).unwrap().value.as_deref(),
        Some("0")
    );
    assert_eq!(
        update_native("json", input, &path(&["decimal"]), "1.50").unwrap(),
        input
    );
}
#[test]
fn strict_json_updates_and_validation_agree() {
    for input in [
        "{\"a\":1 \"b\":2}",
        "[1,]",
        "{\"a\":01}",
        "{\"a\":true false}",
        "{\"a\":\"\\q\"}",
    ] {
        assert!(JsonParser.validate_syntax(input).is_err());
        assert!(update_native("json", input, &path(&["a"]), "2").is_err());
        assert!(!crate::multi_validation::validate_json_multi(input, 3).valid);
    }
    assert!(update_native("json", "{\"a\":1}", &path(&["a"]), "true").is_err());
}
#[test]
fn env_quotes_comments_bom_exports_and_consecutive_edits() {
    for input in [
        "\u{feff}export database.host=\"a \\\" b\"  # comment\r\n",
        "database.host='a'  # comment\r\n",
        "database.host=v  # comment\r\n",
    ] {
        let first =
            update_native("env", input, &path(&["database.host"]), "a \"q\" #fragment").unwrap();
        let second = update_native("env", &first, &path(&["database.host"]), "z").unwrap();
        let quote = if input.contains("='") { "'" } else { "\"" };
        let prefix = input.split('=').next().unwrap();
        assert_eq!(second, format!("{prefix}={quote}z{quote}  # comment\r\n"));
    }
    edit(
        "env",
        "URL=http://x/#frag # comment\nVER=1.10\n",
        &["URL"],
        "http://y/#other",
        "URL=http://y/#other # comment\nVER=1.10\n",
    );
    edit(
        "env",
        "K=\"l1\nl2\"\n",
        &["K"],
        "new\nvalue",
        "K=\"new\\nvalue\"\n",
    );
    edit(
        "env",
        "[database]\r\nhost=local\r\n",
        &["database", "host"],
        "remote",
        "[database]\r\nhost=remote\r\n",
    );
    let tree = parse_native("env", "VER=1.10\nPHONE=0401234567\n").unwrap();
    assert_eq!(tree.children[0].value.as_deref(), Some("1.10"));
    assert_eq!(tree.children[1].value.as_deref(), Some("0401234567"));
}
#[test]
fn xml_config_indexed_siblings_namespaces_padding_and_entities() {
    let input = "<configuration><appSettings><add key='A' value=\"1.10\"/><add key='B' value=\"02100\"/></appSettings><system.web><compilation debug='true'/></system.web></configuration>";
    edit(
        "xml",
        input,
        &["configuration", "appSettings", "add", "1", "@value"],
        "0401234567",
        &input.replace("02100", "0401234567"),
    );
    edit(
        "xml",
        input,
        &["configuration", "system.web", "compilation", "@debug"],
        "false",
        &input.replace("debug='true'", "debug='false'"),
    );
    edit(
        "xml",
        "<x:r xmlns:x='urn:x'><x:a>  v  </x:a></x:r>",
        &["x:r", "x:a"],
        "a' > & <",
        "<x:r xmlns:x='urn:x'><x:a>  a' > &amp; &lt;  </x:a></x:r>",
    );
    edit(
        "xml",
        "<r a='a &amp; b'>v</r>",
        &["r", "@a"],
        "a' > \"",
        "<r a='a&apos; > \"'>v</r>",
    );
}
#[test]
fn xml_empty_cdata_and_parent_safety() {
    edit(
        "xml",
        "<r><a></a><b/></r>",
        &["r", "a"],
        "v",
        "<r><a>v</a><b/></r>",
    );
    edit(
        "xml",
        "<r><a></a><b /></r>",
        &["r", "b"],
        "v",
        "<r><a></a><b >v</b></r>",
    );
    edit(
        "xml",
        "<r><![CDATA[a < b]]></r>",
        &["r"],
        "x]]>y",
        "<r><![CDATA[x]]]]><![CDATA[>y]]></r>",
    );
    assert!(update_native("xml", "<r>\n <a>v</a>\n</r>", &path(&["r"]), "bad").is_err());
    for input in [
        "<r><a></b></r>",
        "<r><x:a xmlns:x='u'></a></r>",
        "<r><a></r>",
    ] {
        assert!(XmlParser.validate_syntax(input).is_err());
        assert!(!crate::multi_validation::validate_xml_multi(input, 3).valid);
    }
}
#[test]
fn structural_array_edits_preserve_surrounding_bytes() {
    let input = "{\r\n  \"a\": [\r\n    1,\r\n    2\r\n  ], \"b\": 3\r\n}\r\n";
    let added = edit_array_native(input, &path(&["a"]), None, Some("true")).unwrap();
    assert_eq!(added, input.replace("    2\r\n", "    2,\r\n    true\r\n"));
    let removed = edit_array_native(&added, &path(&["a"]), Some(1), None).unwrap();
    assert_eq!(removed, input.replace("    2", "    true"));
    parse_native("json", &removed).unwrap();
    assert_eq!(
        edit_array_native("[1, 2, 3]", &[], Some(0), None).unwrap(),
        "[2, 3]"
    );
    assert_eq!(
        edit_array_native("[1, 2, 3]", &[], Some(2), None).unwrap(),
        "[1, 2]"
    );
}
#[test]
fn unicode_positions_are_characters_and_spans_are_bytes() {
    let index = crate::positions::LineIndex::new("äβ\r\n界x");
    assert_eq!(index.line_col(4), (1, 3));
    assert_eq!(index.line_col(9), (2, 2));
    assert_eq!(index.offset(2, 2), 9);
    assert_eq!(index.byte_offset(1, 3), 2);
}

#[test]
fn duplicate_json_keys_and_consecutive_cdata_edits() {
    edit(
        "json",
        r#"{"a":{"x":1},"a":{"x":2}}"#,
        &["a", "1", "x"],
        "3",
        r#"{"a":{"x":1},"a":{"x":3}}"#,
    );
    let once = update_native("xml", "<r><![CDATA[a]]></r>", &path(&["r"]), "x]]>y").unwrap();
    edit("xml", &once, &["r"], "new", "<r><![CDATA[new]]></r>");
}

#[test]
fn golden_files_match_byte_for_byte() {
    for (kind, input, expected, parts, value) in [
        (
            "json",
            include_str!("../fixtures/review-json.input"),
            include_str!("../fixtures/review-json.expected"),
            vec!["servers", "1", "port"],
            "5",
        ),
        (
            "env",
            include_str!("../fixtures/review-env.input"),
            include_str!("../fixtures/review-env.expected"),
            vec!["database.host"],
            "remote",
        ),
        (
            "xml",
            include_str!("../fixtures/review-xml.input"),
            include_str!("../fixtures/review-xml.expected"),
            vec!["configuration", "appSettings", "add", "1", "@value"],
            "0401234567",
        ),
    ] {
        edit(kind, input, &parts, value, expected);
    }
}
